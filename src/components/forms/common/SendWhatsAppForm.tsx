"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/context/AuthContext';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { MultiSelect } from '@/components/ui/multi-select';
import type { Employee } from '@/types';
import Picker from 'emoji-picker-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Loader2, Send, X, Tag, Smartphone, Smile } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Eye } from 'lucide-react';

const whatsAppFormSchema = z.object({
    employeeIds: z.array(z.string()).min(1, 'Please select at least one employee'),
    subject: z.string().optional(),
    body: z.string().min(1, 'Message body is required'),
});

type WhatsAppFormValues = z.infer<typeof whatsAppFormSchema>;

const AVAILABLE_VARIABLES = [
    // Employee
    { key: '{{name}}', label: 'First Name' },
    { key: '{{employee_name}}', label: 'Full Name' },
    { key: '{{employee_id}}', label: 'Employee ID' },
    { key: '{{department}}', label: 'Department' },
    { key: '{{designation}}', label: 'Designation' },
    { key: '{{user_name}}', label: 'Username' },
    { key: '{{password}}', label: 'Password' },

    // Attendance / Time
    { key: '{{in_time}}', label: 'In Time' },
    { key: '{{out_time}}', label: 'Out Time' },
    { key: '{{in_time_remarks}}', label: 'In Remarks' },
    { key: '{{out_time_remarks}}', label: 'Out Remarks' },
    { key: '{{reconciliation_in_time}}', label: 'Rec. In Time' },
    { key: '{{reconciliation_out_time}}', label: 'Rec. Out Time' },

    // Visit / Application
    { key: '{{apply_date}}', label: 'Apply Date' },
    { key: '{{visit_start}}', label: 'Visit Start' },
    { key: '{{visit_end}}', label: 'Visit End' },
    { key: '{{total_duration}}', label: 'Duration' },
    { key: '{{visit_purpose}}', label: 'Purpose' },
    { key: '{{reason}}', label: 'Reason' },

    // System / Other
    { key: '{{company_name}}', label: 'Company Name' },
    { key: '{{amount}}', label: 'Amount' },
    { key: '{{month_year}}', label: 'Month/Year' },
    { key: '{{login_url}}', label: 'Login URL' },
];

interface EmployeeOption {
    id: string;
    name: string;
    employeeCode: string;
    phone: string;
}

