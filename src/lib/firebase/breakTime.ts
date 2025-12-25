import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    serverTimestamp,
    onSnapshot,
    Timestamp,
    orderBy
} from 'firebase/firestore';
import { firestore } from './config';
import { BreakTimeRecord, BreakStatus } from '@/types/breakTime';
import { format, parse, isWithinInterval, set } from 'date-fns';

const BREAK_COLLECTION = 'break_time';

export const getDailyBreakMinutes = async (employeeId: string, dateStr: string): Promise<number> => {
    try {
        const q = query(
            collection(firestore, BREAK_COLLECTION),
            where('employeeId', '==', employeeId),
            where('date', '==', dateStr)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.reduce((sum, doc) => {
            const data = doc.data();
            // Only count non-rejected breaks that have ended
            if (data.status === 'rejected') return sum;
            return sum + (data.durationMinutes || 0);
        }, 0);
    } catch (error) {
        console.error('Error fetching daily break minutes:', error);
        return 0;
    }
};

export const startBreak = async (
    employeeData: { id: string; fullName: string; employeeCode: string; designation: string },
    location?: { latitude: number; longitude: number; address?: string }
) => {
    try {
        const now = new Date();
        const todayDate = format(now, 'yyyy-MM-dd');

        const autoBreakStart = set(now, { hours: 13, minutes: 0, seconds: 0, milliseconds: 0 });
        const autoBreakEnd = set(now, { hours: 14, minutes: 0, seconds: 0, milliseconds: 0 });

        const isAutoApproved = isWithinInterval(now, { start: autoBreakStart, end: autoBreakEnd });
        const status: BreakStatus = isAutoApproved ? 'auto-approved' : 'pending';

        const record: Omit<BreakTimeRecord, 'id'> = {
            employeeId: employeeData.id,
            employeeName: employeeData.fullName,
            employeeCode: employeeData.employeeCode,
            designation: employeeData.designation,
            date: todayDate,
            startTime: now.toISOString(),
            status,
            isAutoApproved,
            onBreak: true,
            ...(location && { locationStart: location }),
            createdAt: serverTimestamp() as Timestamp,
            updatedAt: serverTimestamp() as Timestamp,
        };

        const docRef = await addDoc(collection(firestore, BREAK_COLLECTION), record);
        return docRef.id;
    } catch (error) {
        console.error('Error starting break:', error);
        throw error;
    }
};

export const stopBreak = async (
    breakId: string,
    location?: { latitude: number; longitude: number; address?: string }
) => {
    try {
        const breakRef = doc(firestore, BREAK_COLLECTION, breakId);
        const now = new Date();
        const { getDoc } = await import('firebase/firestore');
        const breakDoc = await getDoc(breakRef);

        if (!breakDoc.exists()) throw new Error('Break record not found');

        const startTime = new Date(breakDoc.data().startTime);
        const durationMinutes = Math.round((now.getTime() - startTime.getTime()) / 60000);

        const updates: any = {
            endTime: now.toISOString(),
            durationMinutes,
            onBreak: false,
            ...(location && { locationEnd: location }),
            updatedAt: serverTimestamp()
        };

        await updateDoc(breakRef, updates);
    } catch (error) {
        console.error('Error stopping break:', error);
        throw error;
    }
};

export const getOnBreakEmployeesSubscription = (callback: (records: BreakTimeRecord[]) => void) => {
    const q = query(
        collection(firestore, BREAK_COLLECTION),
        where('onBreak', '==', true)
    );

    return onSnapshot(q, (snapshot) => {
        const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BreakTimeRecord));
        callback(records);
    });
};

export const getPendingBreakReconciliations = async (): Promise<BreakTimeRecord[]> => {
    try {
        const q = query(
            collection(firestore, BREAK_COLLECTION),
            where('status', '==', 'pending'),
            orderBy('startTime', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BreakTimeRecord));
    } catch (error) {
        console.error("Error fetching pending break reconciliations:", error);
        return [];
    }
};

export const getAllBreakRecords = async (status?: string): Promise<BreakTimeRecord[]> => {
    try {
        let q = query(collection(firestore, BREAK_COLLECTION), orderBy('startTime', 'desc'));
        if (status && status !== 'all') {
            q = query(collection(firestore, BREAK_COLLECTION), where('status', '==', status), orderBy('startTime', 'desc'));
        }
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BreakTimeRecord));
    } catch (error) {
        console.error("Error fetching all break records:", error);
        return [];
    }
};

export const approveBreakRecord = async (breakId: string, reviewerId: string) => {
    const breakRef = doc(firestore, BREAK_COLLECTION, breakId);
    await updateDoc(breakRef, {
        status: 'approved',
        reviewedBy: reviewerId,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
};

export const rejectBreakRecord = async (breakId: string, reviewerId: string, comments?: string) => {
    const breakRef = doc(firestore, BREAK_COLLECTION, breakId);
    await updateDoc(breakRef, {
        status: 'rejected',
        reviewedBy: reviewerId,
        reviewedAt: serverTimestamp(),
        reviewComments: comments,
        updatedAt: serverTimestamp()
    });
};
