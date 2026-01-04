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
    supervisedEmployeeIds: string[];
    currentEmployeeId: string | null;
}

export function useSupervisorCheck(userEmail: string | null | undefined): SupervisorInfo {
    const { userRole, user } = useAuth();
    const [info, setInfo] = useState<SupervisorInfo>({
        isSupervisor: false,
        supervisedEmployees: [],
        supervisedEmployeeIds: [],
        currentEmployeeId: null
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

                    // Fetch privileged users to filter them out of "My Team"
                    // This creates a cleaner view focused on operational staff
                    const privilegedUids = new Set<string>();
                    const privilegedRolesList = ["Super Admin", "Admin", "HR", "Service", "DemoManager", "Accounts", "Commercial", "Viewer"];
                    try {
                        const usersSnapshot = await getDocs(collection(firestore, 'users'));
                        usersSnapshot.docs.forEach(uDoc => {
                            const uData = uDoc.data();
                            const roles = uData.role;
                            const hasPrivilegedRole = Array.isArray(roles)
                                ? roles.some(r => privilegedRolesList.includes(r))
                                : privilegedRolesList.includes(roles);

                            if (hasPrivilegedRole) {
                                privilegedUids.add(uDoc.id); // Doc ID is the UID
                            }
                        });
                    } catch (err) {
                        console.warn("Could not fetch users for team filtering:", err);
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
                        if (data.designation && privilegedRolesList.includes(data.designation)) return;

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

                    setInfo({
                        isSupervisor: true,
                        supervisedEmployees,
                        supervisedEmployeeIds: subordinateIds,
                        currentEmployeeId: employeeId
                    });
                    return;
                }

                if (employeeId) {
                    // Standard supervisor logic based on supervisorId/leaveApproverId
                    // Check if this employee is a supervisor by querying for subordinates
                    const subordinatesQuery = query(
                        collection(firestore, 'employees'),
                        where('supervisorId', '==', employeeId)
                    );
                    const subordinatesSnapshot = await getDocs(subordinatesQuery);
                    subordinateIds = subordinatesSnapshot.docs.map(doc => doc.id);

                    // Also check for leaveApproverId
                    const leaveApproverQuery = query(
                        collection(firestore, 'employees'),
                        where('leaveApproverId', '==', employeeId)
                    );
                    const leaveApproverSnapshot = await getDocs(leaveApproverQuery);
                    leaveApproverSnapshot.docs.forEach(doc => {
                        if (!subordinateIds.includes(doc.id)) {
                            subordinateIds.push(doc.id);
                        }
                    });

                    // Also check the new supervisors array structure
                    const allEmployeesQuery = query(collection(firestore, 'employees'));
                    const allEmployeesSnapshot = await getDocs(allEmployeesQuery);

                    allEmployeesSnapshot.docs.forEach(doc => {
                        const employee = doc.data() as EmployeeDocument;
                        if (employee.supervisors) {
                            const hasAsPrivileged = employee.supervisors.some(
                                sup => sup.supervisorId === employeeId && (sup.isLeaveApprover || sup.isSupervisor || sup.isDirectSupervisor)
                            );
                            if (hasAsPrivileged && !subordinateIds.includes(doc.id)) {
                                subordinateIds.push(doc.id);
                            }
                        }
                    });

                    // Map subordinates to objects with name/photo
                    const privilegedRolesList = ["Super Admin", "Admin", "HR", "Service", "DemoManager", "Accounts", "Commercial", "Viewer"];
                    allEmployeesSnapshot.docs.forEach(doc => {
                        if (subordinateIds.includes(doc.id)) {
                            const data = doc.data() as EmployeeDocument;

                            // 1. Skip self (just in case)
                            if (doc.id === employeeId || (user?.uid && (data.uid === user.uid || doc.id === user.uid))) {
                                return;
                            }

                            // 2. Skip by Designation (proxy for privileged roles)
                            if (data.designation && privilegedRolesList.includes(data.designation)) return;

                            supervisedEmployees.push({
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
                        isSupervisor: subordinateIds.length > 0,
                        supervisedEmployees: supervisedEmployees,
                        supervisedEmployeeIds: subordinateIds,
                        currentEmployeeId: employeeId
                    });
                }
            } catch (error) {
                console.error("Error fetching supervisor info:", error);
            }
        };

        fetchSupervisorInfo();
    }, [userEmail, isAdminRole, user?.uid]);

    return info;
}
