import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, Building2, ChevronRight } from 'lucide-react';
import { RoleRibbon } from '@/components/ui/RoleBadge';
import { useRouter } from 'next/navigation';

interface EmployeeCardProps {
    emp: any;
}

export const EmployeeCard = React.memo(({ emp }: EmployeeCardProps) => {
    const router = useRouter();

    return (
        <div
            onClick={() => router.push(`/mobile/profile/${emp.id}`)}
            className="bg-white p-4 rounded-2xl shadow-[0_4px_15px_rgba(0,0,0,0.05)] border border-slate-100 flex items-center gap-4 active:scale-[0.98] transition-all relative overflow-hidden"
        >
            {/* Role Ribbon */}
            {emp.mergedRoles && emp.mergedRoles.length > 0 && <RoleRibbon roles={emp.mergedRoles} />}

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
    );
});

EmployeeCard.displayName = 'EmployeeCard';
