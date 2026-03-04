import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InventoryStatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    gradient: string;
    loading?: boolean;
}

export const InventoryStatCard: React.FC<InventoryStatCardProps> = ({
    title,
    value,
    icon: Icon,
    gradient,
    loading
}) => {
    return (
        <div className={cn(
            "relative overflow-hidden rounded-2xl p-4 text-white shadow-lg",
            gradient
        )}>
            {/* Background Icon Decoration */}
            <div className="absolute -right-2 -bottom-2 opacity-10">
                <Icon size={80} />
            </div>

            <div className="relative z-10 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                        {title}
                    </span>
                    <div className="p-1.5 bg-white/20 rounded-lg">
                        <Icon size={16} />
                    </div>
                </div>

                <div className="mt-1">
                    {loading ? (
                        <div className="h-7 w-20 bg-white/20 animate-pulse rounded" />
                    ) : (
                        <span className="text-xl font-black tracking-tight">
                            {value}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
