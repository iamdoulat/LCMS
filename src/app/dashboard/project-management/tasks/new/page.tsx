"use client";

import React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TaskForm } from '@/components/project-management/TaskForm';

export default function AddNewTaskPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialStatus = searchParams.get('status') || 'Pending';

    return (
        <div className="p-6 pb-[120px] md:pb-6 max-w-4xl mx-auto space-y-6 bg-slate-50/50 min-h-screen">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create New Task</h1>
                    <p className="text-muted-foreground">Add a new task to a project and assign team members.</p>
                </div>
            </div>

            <TaskForm initialStatus={initialStatus} />
        </div>
    );
}
