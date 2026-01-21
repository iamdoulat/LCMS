"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO } from 'date-fns';
import {
    ArrowLeft,
    Plus,
    Calendar,
    Clock,
    Users,
    Loader2,
    CheckCircle2,
    Circle,
    PlayCircle,
    PauseCircle,
    AlertCircle,
    ChevronRight,
    Search,
    Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Task } from '@/types/projectManagement';
import { MobileFilterSheet, hasActiveFilters, type FilterState } from '@/components/mobile/MobileFilterSheet';
import Swal from 'sweetalert2';
import { doc, updateDoc } from 'firebase/firestore';

const TABS = ['All', 'Pending', 'In Progress', 'On Hold', 'Completed'];

export default function MobileTaskManagementPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('All');
    const [employeeCode, setEmployeeCode] = useState<string | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Filter State
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filters, setFilters] = useState<FilterState>({ status: 'All' });

    // Fetch User's Employee Code first
    useEffect(() => {
        const fetchEmployeeData = async () => {
            if (!user?.email) return;
            try {
                const q = query(collection(firestore, 'employees'), where('email', '==', user.email));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    setEmployeeCode(snap.docs[0].data().employeeCode || null);
                }
            } catch (err) {
                console.error("Error fetching employee data:", err);
            }
        };
        fetchEmployeeData();
    }, [user]);

    // Listen to Tasks
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(firestore, 'project_tasks'),
            orderBy('updatedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allTasks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Task[];

            // Filter tasks where current user is assigned
            const myTasks = allTasks.filter(task => {
                const isAssignedByUid = task.assignedUserIds?.includes(user.uid);
                const isAssignedByCode = employeeCode && task.assignedUsers?.some(u => u.employeeCode === employeeCode);

                return isAssignedByUid || isAssignedByCode;
            });

            setTasks(myTasks);
            setLoading(false);
        }, (error) => {
            console.error("Error listening to tasks:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, employeeCode]);

    const filteredTasks = React.useMemo(() => {
        return tasks.filter(task => {
            // Tab Filter (Status Quick Filter)
            if (activeTab !== 'All' && task.status !== activeTab) return false;

            // Extra Sheet Filters
            if (filters.status && filters.status !== 'All' && task.status !== filters.status) return false;
            if (filters.priority && task.priority !== filters.priority) return false;

            return true;
        });
    }, [tasks, activeTab, filters]);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Completed': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
            case 'In Progress': return <PlayCircle className="h-4 w-4 text-blue-500" />;
            case 'On Hold': return <PauseCircle className="h-4 w-4 text-amber-500" />;
            default: return <Circle className="h-4 w-4 text-slate-400" />;
        }
    };

    const getPriorityStyles = (priority: string) => {
        switch (priority) {
            case 'Urgency': return "bg-rose-50 text-rose-600 border-rose-100";
            case 'High': return "bg-orange-50 text-orange-600 border-orange-100";
            case 'Medium': return "bg-blue-50 text-blue-600 border-blue-100";
            default: return "bg-slate-50 text-slate-600 border-slate-100";
        }
    };

    const handleSwipe = (direction: number) => {
        const currentIndex = TABS.indexOf(activeTab);
        let nextIndex = currentIndex + direction;

        if (nextIndex >= 0 && nextIndex < TABS.length) {
            setActiveTab(TABS[nextIndex]);
        }
    };

    const handleTaskClick = async (task: Task) => {
        if (!user) return;

        const currentAcceptance = task.acceptanceStatuses?.[user.uid];

        if (!currentAcceptance || currentAcceptance === 'Pending') {
            const result = await Swal.fire({
                title: 'Task Assignment',
                text: `Do you want to accept this task: "${task.taskTitle}"?`,
                icon: 'question',
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: 'Accept',
                denyButtonText: 'Reject',
                cancelButtonText: 'Later',
                confirmButtonColor: '#2563eb',
                denyButtonColor: '#e11d48',
                customClass: {
                    container: 'z-[70]',
                    popup: 'rounded-[2rem]',
                    confirmButton: 'rounded-xl font-bold px-6',
                    denyButton: 'rounded-xl font-bold px-6',
                    cancelButton: 'rounded-xl font-bold px-6'
                }
            });

            if (result.isConfirmed) {
                try {
                    const taskRef = doc(firestore, 'project_tasks', task.id);
                    await updateDoc(taskRef, {
                        [`acceptanceStatuses.${user.uid}`]: 'Accepted'
                    });
                    router.push(`/mobile/project-management/${task.id}`);
                } catch (err) {
                    console.error("Error accepting task:", err);
                }
            } else if (result.isDenied) {
                try {
                    const taskRef = doc(firestore, 'project_tasks', task.id);
                    await updateDoc(taskRef, {
                        [`acceptanceStatuses.${user.uid}`]: 'Rejected'
                    });
                    Swal.fire({
                        title: 'Rejected',
                        text: 'Task has been rejected.',
                        icon: 'info',
                        timer: 2000,
                        showConfirmButton: false,
                        customClass: { popup: 'rounded-[2rem]' }
                    });
                } catch (err) {
                    console.error("Error rejecting task:", err);
                }
            }
        } else if (currentAcceptance === 'Accepted') {
            router.push(`/mobile/project-management/${task.id}`);
        } else {
            Swal.fire({
                title: 'Rejected Task',
                text: 'You have already rejected this task.',
                icon: 'warning',
                confirmButtonColor: '#2563eb',
                customClass: { popup: 'rounded-[2rem]' }
            });
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col h-screen bg-[#0a1e60] items-center justify-center">
                <Loader2 className="h-8 w-8 text-white animate-spin mb-4" />
                <p className="text-white font-medium italic opacity-80">Syncing tasks...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden relative">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center justify-between px-4 pt-0 pb-4">
                    <div className="flex items-center">
                        <button
                            onClick={() => router.back()}
                            className="h-10 w-10 text-white rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d] active:scale-100 transition-all"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>
                        <h1 className="text-xl font-bold text-white ml-2">Task Management</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsFilterOpen(true)}
                            className={cn(
                                "h-10 w-10 text-white rounded-full flex items-center justify-center shadow-lg active:scale-100 transition-all",
                                hasActiveFilters(filters)
                                    ? "shadow-[0_4px_12px_rgba(37,99,235,0.2)]"
                                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            )}
                        >
                            <Filter className="h-5 w-5" />
                        </button>

                    </div>
                </div>

                {/* Horizontal Tabs */}
                <div className="bg-white rounded-t-[2.5rem] pt-6 overflow-x-auto no-scrollbar scroll-smooth" ref={scrollContainerRef}>
                    <div className="flex px-6 min-w-max pb-4 gap-8">
                        {TABS.map((tab) => (
                            <button
                                key={tab}
                                onClick={() => handleTabChange(tab)}
                                className={cn(
                                    "relative pb-2 text-sm font-bold transition-all whitespace-nowrap",
                                    activeTab === tab
                                        ? "text-[#0a1e60]"
                                        : "text-slate-300"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    {activeTab === tab && (
                                        <motion.div
                                            layoutId="activeTabDot"
                                            className="h-1.5 w-1.5 rounded-full bg-amber-400"
                                        />
                                    )}
                                    {tab}
                                </div>
                                {activeTab === tab && (
                                    <motion.div
                                        layoutId="activeTabLine"
                                        className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#0a1e60] rounded-full"
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Area with Swipe Support */}
            <div className="flex-1 bg-white relative overflow-hidden">
                <motion.div
                    key={activeTab}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    onDragEnd={(e, info) => {
                        if (info.offset.x > 100) handleSwipe(-1);
                        else if (info.offset.x < -100) handleSwipe(1);
                    }}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="h-full overflow-y-auto px-6 pt-4 pb-[120px] space-y-4"
                >
                    {filteredTasks.length > 0 ? (
                        filteredTasks.map((task) => (
                            <div
                                key={task.id}
                                onClick={() => handleTaskClick(task)}
                                className="bg-white p-5 rounded-[2rem] shadow-md border border-slate-100 flex gap-4 active:scale-[0.98] transition-all"
                            >
                                {/* Vertical Acceptance Badge */}
                                {task.acceptanceStatuses?.[user?.uid || ''] && (
                                    <div className={cn(
                                        "w-6 rounded-full flex items-center justify-center py-2 shadow-sm border",
                                        task.acceptanceStatuses[user?.uid || ''] === 'Accepted'
                                            ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                                            : task.acceptanceStatuses[user?.uid || ''] === 'Rejected'
                                                ? "bg-rose-50 border-rose-100 text-rose-600"
                                                : "hidden"
                                    )}>
                                        <span
                                            className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
                                            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                                        >
                                            {task.acceptanceStatuses[user?.uid || '']}
                                        </span>
                                    </div>
                                )}

                                {/* Task Completion Progress Bar (Pipe Line) */}
                                <div className="w-1.5 bg-slate-100 rounded-full my-1 overflow-hidden relative shadow-inner">
                                    <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: `${task.completionPercentage || 0}%` }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                        className={cn(
                                            "absolute bottom-0 left-0 right-0 rounded-full transition-all duration-500",
                                            (task.completionPercentage || 0) >= 100 ? "bg-gradient-to-t from-emerald-600 to-emerald-400" :
                                                (task.completionPercentage || 0) >= 70 ? "bg-gradient-to-t from-blue-600 to-blue-400" :
                                                    (task.completionPercentage || 0) >= 30 ? "bg-gradient-to-t from-amber-500 to-amber-300" :
                                                        "bg-gradient-to-t from-slate-400 to-slate-300"
                                        )}
                                    />

                                    {/* Priority Indicator Dot */}
                                    <div className={cn(
                                        "absolute top-0 left-0 right-0 h-1.5 w-1.5 rounded-full z-10",
                                        task.priority === 'Urgency' ? "bg-rose-500 shadow-[0_0_4px_rgba(244,63,94,0.6)]" :
                                            task.priority === 'High' ? "bg-orange-500 shadow-[0_0_4px_rgba(249,115,22,0.6)]" :
                                                task.priority === 'Medium' ? "bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,0.6)]" : "bg-slate-300"
                                    )} />
                                </div>

                                <div className="flex-1 space-y-3">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex gap-2 shrink-0">
                                            <span className="px-2 py-0.5 rounded-lg bg-slate-50 text-[10px] font-bold text-slate-400 border border-slate-100 whitespace-nowrap overflow-hidden text-ellipsis max-w-[60px]">
                                                {task.createdByUid === user?.uid ? "Self" : (task.createdByName || "System")}
                                            </span>
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-lg text-[10px] font-bold border",
                                                getPriorityStyles(task.priority)
                                            )}>
                                                {task.priority}
                                            </span>
                                        </div>
                                        {task.projectTitle && (
                                            <div className="bg-blue-50/50 px-2.5 py-0.5 rounded-lg border border-blue-100/50 max-w-[120px]">
                                                <p className="text-[10px] font-black text-blue-600 truncate uppercase tracking-tight">
                                                    {task.projectTitle}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <h3 className="text-sm font-bold text-slate-800 leading-tight">
                                        {task.taskTitle}
                                    </h3>

                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-xl border border-slate-100">
                                            <Calendar className="h-3 w-3 text-slate-400" />
                                            <span className="text-[10px] text-slate-500 font-bold">
                                                {task.startDate ? format(new Date(task.startDate), 'dd-MM-yyyy') : 'N/A'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-xl border border-slate-100">
                                            <Clock className="h-3 w-3 text-slate-400" />
                                            <span className="text-[10px] text-slate-500 font-bold">
                                                {task.dueDate ? format(new Date(task.dueDate), 'dd-MM-yyyy') : 'N/A'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-1">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(task.status)}
                                            <span className="text-[11px] font-bold text-slate-600">
                                                {task.status}
                                            </span>
                                        </div>
                                        <div className="flex -space-x-1.5">
                                            {task.assignedUsers?.slice(0, 3).map((u, i) => (
                                                <div
                                                    key={i}
                                                    className="h-6 w-6 rounded-full border-2 border-white bg-slate-100 overflow-hidden ring-1 ring-slate-100"
                                                >
                                                    {u.photoURL ? (
                                                        <img src={u.photoURL} alt={u.name} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <div className="h-full w-full flex items-center justify-center text-[8px] font-bold text-slate-400 uppercase">
                                                            {u.name?.charAt(0)}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="h-20 w-20 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-4 border-2 border-dashed border-slate-100">
                                <AlertCircle className="h-8 w-8 text-slate-200" />
                            </div>
                            <p className="text-slate-400 font-bold">No tasks found</p>
                            <p className="text-slate-300 text-xs mt-1">There are no tasks in this category.</p>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* FAB */}
            <button
                onClick={() => router.push('/mobile/project-management/new')}
                className="fixed bottom-[100px] right-6 h-11 w-11 bg-[#3b82f6] rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-500/30 active:scale-90 transition-all z-50 border border-white/10"
            >
                <Plus className="h-[22px] w-[22px]" />
            </button>

            <MobileFilterSheet
                open={isFilterOpen}
                onOpenChange={setIsFilterOpen}
                onApply={setFilters}
                onReset={() => setFilters({ status: 'All' })}
                currentFilters={filters}
                showStatus
                statusOptions={['All', ...TABS.filter(t => t !== 'All')]}
                title="Filter Tasks"
            >
                <div className="space-y-3 mt-6">
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Priority</h4>
                    <div className="flex flex-wrap gap-2">
                        {['Low', 'Medium', 'High', 'Urgency'].map(priority => (
                            <button
                                key={priority}
                                onClick={() => setFilters(prev => ({ ...prev, priority: prev.priority === priority ? undefined : priority as any }))}
                                className={cn(
                                    "px-4 py-2 rounded-full text-sm font-bold transition-all border-2",
                                    filters.priority === priority
                                        ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200"
                                        : "bg-white border-slate-200 text-slate-500"
                                )}
                            >
                                {priority}
                            </button>
                        ))}
                    </div>
                </div>
            </MobileFilterSheet>

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
