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
    ArrowLeft,
    Search,
    ChevronRight,
    Loader2,
    Phone,
    Mail,
    Building2,
    SearchX
} from 'lucide-react';
import type { Employee, UserDocumentForAdmin, UserRole } from '@/types';
import { EmployeeCard } from '@/components/mobile/EmployeeCard';
import { DirectorySkeleton } from '@/components/mobile/DirectorySkeleton';

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
            const emailKey = emp.email?.toLowerCase().trim();
            const userRoles = emailKey ? userRoleMap.get(emailKey) : undefined;

            const empRole = (emp as any).role;
            const empRolesArray = Array.isArray(empRole) ? empRole : (empRole ? [empRole] : []);

            // Use a Set to merge roles efficiently
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

    // Use a separate memo for filtered results to prevent re-calculating on every render
    const filteredEmployees = React.useMemo(() => {
        const search = searchTerm.toLowerCase();
        return processedEmployees.filter(emp =>
            emp.fullName?.toLowerCase().includes(search) ||
            emp.employeeCode?.toLowerCase().includes(search) ||
            emp.designation?.toLowerCase().includes(search)
        );
    }, [processedEmployees, searchTerm]);

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#0a1e60] flex flex-col px-4 pt-[15px] pb-4 text-white">
                <div className="flex items-center justify-between mb-4">
                    <Button variant="ghost" size="icon" onClick={handleBack} className="rounded-full bg-white/10 hover:bg-white/20 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)] h-10 w-10 p-0 flex items-center justify-center -ml-1">
                        <ArrowLeft className="h-9 w-9" />
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
            <div className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-hidden relative">
                <div className="h-full overflow-y-auto px-4 pt-8 pb-[120px]">
                    {isLoading ? (
                        <DirectorySkeleton />
                    ) : filteredEmployees && filteredEmployees.length > 0 ? (
                        <div className="space-y-4">
                            <p className="text-xs font-bold text-slate-400 uppercase px-2 mb-2">
                                Total Employees ({filteredEmployees.length})
                            </p>
                            {filteredEmployees.map((emp) => (
                                <EmployeeCard key={emp.id} emp={emp} />
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
        </div>
    );
}
