import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
import { Loader2, Trash2 } from 'lucide-react';
import { doc, updateDoc, serverTimestamp, getDocs, query, where, orderBy, collection } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import Swal from 'sweetalert2';
import type { LeaveTypeDefinition, LeaveGroupDocument } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

// Schema (same as Add form)
const policyRuleSchema = z.object({
    leaveTypeId: z.string(),
    leaveTypeName: z.string(),
    allowedBalance: z.preprocess((val) => Number(val), z.number().min(0)),
    maxLeaveBalanceInYear: z.preprocess((val) => Number(val), z.number().min(0)).optional(),
    balanceForwarding: z.boolean().default(false),
    maxForwardFromPreviousYear: z.preprocess((val) => Number(val), z.number().min(0)).optional(),
    leaveAllowBetweenMultipleYears: z.boolean().default(false),
    intervalDaysInSameLeave: z.preprocess((val) => Number(val), z.number().min(0)).optional(),
    negativeBalance: z.boolean().default(false),
    maxLimitForPastLeave: z.preprocess((val) => Number(val), z.number().min(0)).optional(),
    continuousDaysAllow: z.boolean().default(false),
    continuousSanction: z.preprocess((val) => Number(val), z.number().min(0)).optional(),
    halfDay: z.boolean().default(false),
    maxBalanceForEncashment: z.preprocess((val) => Number(val), z.number().min(0)).optional(),
    isPrefixAllowed: z.boolean().default(false),
    isSuffixAllowed: z.boolean().default(false),
    doesRequiresLeaveAttachment: z.boolean().default(false),
    minDayCountForRequiringAttachment: z.preprocess((val) => Number(val), z.number().min(0)).optional(),
    allowEarnLeave: z.boolean().default(false),
    applyFutureLeaveAfterDays: z.preprocess((val) => Number(val), z.number().min(0)).optional(),
    maxSanctionInServiceLife: z.preprocess((val) => Number(val), z.number().min(0)).optional(),
});

const formSchema = z.object({
    groupName: z.string().min(1, 'Group Name is required'),
    description: z.string().optional(),
    policies: z.array(policyRuleSchema),
    isActive: z.boolean().default(true),
});

interface EditLeaveGroupFormProps {
    leaveGroup: LeaveGroupDocument;
    onSuccess: () => void;
}

