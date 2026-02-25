import { format, parseISO, isValid } from 'date-fns';
import type { AttendancePolicyDocument, EmployeeDocument } from '../types';

/**
 * Finds the active attendance policy for an employee on a given date based on their policy history.
 * @param employee The employee document
 * @param date The date to find the policy for
 * @param attendancePolicies All available attendance policies
 * @returns The active AttendancePolicyDocument or null
 */
export function getActivePolicyForDate(
    employee: EmployeeDocument,
    date: Date,
    attendancePolicies: AttendancePolicyDocument[]
): AttendancePolicyDocument | null {
    if (!attendancePolicies || attendancePolicies.length === 0) return null;

    const history = employee.policyHistory || [];
    const targetDateStr = format(date, 'yyyy-MM-dd');

    // If no history, we still need to check if the current policy globally applies based on its effectiveFrom
    if (history.length === 0) {
        const policy = attendancePolicies.find((p) => p.id === employee.attendancePolicyId);
        if (policy) {
            try {
                const policyEffectiveDate = format(parseISO(policy.effectiveFrom), 'yyyy-MM-dd');
                if (policyEffectiveDate <= targetDateStr) {
                    return policy;
                }
            } catch (err) {
                // Return if date parsing fails to be safe
                return policy;
            }
        }
        // If the only policy isn't effective yet, we don't have a fallback in history.
        // It's safer to either return null (so logic uses 'W' default / 09:00 default) or the policy itself.
        // Returning null allows page.tsx and other functions to know there's no active policy *yet*.
        return null;
    }

    // Sort history by effective date descending to find the closest previous or same-day assignment
    const sortedHistory = [...history].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

    const validAssignment = sortedHistory.find(h => {
        try {
            // 1. The assignment must have happened before or on the target date
            const assignmentEffectiveDate = format(parseISO(h.effectiveFrom), 'yyyy-MM-dd');
            if (assignmentEffectiveDate > targetDateStr) return false;

            // 2. The globally defined policy must ALSO be effective on or before the target date
            const policy = attendancePolicies.find((p) => p.id === h.policyId);
            if (!policy) return false;

            const policyEffectiveDate = format(parseISO(policy.effectiveFrom), 'yyyy-MM-dd');
            return policyEffectiveDate <= targetDateStr;
        } catch (err) {
            return false;
        }
    });

    if (validAssignment) {
        return attendancePolicies.find((p) => p.id === validAssignment.policyId) || null;
    }

    // Fallback: If no assignment matches (meaning the date is before any history started, or 
    // the currently assigned policies haven't globally started yet),
    // use the oldest assignment available, assuming we must have *some* policy.
    const firstAssignment = sortedHistory[sortedHistory.length - 1];
    return attendancePolicies.find((p) => p.id === (firstAssignment?.policyId || employee.attendancePolicyId)) || null;
}
