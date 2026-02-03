"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { BreakTimeRecord } from '@/types/breakTime';
import { MobileBreakTimeModal } from '@/components/mobile/MobileBreakTimeModal';

interface BreakTimeContextType {
    isOnBreak: boolean;
    activeBreakRecord: BreakTimeRecord | null;
    employeeId: string | null;
    openBreakModal: () => void;
    closeBreakModal: () => void;
}

const BreakTimeContext = createContext<BreakTimeContextType>({
    isOnBreak: false,
    activeBreakRecord: null,
    employeeId: null,
    openBreakModal: () => { },
    closeBreakModal: () => { },
});

export const useBreakTime = () => useContext(BreakTimeContext);

export function BreakTimeProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [employeeId, setEmployeeId] = useState<string | null>(null);
    const [isOnBreak, setIsOnBreak] = useState(false);
    const [activeBreakRecord, setActiveBreakRecord] = useState<BreakTimeRecord | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Resolve Correct Employee ID
    useEffect(() => {
        if (!user?.email) {
            setEmployeeId(user?.uid || null);
            return;
        }

        const resolveId = async () => {
            try {
                // Try email-based resolution (standard in this app)
                const emailToLower = user.email!.toLowerCase().trim();
                const q = query(collection(firestore, 'employees'), where('email', '==', emailToLower));
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    setEmployeeId(snapshot.docs[0].id);
                } else {
                    // Fallback to UID if email doesn't match
                    setEmployeeId(user.uid);
                }
            } catch (err) {
                console.error("Error resolving employeeId in BreakTimeContext:", err);
                setEmployeeId(user.uid);
            }
        };

        resolveId();
    }, [user?.email, user?.uid]);

    // Real-time listener for active break
    useEffect(() => {
        if (!employeeId) return;

        const q = query(
            collection(firestore, 'break_time'),
            where('employeeId', '==', employeeId),
            where('onBreak', '==', true)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                setActiveBreakRecord({ id: doc.id, ...doc.data() } as BreakTimeRecord);
                setIsOnBreak(true);
                // Force modal open if on break
                setIsModalOpen(true);
            } else {
                setActiveBreakRecord(null);
                setIsOnBreak(false);
            }
        });

        return () => unsubscribe();
    }, [employeeId]);

    const openBreakModal = () => setIsModalOpen(true);
    const closeBreakModal = () => {
        // Only allow closing if NOT on break
        if (!isOnBreak) {
            setIsModalOpen(false);
        }
    };

    return (
        <BreakTimeContext.Provider value={{ isOnBreak, activeBreakRecord, employeeId, openBreakModal, closeBreakModal }}>
            {children}

            {/* 
              Global Modal Instance 
              If isOnBreak is true, we force it open and prevent closing via the modal's internal logic 
              (which we'll update to respect a 'forceOpen' prop or similar).
            */}
            <MobileBreakTimeModal
                isOpen={isModalOpen}
                onClose={closeBreakModal}
                isFrozen={isOnBreak} // We'll add this prop
            />
        </BreakTimeContext.Provider>
    );
}
