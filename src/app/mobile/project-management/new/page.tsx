"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { TaskForm } from '@/components/project-management/TaskForm';

export default function MobileNewTaskPage() {
    const router = useRouter();

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60]">
            {/* Header */}
            <div className="px-6 pt-[5px] pb-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 text-white bg-white/10 rounded-full transition-all shadow-[0_4px_12px_rgba(37,99,235,0.2)]"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-white uppercase tracking-tight">Create Task</h1>
                        <p className="text-blue-100/60 text-[10px] font-bold uppercase tracking-widest mt-0.5">Project Management</p>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-white rounded-t-[2.5rem] overflow-y-auto no-scrollbar">
                <div className="p-6 pb-[120px]">
                    <TaskForm isMobile={true} backRoute="/mobile/project-management" />
                </div>
            </div>

            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}
