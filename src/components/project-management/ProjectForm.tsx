"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Calendar as CalendarIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
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
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, doc, setDoc, getDocs, getDoc, Timestamp, query, orderBy } from 'firebase/firestore';
import { MultiSelect } from "@/components/ui/multi-select";
import { Combobox } from '@/components/ui/combobox';
import Swal from 'sweetalert2';

const formSchema = z.object({
    projectTitle: z.string().min(2, "Project title must be at least 2 characters."),
    status: z.string().min(1, "Status is required."),
    priority: z.enum(['Low', 'Medium', 'High', 'Urgency']),
    budget: z.string().optional(),
    startDate: z.date({ required_error: "Start date is required." }),
    endDate: z.date().optional(),
    taskAccessibility: z.enum(['Assigned Users', 'Project Users']),
    clientCanDiscuss: z.boolean().default(false),
    tasksTimeEntries: z.boolean().default(false),
    projectUsers: z.array(z.string()).optional().default([]),
    clientId: z.string().min(1, "Client (Application) is required."),
    tags: z.array(z.string()).optional().default([]),
    description: z.string().optional(),
    department: z.enum(['HR', 'Accounts', 'Service']),
    invoiceNumber: z.string().min(1, "Invoice number is required."),
});

interface ProjectFormProps {
    initialData?: any;
    docId?: string;
}

