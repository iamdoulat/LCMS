"use client";

import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types';

export interface Permissions {
    // Attendance
    canViewAllAttendance: boolean;
    canViewTeamAttendance: boolean;
    canViewSelfAttendance: boolean;
    canApproveAttendance: boolean;

    // Leaves
    canViewAllLeaves: boolean;
    canViewTeamLeaves: boolean;
    canViewSelfLeaves: boolean;
    canApproveLeaves: boolean;

    // Visits
    canViewAllVisits: boolean;
    canViewTeamVisits: boolean;
    canViewSelfVisits: boolean;
    canApproveVisits: boolean;

    // Claims
    canViewAllClaims: boolean;
    canViewTeamClaims: boolean;
    canViewSelfClaims: boolean;
    canApproveClaims: boolean;

    // Project Management
    canManageProjects: boolean;
    canViewAllProjects: boolean;

    // HR / Admin
    canManageEmployees: boolean;
    canManageSettings: boolean;
    canUpdateNoticeBoard: boolean;
}

export function usePermissions() {
    const { userRole } = useAuth();

    const permissions = useMemo((): Permissions => {
        const roles = userRole || [];

        const isAdmin = (roles as string[]).includes('Admin') || (roles as string[]).includes('Super Admin');
        const isHR = (roles as string[]).includes('HR');
        const isAccounts = (roles as string[]).includes('Accounts');
        // Removed explicit cast to string[] as UserRole should be compatible with string literals
        const isSupervisorRole = (roles as string[]).includes('Supervisor') || (roles as string[]).includes('Manager') || (roles as string[]).includes('DemoManager');

        // We also check if the user is a supervisor via useSupervisorCheck elsewhere, 
        // but role-based permissions are fixed here.

        return {
            // Attendance
            canViewAllAttendance: isAdmin || isHR,
            canViewTeamAttendance: isAdmin || isHR || isSupervisorRole,
            canViewSelfAttendance: true,
            canApproveAttendance: isAdmin || isHR || isSupervisorRole,

            // Leaves
            canViewAllLeaves: isAdmin || isHR,
            canViewTeamLeaves: isAdmin || isHR || isSupervisorRole,
            canViewSelfLeaves: true,
            canApproveLeaves: isAdmin || isHR || isSupervisorRole,

            // Visits
            canViewAllVisits: isAdmin || isHR,
            canViewTeamVisits: isAdmin || isHR || isSupervisorRole,
            canViewSelfVisits: true,
            canApproveVisits: isAdmin || isHR || isSupervisorRole,

            // Claims
            canViewAllClaims: isAdmin || isHR || isAccounts,
            canViewTeamClaims: isAdmin || isHR || isAccounts || isSupervisorRole,
            canViewSelfClaims: true,
            canApproveClaims: isAdmin || isHR || isAccounts,

            // Project Management
            canManageProjects: isAdmin || roles.includes('Service'),
            canViewAllProjects: isAdmin || roles.includes('Service') || roles.includes('Viewer'),

            // HR / Admin
            canManageEmployees: isAdmin || isHR,
            canManageSettings: isAdmin,
            canUpdateNoticeBoard: isAdmin || isHR,
        };
    }, [userRole]);

    return permissions;
}
