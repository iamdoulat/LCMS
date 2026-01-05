import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const DirectorySkeleton = () => {
    return (
        <div className="space-y-4">
            <div className="px-2 mb-2">
                <Skeleton className="h-4 w-32" />
            </div>
            {[...Array(6)].map((_, i) => (
                <div
                    key={i}
                    className="bg-white p-4 rounded-2xl shadow-[0_4px_15px_rgba(0,0,0,0.05)] border border-slate-100 flex items-center gap-4 relative overflow-hidden"
                >
                    <Skeleton className="h-14 w-14 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-3 w-24" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