export function ProjectForm({ initialData, docId }: ProjectFormProps) {
    const router = useRouter();
    const [usersList, setUsersList] = useState<{ label: string, value: string }[]>([]);
    const [allUsers, setAllUsers] = useState<{ id: string, name: string, photoURL?: string }[]>([]);
    const [customerList, setCustomerList] = useState<{ value: string, label: string }[]>([]);
    const [tagsList, setTagsList] = useState<{ label: string, value: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            projectTitle: initialData?.projectTitle || '',
            status: initialData?.status || 'Not Started',
            priority: initialData?.priority || 'Medium',
            budget: initialData?.budget?.toString() || '',
            startDate: initialData?.startDate ? new Date(initialData.startDate) : undefined,
            endDate: initialData?.endDate ? new Date(initialData.endDate) : undefined,
            taskAccessibility: initialData?.taskAccessibility || 'Assigned Users',
            clientCanDiscuss: initialData?.clientCanDiscuss || false,
            tasksTimeEntries: initialData?.tasksTimeEntries || false,
            projectUsers: initialData?.assignedUsers?.map((u: any) => u.id) || [],
            clientId: initialData?.clientId || '',
            tags: initialData?.tags || [],
            description: initialData?.description || '',
            department: initialData?.department || 'Service',
            invoiceNumber: initialData?.invoiceNumber || '',
        },
    });

    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingData(true);
            try {
                // Fetch Employees
                const usersSnap = await getDocs(query(collection(firestore, 'employees'), orderBy('firstName')));
                const usersData: { id: string, name: string, photoURL?: string }[] = [];
                const users = usersSnap.docs.map(doc => {
                    const data = doc.data();
                    const fullName = data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown';
                    usersData.push({
                        id: doc.id,
                        name: fullName,
                        photoURL: data.photoURL || data.param?.photoURL
                    });
                    return { label: fullName, value: doc.id };
                });
                setUsersList(users);
                setAllUsers(usersData);

                // Fetch Customers
                const customersSnap = await getDocs(query(collection(firestore, 'customers'), orderBy('applicantName')));
                const customers = customersSnap.docs.map(doc => {
                    const data = doc.data();
                    const label = data.applicantName || `Customer-${doc.id}`;
                    return { value: doc.id, label: label };
                });
                setCustomerList(customers);

                // Fetch Global Tags from Settings
                const settingsSnap = await getDoc(doc(firestore, 'project_settings', 'global'));
                let tags: string[] = [];
                if (settingsSnap.exists()) {
                    tags = settingsSnap.data().tags || [];
                }

                // Fallback if no tags in settings
                if (tags.length === 0) {
                    tags = ['Web Development', 'Mobile App', 'Design', 'Marketing', 'SEO'];
                }

                setTagsList(tags.map(tag => ({ label: tag, value: tag })));

            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchData();
    }, []);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setLoading(true);
        try {
            const selectedCustomer = customerList.find(c => c.value === values.clientId);
            const clientName = selectedCustomer ? selectedCustomer.label : 'Unknown';

            const assignedUsers = values.projectUsers.map(uid => {
                const userObj = allUsers.find(u => u.id === uid);
                return {
                    id: uid,
                    name: userObj?.name || 'Unknown User',
                    photoURL: userObj?.photoURL
                };
            });

            const projectData: any = {
                projectTitle: values.projectTitle,
                clientName: clientName,
                clientId: values.clientId,
                status: values.status,
                priority: values.priority,
                assignedUsers: assignedUsers,
                startDate: values.startDate.toISOString(),
                endDate: values.endDate?.toISOString(),
                description: values.description,
                tags: values.tags,
                budget: values.budget ? parseFloat(values.budget) : 0,
                taskAccessibility: values.taskAccessibility,
                clientCanDiscuss: values.clientCanDiscuss,
                tasksTimeEntries: values.tasksTimeEntries,
                department: values.department,
                invoiceNumber: values.invoiceNumber,
                updatedAt: Timestamp.now()
            };

            if (docId) {
                await setDoc(doc(firestore, 'projects', docId), projectData, { merge: true });
                await Swal.fire({
                    title: "Project Updated",
                    text: "The project has been successfully updated.",
                    icon: "success",
                    confirmButtonColor: "#3085d6",
                });
            } else {
                projectData.projectId = `PRJ-${Math.floor(Math.random() * 10000)}`;
                projectData.createdAt = Timestamp.now();
                await addDoc(collection(firestore, 'projects'), projectData);
                await Swal.fire({
                    title: "Project Created",
                    text: "New project has been successfully created.",
                    icon: "success",
                    confirmButtonColor: "#3085d6",
                });
            }

            router.push('/dashboard/project-management/projects');
        } catch (error) {
            console.error("Error saving project:", error);
            Swal.fire({
                title: "Error",
                text: "Failed to save project. Please try again.",
                icon: "error",
                confirmButtonColor: "#d33",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="md:col-span-2">
                        <CardHeader><CardTitle>Project Details</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="projectTitle"
                                render={({ field }) => (
                                    <FormItem className="col-span-2">
                                        <FormLabel>Project Name *</FormLabel>
                                        <FormControl><Input placeholder="Enter project name" {...field} /></FormControl>
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
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {['Not Started', 'In Progress', 'On Hold', 'Completed', 'Top Priority'].map((status) => (
                                                    <SelectItem key={status} value={status}>{status}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="priority"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Priority</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {['Low', 'Medium', 'High', 'Urgency'].map((p) => (
                                                    <SelectItem key={p} value={p}>{p}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="budget"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Budget</FormLabel>
                                        <FormControl><Input type="number" placeholder="Enter budget amount" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="startDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Starts At *</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
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
                                                    <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <Card className="md:col-span-2">
                        <CardHeader><CardTitle>Settings & Assignments</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="taskAccessibility"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Task Accessibility</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select accessibility" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="Assigned Users">Assigned Users</SelectItem>
                                                <SelectItem value="Project Users">Project Users</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="clientId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Select Customer *</FormLabel>
                                        <Combobox
                                            options={customerList}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            placeholder="Search Customer..."
                                            selectPlaceholder={isLoadingData ? "Loading..." : "Select Customer"}
                                            emptyStateMessage="No customers found"
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="clientCanDiscuss"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5"><FormLabel className="text-base">Client Can Discuss?</FormLabel><FormDescription>Allow client to view and comment on tasks.</FormDescription></div>
                                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="tasksTimeEntries"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5"><FormLabel className="text-base">Tasks Time Entries</FormLabel><FormDescription>Enable time tracking for tasks.</FormDescription></div>
                                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="projectUsers"
                                render={({ field }) => (
                                    <FormItem className="col-span-2">
                                        <FormLabel>Select Users</FormLabel>
                                        <FormControl>
                                            <MultiSelect
                                                options={usersList}
                                                onChange={field.onChange}
                                                selected={field.value || []}
                                                placeholder="Select team members"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="tags"
                                render={({ field }) => (
                                    <FormItem className="col-span-2">
                                        <FormLabel>Select Tags</FormLabel>
                                        <FormControl>
                                            <MultiSelect
                                                options={tagsList}
                                                onChange={field.onChange}
                                                selected={field.value || []}
                                                placeholder="Select or Create Tags"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <Card className="md:col-span-2">
                        <CardHeader><CardTitle>Additional Information</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="department"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Department *</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="HR">HR</SelectItem>
                                                <SelectItem value="Accounts">Accounts</SelectItem>
                                                <SelectItem value="Service">Service</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="invoiceNumber"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Invoice Number *</FormLabel>
                                        <FormControl><Input placeholder="Enter invoice number" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem className="col-span-2">
                                        <FormLabel>Description</FormLabel>
                                        <FormControl><Textarea placeholder="Enter project description..." className="min-h-[100px]" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>
                </div>
                <div className="flex justify-end gap-4">
                    <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
                    <Button type="submit" disabled={loading} className="bg-primary text-white">
                        {loading ? (docId ? "Updating..." : "Creating...") : (docId ? "Update Project" : "Create Project")}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
