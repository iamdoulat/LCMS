import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { EmployeeDocument } from '@/types';
import { useAuth } from '@/context/AuthContext';

export interface SupervisedEmployee {
    id: string;
    uid?: string;
    name: string;
    fullName: string;
    employeeCode: string;
    designation?: string;
    photoURL?: string;
}

export interface SupervisorInfo {
    isSupervisor: boolean;
    supervisedEmployees: SupervisedEmployee[];
    explicitSubordinates: SupervisedEmployee[]; // Always reporting-line based, even for admins
    supervisedEmployeeIds: string[];
    explicitSubordinateIds: string[]; // Always reporting-line based IDs
    currentEmployeeId: string | null;
    isLoading: boolean;
}

// Global cache for supervisor info to avoid re-fetching on every page mount
let supervisorCache = new Map<string, SupervisorInfo>();

export const clearSupervisorCache = () => {
    supervisorCache = new Map<string, SupervisorInfo>();
};

export function useSupervisorCheck(userEmail: string | null | undefined): SupervisorInfo {
    const { userRole, user } = useAuth();
    const [info, setInfo] = useState<SupervisorInfo>({
        isSupervisor: false,
        supervisedEmployees: [],
        explicitSubordinates: [],
        supervisedEmployeeIds: [],
        explicitSubordinateIds: [],
        currentEmployeeId: null,
        isLoading: true
    });

    const isAdminRole = useMemo(() => {
        if (!userRole) return false;
        const privilegedRoles = ["Super Admin", "Admin", "HR", "Service", "Accounts", "Commercial", "Viewer"];
        return userRole.some(role => privilegedRoles.includes(role));
    }, [userRole]);

    const hasSupervisorRole = useMemo(() => {
        if (!userRole) return false;
        return userRole.includes('Supervisor');
    }, [userRole]);

    useEffect(() => {
        const fetchSupervisorInfo = async () => {
            if (!userEmail) return;

            // Check cache first
            const cacheKey = `${userEmail}-${isAdminRole}`;
            if (supervisorCache.has(cacheKey)) {
                setInfo(supervisorCache.get(cacheKey)!);
                return;
            }

            try {
                // Fetch current user's employee record if it exists
                const emailToLower = userEmail.toLowerCase().trim();
                const qLower = query(collection(firestore, 'employees'), where('email', '==', emailToLower));
                const snapshotLower = await getDocs(qLower);

                let employeeId = null;
                if (!snapshotLower.empty) {
                    employeeId = snapshotLower.docs[0].id;
                } else {
                    const qOrig = query(collection(firestore, 'employees'), where('email', '==', userEmail.trim()));
                    const snapshotOrig = await getDocs(qOrig);
                    if (!snapshotOrig.empty) {
                        employeeId = snapshotOrig.docs[0].id;
                    } else {
                        employeeId = user?.uid || null;
                    }
                }

                let subordinateIds: string[] = [];
                let supervisedEmployees: SupervisedEmployee[] = [];

                if (isAdminRole) {
                    // For admins, we fetch all employees once. 
                    // This is acceptable as a baseline, but we parallelize it with the user roles fetch.
                    const allEmployeesQuery = query(collection(firestore, 'employees'));
                    
                    const [allEmployeesSnapshot, usersSnapshot] = await Promise.all([
                        getDocs(allEmployeesQuery),
                        getDocs(collection(firestore, 'users')).catch(() => ({ docs: [] } as any))
                    ]);

                    const rolesToFilter = ["Super Admin", "Admin"];
                    const privilegedUids = new Set<string>();
                    
                    if (usersSnapshot && usersSnapshot.docs) {
                        usersSnapshot.docs.forEach((uDoc: any) => {
                            const uData = uDoc.data();
                            const roles = uData.role;
                            const hasPrivilegedRole = Array.isArray(roles)
                                ? roles.some((r: any) => rolesToFilter.includes(r))
                                : rolesToFilter.includes(roles);

                            if (hasPrivilegedRole) privilegedUids.add(uDoc.id);
                        });
                    }

                    const explicitSubordinates: SupervisedEmployee[] = [];
                    const supervisorIdCandidates = Array.from(new Set([employeeId, user?.uid].filter((id): id is string => !!id)));

                    allEmployeesSnapshot.docs.forEach((doc: any) => {
                        const data = doc.data() as EmployeeDocument;

                        // Skip self
                        if (doc.id === employeeId || (user?.uid && (data.uid === user.uid || doc.id === user.uid))) return;

                        // Check reporting line first for explicit list
                        const isExplicit = (
                            supervisorIdCandidates.includes((data as any).supervisorId) ||
                            supervisorIdCandidates.includes((data as any).leaveApproverId) ||
                            supervisorIdCandidates.includes((data as any).directSupervisorId) ||
                            supervisorIdCandidates.includes((data as any).supervisor) ||
                            (Array.isArray((data as any).supervisors) && (data as any).supervisors.some((sup: any) => supervisorIdCandidates.includes(sup.supervisorId)))
                        );

                        if (isExplicit) {
                            explicitSubordinates.push({
                                id: doc.id,
                                uid: data.uid,
                                name: data.fullName || 'Unknown',
                                fullName: data.fullName || 'Unknown',
                                employeeCode: data.employeeCode || 'N/A',
                                designation: data.designation || undefined,
                                photoURL: data.photoURL || undefined
                            });
                        }

                        // Skip other admins for general list
                        if (data.uid && privilegedUids.has(data.uid)) return;
                        if (privilegedUids.has(doc.id)) return;
                        if (data.designation && rolesToFilter.includes(data.designation)) return;

                        subordinateIds.push(doc.id);
                        supervisedEmployees.push({
                            id: doc.id,
                            uid: data.uid,
                            name: data.fullName || 'Unknown',
                            fullName: data.fullName || 'Unknown',
                            employeeCode: data.employeeCode || 'N/A',
                            designation: data.designation || undefined,
                            photoURL: data.photoURL || undefined
                        });
                    });

                    const result: SupervisorInfo = {
                        isSupervisor: true,
                        supervisedEmployees,
                        explicitSubordinates,
                        supervisedEmployeeIds: subordinateIds,
                        explicitSubordinateIds: explicitSubordinates.map(e => e.id),
                        currentEmployeeId: employeeId,
                        isLoading: false
                    };
                    supervisorCache.set(cacheKey, result);
                    setInfo(result);
                    return;
                }

                if (employeeId) {
                    // --- Delegation Logic Start ---
                    // 1. Check if anyone has delegated their power TO this user
                    const delegationsToQuery = query(collection(firestore, 'supervision_delegations'), 
                        where('delegateId', '==', employeeId),
                        where('status', '==', 'active')
                    );
                    const delegationsToSnapshot = await getDocs(delegationsToQuery);
                    const delegatorIds = delegationsToSnapshot.docs.map(doc => doc.data().delegatorId);

                    // 2. Check if THIS user has delegated their power to someone else
                    const delegationsFromQuery = query(collection(firestore, 'supervision_delegations'),
                        where('delegatorId', '==', employeeId),
                        where('status', '==', 'active')
                    );
                    const delegationsFromSnapshot = await getDocs(delegationsFromQuery);
                    const isDelegatorActive = !delegationsFromSnapshot.empty;
                    // --- Delegation Logic End ---

                    const supervisorIdCandidates = Array.from(new Set([employeeId, user?.uid, ...delegatorIds].filter((id): id is string => !!id)));
                    const subordinatesMap = new Map<string, SupervisedEmployee>();

                    // Parallelize all direct reporting line queries
                    const queryFields = ['supervisorId', 'leaveApproverId', 'directSupervisorId', 'supervisor', 'supervision', 'Direct supervision'];
                    
                    const queryPromises = queryFields.map(field => 
                        getDocs(query(collection(firestore, 'employees'), where(field, 'in', supervisorIdCandidates)))
                    );

                    const snapshots = await Promise.all(queryPromises);
                    
                    snapshots.forEach(snap => {
                        snap.docs.forEach(doc => {
                            if (!subordinatesMap.has(doc.id)) {
                                const data = doc.data() as EmployeeDocument;
                                // Skip self if returned by any chance
                                if (doc.id === employeeId || (user?.uid && (data.uid === user.uid || doc.id === user.uid))) return;
                                
                                subordinatesMap.set(doc.id, {
                                    id: doc.id,
                                    uid: data.uid,
                                    name: data.fullName || 'Unknown',
                                    fullName: data.fullName || 'Unknown',
                                    employeeCode: data.employeeCode || 'N/A',
                                    designation: data.designation || undefined,
                                    photoURL: data.photoURL || undefined
                                });
                            }
                        });
                    });

                    const finalSupervised = isDelegatorActive && !isAdminRole ? [] : Array.from(subordinatesMap.values());
                    const finalIds = isDelegatorActive && !isAdminRole ? [] : Array.from(subordinatesMap.keys());

                    const result: SupervisorInfo = {
                        isSupervisor: hasSupervisorRole || finalIds.length > 0 || (isDelegatorActive && !isAdminRole),
                        supervisedEmployees: finalSupervised,
                        explicitSubordinates: finalSupervised,
                        supervisedEmployeeIds: finalIds,
                        explicitSubordinateIds: finalIds,
                        currentEmployeeId: employeeId,
                        isLoading: false
                    };
                    supervisorCache.set(cacheKey, result);
                    setInfo(result);
                } else {
                    const result: SupervisorInfo = {
                        ...info,
                        isSupervisor: hasSupervisorRole,
                        isLoading: false
                    };
                    setInfo(result);
                }
            } catch (error) {
                console.error("Error fetching supervisor info:", error);
                setInfo(prev => ({ ...prev, isLoading: false }));
            }
        };

        fetchSupervisorInfo();
    }, [userEmail, isAdminRole, user?.uid, hasSupervisorRole]);

    return info;
}
