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
    Calendar as CalendarIcon,
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    CheckCircle2,
    AlertCircle,
    Info
} from "lucide-react";
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
import { collection, query, where, onSnapshot, orderBy, limit, getDocs } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
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

const StatCard = ({ title, value, icon: Icon, description, trend, trendValue, className, iconColor }: StatCardProps) => (
    <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            <div className={cn("p-2 rounded-full bg-slate-100 dark:bg-slate-800", iconColor)}>
                <Icon className="h-4 w-4" />
            </div>
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {(description || trend) && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center">
                    {trend === 'up' && <ArrowUpRight className="h-4 w-4 text-emerald-500 mr-1" />}
                    {trend === 'down' && <ArrowDownRight className="h-4 w-4 text-rose-500 mr-1" />}
                    {trendValue && <span className={cn("font-medium mr-1", trend === 'up' ? "text-emerald-500" : trend === 'down' ? "text-rose-500" : "")}>{trendValue}</span>}
                    {description}
                </p>
            )}
        </CardContent>
    </Card>
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

    useEffect(() => {
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
            setProjectStatusData(Object.entries(statusCounts).map(([name, value]) => ({ name, value })));

            // Filter My Active Projects (Assuming 'assignedUserIds' or similar exists, or just all active projects if admin)
            // For now, let's just take the first 4 active projects for display
            const active = snap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter((p: any) => p.status === 'In Progress' || p.status === 'Pending')
                .slice(0, 4);
            setMyProjects(active);
        });

        const unsubTasks = onSnapshot(collection(firestore, 'project_tasks'), (snap) => {
            setStats(prev => ({ ...prev, totalTasks: snap.size }));

            const statusCounts: Record<string, number> = {};
            snap.docs.forEach(doc => {
                const status = doc.data().status || 'Pending';
                statusCounts[status] = (statusCounts[status] || 0) + 1;
            });
            setTaskStatusData(Object.entries(statusCounts).map(([name, value]) => ({ name, value })));
        });

        const unsubUsers = onSnapshot(query(collection(firestore, 'employees'), where('disabled', '==', false)), (snap) => {
            setStats(prev => ({ ...prev, totalUsers: snap.size }));
        });

        const unsubClients = onSnapshot(collection(firestore, 'customers'), (snap) => {
            setStats(prev => ({ ...prev, totalClients: snap.size }));
        });

        // Mocking Recent Activity for now (replace with actual collection later)
        setRecentActivities([
            { id: '1', user: 'Alice', action: 'created a new project', target: 'Website Redesign', time: '2 mins ago', avatar: '/avatars/01.png' },
            { id: '2', user: 'Bob', action: 'completed task', target: 'Homepage Wireframe', time: '1 hour ago', avatar: '/avatars/02.png' },
            { id: '3', user: 'Charlie', action: 'commented on', target: 'API Integration', time: '3 hours ago', avatar: '/avatars/03.png' },
            { id: '4', user: 'Diana', action: 'updated status', target: 'Mobile App', time: '5 hours ago', avatar: '/avatars/04.png' },
        ]);

        return () => {
            unsubProjects();
            unsubTasks();
            unsubUsers();
            unsubClients();
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
                    iconColor="text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400"
                />
                <StatCard
                    title="Total Tasks"
                    value={stats.totalTasks}
                    icon={ListChecks}
                    trend="up"
                    trendValue="+12%"
                    description="from last week"
                    iconColor="text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400"
                />
                <StatCard
                    title="Active Users"
                    value={stats.totalUsers}
                    icon={Users}
                    description="team members"
                    iconColor="text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400"
                />
                <StatCard
                    title="Total Clients"
                    value={stats.totalClients}
                    icon={Building2}
                    description="active contracts"
                    iconColor="text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400"
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
                            <AreaChart data={[
                                { name: 'Jan', income: 4000, expense: 2400 },
                                { name: 'Feb', income: 3000, expense: 1398 },
                                { name: 'Mar', income: 2000, expense: 9800 },
                                { name: 'Apr', income: 2780, expense: 3908 },
                                { name: 'May', income: 1890, expense: 4800 },
                                { name: 'Jun', income: 2390, expense: 3800 },
                                { name: 'Jul', income: 3490, expense: 4300 },
                            ]}>
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
                                {recentActivities.map((activity, i) => (
                                    <div key={i} className="flex items-start gap-4 p-3 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors">
                                        <Avatar className="h-9 w-9 border-2 border-white shadow-sm">
                                            <AvatarFallback className="bg-blue-600 text-white font-bold">{activity.user[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 space-y-1">
                                            <p className="text-sm font-medium leading-none">
                                                <span className="text-slate-900">{activity.user}</span>
                                                <span className="text-slate-500 font-normal"> {activity.action} </span>
                                                <span className="text-blue-600">{activity.target}</span>
                                            </p>
                                            <p className="text-xs text-slate-400 flex items-center gap-1">
                                                <Clock className="h-3 w-3" /> {activity.time}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
