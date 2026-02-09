"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { MultiSelect } from '@/components/ui/multi-select';
import { Loader2, Send } from 'lucide-react';
import { EmployeeDocument } from '@/types';

const notificationSchema = z.object({
    title: z.string().min(1, "Title is required"),
    message: z.string().min(1, "Message is required"),
    targetAll: z.boolean().default(false),
    selectedEmployeeIds: z.array(z.string()).optional(),
}).refine((data) => data.targetAll || (data.selectedEmployeeIds && data.selectedEmployeeIds.length > 0), {
    message: "Please select at least one employee or target all.",
    path: ["selectedEmployeeIds"],
});

type NotificationFormValues = z.infer<typeof notificationSchema>;

export function SendNotificationForm() {
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const { data: employees, isLoading: isLoadingEmployees } = useFirestoreQuery<EmployeeDocument[]>(
        query(collection(firestore, "employees"), orderBy("fullName")),
        undefined,
        ['employees_select_list']
    );

    const form = useForm<NotificationFormValues>({
        resolver: zodResolver(notificationSchema),
        defaultValues: {
            title: '',
            message: '',
            targetAll: false,
            selectedEmployeeIds: [],
        },
    });

    const watchTargetAll = form.watch("targetAll");

    const employeeOptions = React.useMemo(() => {
        return employees?.map(emp => ({
            value: emp.uid || emp.id, // Prefer uid if available (linked to auth), otherwise doc ID
            label: `${emp.fullName} (${emp.employeeCode})`,
        })) || [];
    }, [employees]);

    async function onSubmit(data: NotificationFormValues) {
        setIsSubmitting(true);
        try {
            const payload = {
                title: data.title,
                body: data.message,
                userIds: data.targetAll ? undefined : data.selectedEmployeeIds,
                targetRoles: data.targetAll ? ['Employee', 'Admin', 'HR', 'Super Admin'] : undefined, // If all, maybe target broad roles or fetch all IDs backend side
            };

            // Refinement: If targetAll, we might want to just send without userIds and handle it on backend, 
            // OR let backend fetch all tokens. 
            // The current API route supports `targetRoles` or `userIds`.
            // If targetAll is true, we can send a custom flag or just use a broad role set.
            // For this implementation, let's use userIds if specific, and a flag or roles if all.
            // Re-reading api route: it checks targetRoles then userIds. 
            // If targetAll, let's pass a special flag or just broad roles. 
            // OR, we can just map all employee IDs here if list isn't huge.
            // Better: Update API to handle "all users" or just use the roles logic.
            // Let's use targetRoles for 'targetAll' case to be safe and efficient.

            if (data.targetAll) {
                // Broad roles to cover everyone. 
                // Adjust this list based on your actual system roles.
                payload.targetRoles = ['Super Admin', 'Admin', 'HR', 'Employee', 'Service', 'Accounts', 'Commercial', 'Viewer', 'DemoManager', 'Supervisor'];
                payload.userIds = undefined;
            }

            const response = await fetch('/api/notifications/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to send');
            }

            Swal.fire({
                title: "Sent!",
                text: `Notification sent successfully to ${result.successCount} devices.`,
                icon: "success"
            });

            form.reset();
        } catch (error: any) {
            console.error("Error sending notification:", error);
            Swal.fire("Error", error.message || "Failed to send notification.", "error");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                                <Input placeholder="Notification Title" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Message</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Type your message here..." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="targetAll"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base">Send to All Employees</FormLabel>
                                <FormDescription>Toggle to send this notification to every registered user.</FormDescription>
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

                {!watchTargetAll && (
                    <FormField
                        control={form.control}
                        name="selectedEmployeeIds"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Select Employees</FormLabel>
                                <FormControl>
                                    <MultiSelect
                                        options={employeeOptions}
                                        selected={field.value || []}
                                        onChange={field.onChange}
                                        placeholder="Select employees..."
                                        disabled={isLoadingEmployees}
                                    />
                                </FormControl>
                                <FormDescription>Search and select specific employees.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                <Button type="submit" disabled={isSubmitting || isLoadingEmployees} className="w-full md:w-auto">
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                        </>
                    ) : (
                        <>
                            <Send className="mr-2 h-4 w-4" /> Send Notification
                        </>
                    )}
                </Button>
            </form>
        </Form>
    );
}
