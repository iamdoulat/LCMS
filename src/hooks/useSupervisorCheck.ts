import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { EmployeeDocument } from '@/types';

export interface SupervisorInfo {
    isSupervisor: boolean;
    supervisedEmployeeIds: string[];
    currentEmployeeId: string | null;
}

export function useSupervisorCheck(userEmail: string | null | undefined): SupervisorInfo {
    const [info, setInfo] = useState<SupervisorInfo>({
        isSupervisor: false,
        supervisedEmployeeIds: [],
        currentEmployeeId: null
    });

    useEffect(() => {
        const fetchSupervisorInfo = async () => {
            if (!userEmail) return;

            try {
                const q = query(collection(firestore, 'employees'), where('email', '==', userEmail));
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    const empDoc = snapshot.docs[0];
                    const employeeId = empDoc.id;

                    // Check if this employee is a supervisor by querying for subordinates
                    const subordinatesQuery = query(
                        collection(firestore, 'employees'),
                        where('supervisorId', '==', employeeId)
                    );
                    const subordinatesSnapshot = await getDocs(subordinatesQuery);
                    const subordinateIds = subordinatesSnapshot.docs.map(doc => doc.id);

                    // Also check the new supervisors array structure
                    const allEmployeesQuery = query(collection(firestore, 'employees'));
                    const allEmployeesSnapshot = await getDocs(allEmployeesQuery);

                    allEmployeesSnapshot.docs.forEach(doc => {
                        const employee = doc.data() as EmployeeDocument;
                        if (employee.supervisors) {
                            const hasAsLeaveApprover = employee.supervisors.some(
                                sup => sup.supervisorId === employeeId && (sup.isLeaveApprover || sup.isSupervisor || sup.isDirectSupervisor)
                            );
                            if (hasAsLeaveApprover && !subordinateIds.includes(doc.id)) {
                                subordinateIds.push(doc.id);
                            }
                        }
                    });

                    setInfo({
                        isSupervisor: subordinateIds.length > 0,
                        supervisedEmployeeIds: subordinateIds,
                        currentEmployeeId: employeeId
                    });
                }
            } catch (error) {
                console.error("Error fetching supervisor info:", error);
            }
        };

        fetchSupervisorInfo();
    }, [userEmail]);

    return info;
}
