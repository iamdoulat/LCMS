"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectForm } from '@/components/project-management/ProjectForm';

export default function AddProjectPage() {
    const router = useRouter();

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6 bg-slate-50/50 min-h-screen">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Add New Project</h1>
                    <p className="text-muted-foreground">Create a new project with all details.</p>
                </div>
            </div>

            <ProjectForm />
        </div>
    );
}
