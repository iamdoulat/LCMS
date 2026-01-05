"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TaskForm } from '@/components/project-management/TaskForm';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';

export default function EditTaskPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [task, setTask] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTask = async () => {
            try {
                const docSnap = await getDoc(doc(firestore, 'project_tasks', id));
                if (docSnap.exists()) {
                    setTask({ id: docSnap.id, ...docSnap.data() });
                } else {
                    Swal.fire("Error", "Task not found.", "error");
                    router.push('/dashboard/project-management/tasks');
                }
            } catch (error) {
                console.error("Error fetching task:", error);
                Swal.fire("Error", "Failed to load task details.", "error");
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchTask();
        }
    }, [id, router]);

    if (loading) {
        return (
            <div className="h-[400px] flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Loading task data...</p>
            </div>
        );
    }

    return (
        <div className="p-6 pb-[120px] md:pb-6 max-w-4xl mx-auto space-y-6 bg-slate-50/50 min-h-screen">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit Task</h1>
                    <p className="text-muted-foreground">Modify details for task <span className="font-semibold text-slate-900">{task?.taskId}</span></p>
                </div>
            </div>

            <TaskForm initialData={task} docId={id} />
        </div>
    );
}
