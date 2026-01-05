"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectForm } from '@/components/project-management/ProjectForm';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from '@/components/ui/use-toast';

export default function EditProjectPage() {
    const router = useRouter();
    const params = useParams();
    const projectId = params.id as string;

    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProject = async () => {
            try {
                const docSnap = await getDoc(doc(firestore, 'projects', projectId));
                if (docSnap.exists()) {
                    setProject({ id: docSnap.id, ...docSnap.data() });
                } else {
                    toast({
                        title: "Error",
                        description: "Project not found.",
                        variant: "destructive"
                    });
                    router.push('/dashboard/project-management/projects');
                }
            } catch (error) {
                console.error("Error fetching project:", error);
                toast({
                    title: "Error",
                    description: "Failed to load project details.",
                    variant: "destructive"
                });
            } finally {
                setLoading(false);
            }
        };

        if (projectId) {
            fetchProject();
        }
    }, [projectId, router]);

    if (loading) {
        return (
            <div className="h-[400px] flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Loading project data...</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6 bg-slate-50/50 min-h-screen">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit Project</h1>
                    <p className="text-muted-foreground mr-1">Modify details for <span className="font-semibold text-slate-900">{project?.projectTitle}</span></p>
                </div>
            </div>

            <ProjectForm initialData={project} docId={projectId} />
        </div>
    );
}
