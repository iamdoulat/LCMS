"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Calendar as CalendarIcon, Save, X, Paperclip } from 'lucide-react';
import Swal from 'sweetalert2';
import { firestore, storage } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, Timestamp, runTransaction, doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { MultiSelect } from '@/components/ui/multi-select';

const taskSchema = z.object({
    taskTitle: z.string().min(1, "Task Title is required"),
    status: z.enum(['Not Started', 'In Progress', 'On Hold', 'Completed']),
    priority: z.enum(['Low', 'Medium', 'High', 'Urgency']),
    projectId: z.string().min(1, "Project is required"),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    assignedUserIds: z.array(z.string()).min(1, "At least one user must be assigned"),
    clientCanDiscuss: z.boolean().default(false),
    description: z.string().optional(),
    billingType: z.enum(['None', 'Billable', 'Non-Billable']).default('None'),
    completionPercentage: z.string(),
    enableReminder: z.boolean().default(false),
    enableRecurring: z.boolean().default(false),
});

type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskFormProps {
    initialData?: any;
    docId?: string;
    initialStatus?: string;
}

export function TaskForm({ initialData, docId, initialStatus }: TaskFormProps) {
    const router = useRouter();
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [projectsList, setProjectsList] = useState<{ id: string, name: string }[]>([]);
    const [usersList, setUsersList] = useState<{ label: string, value: string }[]>([]);
    const [allUsers, setAllUsers] = useState<{ id: string, name: string, photoURL?: string, employeeCode?: string, firestoreId: string }[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [existingAttachments, setExistingAttachments] = useState<any[]>(initialData?.attachments || []);

    const form = useForm<TaskFormValues>({
        resolver: zodResolver(taskSchema),
        defaultValues: {
            taskTitle: initialData?.taskTitle || '',
            status: (initialData?.status || initialStatus || 'Not Started') as any,
            priority: initialData?.priority || 'Medium',
            projectId: initialData?.projectId || '',
            assignedUserIds: initialData?.assignedUserIds || [],
            clientCanDiscuss: initialData?.clientCanDiscuss || false,
            description: initialData?.description || '',
            billingType: initialData?.billingType || 'None',
            completionPercentage: initialData?.completionPercentage?.toString() || '0',
            enableReminder: initialData?.enableReminder || false,
            enableRecurring: initialData?.enableRecurring || false,
            startDate: initialData?.startDate ? new Date(initialData.startDate) : undefined,
            endDate: initialData?.dueDate ? new Date(initialData.dueDate) : undefined,
        },
    });

    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingData(true);
            try {
                // Fetch Projects
                const projectsSnap = await getDocs(query(collection(firestore, 'projects'), orderBy('updatedAt', 'desc')));
                const projects = projectsSnap.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().projectTitle || 'Untitled Project'
                }));
                setProjectsList(projects);

                // Fetch Employees
                const usersSnap = await getDocs(query(collection(firestore, 'employees'), orderBy('firstName')));
                const usersData: { id: string, name: string, photoURL?: string, employeeCode?: string, firestoreId: string }[] = [];
                const users = usersSnap.docs.map(doc => {
                    const data = doc.data();
                    const fullName = data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown';
                    const code = data.employeeCode || doc.id;
                    usersData.push({
                        id: code,
                        firestoreId: doc.id,
                        name: fullName,
                        photoURL: data.photoURL || data.param?.photoURL,
                        employeeCode: data.employeeCode
                    });
                    return { label: `[${data.employeeCode || 'N/A'}] ${fullName}`, value: code };
                });
                setUsersList(users);
                setAllUsers(usersData);

            } catch (error) {
                console.error("Error fetching data:", error);
                Swal.fire("Error", "Failed to load projects or users.", "error");
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (!isLoadingData && initialData?.assignedUserIds && allUsers.length > 0) {
            const currentIds = form.getValues('assignedUserIds');
            const mappedIds = currentIds.map(id => {
                const userObj = allUsers.find(u => u.firestoreId === id);
                return userObj ? userObj.id : id;
            });
            form.setValue('assignedUserIds', mappedIds);
        }
    }, [isLoadingData, allUsers]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const removeExistingAttachment = (index: number) => {
        setExistingAttachments(prev => prev.filter((_, i) => i !== index));
    };

    async function onSubmit(data: TaskFormValues) {
        setIsSubmitting(true);
        try {
            const project = projectsList.find(p => p.id === data.projectId);
            const projectTitle = project ? project.name : 'Unknown Project';

            const assignedUsers = data.assignedUserIds.map(codeOrUid => {
                const userObj = allUsers.find(u => u.id === codeOrUid || u.firestoreId === codeOrUid);
                return {
                    id: userObj?.id || codeOrUid,
                    name: userObj?.name || 'Unknown User',
                    photoURL: userObj?.photoURL,
                    employeeCode: userObj?.employeeCode || (userObj?.id !== userObj?.firestoreId ? userObj?.id : undefined)
                };
            });

            if (docId) {
                // UPDATE MODE
                const attachments = [...existingAttachments];
                if (selectedFiles.length > 0) {
                    for (const file of selectedFiles) {
                        const uniqueName = `${Date.now()}_${file.name}`;
                        const storageRef = ref(storage, `tasks/${initialData.taskId}/attachments/${uniqueName}`);
                        await uploadBytes(storageRef, file);
                        const url = await getDownloadURL(storageRef);
                        attachments.push({
                            name: file.name,
                            url: url,
                            type: file.type.startsWith('image/') ? 'image' : 'file'
                        });
                    }
                }

                const taskData = {
                    taskTitle: data.taskTitle,
                    projectId: data.projectId,
                    projectTitle: projectTitle,
                    status: data.status,
                    priority: data.priority,
                    assignedUsers: assignedUsers,
                    assignedUserIds: data.assignedUserIds,
                    startDate: data.startDate ? data.startDate.toISOString() : null,
                    dueDate: data.endDate ? data.endDate.toISOString() : null,
                    clientCanDiscuss: data.clientCanDiscuss,
                    description: data.description || '',
                    billingType: data.billingType,
                    completionPercentage: parseInt(data.completionPercentage),
                    enableReminder: data.enableReminder,
                    enableRecurring: data.enableRecurring,
                    attachments: attachments,
                    updatedAt: serverTimestamp(),
                };

                await setDoc(doc(firestore, 'project_tasks', docId), taskData, { merge: true });

                // Trigger Notifications
                if (data.assignedUserIds && data.assignedUserIds.length > 0) {
                    fetch('/api/notify/task', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'task_assigned',
                            taskId: docId,
                            targetUserIds: data.assignedUserIds
                        })
                    }).catch(err => console.error('Task update notification error:', err));
                }

                Swal.fire({
                    title: "Task Updated!",
                    text: "The task has been successfully updated.",
                    icon: "success",
                    timer: 1500,
                    showConfirmButton: false
                });
            } else {
                // CREATE MODE
                let createdDocId = '';
                await runTransaction(firestore, async (transaction) => {
                    const counterRef = doc(firestore, 'counters', 'tasks');
                    const counterSnap = await transaction.get(counterRef);

                    let newCount = 1000;
                    if (counterSnap.exists()) {
                        newCount = counterSnap.data().count + 1;
                    }

                    const customTaskId = `T-${newCount}`;

                    const attachments = [];
                    if (selectedFiles.length > 0) {
                        for (const file of selectedFiles) {
                            const uniqueName = `${Date.now()}_${file.name}`;
                            const storageRef = ref(storage, `tasks/${customTaskId}/attachments/${uniqueName}`);
                            await uploadBytes(storageRef, file);
                            const url = await getDownloadURL(storageRef);
                            attachments.push({
                                name: file.name,
                                url: url,
                                type: file.type.startsWith('image/') ? 'image' : 'file'
                            });
                        }
                    }

                    const newTaskRef = doc(collection(firestore, 'project_tasks'));
                    createdDocId = newTaskRef.id;
                    const taskData = {
                        taskId: customTaskId,
                        taskTitle: data.taskTitle,
                        projectId: data.projectId,
                        projectTitle: projectTitle,
                        status: data.status,
                        priority: data.priority,
                        assignedUsers: assignedUsers,
                        assignedUserIds: data.assignedUserIds,
                        startDate: data.startDate ? data.startDate.toISOString() : undefined,
                        dueDate: data.endDate ? data.endDate.toISOString() : undefined,
                        clientCanDiscuss: data.clientCanDiscuss,
                        description: data.description || '',
                        billingType: data.billingType,
                        completionPercentage: parseInt(data.completionPercentage),
                        enableReminder: data.enableReminder,
                        enableRecurring: data.enableRecurring,
                        attachments: attachments,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    };

                    transaction.set(counterRef, { count: newCount }, { merge: true });
                    transaction.set(newTaskRef, taskData);
                });

                // Trigger Notifications
                if (data.assignedUserIds && data.assignedUserIds.length > 0) {
                    fetch('/api/notify/task', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'task_assigned',
                            taskId: createdDocId,
                            targetUserIds: data.assignedUserIds
                        })
                    }).catch(err => console.error('Task creation notification error:', err));
                }

                Swal.fire({
                    title: "Task Created!",
                    text: "The new task has been successfully added.",
                    icon: "success",
                    timer: 1500,
                    showConfirmButton: false
                });
            }

            router.push('/dashboard/project-management/tasks');
            router.refresh();

        } catch (error) {
            console.error("Error saving task:", error);
            Swal.fire("Error", "Failed to save task.", "error");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                            control={form.control}
                            name="taskTitle"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Task Name *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter task title" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Status *</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="Not Started">Not Started</SelectItem>
                                            <SelectItem value="In Progress">In Progress</SelectItem>
                                            <SelectItem value="On Hold">On Hold</SelectItem>
                                            <SelectItem value="Completed">Completed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                            control={form.control}
                            name="priority"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Priority</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select priority" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="Low">Low</SelectItem>
                                            <SelectItem value="Medium">Medium</SelectItem>
                                            <SelectItem value="High">High</SelectItem>
                                            <SelectItem value="Urgency">Urgency</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="projectId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Select Project *</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={isLoadingData ? "Loading projects..." : "Select Project"} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {projectsList.map(project => (
                                                <SelectItem key={project.id} value={project.id}>
                                                    {project.name}
                                                </SelectItem>
                                            ))}
                                            {projectsList.length === 0 && !isLoadingData && (
                                                <div className="p-2 text-sm text-muted-foreground text-center">No projects available</div>
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                            control={form.control}
                            name="startDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Starts At</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full pl-3 text-left font-normal",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value ? (
                                                        format(field.value, "PPP")
                                                    ) : (
                                                        <span>Pick a start date</span>
                                                    )}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={field.onChange}
                                                disabled={(date) =>
                                                    date < new Date("1900-01-01")
                                                }
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="endDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Ends At</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full pl-3 text-left font-normal",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value ? (
                                                        format(field.value, "PPP")
                                                    ) : (
                                                        <span>Pick an end date</span>
                                                    )}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={field.onChange}
                                                disabled={(date) =>
                                                    date < new Date("1900-01-01")
                                                }
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        <FormField
                            control={form.control}
                            name="assignedUserIds"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Select Users *</FormLabel>
                                    <FormControl>
                                        <MultiSelect
                                            options={usersList}
                                            selected={field.value}
                                            onChange={field.onChange}
                                            placeholder="Select team members..."
                                            className="w-full"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="clientCanDiscuss"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-slate-50 mt-1">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Client Can Discuss?</FormLabel>
                                        <FormDescription>
                                            Allow the client to view and comment on this task.
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="pt-4 border-t">
                        <h3 className="text-lg font-medium mb-4">Attachments</h3>
                        <div className="space-y-4">
                            <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors">
                                <Paperclip className="h-8 w-8 text-slate-400 mb-2" />
                                <p className="text-sm text-muted-foreground mb-4">Drag and drop files here, or click to select files</p>
                                <Input
                                    id="file-upload"
                                    type="file"
                                    multiple
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                                <label htmlFor="file-upload">
                                    <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('file-upload')?.click()}>
                                        Select Files
                                    </Button>
                                </label>
                            </div>

                            {(existingAttachments.length > 0 || selectedFiles.length > 0) && (
                                <div className="space-y-2">
                                    {existingAttachments.map((file, index) => (
                                        <div key={`existing-${index}`} className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-100 rounded-lg shadow-sm">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="h-8 w-8 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-[10px] font-bold text-blue-600">URL</span>
                                                </div>
                                                <span className="text-sm text-slate-700 truncate">{file.name}</span>
                                                <Badge variant="outline" className="text-[9px] bg-white h-4">Existing</Badge>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-400 hover:text-red-500"
                                                onClick={() => removeExistingAttachment(index)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    {selectedFiles.map((file, index) => (
                                        <div key={`new-${index}`} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-xs font-bold text-slate-500">{file.name.split('.').pop()?.toUpperCase()}</span>
                                                </div>
                                                <span className="text-sm text-slate-700 truncate">{file.name}</span>
                                                <span className="text-xs text-muted-foreground flex-shrink-0">({(file.size / 1024).toFixed(0)} KB)</span>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-400 hover:text-red-500"
                                                onClick={() => removeFile(index)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder="Enter task description details..."
                                        className="min-h-[120px]"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="pt-4 border-t">
                        <h3 className="text-lg font-medium mb-4">Additional Fields</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                            control={form.control}
                            name="billingType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Billing Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select billing type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="None">None</SelectItem>
                                            <SelectItem value="Billable">Billable</SelectItem>
                                            <SelectItem value="Non-Billable">Non-Billable</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="completionPercentage"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Completion Percentage (%)</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select percentage" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {Array.from({ length: 11 }, (_, i) => i * 10).map(val => (
                                                <SelectItem key={val} value={val.toString()}>
                                                    {val}%
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                            control={form.control}
                            name="enableReminder"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-slate-50">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Enable Reminder</FormLabel>
                                        <FormDescription>
                                            Send notifications for this task.
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="enableRecurring"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-slate-50">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Enable Recurring Task</FormLabel>
                                        <FormDescription>
                                            Repeat this task automatically.
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="flex gap-4 pt-4 justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.back()}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting || isLoadingData} className="min-w-[150px]">
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {docId ? "Updating..." : "Creating..."}
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    {docId ? "Update Task" : "Create Task"}
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}
