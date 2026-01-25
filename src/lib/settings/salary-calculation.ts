import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export interface SalaryCalculationSettings {
    medicalAllowance: number;
    conveyanceAllowance: number;
    foodAllowance: number;
    updatedAt?: any;
    updatedBy?: string;
}

// Default values - fallback if no settings configured
export const DEFAULT_SALARY_SETTINGS: SalaryCalculationSettings = {
    medicalAllowance: 750,
    conveyanceAllowance: 450,
    foodAllowance: 1250,
};

/**
 * Fetches salary calculation settings from Firestore
 * Returns default values if not configured
 */
export async function getSalaryCalculationSettings(): Promise<SalaryCalculationSettings> {
    try {
        const settingsRef = doc(firestore, 'financial_settings', 'salary_calculation');
        const settingsSnap = await getDoc(settingsRef);

        if (settingsSnap.exists()) {
            const data = settingsSnap.data() as SalaryCalculationSettings;
            return {
                medicalAllowance: data.medicalAllowance ?? DEFAULT_SALARY_SETTINGS.medicalAllowance,
                conveyanceAllowance: data.conveyanceAllowance ?? DEFAULT_SALARY_SETTINGS.conveyanceAllowance,
                foodAllowance: data.foodAllowance ?? DEFAULT_SALARY_SETTINGS.foodAllowance,
                updatedAt: data.updatedAt,
                updatedBy: data.updatedBy,
            };
        }

        // No settings found, return defaults
        return DEFAULT_SALARY_SETTINGS;
    } catch (error) {
        console.error('Error fetching salary calculation settings:', error);
        // Return defaults on error
        return DEFAULT_SALARY_SETTINGS;
    }
}

/**
 * Updates salary calculation settings in Firestore
 */
export async function updateSalaryCalculationSettings(
    settings: Omit<SalaryCalculationSettings, 'updatedAt' | 'updatedBy'>,
    userId: string
): Promise<void> {
    const settingsRef = doc(firestore, 'financial_settings', 'salary_calculation');

    await setDoc(settingsRef, {
        ...settings,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
    });
}

/**
 * Resets salary calculation settings to defaults
 */
export async function resetSalaryCalculationSettings(userId: string): Promise<void> {
    await updateSalaryCalculationSettings(DEFAULT_SALARY_SETTINGS, userId);
}
