"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { BreakTimeRecord } from '@/types/breakTime';
import { MobileBreakTimeModal } from '@/components/mobile/MobileBreakTimeModal';

interface BreakTimeContextType {
    isOnBreak: boolean;
    activeBreakRecord: BreakTimeRecord | null;
    openBreakModal: () => void;
    closeBreakModal: () => void;
}

const BreakTimeContext = createContext<BreakTimeContextType>({
    isOnBreak: false,
    activeBreakRecord: null,
    openBreakModal: () => { },
    closeBreakModal: () => { },
});

export const useBreakTime = () => useContext(BreakTimeContext);

export function BreakTimeProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [isOnBreak, setIsOnBreak] = useState(false);
    const [activeBreakRecord, setActiveBreakRecord] = useState<BreakTimeRecord | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Real-time listener for active break
    useEffect(() => {
        if (!user?.email) return;

        // We need to resolve employee ID first if it differs from UID, 
        // but for now let's assume UID matches or we simply query by employeeId which usually is UID in this app.
        // Dashboard uses detailed resolution, but auth.uid is robust enough for now if we assume standard flow.
        // Actually, let's use the same logic as Dashboard if possible, or just rely on user.uid 
        // effectively linking to the employee record.

        const q = query(
            collection(firestore, 'break_time'),
            where('employeeId', '==', user.uid),
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
                // Do not auto-close here, user might want to see summary. 
                // But typically if they stop break, they close it manually.
                // However, if we want to "freeze" app, we should ensure modal is open if isOnBreak is true.
            }
        });

        return () => unsubscribe();
    }, [user]);

    const openBreakModal = () => setIsModalOpen(true);
    const closeBreakModal = () => {
        // Only allow closing if NOT on break
        if (!isOnBreak) {
            setIsModalOpen(false);
        }
    };

    return (
        <BreakTimeContext.Provider value={{ isOnBreak, activeBreakRecord, openBreakModal, closeBreakModal }}>
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
