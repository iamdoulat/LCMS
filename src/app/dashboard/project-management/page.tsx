"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Briefcase,
    ListChecks,
    Users,
    Building2,
    TrendingUp,
    Activity,
    CheckCircle2,
    AlertCircle,
    Info,
    ArrowUpRight,
    ArrowDownRight
} from "lucide-react";
import { motion } from 'framer-motion';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    Legend,
    Area,
    AreaChart
} from 'recharts';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getMonth, parseISO } from 'date-fns';
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Progress } from "@/components/ui/progress";
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

// ... imports

// Types (You can move these to a separate file later if needed, or import from @/types)
interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ElementType;
    description?: string;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    className?: string;
    iconColor?: string;
}

const StatCard = ({ title, value, icon: Icon, description, trend, trendValue, className }: StatCardProps) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -5 }}
        className="w-full"
    >
        <Card className={cn("overflow-hidden border-none shadow-xl text-white group relative", className)}>
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <CardTitle className="text-sm font-bold text-white/90 uppercase tracking-wider">{title}</CardTitle>
                <div className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-md shadow-inner border border-white/10 group-hover:rotate-12 transition-transform duration-300">
                    <Icon className="h-5 w-5 text-white" />
                </div>
            </CardHeader>
            <CardContent className="relative z-10 pt-2">
                <div className="text-3xl font-black tracking-tight">{value}</div>
                {(description || trend) && (
                    <div className="text-xs text-white/80 mt-2 flex items-center font-medium bg-black/10 w-fit px-2 py-1 rounded-lg backdrop-blur-sm border border-white/5">
                        {trend === 'up' && <ArrowUpRight className="h-3 w-3 text-white mr-1" />}
                        {trend === 'down' && <ArrowDownRight className="h-3 w-3 text-white mr-1" />}
                        {trendValue && <span className="font-bold mr-1">{trendValue}</span>}
                        <span className="opacity-90">{description}</span>
                    </div>
                )}
            </CardContent>

            {/* Decorative background element */}
            <div className="absolute bottom-0 right-0 -mb-8 -mr-8 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
        </Card>
    </motion.div>
);

