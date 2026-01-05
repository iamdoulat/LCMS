"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
    Calendar as CalendarIcon,
    MoreVertical,
    Edit,
    Trash2,
    Eye,
    Plus,
    Search,
    Filter,
    Users,
    List,
    LayoutGrid,
    Layout,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { firestore } from '@/lib/firebase/config';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { Task } from '@/types/projectManagement';
import { cn } from '@/lib/utils';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import Swal from 'sweetalert2';

type ViewMode = 'board' | 'list' | 'calendar';

export default function ManageTasksPage() {
    const router = useRouter();
    const { userRole } = useAuth();
    const searchParams = useSearchParams();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>('board');
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [employeePhotos, setEmployeePhotos] = useState<Record<string, string>>({});
    const [clientNames, setClientNames] = useState<Record<string, string>>({});

    // Filter States
    const [priorityFilter, setPriorityFilter] = useState<string>('all');
    const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
    const [allUsers, setAllUsers] = useState<{ id: string, name: string, photoURL?: string }[]>([]);

    // Statistics
    const stats = useMemo(() => {
        const total = tasks.length;
        const completed = tasks.filter(t => t.status === 'Completed').length;
        const inProgress = tasks.filter(t => t.status === 'In Progress').length;
        const pending = tasks.filter(t => t.status !== 'Completed').length;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { total, completed, inProgress, pending, completionRate };
    }, [tasks]);

    // Calendar State
    const [currentMonth, setCurrentMonth] = useState(new Date());

    useEffect(() => {
        // Fetch Tasks
        const q = query(collection(firestore, 'project_tasks'), orderBy('updatedAt', 'desc'));
        const unsubscribeTasks = onSnapshot(q, (snapshot) => {
            const tasksData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Task[];
            setTasks(tasksData);
            setLoading(false);
        });

        // Fetch Employees for Photos (One-time fetch for avatar lookup)
        const unsubscribeEmployees = onSnapshot(collection(firestore, 'employees'), (snap) => {
            const photos: Record<string, string> = {};
            const usersList: { id: string, name: string, photoURL?: string }[] = [];

            snap.docs.forEach(doc => {
                const data = doc.data();
                const fullName = data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown';
                const photo = data.photoURL || data.param?.photoURL;
                const code = data.employeeCode || doc.id;

                if (photo) {
                    photos[code] = photo;
                }
                usersList.push({ id: code, name: fullName, photoURL: photo });
            });
            setEmployeePhotos(photos);
            setAllUsers(usersList);
        });

        const unsubscribeProjects = onSnapshot(collection(firestore, 'projects'), (snap) => {
            const clients: Record<string, string> = {};
            snap.docs.forEach(doc => {
                const data = doc.data();
                if (data.clientName) {
                    clients[doc.id] = data.clientName;
                }
            });
            setClientNames(clients);
        });

        return () => {
            unsubscribeTasks();
            unsubscribeEmployees();
            unsubscribeProjects();
        };
    }, []);

    // --- Actions ---

    const handleDelete = async (id: string) => {
        const hasPermission = userRole?.some(role => ['Admin', 'Super Admin', 'Service'].includes(role));

        if (!hasPermission) {
            Swal.fire("Permission Denied", "You do not have permission to delete tasks.", "error");
            return;
        }

        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(firestore, 'project_tasks', id));
                Swal.fire(
                    'Deleted!',
                    'Your task has been deleted.',
                    'success'
                );
            } catch (error: any) {
                console.error("Delete Error:", error);
                Swal.fire("Delete Failed", error.message || "Could not delete task.", "error");
            }
        }
    };

    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        setDraggedTaskId(taskId);
        e.dataTransfer.setData("taskId", taskId);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = async (e: React.DragEvent, newStatus: string) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData("taskId");

        if (taskId) {
            // Optimistic update
            const updatedTasks = tasks.map(t =>
                t.id === taskId ? { ...t, status: newStatus as any } : t
            );
            setTasks(updatedTasks);
            setDraggedTaskId(null);

            // Firestore update
            try {
                const taskRef = doc(firestore, 'project_tasks', taskId);
                await updateDoc(taskRef, {
                    status: newStatus,
                    updatedAt: new Date()
                });
            } catch (error) {
                console.error("Error updating task status:", error);
            }
        }
    };

    // --- Helpers ---

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'High': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'Urgency': return 'text-red-600 bg-red-50 border-red-200';
            case 'Medium': return 'text-blue-600 bg-blue-50 border-blue-200';
            default: return 'text-slate-600 bg-slate-50 border-slate-200';
        }
    };

    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            const matchesSearch = t.taskTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t as any).projectTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.assignedUsers?.some(u => u.employeeCode?.toLowerCase().includes(searchQuery.toLowerCase()) || u.name?.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
            const matchesAssignee = assigneeFilter === 'all' ||
                t.assignedUserIds?.includes(assigneeFilter) ||
                t.assignedUsers?.some(u => u.id === assigneeFilter || u.employeeCode === assigneeFilter);

            return matchesSearch && matchesPriority && matchesAssignee;
        });
    }, [tasks, searchQuery, priorityFilter, assigneeFilter]);

    // --- Views ---

    // --- Helper for Slug ---
    const createSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const BoardView = () => {
        const columns = [
            { id: 'Pending', title: 'Pending', color: 'bg-slate-100/50' },
            { id: 'In Progress', title: 'In Progress', color: 'bg-blue-50/50' },
            { id: 'On Hold', title: 'On Hold', color: 'bg-amber-50/50' },
            { id: 'Completed', title: 'Completed', color: 'bg-emerald-50/50' }
        ];

        return (
            <div className="flex gap-4 h-full min-w-[1000px] pb-4 overflow-x-auto">
                {columns.map(col => (
                    <div
                        key={col.id}
                        className={cn(
                            "flex-1 rounded-xl flex flex-col border border-slate-200/60 shadow-sm transition-colors",
                            col.color
                        )}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, col.id)}
                    >
                        <div className="p-3 flex items-center justify-between font-semibold text-sm border-b border-slate-200/60 bg-white/50 backdrop-blur-sm rounded-t-xl sticky top-0 z-10">
                            <span className={cn(
                                "flex items-center gap-2 font-bold bg-clip-text text-transparent bg-gradient-to-r transition-all duration-300",
                                col.id === 'Pending' ? "from-slate-700 to-slate-500" :
                                    col.id === 'In Progress' ? "from-blue-600 via-indigo-600 to-violet-600" :
                                        col.id === 'On Hold' ? "from-amber-600 to-orange-600" :
                                            "from-emerald-600 to-teal-600"
                            )}>
                                {col.title}
                                <Badge variant="secondary" className="h-5 px-1.5 min-w-[1.25rem] justify-center bg-white border shadow-sm text-slate-500">
                                    {filteredTasks.filter(t => t.status === col.id).length}
                                </Badge>
                            </span>
                        </div>

                        <div className="p-2 flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                            <AnimatePresence>
                                {filteredTasks
                                    .filter(t => t.status === col.id)
                                    .map(task => (
                                        <motion.div
                                            key={task.id}
                                            layoutId={task.id}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <Card
                                                draggable
                                                onDragStart={(e) => handleDragStart(e as any, task.id)}
                                                className={cn(
                                                    "mb-1 hover:shadow-md transition-all cursor-move border-l-4 bg-white relative",
                                                    draggedTaskId === task.id ? "opacity-50 border-2 border-dashed border-slate-400" : "opacity-100",
                                                    task.priority === 'Urgency' ? "border-l-red-500" :
                                                        task.priority === 'High' ? "border-l-orange-500" :
                                                            task.priority === 'Medium' ? "border-l-blue-500" : "border-l-slate-300"
                                                )}
                                            >
                                                <CardContent className="p-3">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5", getPriorityColor(task.priority))}>
                                                            {task.priority}
                                                        </Badge>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" className="h-6 w-6 p-0 hover:bg-slate-100 rounded-full">
                                                                    <MoreVertical className="h-3 w-3 text-slate-400" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => router.push(`/dashboard/project-management/tasks/${createSlug(task.taskTitle)}/${task.id}`)}>
                                                                    <Eye className="mr-2 h-4 w-4" /> View Details
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => router.push(`/dashboard/project-management/tasks/edit/${task.id}`)}>
                                                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                                                </DropdownMenuItem>
                                                                {userRole?.some(role => ['Admin', 'Super Admin', 'Service'].includes(role)) && (
                                                                    <>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(task.id)}>
                                                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>

                                                    <h4 className="font-bold text-sm mb-1 leading-tight line-clamp-2 bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-transparent group-hover:from-blue-600 group-hover:via-indigo-600 group-hover:to-purple-600 transition-all duration-500">
                                                        {task.taskTitle}
                                                    </h4>

                                                    <div className="text-xs text-muted-foreground mb-3 space-y-1">
                                                        <div className="flex items-center gap-1">
                                                            <span className="font-medium text-slate-700">Project:</span>
                                                            <span className="truncate max-w-[150px]">{task.projectTitle}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <span className="font-medium text-slate-700">Client:</span>
                                                            <span className="truncate max-w-[150px]">{clientNames[task.projectId as string] || '-'}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-slate-100">
                                                        {/* Status & Priority Row (Already have priority badge at top, adding Status here if requested, or maybe bottom) */}
                                                        {/* User requested Status, Priority, Client, Dates. Priority is at top. Status is the column... but lets add a mini badge if they want to see it explicitly or maybe in mobile view its useful. Since it's sorted by column, status is implied, but I'll add a small text. */}

                                                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                                            <div className="flex flex-col">
                                                                <span>Start: {task.startDate ? format(new Date(task.startDate), 'MMM d') : '-'}</span>
                                                                <span>End: {task.dueDate ? format(new Date(task.dueDate), 'MMM d') : '-'}</span>
                                                            </div>

                                                            <div className="flex -space-x-2 hover:space-x-1 transition-all">
                                                                {task.assignedUsers?.slice(0, 3).map((u, i) => (
                                                                    <Avatar key={i} className="h-6 w-6 border-2 border-white ring-1 ring-slate-100">
                                                                        <AvatarImage src={employeePhotos[u.id] || u.photoURL} alt={u.name} />
                                                                        <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-bold">
                                                                            {u.name?.charAt(0)}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Pipe line progress bar */}
                                                    <div className="mt-4 pt-3 border-t border-slate-100">
                                                        <div className="relative h-2.5 w-full bg-slate-100/80 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 via-purple-500 to-emerald-500 transition-all duration-1000 ease-out rounded-full relative"
                                                                style={{ width: `${task.completionPercentage || 0}%` }}
                                                            >
                                                                {/* 3D Reflection Highlight */}
                                                                <div className="absolute inset-x-0 top-0.5 h-[30%] bg-white/40 blur-[0.5px]" />
                                                                <div className="absolute inset-x-0 bottom-0.5 h-[30%] bg-black/10 blur-[0.5px]" />

                                                                {/* Pulse effect on completion */}
                                                                <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/30 blur-[2px] animate-pulse" />
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between items-center mt-1.5 px-0.5">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Progress</span>
                                                            </div>
                                                            <span className="text-[10px] font-extrabold text-slate-700 bg-white px-2 py-0.5 rounded-full border shadow-sm ring-1 ring-slate-100">
                                                                {task.completionPercentage || 0}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    ))
                                }
                            </AnimatePresence>
                            <Button
                                variant="ghost"
                                className="w-full justify-start text-xs text-muted-foreground hover:bg-white/60 hover:text-primary mt-2 border border-dashed border-slate-200 hover:border-primary/30 h-8"
                                onClick={() => router.push(`/dashboard/project-management/tasks/new?status=${col.id}`)}
                            >
                                <Plus className="h-3 w-3 mr-1" /> Add Task
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const ListView = () => (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <Table>
                <TableHeader className="bg-slate-50/50">
                    <TableRow>
                        <TableHead className="w-[80px]">ID</TableHead>
                        <TableHead className="w-[300px]">Task</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredTasks.map((task) => (
                        <TableRow key={task.id} className="hover:bg-slate-50/50 transition-colors group">
                            <TableCell className="font-mono text-xs text-muted-foreground">
                                {task.taskId || task.id.slice(0, 6)}
                            </TableCell>
                            <TableCell className="font-medium">
                                <div className="flex flex-col">
                                    <span
                                        onClick={() => router.push(`/dashboard/project-management/tasks/${createSlug(task.taskTitle)}/${task.id}`)}
                                        className="bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-transparent hover:from-blue-600 hover:via-indigo-600 hover:to-purple-600 cursor-pointer font-bold transition-all duration-500"
                                    >
                                        {task.taskTitle}
                                    </span>
                                    {task.billingType !== 'None' && (
                                        <span className="text-[10px] text-muted-foreground capitalize">{task.billingType}</span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{task.projectTitle}</TableCell>
                            <TableCell>
                                <div className="flex -space-x-2">
                                    {task.assignedUsers?.slice(0, 4).map((u, i) => (
                                        <Avatar key={i} className="h-7 w-7 border-2 border-white">
                                            <AvatarImage src={employeePhotos[u.id] || u.photoURL} alt={u.name} />
                                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                                {u.name?.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                    ))}
                                </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{clientNames[task.projectId] || '-'}</TableCell>
                            <TableCell>
                                <Badge variant="secondary" className={cn("font-normal border",
                                    task.status === 'Completed' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                        task.status === 'In Progress' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                            task.status === 'On Hold' ? "bg-amber-50 text-amber-700 border-amber-200" :
                                                "bg-slate-100 text-slate-700 border-slate-200"
                                )}>
                                    {task.status}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className={cn("text-[10px]", getPriorityColor(task.priority))}>
                                    {task.priority}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                                {task.startDate ? format(new Date(task.startDate), 'MMM d, yyyy') : '-'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                                {task.dueDate ? format(new Date(task.dueDate), 'MMM d, yyyy') : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="icon" className="h-8 w-8 p-0 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => router.push(`/dashboard/project-management/tasks/${createSlug(task.taskTitle)}/${task.id}`)}>
                                            <Eye className="mr-2 h-4 w-4" /> View Details
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => router.push(`/dashboard/project-management/tasks/edit/${task.id}`)}>
                                            <Edit className="mr-2 h-4 w-4" /> Edit
                                        </DropdownMenuItem>
                                        {userRole?.some(role => ['Admin', 'Super Admin', 'Service'].includes(role)) && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(task.id)}>
                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                    {filteredTasks.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                No tasks found matching your search.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );

    const CalendarView = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);
        const calendarGrid = eachDayOfInterval({ start: startDate, end: endDate });

        const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
        const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
        const today = new Date();

        return (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col h-full">
                <div className="p-4 flex items-center justify-between border-b bg-slate-50/30">
                    <h2 className="text-lg font-semibold text-slate-800">
                        {format(currentMonth, 'MMMM yyyy')}
                    </h2>
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
                            Today
                        </Button>
                        <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-7 grid-rows-[auto_1fr] min-h-0 overflow-auto">
                    {/* Weekday Headers */}
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="p-3 text-sm font-medium text-slate-500 border-b border-r last:border-r-0 bg-slate-50/50 text-center">
                            {day}
                        </div>
                    ))}

                    {/* Calendar Grid */}
                    {calendarGrid.map((day, dayIdx) => {
                        const dayTasks = tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), day));
                        const isCurrentMonth = isSameMonth(day, currentMonth);
                        const isToday = isSameDay(day, today);

                        return (
                            <div
                                key={day.toString()}
                                className={cn(
                                    "min-h-[120px] p-2 border-b border-r last:border-r-0 flex flex-col gap-1 transition-colors hover:bg-slate-50/30",
                                    !isCurrentMonth && "bg-slate-50/50 text-slate-400",
                                    isToday && "bg-blue-50/30"
                                )}
                            >
                                <div className={cn(
                                    "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mb-1",
                                    isToday ? "bg-blue-600 text-white" : "text-slate-700"
                                )}>
                                    {format(day, 'd')}
                                </div>
                                <div className="space-y-1 overflow-y-auto max-h-[100px] custom-scrollbar">
                                    {dayTasks.map(task => (
                                        <div
                                            key={task.id}
                                            onClick={() => router.push(`/dashboard/project-management/tasks/${createSlug(task.taskTitle)}/${task.id}`)}
                                            className={cn(
                                                "text-[10px] p-1.5 rounded border border-l-2 truncate cursor-pointer shadow-sm hover:translate-y-[-1px] transition-transform",
                                                task.priority === 'Urgency' ? "bg-red-50 border-red-100 border-l-red-500 text-red-700" :
                                                    task.priority === 'High' ? "bg-orange-50 border-orange-100 border-l-orange-500 text-orange-700" :
                                                        "bg-white border-slate-100 border-l-blue-500 text-slate-600"
                                            )}
                                        >
                                            {task.taskTitle}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 pb-[120px] md:pb-6 h-auto md:h-[calc(100vh-64px)] flex flex-col bg-slate-50/50">
            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card className="shadow-sm border-l-4 border-l-blue-500">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Total Tasks</p>
                            <h3 className="text-2xl font-bold text-slate-700">{stats.total}</h3>
                        </div>
                        <div className="h-10 w-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                            <List className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-l-4 border-l-orange-500">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">In Progress</p>
                            <h3 className="text-2xl font-bold text-slate-700">{stats.inProgress}</h3>
                        </div>
                        <div className="h-10 w-10 bg-orange-50 rounded-full flex items-center justify-center text-orange-600">
                            <Users className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-l-4 border-l-emerald-500">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Completed</p>
                            <h3 className="text-2xl font-bold text-slate-700">{stats.completed}</h3>
                        </div>
                        <div className="h-10 w-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                            <Layout className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-l-4 border-l-slate-500">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Completion Rate</p>
                            <h3 className="text-2xl font-bold text-slate-700">{stats.completionRate}%</h3>
                        </div>
                        <div className="h-10 w-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-600">
                            <Filter className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Header Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-white border border-slate-100 shadow-sm text-blue-500">
                        <Layout className="h-7 w-7" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 bg-clip-text text-transparent">
                            Manage Tasks
                        </h1>
                        <p className="text-slate-500 font-medium">Track and manage project tasks</p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex gap-1 bg-white p-1 rounded-lg border shadow-sm h-10 items-center">
                        <Button
                            variant={viewMode === 'board' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('board')}
                            className="h-8 px-3"
                        >
                            <LayoutGrid className="h-4 w-4 mr-2" /> Board
                        </Button>
                        <Button
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('list')}
                            className="h-8 px-3"
                        >
                            <List className="h-4 w-4 mr-2" /> List
                        </Button>
                        <Button
                            variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('calendar')}
                            className="h-8 px-3"
                        >
                            <CalendarIcon className="h-4 w-4 mr-2" /> Calendar
                        </Button>
                    </div>

                    <div className="flex gap-2">
                        {/* Filters */}
                        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                            <SelectTrigger className="w-[130px] bg-white h-10">
                                <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Priorities</SelectItem>
                                <SelectItem value="High">High</SelectItem>
                                <SelectItem value="Medium">Medium</SelectItem>
                                <SelectItem value="Low">Low</SelectItem>
                                <SelectItem value="Urgency">Urgency</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                            <SelectTrigger className="w-[150px] bg-white h-10">
                                <SelectValue placeholder="Assignee" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Assignees</SelectItem>
                                {allUsers.map(u => (
                                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search tasks..."
                                className="pl-8 bg-white border-slate-200 w-[180px] h-10"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button onClick={() => router.push('/dashboard/project-management/tasks/new')} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md h-10">
                            <Plus className="h-4 w-4 mr-2" /> New Task
                        </Button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden min-h-0 relative">
                {viewMode === 'board' && <BoardView />}
                {viewMode === 'list' && (
                    <div className="h-full overflow-auto">
                        <ListView />
                    </div>
                )}
                {viewMode === 'calendar' && <CalendarView />}
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                    height: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
                
                @keyframes gradient-x {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .animate-gradient-x {
                    background-size: 200% 200%;
                    animation: gradient-x 15s ease infinite;
                }
            `}</style>
        </div>
    );
}
