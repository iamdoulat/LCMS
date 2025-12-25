import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import Swal from 'sweetalert2';
import type { LeaveTypeDefinition } from '@/types';

const formSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    code: z.string().min(1, 'Code is required'),
    shortCode: z.string().optional(),
    isActive: z.boolean().default(true),
});

interface EditLeaveTypeFormProps {
    leaveType: LeaveTypeDefinition;
    onSuccess: () => void;
}

export function EditLeaveTypeForm({ leaveType, onSuccess }: EditLeaveTypeFormProps) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: leaveType.name,
            code: leaveType.code,
            shortCode: leaveType.shortCode || '',
            isActive: leaveType.isActive ?? true,
        },
    });

    const isSubmitting = form.formState.isSubmitting;

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            await updateDoc(doc(firestore, 'hrm_settings', 'leave_types', 'items', leaveType.id), {
                ...values,
                updatedAt: serverTimestamp(),
            });
            Swal.fire({
                title: 'Success',
                text: 'Leave Type updated successfully',
                icon: 'success',
                timer: 1000,
                showConfirmButton: false
            });
            onSuccess();
        } catch (error) {
            console.error('Error updating leave type:', error);
            Swal.fire('Error', 'Failed to update leave type', 'error');
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Leave Name *</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. Casual Leave" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="code"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Code *</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. CL" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="shortCode"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Short Code</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. C" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>
                                    Active
                                </FormLabel>
                            </div>
                        </FormItem>
                    )}
                />
                <div className="flex justify-end">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Update
                    </Button>
                </div>
            </form>
        </Form>
    );
}
