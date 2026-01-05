"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { Project, Task } from '@/types/projectManagement';
import { format } from 'date-fns';
import {
    Calendar,
    ArrowLeft,
    Users,
    ListChecks,
    Clock,
    Building2,
    CheckCircle2,
    Briefcase,
    MoreVertical,
    Edit,
    Trash2,
    PieChart,
    AlertCircle,
    Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Swal from 'sweetalert2';
import { deleteDoc } from 'firebase/firestore';

export default function ProjectDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    const [project, setProject] = useState<Project | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!projectId) return;

        // Fetch Project
        const unsubProject = onSnapshot(doc(firestore, 'projects', projectId), (doc) => {
            if (doc.exists()) {
                setProject({ id: doc.id, ...doc.data() } as Project);
            } else {
                console.error("Project not found");
                // router.push('/dashboard/project-management/projects'); // Optional redirect
            }
            setLoading(false);
        });

        // Fetch Tasks for this Project
        const q = query(collection(firestore, 'project_tasks'), where('projectId', '==', projectId));
        const unsubTasks = onSnapshot(q, (snapshot) => {
            const tasksData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Task[];
            setTasks(tasksData);
        });

        return () => {
            unsubProject();
            unsubTasks();
        };
    }, [projectId]);

    if (loading) return <div className="p-8">Loading...</div>;
    if (!project) return <div className="p-8">Project not found</div>;

    const completedTasks = tasks.filter(t => t.status === 'Completed').length;
    const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

    // Stats for Overview
    const pendingTasks = tasks.filter(t => t.status !== 'Completed').length;
    const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Completed').length;
    const highPriorityTasks = tasks.filter(t => t.priority === 'High' || t.priority === 'Urgency').length;

    const handleDelete = async () => {
        // 1. Check for Active Tasks
        if (pendingTasks > 0) {
            Swal.fire({
                icon: 'error',
                title: 'Cannot Delete Project',
                text: `There are ${pendingTasks} active tasks in this project. Please delete or complete them active tasks first.`,
            });
            return;
        }

        // 2. Confirmation
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this! All associated data will be removed.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(firestore, 'projects', projectId));
                await Swal.fire('Deleted!', 'Project has been deleted.', 'success');
                router.push('/dashboard/project-management/projects');
            } catch (error: any) {
                console.error("Error deleting project:", error);
                Swal.fire('Error', error.message || 'Could not delete project.', 'error');
            }
        }
    };

    return (
        <div className="p-6 min-h-screen bg-slate-50/50 space-y-6">
            <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-muted-foreground">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-900">
                            <MoreVertical className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>

                        <DropdownMenuItem onClick={() => router.push(`/dashboard/project-management/projects/edit/${project.id}`)}>
                            <Edit className="h-4 w-4 mr-2" /> Edit Project
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" /> Delete Project
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Header Card */}
            <Card className="border-none shadow-sm bg-white">
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                    {project.projectId}
                                </Badge>
                                <Badge variant="secondary" className={
                                    project.status === 'In Progress' ? "bg-blue-100 text-blue-700" :
                                        project.status === 'Completed' ? "bg-emerald-100 text-emerald-700" :
                                            "bg-slate-100 text-slate-700"
                                }>
                                    {project.status}
                                </Badge>
                            </div>
                            <h1 className="text-3xl font-bold text-slate-900 mb-1">{project.projectTitle}</h1>
                            <div className="flex items-center text-slate-500 text-sm gap-4 mt-2">
                                <span className="flex items-center"><Building2 className="h-4 w-4 mr-1" /> {project.clientName}</span>
                                <span className="flex items-center"><Calendar className="h-4 w-4 mr-1" /> Due: {project.endDate ? format(new Date(project.endDate), 'PP') : 'N/A'}</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <div className="text-right">
                                <p className="text-sm text-muted-foreground mb-1">Project Progress</p>
                                <div className="flex items-center gap-2">
                                    <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <span className="font-bold text-slate-700">{progress}%</span>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {completedTasks} / {tasks.length} tasks completed
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="bg-white border text-slate-600">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
                    <TabsTrigger value="team">Team ({project.assignedUsers?.length || 0})</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">

                    {/* Project Statistics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-4 flex flex-col gap-1">
                                <span className="text-xs font-medium text-muted-foreground uppercase">Total Tasks</span>
                                <div className="flex items-center justify-between">
                                    <span className="text-2xl font-bold text-slate-700">{tasks.length}</span>
                                    <ListChecks className="h-5 w-5 text-blue-500" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 flex flex-col gap-1">
                                <span className="text-xs font-medium text-muted-foreground uppercase">Completed</span>
                                <div className="flex items-center justify-between">
                                    <span className="text-2xl font-bold text-emerald-600">{completedTasks}</span>
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 flex flex-col gap-1">
                                <span className="text-xs font-medium text-muted-foreground uppercase">Pending</span>
                                <div className="flex items-center justify-between">
                                    <span className="text-2xl font-bold text-amber-600">{pendingTasks}</span>
                                    <Activity className="h-5 w-5 text-amber-500" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 flex flex-col gap-1">
                                <span className="text-xs font-medium text-muted-foreground uppercase">Overdue</span>
                                <div className="flex items-center justify-between">
                                    <span className="text-2xl font-bold text-red-600">{overdueTasks}</span>
                                    <AlertCircle className="h-5 w-5 text-red-500" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle className="text-lg">Description</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                                    {project.description || 'No description provided.'}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <p className="text-sm font-medium text-slate-500 mb-1">Start Date</p>
                                    <p className="flex items-center text-slate-700">
                                        <Calendar className="h-4 w-4 mr-2 text-slate-400" />
                                        {project.startDate ? format(new Date(project.startDate), 'PP') : 'N/A'}
                                    </p>
                                </div>
                                <Separator />
                                <div>
                                    <p className="text-sm font-medium text-slate-500 mb-1">Priority</p>
                                    <Badge className={
                                        project.priority === 'High' ? "bg-orange-100 text-orange-700 hover:bg-orange-100" :
                                            project.priority === 'Urgency' ? "bg-red-100 text-red-700 hover:bg-red-100" :
                                                "bg-blue-50 text-blue-700 hover:bg-blue-50"
                                    }>
                                        {project.priority}
                                    </Badge>
                                </div>
                                <Separator />
                                <div>
                                    <p className="text-sm font-medium text-slate-500 mb-1">Department</p>
                                    <p className="text-slate-700">{project.department || 'General'}</p>
                                </div>
                                <Separator />
                                <div>
                                    <p className="text-sm font-medium text-slate-500 mb-1">Budget</p>
                                    <p className="text-slate-700 font-mono">
                                        {project.budget ? `$${project.budget.toLocaleString()}` : 'Not set'}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="tasks">
                    <Card>
                        <CardContent className="p-0">
                            {tasks.length > 0 ? (
                                <div className="divide-y">
                                    {tasks.map(task => (
                                        <div key={task.id}
                                            className="p-4 hover:bg-slate-50 flex items-center justify-between cursor-pointer transition-colors"
                                            onClick={() => router.push(`/dashboard/project-management/tasks/${project.projectTitle}/${task.id}`)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2 rounded-full ${task.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                                                    }`}>
                                                    <CheckCircle2 className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-900">{task.taskTitle}</p>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                        <span className="font-mono">{task.taskId || task.id.substring(0, 6)}</span>
                                                        <span>•</span>
                                                        <span>{task.priority}</span>
                                                        <span>•</span>
                                                        <span>{task.dueDate ? format(new Date(task.dueDate), 'MMM d') : 'No due date'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <Badge variant="outline">{task.status}</Badge>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-muted-foreground">
                                    No tasks found.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="team">
                    <Card>
                        <CardHeader>
                            <CardTitle>Project Team</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {project.assignedUsers?.map((user) => (
                                    <div key={user.id} className="flex items-center gap-3 p-3 rounded-lg border bg-slate-50/50">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={user.photoURL} />
                                            <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-medium text-slate-900">{user.name}</p>
                                            <p className="text-xs text-muted-foreground">Team Member</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
