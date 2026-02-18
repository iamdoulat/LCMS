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

    // If no history, use the current attendancePolicyId
    if (history.length === 0) {
        return attendancePolicies.find((p) => p.id === employee.attendancePolicyId) || null;
    }

    // Sort history by effective date descending to find the closest previous or same-day assignment
    const sortedHistory = [...history].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

    const assignment = sortedHistory.find(h => {
        try {
            const effectiveDate = format(parseISO(h.effectiveFrom), 'yyyy-MM-dd');
            return effectiveDate <= targetDateStr;
        } catch (err) {
            return false;
        }
    });

    if (assignment) {
        return attendancePolicies.find((p) => p.id === assignment.policyId) || null;
    }

    // Fallback: If no assignment matches (meaning the date is before any history started), 
    // use the oldest assignment available or the current policy.
    const firstAssignment = sortedHistory[sortedHistory.length - 1];
    return attendancePolicies.find((p) => p.id === (firstAssignment?.policyId || employee.attendancePolicyId)) || null;
}