export default function ProjectManagementDashboard() {
    const { user } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState({
        totalProjects: 0,
        totalTasks: 0,
        totalUsers: 0,
        totalClients: 0
    });
    const [projectStatusData, setProjectStatusData] = useState<any[]>([]);
    const [taskStatusData, setTaskStatusData] = useState<any[]>([]);
    const [recentActivities, setRecentActivities] = useState<any[]>([]);
    const [myProjects, setMyProjects] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
    const [calEvents, setCalEvents] = useState<any[]>([]);
    const [financialData, setFinancialData] = useState<any[]>([]);
    const [userMap, setUserMap] = useState<Record<string, any>>({});

    useEffect(() => {
        // Fetch Users first for mapping (or keep real-time)
        const unsubUsers = onSnapshot(query(collection(firestore, 'employees'), where('disabled', '==', false)), (snap) => {
            setStats(prev => ({ ...prev, totalUsers: snap.size }));
            const mapping: Record<string, any> = {};
            snap.docs.forEach(doc => {
                mapping[doc.id] = doc.data();
            });
            setUserMap(mapping);
        });

        // Real-time listeners
        const unsubProjects = onSnapshot(collection(firestore, 'projects'), (snap) => {
            setStats(prev => ({ ...prev, totalProjects: snap.size }));

            // Process for charts
            const statusCounts: Record<string, number> = {};
            snap.docs.forEach(doc => {
                const status = doc.data().status || 'Unknown';
                statusCounts[status] = (statusCounts[status] || 0) + 1;
            });
            setProjectStatusData(Object.entries(statusCounts).map(([name, value]) => ({ name, value })));

            // Filter My Active Projects
            const active = snap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter((p: any) => p.status === 'In Progress' || p.status === 'Pending')
                .slice(0, 4);
            setMyProjects(active);
        });

        const unsubTasks = onSnapshot(collection(firestore, 'project_tasks'), (snap) => {
            setStats(prev => ({ ...prev, totalTasks: snap.size }));

            const statusCounts: Record<string, number> = {};
            const events: any[] = [];

            snap.docs.forEach(doc => {
                const data = doc.data();
                const status = data.status || 'Pending';
                statusCounts[status] = (statusCounts[status] || 0) + 1;

                if (data.dueDate) {
                    events.push({
                        id: doc.id,
                        title: data.taskTitle,
                        date: new Date(data.dueDate),
                        type: 'task',
                        status: data.status
                    });
                }
            });
            setTaskStatusData(Object.entries(statusCounts).map(([name, value]) => ({ name, value })));
            setCalEvents(events);
        });

        const unsubClients = onSnapshot(collection(firestore, 'customers'), (snap) => {
            setStats(prev => ({ ...prev, totalClients: snap.size }));
        });

        // Financial Data
        const unsubInvoices = onSnapshot(query(collection(firestore, 'project_invoices'), orderBy('createdAt', 'desc')), (snap) => {
            const currentYear = new Date().getFullYear();
            const monthlyData = Array(12).fill(0).map((_, i) => ({
                name: format(new Date(currentYear, i, 1), 'MMM'),
                income: 0,
                expense: 0 // Placeholder
            }));

            snap.docs.forEach(doc => {
                const data = doc.data();
                const date = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt);

                if (date.getFullYear() === currentYear && (data.status === 'Paid' || data.paymentStatus === 'Paid')) {
                    const monthIndex = getMonth(date);
                    monthlyData[monthIndex].income += Number(data.totalAmount || data.amount || 0);
                }
            });
            setFinancialData(monthlyData);
        });

        // Recent Activities (System Logs)
        const unsubLogs = onSnapshot(query(collection(firestore, 'system_logs'), where('type', '==', 'task_activity'), orderBy('createdAt', 'desc'), limit(10)), (snap) => {
            const logs = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRecentActivities(logs);
        });

        return () => {
            unsubProjects();
            unsubTasks();
            unsubUsers();
            unsubClients();
            unsubInvoices();
            unsubLogs();
        };
    }, []);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
    const TASK_COLORS: Record<string, string> = {
        'Pending': '#94a3b8',
        'In Progress': '#3b82f6',
        'On Hold': '#f59e0b',
        'Completed': '#10b981'
    };

    return (
        <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen">
            <div className="flex flex-col space-y-2">
                <h2 className="text-3xl font-bold tracking-tight text-slate-800">Project Dashboard</h2>
                <p className="text-muted-foreground">Welcome back! Here's what's happening in your projects today.</p>
            </div>

            {/* Top Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Total Projects"
                    value={stats.totalProjects}
                    icon={Briefcase}
                    trend="up"
                    trendValue="+2"
                    description="this month"
                    className="gradient-primary"
                />
                <StatCard
                    title="Total Tasks"
                    value={stats.totalTasks}
                    icon={ListChecks}
                    trend="up"
                    trendValue="+12%"
                    description="from last week"
                    className="gradient-purple"
                />
                <StatCard
                    title="Active Users"
                    value={stats.totalUsers}
                    icon={Users}
                    description="team members"
                    className="gradient-success"
                />
                <StatCard
                    title="Total Clients"
                    value={stats.totalClients}
                    icon={Building2}
                    description="active contracts"
                    className="gradient-warning"
                />
            </div>

            {/* My Active Projects */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="col-span-4 shadow-sm border-none bg-white/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                            <CardTitle className="text-xl font-bold text-slate-800">Active Projects</CardTitle>
                            <CardDescription>Projects currently in progress</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/project-management/projects')}>
                            View All
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            {myProjects.length > 0 ? (
                                myProjects.map((project: any) => (
                                    <div key={project.id} className="p-4 rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push(`/dashboard/project-management/projects/${project.id}`)}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div className={`p-2 rounded-lg ${project.priority === 'High' ? 'bg-orange-100 text-orange-600' :
                                                project.priority === 'Urgency' ? 'bg-red-100 text-red-600' :
                                                    'bg-blue-100 text-blue-600'
                                                }`}>
                                                <Activity className="h-5 w-5" />
                                            </div>
                                            <Badge variant="outline" className="font-normal bg-slate-50">{project.status}</Badge>
                                        </div>
                                        <h4 className="font-semibold text-slate-900 truncate mb-1">{project.projectTitle}</h4>
                                        <p className="text-xs text-muted-foreground truncate mb-4">{project.clientName || 'No Client'}</p>

                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs text-slate-500">
                                                <span>Progress</span>
                                                <span>{project.progress || 0}%</span>
                                            </div>
                                            <Progress value={project.progress || 0} className="h-1.5" />
                                        </div>

                                        <div className="mt-4 flex -space-x-2 overflow-hidden">
                                            {project.assignedUsers?.slice(0, 3).map((u: any, i: number) => (
                                                <Avatar key={i} className="inline-block h-6 w-6 rounded-full ring-2 ring-white">
                                                    <AvatarImage src={u.photoURL} />
                                                    <AvatarFallback className="text-[9px]">{u.name?.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-4 text-center py-8 text-muted-foreground">
                                    No active projects found.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Graph Section - Row 1 */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Project Status Overview</CardTitle>
                        <CardDescription>Distribution of projects by their current status</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={projectStatusData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Task Distribution</CardTitle>
                        <CardDescription>Tasks by completion status</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={taskStatusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {taskStatusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={TASK_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Finance & Activity & Calendar */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Finance Chart (Mock Data) */}
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Financial Overview</CardTitle>
                        <CardDescription>Income vs Expenses (This Year)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={financialData}>
                                <defs>
                                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <Tooltip />
                                <Area type="monotone" dataKey="income" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" />
                                <Area type="monotone" dataKey="expense" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Calendar & Activities */}
                <div className="col-span-3 space-y-4">
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle>Calendar & Activity</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <div className="flex justify-center border rounded-lg p-2 bg-white">
                                <Calendar
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={setSelectedDate}
                                    className="rounded-md"
                                />
                            </div>

                            <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2">
                                <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Recent Activity</h4>
                                {recentActivities.length > 0 ? (
                                    recentActivities.map((activity, i) => {
                                        const user = userMap[activity.userId] || { fullName: 'System', photoURL: null };
                                        const timeStr = activity.createdAt?.toDate ? format(activity.createdAt.toDate(), 'MMM dd, HH:mm') : 'Just now';

                                        return (
                                            <div key={activity.id || i} className="flex items-start gap-4 p-3 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors">
                                                <Avatar className="h-9 w-9 border-2 border-white shadow-sm">
                                                    <AvatarImage src={user.photoURL} />
                                                    <AvatarFallback className="bg-blue-600 text-white font-bold">{user.fullName?.charAt(0) || 'S'}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 space-y-1">
                                                    <p className="text-sm font-medium leading-none">
                                                        <span className="text-slate-900">{user.fullName}</span>
                                                        <span className="text-slate-500 font-normal"> {activity.action} </span>
                                                        <span className="text-blue-600">{activity.message || activity.target}</span>
                                                    </p>
                                                    <p className="text-xs text-slate-400 flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> {timeStr}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-4 text-muted-foreground text-sm">No recent activity.</div>
                                )}
                            </div>
                            <div className="pt-2 border-t">
                                <h4 className="text-sm font-semibold text-slate-500 mb-2">
                                    Tasks for {selectedDate ? format(selectedDate, 'MMM dd') : 'Selected Date'}
                                </h4>
                                {calEvents.filter(e => selectedDate && isSameDay(e.date, selectedDate)).length > 0 ? (
                                    <ul className="space-y-1">
                                        {calEvents.filter(e => selectedDate && isSameDay(e.date, selectedDate)).map((e: any) => (
                                            <li key={e.id} className="text-xs flex items-center gap-2">
                                                <div className={cn("w-2 h-2 rounded-full", e.status === 'Completed' ? "bg-green-500" : "bg-blue-500")} />
                                                <span className={e.status === 'Completed' ? "line-through text-slate-400" : "text-slate-700"}>{e.title}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-xs text-slate-400 italic">No tasks due this day.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
