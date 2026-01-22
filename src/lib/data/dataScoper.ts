import {
    collection,
    query,
    where,
    Query,
    DocumentData,
    orderBy,
    limit,
    Timestamp
} from 'firebase/firestore';
import { startOfMonth, subDays } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { Permissions } from '@/hooks/usePermissions';

export interface ScoperContext {
    uid: string;
    employeeId: string | null;
    supervisedEmployeeIds: string[];
}

export const dataScoper = {
    /**
     * Get attendance query based on permissions and context
     */
    getAttendanceQuery: (permissions: Permissions, context: ScoperContext): Query<DocumentData> => {
        const attendanceRef = collection(firestore, 'attendance');
        const ids = [context.uid];
        if (context.employeeId) ids.push(context.employeeId);

        // Remove duplicates
        const selfIds = Array.from(new Set(ids));

        const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

        if (permissions.canViewAllAttendance) {
            return query(
                attendanceRef,
                where('date', '>=', thirtyDaysAgo),
                orderBy('date', 'desc')
            );
        }

        if (permissions.canViewTeamAttendance && context.supervisedEmployeeIds.length > 0) {
            // Include self + team
            const allIds = Array.from(new Set([...selfIds, ...context.supervisedEmployeeIds]));
            return query(
                attendanceRef,
                where('employeeId', 'in', allIds.slice(0, 30)),
                where('date', '>=', thirtyDaysAgo),
                orderBy('date', 'desc')
            );
        }

        return query(
            attendanceRef,
            where('employeeId', 'in', selfIds),
            where('date', '>=', thirtyDaysAgo),
            orderBy('date', 'desc')
        );
    },

    /**
     * Get leave applications query based on permissions and context
     */
    getLeaveQuery: (permissions: Permissions, context: ScoperContext): Query<DocumentData> => {
        const leaveRef = collection(firestore, 'leave_applications');
        const selfIds = [context.uid];
        if (context.employeeId) selfIds.push(context.employeeId);

        if (permissions.canViewAllLeaves) {
            return query(leaveRef, orderBy('createdAt', 'desc'));
        }

        if (permissions.canViewTeamLeaves && context.supervisedEmployeeIds.length > 0) {
            const allIds = Array.from(new Set([...selfIds, ...context.supervisedEmployeeIds]));
            return query(
                leaveRef,
                where('employeeId', 'in', allIds.slice(0, 30)),
                orderBy('createdAt', 'desc')
            );
        }

        return query(
            leaveRef,
            where('employeeId', 'in', selfIds),
            orderBy('createdAt', 'desc')
        );
    },

    /**
     * Get visit applications query based on permissions and context
     */
    getVisitQuery: (permissions: Permissions, context: ScoperContext): Query<DocumentData> => {
        const visitRef = collection(firestore, 'visit_applications');
        const selfIds = [context.uid];
        if (context.employeeId) selfIds.push(context.employeeId);

        if (permissions.canViewAllVisits) {
            return query(visitRef, orderBy('createdAt', 'desc'));
        }

        if (permissions.canViewTeamVisits && context.supervisedEmployeeIds.length > 0) {
            const allIds = Array.from(new Set([...selfIds, ...context.supervisedEmployeeIds]));
            return query(
                visitRef,
                where('employeeId', 'in', allIds.slice(0, 30)),
                orderBy('createdAt', 'desc')
            );
        }

        return query(
            visitRef,
            where('employeeId', 'in', selfIds),
            orderBy('createdAt', 'desc')
        );
    }
};
