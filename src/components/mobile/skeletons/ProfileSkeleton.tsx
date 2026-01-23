import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Smartphone, Mail, Phone } from "lucide-react";

export const ProfileSkeleton = () => {
    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Header stays static but can be rendered immediately in the page */}
            <header className="sticky top-0 z-50 bg-[#0a1e60] flex items-center gap-4 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] min-h-[calc(4rem+env(safe-area-inset-top))] text-white overflow-hidden shadow-sm">
                <div className="p-1 rounded-full bg-white/5 mt-1">
                    <ChevronLeft className="w-7 h-7 opacity-20" />
                </div>
                <Skeleton className="h-6 w-24 bg-white/10 mt-1" />
            </header>

            {/* Main Content Container Skeleton */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] px-6 pt-12 pb-24 relative mt-10">

                {/* Profile Header Avatar Skeleton */}
                <div className="absolute -top-12 left-6 z-[60] translate-y-[10px]">
                    <Skeleton className="h-24 w-24 rounded-full border-4 border-white shadow-md bg-slate-200" />
                </div>

                {/* Contact Actions Skeleton */}
                <div className="absolute top-6 right-6 flex gap-2">
                    <div className="bg-white rounded-2xl h-11 w-11 shadow-sm flex items-center justify-center">
                        <Skeleton className="h-5 w-5 rounded-full" />
                    </div>
                    <div className="bg-white rounded-2xl h-11 w-11 shadow-sm flex items-center justify-center">
                        <Skeleton className="h-5 w-5 rounded-full" />
                    </div>
                    <div className="bg-white rounded-2xl h-11 w-11 shadow-sm flex items-center justify-center">
                        <Skeleton className="h-5 w-5 rounded-full" />
                    </div>
                </div>

                {/* Name & Title Skeleton */}
                <div className="mt-16 mb-8 space-y-2">
                    <Skeleton className="h-7 w-3/4 bg-slate-200" />
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-1/3 bg-slate-200" />
                        <Skeleton className="h-5 w-16 bg-purple-100" />
                    </div>
                </div>

                {/* Tabs Skeleton */}
                <div className="flex gap-3 mb-6 overflow-hidden">
                    <Skeleton className="h-12 w-32 rounded-xl bg-white" />
                    <Skeleton className="h-12 w-32 rounded-xl bg-white" />
                    <Skeleton className="h-12 w-32 rounded-xl bg-white" />
                </div>

                {/* Info Card Skeleton */}
                <div className="bg-white rounded-3xl p-6 shadow-md space-y-6">
                    <div className="flex items-center justify-between mb-2">
                        <Skeleton className="h-6 w-40 bg-slate-100" />
                        <div className="h-1 w-12 bg-slate-100 rounded-full" />
                    </div>

                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4">
                            <Skeleton className="h-12 w-12 rounded-2xl bg-slate-50" />
                            <div className="flex-1 space-y-1.5">
                                <Skeleton className="h-3 w-20 bg-slate-50" />
                                <Skeleton className="h-5 w-1/2 bg-slate-50" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
