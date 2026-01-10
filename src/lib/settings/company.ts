import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';

export const getCompanyName = async (): Promise<string> => {
    try {
        if (typeof window === 'undefined') {
            const { admin } = await import('@/lib/firebase/admin');
            const docSnap = await admin.firestore().collection('financial_settings').doc('main_settings').get();
            if (docSnap.exists) {
                return docSnap.data()?.companyName || process.env.NEXT_PUBLIC_APP_NAME || 'Nextsew';
            }
        } else {
            const docSnap = await getDoc(doc(firestore, 'financial_settings', 'main_settings'));
            if (docSnap.exists()) {
                return docSnap.data()?.companyName || process.env.NEXT_PUBLIC_APP_NAME || 'Nextsew';
            }
        }
    } catch (error) {
        console.error("Error fetching company name:", error);
    }
    return process.env.NEXT_PUBLIC_APP_NAME || 'Nextsew';
};