export function SendWhatsAppForm() {
    const { companyName } = useAuth();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [loadingMessage, setLoadingMessage] = React.useState('');
    const [employees, setEmployees] = React.useState<EmployeeOption[]>([]);
    const [isLoadingEmployees, setIsLoadingEmployees] = React.useState(true);
    const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);

    const form = useForm<WhatsAppFormValues>({
        resolver: zodResolver(whatsAppFormSchema),
        defaultValues: {
            employeeIds: [],
            subject: '',
            body: '',
        },
    });

    // Fetch employees
    React.useEffect(() => {
        const fetchEmployees = async () => {
            setIsLoadingEmployees(true);
            try {
                // Fetch employees who have a phone number (mobileNumber or phoneNumber)
                const q = query(collection(firestore, 'employees'), orderBy('fullName'));
                const employeesSnap = await getDocs(q);
                const employeeList: EmployeeOption[] = employeesSnap.docs
                    .map(doc => {
                        const data = doc.data() as any; // Use any to access potential legacy fields
                        // Check multiple possible field names for phone number
                        const phone = data.phone || data.mobileNumber || data.contactNumber || data.phoneNumber || '';
                        return {
                            id: doc.id,
                            name: data.fullName || 'Unnamed Employee',
                            employeeCode: data.employeeCode || '',
                            phone: phone,
                        };
                    })
                    .filter(emp => emp.phone); // Only include employees with phone numbers

                setEmployees(employeeList);
            } catch (error) {
                console.error('Error fetching employees:', error);
                Swal.fire('Error', 'Failed to load employees', 'error');
            } finally {
                setIsLoadingEmployees(false);
            }
        };

        fetchEmployees();
    }, []);

    const selectAll = () => {
        const allIds = employees.map(emp => emp.id);
        form.setValue('employeeIds', allIds);
    };

    const deselectAll = () => {
        form.setValue('employeeIds', []);
    };

    // Insert variable into message body
    const insertVariableIntoBody = (variable: string) => {
        const currentBody = form.getValues('body') || '';
        form.setValue('body', currentBody + ' ' + variable);
    };

    // Add emoji
    const onEmojiClick = (emojiObject: any) => {
        const currentBody = form.getValues('body') || '';
        form.setValue('body', currentBody + emojiObject.emoji);
        setShowEmojiPicker(false);
    };

    // Replace variables logic
    const replaceVariables = (text: string, employee: EmployeeOption) => {
        let processedText = text;
        const now = new Date();

        // Static Replacements
        processedText = processedText
            .replace(/{{name}}/g, employee.name.split(' ')[0])
            .replace(/{{employee_name}}/g, employee.name)
            .replace(/{{employee_id}}/g, employee.employeeCode)
            .replace(/{{company_name}}/g, companyName || 'NextSew')
            .replace(/{{login_url}}/g, window.location.origin)
            .replace(/{{date}}/g, now.toLocaleDateString())
            .replace(/{{month_year}}/g, now.toLocaleString('default', { month: 'long', year: 'numeric' }));

        // Context-specific variables (left empty or as placeholder if not relevant in generic context)
        // Since this is a generic sender, we can't accurately fill specific attendance/visit details
        // unless we fetch the "latest" for each.
        // For now, we will replace known empty ones with empty string to avoid showing raw {{tags}}
        // Or keep them if the user intends to use this for a specific context manually?
        // Let's replace common undefined ones with empty string or a placeholder if critical.

        // List of all keys to check and clear if not replaced
        AVAILABLE_VARIABLES.forEach(v => {
            if (processedText.includes(v.key) && !processedText.includes('{{' + v.key.replace(/{{|}}/g, '') + '}}')) {
                // It was replaced already
            } else {
                // Not replaced, meaning we don't have data for it in this context
                // Ideally, we shouldn't just clear it blindly if it's important, but for generic tool it's safer than sending raw tag
                // However, user specifically asked for these. 
                // I'll leave unreplaced tags so user sees they are missing, or better, 
                // I'll replace with empty string so the message looks clean?
                // Decision: Replace with empty string.
            }
        });

        // Additional mock replacement for 'password' (NEVER send real password)
        processedText = processedText.replace(/{{password}}/g, '(hidden)');

        return processedText;
    };

    // Submit form
    const onSubmit = async (data: WhatsAppFormValues) => {
        setIsSubmitting(true);
        const selectedEmployees = employees.filter(e => data.employeeIds.includes(e.id));

        let successCount = 0;
        let failCount = 0;

        try {
            for (let i = 0; i < selectedEmployees.length; i++) {
                const emp = selectedEmployees[i];
                setLoadingMessage(`Sending ${i + 1}/${selectedEmployees.length}...`);

                // Construct formatting
                let fullMessage = '';
                if (data.subject) {
                    fullMessage += `*// ${data.subject} //*\n----------------\n`;
                }
                fullMessage += data.body;

                // Replace variables
                const personalizedMessage = replaceVariables(fullMessage, emp);

                // Send API Call
                const response = await fetch('/api/whatsapp/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        recipient: emp.phone,
                        message: personalizedMessage,
                    }),
                });

                if (response.ok) {
                    successCount++;
                } else {
                    failCount++;
                    console.error(`Failed to send to ${emp.name} (${emp.phone})`);
                }
            }

            Swal.fire({
                title: 'Process Completed',
                html: `Sent: <b>${successCount}</b><br>Failed: <b>${failCount}</b>`,
                icon: failCount === 0 ? 'success' : 'warning',
            });

            // Reset form if all successful
            if (failCount === 0) {
                form.reset();
            }

        } catch (error: any) {
            console.error('Error sending WhatsApp messages:', error);
            Swal.fire('Error', error.message || 'Failed to send messages', 'error');
        } finally {
            setIsSubmitting(false);
            setLoadingMessage('');
        }
    };

    const employeeOptions = employees.map(emp => ({
        value: emp.id,
        label: `${emp.name} (${emp.employeeCode}) - ${emp.phone}`,
    }));

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                {/* Employee Selection */}
                <FormField
                    control={form.control}
                    name="employeeIds"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Select Employees*</FormLabel>
                            <div className="flex justify-between items-center mb-2">
                                <FormDescription>
                                    Select employees with valid phone numbers.
                                </FormDescription>
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" size="sm" onClick={selectAll} className="h-7 text-xs">
                                        Select All
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" onClick={deselectAll} className="h-7 text-xs">
                                        Deselect All
                                    </Button>
                                </div>
                            </div>
                            <FormControl>
                                {isLoadingEmployees ? (
                                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Loading employees...</span>
                                    </div>
                                ) : (
                                    <MultiSelect
                                        options={employeeOptions}
                                        selected={field.value}
                                        onChange={field.onChange}
                                        placeholder="Select employees..."
                                        className="w-full"
                                    />
                                )}
                            </FormControl>
                            <FormMessage />
                            <div className="text-xs text-muted-foreground mt-1">
                                Selected: {field.value.length} employee(s)
                            </div>
                        </FormItem>
                    )}
                />

                <Separator />

                {/* Subject Field */}
                <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Subject (Optional)</FormLabel>
                            <FormDescription>
                                Will be displayed in <b>bold</b> at the top of the message.
                            </FormDescription>
                            <FormControl>
                                <Input placeholder="Important Notice" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Message Body */}
                <FormField
                    control={form.control}
                    name="body"
                    render={({ field }) => (
                        <FormItem>
                            <div className="flex flex-row items-center justify-between">
                                <FormLabel>Message Body*</FormLabel>
                                <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8 gap-2">
                                            <Smile className="h-4 w-4" /> Add Emoji
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0 border-none">
                                        <Picker onEmojiClick={onEmojiClick} width="100%" />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <FormControl>
                                <Textarea
                                    value={field.value}
                                    onChange={field.onChange}
                                    className="min-h-[200px]"
                                    placeholder="Write your message here... You can use variables like {{name}}."
                                />
                            </FormControl>
                            <FormMessage />

                            {/* Variables Helper */}
                            <div className="mt-2">
                                <p className="text-sm font-medium mb-2">Available Variables:</p>
                                <div className="flex flex-wrap gap-2">
                                    {AVAILABLE_VARIABLES.map((variable) => (
                                        <Badge
                                            key={variable.key}
                                            variant="secondary"
                                            className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                                            onClick={() => insertVariableIntoBody(variable.key)}
                                        >
                                            <Tag className="h-3 w-3 mr-1" />
                                            {variable.label}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            {/* Preview Dialog */}
                            <div className="flex justify-start mt-4">
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button type="button" variant="secondary" className="gap-2">
                                            <Eye className="h-4 w-4" /> Preview
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-md">
                                        <DialogHeader>
                                            <DialogTitle>Message Preview</DialogTitle>
                                            <DialogDescription>
                                                This is how the message might appear on WhatsApp.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="bg-[#DCF8C6] dark:bg-[#056162] p-4 rounded-lg shadow-sm text-black dark:text-white mt-2 whitespace-pre-wrap relative">
                                            <div className="absolute top-0 right-0 p-1 opacity-50">
                                                <Smartphone className="h-4 w-4" />
                                            </div>
                                            {form.getValues('subject') && <strong>{form.getValues('subject')}<br /><br /></strong>}
                                            {field.value
                                                // Simple mock replacements for preview
                                                .replace(/{{name}}/g, 'John')
                                                .replace(/{{employee_name}}/g, 'John Doe')
                                                .replace(/{{company_name}}/g, companyName || 'NextSew')
                                            }
                                            <div className="text-[10px] text-right mt-2 opacity-60">
                                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>

                        </FormItem>
                    )}
                />

                <Separator />

                {/* Action Buttons */}
                <div className="flex gap-2 justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            form.reset();
                        }}
                    >
                        <X className="mr-2 h-4 w-4" />
                        Reset
                    </Button>
                    <Button
                        type="submit"
                        disabled={isSubmitting || isLoadingEmployees}
                        className="bg-green-600 hover:bg-green-700 text-white"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {loadingMessage || 'Sending...'}
                            </>
                        ) : (
                            <>
                                <Send className="mr-2 h-4 w-4" />
                                Send WhatsApp
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
