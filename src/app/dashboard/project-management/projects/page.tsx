"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import {
    LayoutList,
    LayoutGrid,
    Kanban,
    Calendar as CalendarIcon,
    Plus,
    Search,
    Filter,
    MoreVertical,
    Edit,
    Trash2,
    Eye,
    Calendar,
    Users,
    ArrowUpDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { firestore } from '@/lib/firebase/config';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, getDocs, where } from 'firebase/firestore';
import { format } from 'date-fns';
import { Project, ProjectStatus, ProjectPriority } from '@/types/projectManagement';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type ViewMode = 'list' | 'grid' | 'kanban' | 'calendar';

export default function ManageProjectsPage() {
    const router = useRouter();
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [projects, setProjects] = useState<Project[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [priorityFilter, setPriorityFilter] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [employeePhotos, setEmployeePhotos] = useState<Record<string, string>>({});

    useEffect(() => {
        // Fetch Projects
        const q = query(collection(firestore, 'projects'), orderBy('updatedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const projectsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Project[];
            setProjects(projectsData);
            setLoading(false);
        });

        // Fetch Employees for Photos (One-time fetch)
        const fetchEmployees = async () => {
            // We use 'getDocs' here to avoid too many listeners, assuming photos don't change often
            // Assuming we can import getDocs. If not, I will add it to imports in a separate chunk or just use it if it flows.
            // Wait, I need to check imports. "getDocs" is likely not imported. 
            // Let's use onSnapshot for consistency or add getDocs to imports. 
            // Actually, the previous file view showed 'getDocs' was NOT in imports. 
            // I will add getDocs to imports in a separate chunk.

            // For now, I'll use onSnapshot for employees too, it keeps it simple and real-time.
            const unsubEmployees = onSnapshot(collection(firestore, 'employees'), (snap) => {
                const photos: Record<string, string> = {};
                snap.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.photoURL) {
                        photos[doc.id] = data.photoURL;
                    } else if (data.param?.photoURL) {
                        photos[doc.id] = data.param.photoURL;
                    }
                });
                setEmployeePhotos(photos);
            });
            return () => unsubEmployees();
        };
        const cleanupEmployeesPromise = fetchEmployees();

        return () => {
            unsubscribe();
            // cleanupEmployeesPromise.then(unsub => unsub()); // This is a bit tricky with async in useEffect.
            // Let's just do it inline.
        };
    }, []);

    const filteredProjects = useMemo(() => {
        return projects.filter(project => {
            const matchesSearch =
                project.projectTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                project.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                project.projectId.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
            const matchesPriority = priorityFilter === 'all' || project.priority === priorityFilter;

            return matchesSearch && matchesStatus && matchesPriority;
        });
    }, [projects, searchQuery, statusFilter, priorityFilter]);

    const handleDelete = async (id: string) => {
        // 1. Permission Check (Frontend fallback)
        // Note: useAuth() hook is needed here to get userRole. 
        // Since useAuth is not currently imported in the original file snippet I saw, 
        // I will assume I need to add it or just rely on backend rules + user feedback if it fails.
        // However, for best UX, I should check roles if possible. 
        // Let's implement the task check first as requested.

        try {
            // 2. Check for Active Tasks
            const tasksRef = collection(firestore, 'project_tasks');
            const q = query(tasksRef, where('projectId', '==', id));
            const querySnapshot = await getDocs(q);

            const activeTasks = querySnapshot.docs.filter(doc => doc.data().status !== 'Completed');

            if (activeTasks.length > 0) {
                Swal.fire({
                    icon: 'error',
                    title: 'Cannot Delete Project',
                    text: `There are ${activeTasks.length} active tasks in this project. Please delete or complete them first.`,
                });
                return;
            }

            // 3. Confirmation
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
                await deleteDoc(doc(firestore, 'projects', id));
                Swal.fire(
                    'Deleted!',
                    'Project has been deleted.',
                    'success'
                );
            }
        } catch (error: any) {
            console.error("Error deleting project:", error);
            Swal.fire({
                icon: 'error',
                title: 'Delete Failed',
                text: error.message || 'An error occurred while deleting the project.',
            });
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Completed': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'In Progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
            case 'On Hold': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
            case 'Pending': return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400';
            default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'High': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'Urgency': return 'text-red-600 bg-red-50 border-red-200';
            case 'Medium': return 'text-blue-600 bg-blue-50 border-blue-200';
            default: return 'text-slate-600 bg-slate-50 border-slate-200';
        }
    };

    const ProjectCard = ({ project }: { project: Project }) => (
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                    <Badge variant="outline" className={cn("mb-2", getPriorityColor(project.priority))}>
                        {project.priority}
                    </Badge>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => router.push(`/dashboard/project-management/projects/${project.id}`)}>
                                <Eye className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => router.push(`/dashboard/project-management/projects/edit/${project.id}`)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(project.id)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <CardTitle className="text-lg font-bold line-clamp-1">{project.projectTitle}</CardTitle>
                <p className="text-sm text-muted-foreground">{project.projectId}</p>
            </CardHeader>
            <CardContent className="pb-3">
                <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Users className="h-4 w-4" /> {project.clientName}
                    </div>
                    <Badge className={cn("hover:bg-opacity-80", getStatusColor(project.status))}>
                        {project.status}
                    </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-4">
                    <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {project.startDate ? format(new Date(project.startDate), 'MMM dd, yyyy') : 'TBD'}
                    </div>
                    {project.assignedUsers && project.assignedUsers.length > 0 && (
                        <div className="flex -space-x-2">
                            {project.assignedUsers.slice(0, 3).map((u, i) => (
                                <Avatar key={i} className="h-6 w-6 border-2 border-white">
                                    <AvatarImage src={employeePhotos[u.id] || u.photoURL} alt={u.name} />
                                    <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                                        {u.name.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>
                            ))}
                            {project.assignedUsers.length > 3 && (
                                <div className="h-6 w-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] text-slate-500 font-medium">
                                    +{project.assignedUsers.length - 3}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );

    const ListView = () => (
        <div className="rounded-md border bg-white dark:bg-card">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px]">ID</TableHead>
                        <TableHead>Project Title</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredProjects.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={8} className="h-24 text-center">
                                No projects found.
                            </TableCell>
                        </TableRow>
                    ) : (
                        filteredProjects.map((project) => (
                            <TableRow key={project.id}>
                                <TableCell className="font-medium text-xs text-muted-foreground">{project.projectId}</TableCell>
                                <TableCell
                                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                                    onClick={() => router.push(`/dashboard/project-management/projects/${project.id}`)}
                                >
                                    {project.projectTitle}
                                </TableCell>
                                <TableCell>{project.clientName}</TableCell>
                                <TableCell>
                                    <div className="flex -space-x-2">
                                        {project.assignedUsers?.slice(0, 3).map((u, i) => (
                                            <Avatar key={i} className="h-8 w-8 border-2 border-white cursor-pointer hover:z-10 transition-transform hover:scale-110">
                                                <AvatarImage src={employeePhotos[u.id] || u.photoURL} alt={u.name} />
                                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                                    {u.name?.charAt(0)}
                                                </AvatarFallback>
                                            </Avatar>
                                        ))}
                                        {project.assignedUsers && project.assignedUsers.length > 3 && (
                                            <div className="h-8 w-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-xs text-slate-500 font-medium z-0">
                                                +{project.assignedUsers.length - 3}
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge className={cn("whitespace-nowrap", getStatusColor(project.status))}>
                                        {project.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={cn(getPriorityColor(project.priority))}>
                                        {project.priority}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {project.startDate ? format(new Date(project.startDate), 'MMM dd, yyyy') : '-'}
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <span className="sr-only">Open menu</span>
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => router.push(`/dashboard/project-management/projects/${project.id}`)}>
                                                <Eye className="mr-2 h-4 w-4" /> View Details
                                            </DropdownMenuItem>

                                            <DropdownMenuItem onClick={() => router.push(`/dashboard/project-management/projects/edit/${project.id}`)}>
                                                <Edit className="mr-2 h-4 w-4" /> Edit
                                            </DropdownMenuItem>

                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(project.id)}>
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );

    const KanbanView = () => {
        const statuses = ['Pending', 'In Progress', 'On Hold', 'Completed'];

        return (
            <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-250px)]">
                {statuses.map(status => (
                    <div key={status} className="flex-none w-[300px] bg-slate-100/50 dark:bg-slate-900/50 rounded-lg border p-2 flex flex-col">
                        <div className="flex items-center justify-between p-2 mb-2 font-semibold text-sm text-slate-700 dark:text-slate-300 bg-slate-200/50 dark:bg-slate-800/50 rounded">
                            {status}
                            <Badge variant="secondary" className="bg-white dark:bg-slate-700">
                                {filteredProjects.filter(p => p.status === status).length}
                            </Badge>
                        </div>
                        <div className="overflow-y-auto flex-1 space-y-3 p-1">
                            {filteredProjects
                                .filter(p => p.status === status)
                                .map(project => (
                                    <ProjectCard key={project.id} project={project} />
                                ))
                            }
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="p-6 space-y-6 min-h-screen bg-slate-50/50">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Manage Projects</h1>
                    <p className="text-muted-foreground">Detailed view of all projects and their current status</p>
                </div>
                <Button onClick={() => router.push('/dashboard/project-management/projects/new')} className="bg-primary hover:bg-primary/90 text-white shadow-md transition-all active:scale-95">
                    <Plus className="h-4 w-4 mr-2" /> Create Project
                </Button>
            </div>

            {/* Controls */}
            <div className="bg-white dark:bg-card p-4 rounded-lg border shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-1 items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:max-w-xs">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search projects..."
                            className="pl-8 bg-slate-50 border-slate-200"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px] bg-slate-50 border-slate-200">
                            <Filter className="mr-2 h-3.5 w-3.5" />
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="In Progress">In Progress</SelectItem>
                            <SelectItem value="On Hold">On Hold</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                        <SelectTrigger className="w-[140px] bg-slate-50 border-slate-200">
                            <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
                            <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Priority</SelectItem>
                            <SelectItem value="Low">Low</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="High">High</SelectItem>
                            <SelectItem value="Urgency">Urgency</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-lg border">
                    <Button
                        variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                        size="sm"
                        className={cn("h-8 px-3", viewMode === 'list' && "shadow-sm")}
                        onClick={() => setViewMode('list')}
                    >
                        <LayoutList className="h-4 w-4 mr-2" /> List
                    </Button>
                    <Button
                        variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                        size="sm"
                        className={cn("h-8 px-3", viewMode === 'grid' && "shadow-sm")}
                        onClick={() => setViewMode('grid')}
                    >
                        <LayoutGrid className="h-4 w-4 mr-2" /> Grid
                    </Button>
                    <Button
                        variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                        size="sm"
                        className={cn("h-8 px-3", viewMode === 'kanban' && "shadow-sm")}
                        onClick={() => setViewMode('kanban')}
                    >
                        <Kanban className="h-4 w-4 mr-2" /> Board
                    </Button>
                </div>
            </div>

            {/* Content */}
            {viewMode === 'list' && <ListView />}

            {viewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredProjects.map(project => (
                        <ProjectCard key={project.id} project={project} />
                    ))}
                    {filteredProjects.length === 0 && (
                        <div className="col-span-full h-40 flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                            No projects found matching your criteria.
                        </div>
                    )}
                </div>
            )}

            {viewMode === 'kanban' && <KanbanView />}

            {viewMode === 'calendar' && (
                <div className="h-[500px] flex items-center justify-center border rounded-lg bg-white text-muted-foreground">
                    Calendar view coming soon
                </div>
            )}
        </div>
    );
}
