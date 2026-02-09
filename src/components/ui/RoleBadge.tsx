import React from 'react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

interface RoleBadgeProps {
    role?: UserRole;
    roles?: UserRole[];
    size?: 'xs' | 'sm' | 'md';
    className?: string;
}

const roleStyles: Record<UserRole, { bg: string; text: string; border: string }> = {
    'Super Admin': {
        bg: 'bg-gradient-to-r from-red-500 to-red-600',
        text: 'text-white',
        border: 'border-red-300'
    },
    'Admin': {
        bg: 'bg-gradient-to-r from-orange-500 to-orange-600',
        text: 'text-white',
        border: 'border-orange-300'
    },
    'HR': {
        bg: 'bg-gradient-to-r from-green-500 to-green-600',
        text: 'text-white',
        border: 'border-green-300'
    },
    'Employee': {
        bg: 'bg-gradient-to-r from-blue-500 to-blue-600',
        text: 'text-white',
        border: 'border-blue-300'
    },
    'Service': {
        bg: 'bg-gradient-to-r from-purple-500 to-purple-600',
        text: 'text-white',
        border: 'border-purple-300'
    },
    'DemoManager': {
        bg: 'bg-gradient-to-r from-yellow-500 to-yellow-600',
        text: 'text-white',
        border: 'border-yellow-300'
    },
    'Accounts': {
        bg: 'bg-gradient-to-r from-amber-600 to-amber-700',
        text: 'text-white',
        border: 'border-amber-300'
    },
    'Commercial': {
        bg: 'bg-gradient-to-r from-cyan-500 to-cyan-600',
        text: 'text-white',
        border: 'border-cyan-300'
    },
    'Viewer': {
        bg: 'bg-gradient-to-r from-gray-400 to-gray-500',
        text: 'text-white',
        border: 'border-gray-300'
    },
    'User': {
        bg: 'bg-gradient-to-r from-sky-400 to-sky-500',
        text: 'text-white',
        border: 'border-sky-300'
    },
    'Supervisor': {
        bg: 'bg-gradient-to-r from-indigo-500 to-indigo-600',
        text: 'text-white',
        border: 'border-indigo-300'
    }
};

const sizeStyles = {
    xs: 'px-1.5 py-0.5 text-[9px] rounded',
    sm: 'px-2 py-0.5 text-[10px] rounded-md',
    md: 'px-2.5 py-1 text-xs rounded-md'
};

// Helper to normalize role names for style lookup
const getNormalizedRole = (r: any): UserRole => {
    if (typeof r !== 'string') return 'User';
    const found = Object.keys(roleStyles).find(
        key => key.toLowerCase() === r.toLowerCase()
    );
    return (found as UserRole) || 'User';
};

export function RoleBadge({ role, roles, size = 'sm', className }: RoleBadgeProps) {
    // Collect all candidate roles from both 'role' and 'roles' props
    const rawRoles: any[] = [];
    if (role) rawRoles.push(role);
    if (roles) {
        if (Array.isArray(roles)) rawRoles.push(...roles);
        else rawRoles.push(roles);
    }

    // Normalize case-insensitivity and remove duplicates
    const rolesToDisplay = Array.from(new Set(rawRoles.map(getNormalizedRole)));

    if (rolesToDisplay.length === 0) return null;

    return (
        <div className={cn("flex flex-wrap gap-1", className)}>
            {rolesToDisplay.map((r) => {
                const style = roleStyles[r];
                return (
                    <span
                        key={r}
                        className={cn(
                            style.bg,
                            style.text,
                            sizeStyles[size],
                            'font-semibold inline-flex items-center shadow-sm border',
                            style.border,
                            'transition-transform hover:scale-105'
                        )}
                        title={`Role: ${r}`}
                    >
                        {r}
                    </span>
                );
            })}
        </div>
    );
}

export function RoleRibbon({ role, roles, className }: RoleBadgeProps) {
    // Collect all candidate roles
    const rawRoles: any[] = [];
    if (role) rawRoles.push(role);
    if (roles) {
        if (Array.isArray(roles)) rawRoles.push(...roles);
        else rawRoles.push(roles);
    }

    if (rawRoles.length === 0) return null;

    // Use normalized primary role
    const primaryRole = getNormalizedRole(rawRoles[0]);
    const style = roleStyles[primaryRole];

    return (
        <div className={cn(
            "absolute -top-[1px] -left-[1px] w-20 h-20 overflow-hidden z-[70] pointer-events-none",
            className
        )}>
            <div className={cn(
                "absolute top-4 -left-8 w-28 py-1 text-[8px] font-black text-center uppercase tracking-wider -rotate-45 shadow-lg border-b border-white/20",
                style.bg,
                style.text,
            )}>
                {primaryRole}
            </div>
        </div>
    );
}