export function EditLeaveGroupForm({ leaveGroup, onSuccess }: EditLeaveGroupFormProps) {
    const [leaveTypes, setLeaveTypes] = useState<LeaveTypeDefinition[]>([]);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            groupName: leaveGroup.groupName,
            description: leaveGroup.description || '',
            policies: leaveGroup.policies || [],
            isActive: leaveGroup.isActive ?? true,
        },
    });

    const { fields: policyFields, append, remove } = useFieldArray({
        control: form.control,
        name: "policies",
    });

    useEffect(() => {
        const fetchLeaveTypes = async () => {
            try {
                const q = query(
                    collection(firestore, 'hrm_settings', 'leave_types', 'items'),
                    where('isActive', '==', true)
                );
                const snapshot = await getDocs(q);
                const types = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveTypeDefinition));
                types.sort((a, b) => a.name.localeCompare(b.name));
                setLeaveTypes(types);
            } catch (error) {
                console.error("Error fetching leave types:", error);
            }
        };
        fetchLeaveTypes();
    }, []);

    const handleAddLeaveType = (leaveTypeId: string) => {
        const selectedType = leaveTypes.find(lt => lt.id === leaveTypeId);
        if (selectedType) {
            if (policyFields.some(field => field.leaveTypeId === leaveTypeId)) {
                return;
            }
            append({
                leaveTypeId: selectedType.id,
                leaveTypeName: selectedType.name,
                allowedBalance: 0,
                maxLeaveBalanceInYear: 0,
                balanceForwarding: false,
                maxForwardFromPreviousYear: 0,
                leaveAllowBetweenMultipleYears: false,
                intervalDaysInSameLeave: 0,
                negativeBalance: false,
                maxLimitForPastLeave: 0,
                continuousDaysAllow: false,
                continuousSanction: 0,
                halfDay: false,
                maxBalanceForEncashment: 0,
                isPrefixAllowed: false,
                isSuffixAllowed: false,
                doesRequiresLeaveAttachment: false,
                minDayCountForRequiringAttachment: 0,
                allowEarnLeave: false,
                applyFutureLeaveAfterDays: 0,
                maxSanctionInServiceLife: 0,
            });
        }
    };

    const isSubmitting = form.formState.isSubmitting;

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (values.policies.length === 0) {
            Swal.fire('Error', 'Please add at least one leave type policy', 'error');
            return;
        }

        try {
            await updateDoc(doc(firestore, 'hrm_settings', 'leave_groups', 'items', leaveGroup.id), {
                ...values,
                updatedAt: serverTimestamp(),
            });
            Swal.fire({
                title: 'Success',
                text: 'Leave Group updated successfully',
                icon: 'success',
                timer: 1000,
                showConfirmButton: false
            });
            onSuccess();
        } catch (error) {
            console.error('Error updating leave group:', error);
            Swal.fire('Error', 'Failed to update leave group', 'error');
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="groupName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Leave Group Name *</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. General" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormItem>
                        <FormLabel>Available Leave Type *</FormLabel>
                        <Select onValueChange={handleAddLeaveType}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Leave Type to Add" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {leaveTypes.map((type) => (
                                    <SelectItem
                                        key={type.id}
                                        value={type.id}
                                        disabled={policyFields.some(p => p.leaveTypeId === type.id)}
                                    >
                                        {type.name} ({type.code})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FormItem>
                </div>

                <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                        {policyFields.map((field, index) => (
                            <Card key={field.id} className="relative">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                                    onClick={() => remove(index)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                                <CardHeader className="py-3 bg-muted/20">
                                    <CardTitle className="text-base font-medium flex items-center gap-2">
                                        <Badge variant="outline">{form.getValues(`policies.${index}.leaveTypeName`)}</Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 py-4">
                                    {/* Row 1 */}
                                    <FormField
                                        control={form.control}
                                        name={`policies.${index}.allowedBalance`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Allowed Balance *</FormLabel>
                                                <FormControl><Input type="number" {...field} /></FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`policies.${index}.maxLeaveBalanceInYear`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Max Leave Balance In An Year *</FormLabel>
                                                <FormControl><Input type="number" {...field} /></FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`policies.${index}.maxSanctionInServiceLife`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Max Sanction In Service Life *</FormLabel>
                                                <FormControl><Input type="number" {...field} /></FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`policies.${index}.continuousSanction`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Continuous Sanction *</FormLabel>
                                                <FormControl><Input type="number" {...field} /></FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    {/* Row 2 - Checkboxes */}
                                    <FormField
                                        control={form.control}
                                        name={`policies.${index}.balanceForwarding`}
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center space-x-2 space-y-0 mt-2">
                                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                <FormLabel className="font-normal text-xs">Balance Forward</FormLabel>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`policies.${index}.allowEarnLeave`}
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center space-x-2 space-y-0 mt-2">
                                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                <FormLabel className="font-normal text-xs">Allow Earn Leave</FormLabel>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`policies.${index}.halfDay`}
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center space-x-2 space-y-0 mt-2">
                                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                <FormLabel className="font-normal text-xs">Half Day</FormLabel>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`policies.${index}.negativeBalance`}
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center space-x-2 space-y-0 mt-2">
                                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                <FormLabel className="font-normal text-xs">Negative Balance</FormLabel>
                                            </FormItem>
                                        )}
                                    />

                                    {/* Row 3 - More Inputs */}
                                    {form.watch(`policies.${index}.balanceForwarding`) && (
                                        <FormField
                                            control={form.control}
                                            name={`policies.${index}.maxForwardFromPreviousYear`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">Max Forward From Prev Year *</FormLabel>
                                                    <FormControl><Input type="number" {...field} /></FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    )}

                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </ScrollArea>

                <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Update Group
                    </Button>
                </div>
            </form>
        </Form>
    );
}
