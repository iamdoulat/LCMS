"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { firestore } from '@/lib/firebase/config';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import {
    ChevronLeft,
    Search,
    ChevronRight,
    Loader2,
    Phone,
    Mail,
    Building2,
    SearchX
} from 'lucide-react';
import type { Employee, UserDocumentForAdmin, UserRole } from '@/types';
import { RoleRibbon } from '@/components/ui/RoleBadge';

export default function MobileDirectoryPage() {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');

    const { data: employees, isLoading: isLoadingEmployees } = useFirestoreQuery<Employee[]>(
        query(collection(firestore, 'employees'), orderBy('fullName', 'asc')),
        undefined,
        ['employees_directory']
    );

    const { data: users, isLoading: isLoadingUsers } = useFirestoreQuery<UserDocumentForAdmin[]>(
        query(collection(firestore, "users")),
        undefined,
        ['users_for_directory_roles']
    );

    const isLoading = isLoadingEmployees || isLoadingUsers;

    const handleBack = () => {
        router.back();
    };

    const processedEmployees = React.useMemo(() => {
        if (!employees) return [];

        // Create a map of email to user data for quick role lookup
        const userRoleMap = new Map<string, UserRole[]>();
        if (users) {
            users.forEach(u => {
                if (u.email && u.role) {
                    const emailKey = u.email.toLowerCase().trim();
                    const roles = Array.isArray(u.role) ? u.role : [u.role];
                    userRoleMap.set(emailKey, roles);
                }
            });
        }

        return employees.map(emp => {
            // Merge roles from the user collection if available
            const emailKey = emp.email?.toLowerCase().trim();
            const userRoles = emailKey ? userRoleMap.get(emailKey) : undefined;

            // Combine employee.role and user.role, ensuring we don't have duplicates
            // Combine employee.role and user.role, ensuring we don't have duplicates
            const empRole = (emp as any).role;
            const empRolesArray = Array.isArray(empRole) ? empRole : (empRole ? [empRole] : []);

            const mergedRoles = Array.from(new Set([
                ...empRolesArray,
                ...(userRoles || [])
            ]));

            return {
                ...emp,
                mergedRoles
            };
        });
    }, [employees, users]);

    const filteredEmployees = processedEmployees.filter(emp =>
        emp.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.designation?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col min-h-screen bg-[#0a1e60]">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#0a1e60] flex flex-col px-4 pt-4 pb-6 text-white">
                <div className="flex items-center justify-between mb-6">
                    <Button variant="ghost" size="icon" onClick={handleBack} className="text-white hover:bg-white/10 -ml-2">
                        <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <h1 className="text-xl font-semibold">Employee Directory</h1>
                    <div className="w-10" /> {/* Spacer */}
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                        placeholder="Search by name, code or title..."
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50 pl-10 h-12 rounded-2xl focus-visible:ring-white/30"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </header>

            {/* Content Area */}
            <div className="flex-1 bg-slate-50 rounded-t-[2rem] px-4 pt-8 pb-[120px] min-h-[500px]">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center pt-20">
                        <Loader2 className="h-8 w-8 text-[#0a1e60] animate-spin mb-4" />
                        <p className="text-slate-500 font-medium">Loading Directory...</p>
                    </div>
                ) : filteredEmployees && filteredEmployees.length > 0 ? (
                    <div className="space-y-4">
                        <p className="text-xs font-bold text-slate-400 uppercase px-2 mb-2">
                            Total Employees ({filteredEmployees.length})
                        </p>
                        {filteredEmployees.map((emp) => (
                            <div
                                key={emp.id}
                                onClick={() => router.push(`/mobile/profile/${emp.id}`)}
                                className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 active:scale-[0.98] transition-all relative overflow-hidden"
                            >
                                {/* Role Ribbon */}
                                {emp.mergedRoles.length > 0 && <RoleRibbon roles={emp.mergedRoles} />}

                                <div className="h-14 w-14 rounded-full overflow-hidden border border-slate-100 bg-slate-50 flex-shrink-0">
                                    <Avatar className="h-full w-full">
                                        <AvatarImage src={emp.photoURL || undefined} className="object-cover" />
                                        <AvatarFallback className="text-lg font-bold text-slate-700 bg-slate-200">
                                            {emp.fullName?.charAt(0)}
                                        </AvatarFallback>
                                    </Avatar>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-[#0a1e60] truncate">{emp.fullName}</h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                                            {emp.employeeCode}
                                        </span>
                                        <span className="text-[11px] text-slate-400 font-medium truncate">
                                            {emp.designation}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-2 text-slate-400">
                                        {emp.phone && (
                                            <div className="flex items-center gap-1">
                                                <Phone className="h-3 w-3" />
                                                <span className="text-[10px]">{emp.phone}</span>
                                            </div>
                                        )}
                                        {emp.branch && (
                                            <div className="flex items-center gap-1">
                                                <Building2 className="h-3 w-3" />
                                                <span className="text-[10px] truncate">{emp.branch}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <ChevronRight className="h-5 w-5 text-slate-300 flex-shrink-0" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center pt-20 text-slate-400">
                        <div className="bg-slate-100 p-4 rounded-full mb-4">
                            <SearchX className="h-8 w-8" />
                        </div>
                        <p className="font-medium px-10 text-center">No employees found matching "{searchTerm}"</p>
                        <Button
                            variant="link"
                            className="text-[#3b82f6] mt-2"
                            onClick={() => setSearchTerm('')}
                        >
                            Clear Search
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
