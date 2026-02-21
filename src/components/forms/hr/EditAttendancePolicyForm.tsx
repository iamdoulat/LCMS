"use client";

import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { Loader2, CalendarIcon } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { useToast } from "@/hooks/use-toast";
import { AttendancePolicySchema, type AttendancePolicyFormValues, type AttendancePolicyDocument } from '@/types';
import { format, parseISO } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from '@/components/forms/common';

interface EditAttendancePolicyFormProps {
    policy: AttendancePolicyDocument;
    onSuccess: () => void;
}

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export function EditAttendancePolicyForm({ policy, onSuccess }: EditAttendancePolicyFormProps) {
    const { toast } = useToast();
    const form = useForm<AttendancePolicyFormValues>({
        resolver: zodResolver(AttendancePolicySchema),
        defaultValues: {
            name: policy.name,
            effectiveFrom: policy.effectiveFrom ? parseISO(policy.effectiveFrom) : new Date(),
            workingHours: policy.workingHours || '08:00',
            inTime: policy.inTime || '09:00 AM',
            delayBuffer: policy.delayBuffer ?? 10,
            extendedDelayBuffer: policy.extendedDelayBuffer ?? 0,
            earlyOutTime: policy.earlyOutTime || '',
            breakTime: policy.breakTime ?? 60,
            ignoreOtAndDeduction: policy.ignoreOtAndDeduction,
            excludeFromAttReports: policy.excludeFromAttReports,
            discardAttOnWeekend: policy.discardAttOnWeekend,
            dailyPolicies: policy.dailyPolicies || DAYS.map(day => ({
                day,
                inTime: '09:00 AM',
                workingHours: '08:00',
                delayBuffer: 10,
                extendedDelayBuffer: 0,
                earlyOutTime: '',
                breakTime: 60,
                workingType: day === 'Friday' ? 'Weekend' : 'Full Day',
            })),
        },
    });

    const { fields } = useFieldArray({
        control: form.control,
        name: "dailyPolicies",
    });

    const isSubmitting = form.formState.isSubmitting;

    async function onSubmit(values: AttendancePolicyFormValues) {
        try {
            const dataToUpdate = {
                ...values,
                effectiveFrom: values.effectiveFrom.toISOString(),
                updatedAt: serverTimestamp(),
            };

            await updateDoc(doc(firestore, 'hrm_settings', 'attendance_policies', 'items', policy.id), dataToUpdate);

            toast({
                title: 'Success',
                description: 'Attendance Policy updated successfully',
            });
            onSuccess();
        } catch (error: any) {
            console.error('Error updating attendance policy:', error);
            toast({
                title: 'Error',
                description: `Failed to update attendance policy: ${error.message}`,
                variant: 'destructive',
            });
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Policy Name *</FormLabel>
                                <FormControl>
                                    <Input placeholder="Type Name" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="effectiveFrom"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Effective from *</FormLabel>
                                <DatePickerField field={field} placeholder="Pick a date" />
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="workingHours"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Working Hours *</FormLabel>
                                <FormControl>
                                    <Input placeholder="HH:mm" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="inTime"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>In time *</FormLabel>
                                <FormControl>
                                    <Input placeholder="HH:mm am/pm" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FormField
                        control={form.control}
                        name="delayBuffer"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Delay Buffer time (In minutes)</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="extendedDelayBuffer"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Ex. Delay Buffer time (In minutes)</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="earlyOutTime"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Early Out Time</FormLabel>
                                <FormControl>
                                    <Input placeholder="HH:mm am/pm" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="breakTime"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Break Time (In minutes)</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="flex flex-wrap gap-6 pt-2">
                    <FormField
                        control={form.control}
                        name="ignoreOtAndDeduction"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">Ignore overtime and deduction calculations</FormLabel>
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="excludeFromAttReports"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">Exclude from attendance reports</FormLabel>
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="discardAttOnWeekend"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">Discard Weekend Attendance</FormLabel>
                            </FormItem>
                        )}
                    />
                </div>

                <div className="rounded-md border overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="w-[100px]">Day</TableHead>
                                <TableHead>In time</TableHead>
                                <TableHead>Working Hours</TableHead>
                                <TableHead>Delay Buffer (min)</TableHead>
                                <TableHead>Ex. Delay Buffer (min)</TableHead>
                                <TableHead>Early Out Time</TableHead>
                                <TableHead>Break Time</TableHead>
                                <TableHead>Working Type</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((field, index) => (
                                <TableRow key={field.id}>
                                    <TableCell className="font-medium">{field.day}</TableCell>
                                    <TableCell>
                                        <FormField
                                            control={form.control}
                                            name={`dailyPolicies.${index}.inTime`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input placeholder="09:00 AM" {...field} className="h-8 text-xs" />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <FormField
                                            control={form.control}
                                            name={`dailyPolicies.${index}.workingHours`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input placeholder="08:00" {...field} className="h-8 text-xs" />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <FormField
                                            control={form.control}
                                            name={`dailyPolicies.${index}.delayBuffer`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} className="h-8 text-xs w-16" />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <FormField
                                            control={form.control}
                                            name={`dailyPolicies.${index}.extendedDelayBuffer`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} className="h-8 text-xs w-16" />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <FormField
                                            control={form.control}
                                            name={`dailyPolicies.${index}.earlyOutTime`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input placeholder="--:-- --" {...field} className="h-8 text-xs" />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <FormField
                                            control={form.control}
                                            name={`dailyPolicies.${index}.breakTime`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} className="h-8 text-xs w-16" />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <FormField
                                            control={form.control}
                                            name={`dailyPolicies.${index}.workingType`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue placeholder="Select type" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="Full Day">Full Day</SelectItem>
                                                            <SelectItem value="Half Day">Half Day</SelectItem>
                                                            <SelectItem value="Weekend">Weekend</SelectItem>
                                                            <SelectItem value="Off Day">Off Day</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={onSuccess}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Update
                    </Button>
                </div>
            </form>
        </Form>
    );
}
