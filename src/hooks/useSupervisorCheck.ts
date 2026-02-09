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
        const privilegedRoles = ["Super Admin", "Admin", "HR", "Service", "DemoManager", "Accounts", "Commercial", "Viewer"];
        return userRole.some(role => privilegedRoles.includes(role));
    }, [userRole]);

    useEffect(() => {
        const fetchSupervisorInfo = async () => {
            if (!userEmail) return;

            try {
                // Fetch current user's employee record if it exists
                // Standardize on lowercase for search, but try original in case it was saved differently
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
                    // Admins see everyone, but we'll filter out privileged roles and self
                    const allEmployeesQuery = query(collection(firestore, 'employees'));
                    const allEmployeesSnapshot = await getDocs(allEmployeesQuery);

                    // Define which roles are filtered out from "My Team" view
                    // For Super Admins/Admins, we only filter out other Admins
                    // For other privileged roles, we filter out all privileged roles
                    const isRealAdmin = userRole?.some(r => ["Super Admin", "Admin"].includes(r));
                    const privilegedRolesList = ["Super Admin", "Admin", "HR", "Service", "DemoManager", "Accounts", "Commercial", "Viewer"];
                    const rolesToFilter = isRealAdmin ? ["Super Admin", "Admin"] : privilegedRolesList;

                    const privilegedUids = new Set<string>();
                    try {
                        const usersSnapshot = await getDocs(collection(firestore, 'users'));
                        usersSnapshot.docs.forEach(uDoc => {
                            const uData = uDoc.data();
                            const roles = uData.role;
                            const hasPrivilegedRole = Array.isArray(roles)
                                ? roles.some(r => rolesToFilter.includes(r))
                                : rolesToFilter.includes(roles);

                            if (hasPrivilegedRole) {
                                privilegedUids.add(uDoc.id); // Doc ID is the UID
                            }
                        });
                    } catch (err) {
                        // Permission errors here are expected for non-admins (e.g. users creating specialized dashboards)
                        // console.debug("Could not fetch users for team filtering (expected for non-admins):", err);
                    }

                    allEmployeesSnapshot.docs.forEach(doc => {
                        const data = doc.data() as EmployeeDocument;

                        // 1. Skip self (by doc ID or UID)
                        if (doc.id === employeeId || (user?.uid && (data.uid === user.uid || doc.id === user.uid))) {
                            return;
                        }

                        // 2. Skip by Role (from users collection)
                        if (data.uid && privilegedUids.has(data.uid)) return;
                        if (privilegedUids.has(doc.id)) return;

                        // 3. Skip by Designation (fallback proxy)
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

                    // Also calculate explicit subordinates for admins (reporting-line based)
                    const explicitSubordinates: SupervisedEmployee[] = [];
                    const supervisorIdCandidates = Array.from(new Set([employeeId, user?.uid].filter((id): id is string => !!id)));

                    allEmployeesSnapshot.docs.forEach(doc => {
                        const data = doc.data() as any;
                        const isExplicit = (
                            supervisorIdCandidates.includes(data.supervisorId) ||
                            supervisorIdCandidates.includes(data.leaveApproverId) ||
                            supervisorIdCandidates.includes(data.directSupervisorId) ||
                            supervisorIdCandidates.includes(data.supervisor) ||
                            supervisorIdCandidates.includes(data.supervision) ||
                            supervisorIdCandidates.includes(data['Direct supervision']) ||
                            (Array.isArray(data.supervisors) && data.supervisors.some((sup: any) => supervisorIdCandidates.includes(sup.supervisorId)))
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
                    });

                    setInfo({
                        isSupervisor: true,
                        supervisedEmployees,
                        explicitSubordinates,
                        supervisedEmployeeIds: subordinateIds,
                        explicitSubordinateIds: explicitSubordinates.map(e => e.id),
                        currentEmployeeId: employeeId,
                        isLoading: false
                    });
                    return;
                }

                if (employeeId) {
                    const supervisorIdCandidates = Array.from(new Set([employeeId, user?.uid].filter((id): id is string => !!id)));
                    const subordinatesMap = new Map<string, EmployeeDocument>();

                    // Helper to process snapshots
                    const processSnapshot = (snap: any) => {
                        snap.docs.forEach((doc: any) => {
                            if (!subordinatesMap.has(doc.id)) {
                                subordinatesMap.set(doc.id, { id: doc.id, ...doc.data() } as EmployeeDocument);
                            }
                        });
                    };

                    // 1. Fetch by supervisorId
                    const subordinatesQuery = query(
                        collection(firestore, 'employees'),
                        where('supervisorId', 'in', supervisorIdCandidates)
                    );
                    const subordinatesSnapshot = await getDocs(subordinatesQuery);
                    processSnapshot(subordinatesSnapshot);

                    // 2. Fetch by leaveApproverId
                    const leaveApproverQuery = query(
                        collection(firestore, 'employees'),
                        where('leaveApproverId', 'in', supervisorIdCandidates)
                    );
                    const leaveApproverSnapshot = await getDocs(leaveApproverQuery);
                    processSnapshot(leaveApproverSnapshot);

                    // 3. Fetch by directSupervisorId
                    const directSupQuery = query(
                        collection(firestore, 'employees'),
                        where('directSupervisorId', 'in', supervisorIdCandidates)
                    );
                    const directSupSnapshot = await getDocs(directSupQuery);
                    processSnapshot(directSupSnapshot);

                    // 4. Fetch by 'supervisor'
                    const supervisorFieldQuery = query(
                        collection(firestore, 'employees'),
                        where('supervisor', 'in', supervisorIdCandidates)
                    );
                    const supervisorFieldSnapshot = await getDocs(supervisorFieldQuery);
                    processSnapshot(supervisorFieldSnapshot);

                    // 5. Fetch by 'supervision'
                    const supervisionFieldQuery = query(
                        collection(firestore, 'employees'),
                        where('supervision', 'in', supervisorIdCandidates)
                    );
                    const supervisionFieldSnapshot = await getDocs(supervisionFieldQuery);
                    processSnapshot(supervisionFieldSnapshot);

                    // 6. Fetch by 'Direct supervision'
                    const directSupervisionFieldQuery = query(
                        collection(firestore, 'employees'),
                        where('Direct supervision', 'in', supervisorIdCandidates)
                    );
                    const directSupervisionFieldSnapshot = await getDocs(directSupervisionFieldQuery);
                    processSnapshot(directSupervisionFieldSnapshot);

                    // 7. Check the supervisors array structure
                    // This still requires iterating potentially many docs, but we'll try it safely
                    try {
                        const allEmployeesQuery = query(collection(firestore, 'employees'));
                        const allEmployeesSnapshot = await getDocs(allEmployeesQuery);

                        allEmployeesSnapshot.docs.forEach(doc => {
                            const employee = doc.data() as any;
                            if (employee.supervisors && Array.isArray(employee.supervisors)) {
                                const isSupervisedByMe = employee.supervisors.some(
                                    (sup: any) => supervisorIdCandidates.includes(sup.supervisorId) && (sup.isLeaveApprover || sup.isSupervisor || sup.isDirectSupervisor)
                                );
                                if (isSupervisedByMe && !subordinatesMap.has(doc.id)) {
                                    subordinatesMap.set(doc.id, { id: doc.id, ...doc.data() } as EmployeeDocument);
                                }
                            }
                        });
                    } catch (e) {
                        // Ignore error if we can't fetch all employees; we rely on 1-6
                        // console.debug("Skipping deep supervisor check due to permissions/error");
                    }

                    subordinateIds = Array.from(subordinatesMap.keys());

                    // Map subordinates to objects with name/photo
                    const privilegedRolesList = ["Super Admin", "Admin", "HR", "Service", "DemoManager", "Accounts", "Commercial", "Viewer"];

                    subordinatesMap.forEach((data, id) => {
                        // 1. Skip self (just in case)
                        if (id === employeeId || (user?.uid && (data.uid === user.uid || id === user.uid))) {
                            return;
                        }

                        // 2. Skip by Designation (proxy for privileged roles)
                        if (data.designation && privilegedRolesList.includes(data.designation)) return;

                        supervisedEmployees.push({
                            id: id,
                            uid: data.uid,
                            name: data.fullName || 'Unknown',
                            fullName: data.fullName || 'Unknown',
                            employeeCode: data.employeeCode || 'N/A',
                            designation: data.designation || undefined,
                            photoURL: data.photoURL || undefined
                        });
                    });

                    setInfo({
                        isSupervisor: subordinateIds.length > 0,
                        supervisedEmployees: supervisedEmployees,
                        explicitSubordinates: supervisedEmployees,
                        supervisedEmployeeIds: subordinateIds,
                        explicitSubordinateIds: subordinateIds,
                        currentEmployeeId: employeeId,
                        isLoading: false
                    });
                } else {
                    setInfo(prev => ({ ...prev, isLoading: false }));
                }
            } catch (error) {
                console.error("Error fetching supervisor info:", error);
                setInfo(prev => ({ ...prev, isLoading: false }));
            }
        };

        fetchSupervisorInfo();
    }, [userEmail, isAdminRole, user?.uid]);

    return info;
}
