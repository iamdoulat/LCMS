"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Swal from 'sweetalert2';
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';
import { firestore, storage } from '@/lib/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MultiSelect } from '@/components/ui/multi-select';
import type { Employee } from '@/types';
import type { EmailTemplate } from '@/types/email-settings';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Loader2, Send, X, FileText, Trash2, Tag, Check, ChevronsUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Switch as SwitchUI } from "@/components/ui/switch";

// Dynamically import ReactQuill to avoid SSR issues - REMOVED
// const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Eye, Info } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

const emailFormSchema = z.object({
    employeeIds: z.array(z.string()).min(1, 'Please select at least one employee'),
    subject: z.string().min(1, 'Subject is required'),
    body: z.string().min(10, 'Email body must be at least 10 characters'),
});

type EmailFormValues = z.infer<typeof emailFormSchema>;

const AVAILABLE_VARIABLES = [
    // Employee
    { key: '{{name}}', label: 'First Name' },
    { key: '{{employee_name}}', label: 'Full Name' },
    { key: '{{employee_id}}', label: 'Employee ID' },
    { key: '{{department}}', label: 'Department' },
    { key: '{{designation}}', label: 'Designation' },
    { key: '{{user_name}}', label: 'Username' },
    { key: '{{password}}', label: 'Password' },

    // Holiday
    { key: '{{holiday_title}}', label: 'Holiday Title' },
    { key: '{{holiday_start_date}}', label: 'Start Date' },
    { key: '{{holiday_end_date}}', label: 'End Date' },
    { key: '{{holiday_type}}', label: 'Holiday Type' },
    { key: '{{holiday_description}}', label: 'Description' },

    // Attendance / Time
    { key: '{{date}}', label: 'Date' },
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
    email: string;
}

export function SendEmailForm() {
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [employees, setEmployees] = React.useState<EmployeeOption[]>([]);
    const [templates, setTemplates] = React.useState<EmailTemplate[]>([]);
    const [isLoadingEmployees, setIsLoadingEmployees] = React.useState(true);
    const [attachments, setAttachments] = React.useState<{ name: string; url: string; size: number }[]>([]);
    const [isUploading, setIsUploading] = React.useState(false);

    // New state for HTML mode toggle
    const [isHtmlMode, setIsHtmlMode] = React.useState(true);

    const form = useForm<EmailFormValues>({
        resolver: zodResolver(emailFormSchema),
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
                const employeesSnap = await getDocs(collection(firestore, 'employees'));
                const employeeList: EmployeeOption[] = employeesSnap.docs
                    .map(doc => {
                        const data = doc.data() as Employee;
                        return {
                            id: doc.id,
                            name: data.fullName || 'Unnamed Employee',
                            employeeCode: data.employeeCode || '',
                            email: data.email || '',
                        };
                    })
                    .filter(emp => emp.email); // Only include employees with email

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

    // Fetch templates
    React.useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const templatesSnap = await getDocs(collection(firestore, 'email_templates'));
                const templateList: EmailTemplate[] = templatesSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as EmailTemplate));
                setTemplates(templateList);
            } catch (error) {
                console.error('Error fetching templates:', error);
            }
        };

        fetchTemplates();
    }, []);

    const selectAll = () => {
        const allIds = employees.map(emp => emp.id);
        form.setValue('employeeIds', allIds);
    };

    const deselectAll = () => {
        form.setValue('employeeIds', []);
    };

    // Insert variable into subject
    const insertVariableIntoSubject = (variable: string) => {
        const currentSubject = form.getValues('subject');
        form.setValue('subject', currentSubject + ' ' + variable);
    };

    // Handle template selection
    const handleTemplateChange = (templateId: string) => {
        const selectedTemplate = templates.find(t => t.id === templateId);
        if (selectedTemplate) {
            form.setValue('subject', selectedTemplate.subject);
            form.setValue('body', selectedTemplate.body);
            // Templates are usually HTML, so switch to HTML mode if likely HTML
            // Simple heuristic: if it contains tags
            if (/<[a-z][\s\S]*>/i.test(selectedTemplate.body)) {
                setIsHtmlMode(true);
            }
        }
    };

    // Handle file upload
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const totalCurrentSize = attachments.reduce((sum, att) => sum + att.size, 0);
        const newFilesSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);
        const maxSize = 10 * 1024 * 1024; // 10MB

        if (totalCurrentSize + newFilesSize > maxSize) {
            Swal.fire('Error', 'Total file size cannot exceed 10MB', 'error');
            return;
        }

        setIsUploading(true);
        try {
            const uploadedFiles = await Promise.all(
                Array.from(files).map(async (file) => {
                    const timestamp = Date.now();
                    const storageRef = ref(storage, `email_attachments/${timestamp}/${file.name}`);
                    await uploadBytes(storageRef, file);
                    const url = await getDownloadURL(storageRef);
                    return { name: file.name, url, size: file.size };
                })
            );

            setAttachments(prev => [...prev, ...uploadedFiles]);
        } catch (error) {
            console.error('Error uploading files:', error);
            Swal.fire('Error', 'Failed to upload files', 'error');
        } finally {
            setIsUploading(false);
            event.target.value = ''; // Reset input
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    // Submit form
    const onSubmit = async (data: EmailFormValues) => {
        setIsSubmitting(true);

        try {
            // Process body based on mode
            let finalBody = data.body;
            if (!isHtmlMode) {
                // Convert newlines to <br> for plain text mode
                finalBody = finalBody.replace(/\n/g, '<br>');
                // Wrap in paragraph if needed, or just send as is depending on styling preference.
                // Simple <br> conversion is usually sufficient for "Plain Text" feel in HTML email clients.
            }

            const response = await fetch('/api/hr/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employeeIds: data.employeeIds,
                    subject: data.subject,
                    body: finalBody,
                    attachmentUrls: attachments.map(att => ({ name: att.name, url: att.url })),
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to send emails');
            }

            Swal.fire({
                title: 'Success!',
                text: `Email sent successfully to ${result.sentCount} employee(s)`,
                icon: 'success',
            });

            // Reset form
            form.reset();
            setAttachments([]);
        } catch (error: any) {
            console.error('Error sending email:', error);
            Swal.fire('Error', error.message || 'Failed to send email', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalSizeMB = (attachments.reduce((sum, att) => sum + att.size, 0) / (1024 * 1024)).toFixed(2);

    // Filter employees options for MultiSelect
    const employeeOptions = employees.map(emp => ({
        value: emp.id,
        label: `${emp.name} (${emp.employeeCode}) - ${emp.email}`,
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
                                    Search and select employees from the dropdown.
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

                {/* Template Selection */}
                <FormItem>
                    <FormLabel>Choose Template (Optional)</FormLabel>
                    <FormDescription>Select a template to auto-fill the subject and body.</FormDescription>
                    <Select onValueChange={handleTemplateChange}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a template..." />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {templates.map((template) => (
                                <SelectItem key={template.id} value={template.id || ''}>
                                    {template.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </FormItem>

                {/* Subject Field with Variables */}
                <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email Subject*</FormLabel>
                            <FormDescription>
                                Click a variable below to insert it into the subject
                            </FormDescription>
                            <FormControl>
                                <Input placeholder="Enter email subject..." {...field} />
                            </FormControl>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {AVAILABLE_VARIABLES.map((variable) => (
                                    <Badge
                                        key={variable.key}
                                        variant="outline"
                                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                                        onClick={() => insertVariableIntoSubject(variable.key)}
                                    >
                                        <Tag className="h-3 w-3 mr-1" />
                                        {variable.label}
                                    </Badge>
                                ))}
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Email Body (Rich Text Editor) */}
                <FormField
                    control={form.control}
                    name="body"
                    render={({ field }) => (
                        <FormItem>
                            <div className="flex flex-row items-center justify-between">
                                <FormLabel>Email Body</FormLabel>
                                <div className="flex items-center space-x-2">
                                    <SwitchUI
                                        id="html-mode"
                                        checked={isHtmlMode}
                                        onCheckedChange={setIsHtmlMode}
                                    />
                                    <Label htmlFor="html-mode" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        HTML Mode
                                    </Label>
                                </div>
                            </div>

                            {isHtmlMode && (
                                <Alert className="mb-2 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    <AlertTitle className="text-blue-800 dark:text-blue-300">HTML Supported</AlertTitle>
                                    <AlertDescription className="text-blue-700 dark:text-blue-400">
                                        You can write raw HTML here. Use inline CSS for styling to ensure compatibility across email clients.
                                        Use variables like <code>{`{{name}}`}</code> inside the content.
                                    </AlertDescription>
                                </Alert>
                            )}

                            <FormControl>
                                <Textarea
                                    value={field.value}
                                    onChange={field.onChange}
                                    className="font-mono text-sm min-h-[300px]"
                                    placeholder={isHtmlMode
                                        ? "<html><body><h1>Hello {{name}},</h1>...</body></html>"
                                        : "Hello {{name}},\n\nWrite your message here..."}
                                />
                            </FormControl>
                            <FormMessage />

                            <div className="flex justify-start mt-2">
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button type="button" variant="secondary" className="gap-2">
                                            <Eye className="h-4 w-4" /> Preview
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                        <DialogHeader>
                                            <DialogTitle>Email Preview ({isHtmlMode ? 'HTML' : 'Plain Text'})</DialogTitle>
                                            <DialogDescription>
                                                This is how your email might look. Variables are replaced with sample data.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="border rounded-md p-4 mt-2 bg-white min-h-[300px] text-black">
                                            <div dangerouslySetInnerHTML={{
                                                __html: (field.value || '')
                                                    // Handle Plain Text Newlines for Preview
                                                    .replace(/\n/g, isHtmlMode ? '\n' : '<br>')
                                                    // Employee
                                                    .replace(/{{employee_name}}/g, 'John Doe')
                                                    .replace(/{{name}}/g, 'John')
                                                    .replace(/{{employee_id}}/g, 'EMP-001')
                                                    .replace(/{{department}}/g, 'Engineering')
                                                    .replace(/{{designation}}/g, 'Software Engineer')
                                                    .replace(/{{user_name}}/g, 'john.doe')
                                                    .replace(/{{password}}/g, '********')

                                                    // System / Other
                                                    .replace(/{{company_name}}/g, process.env.NEXT_PUBLIC_APP_NAME || 'Nextsew')
                                                    .replace(/{{date}}/g, new Date().toLocaleDateString())
                                                    .replace(/{{login_url}}/g, 'https://app.nextsew.com/login')
                                                    .replace(/{{amount}}/g, '$500.00')
                                                    .replace(/{{month_year}}/g, 'December 2024')

                                                    // Holiday
                                                    .replace(/{{holiday_title}}/g, 'New Year')
                                                    .replace(/{{holiday_start_date}}/g, '2025-01-01')
                                                    .replace(/{{holiday_end_date}}/g, '2025-01-01')
                                                    .replace(/{{holiday_type}}/g, 'Public Holiday')
                                                    .replace(/{{holiday_description}}/g, 'Public holiday for New Year celebration')

                                                    // Attendance
                                                    .replace(/{{in_time}}/g, '09:00 AM')
                                                    .replace(/{{out_time}}/g, '06:00 PM')
                                                    .replace(/{{in_time_remarks}}/g, 'On Time')
                                                    .replace(/{{out_time_remarks}}/g, 'Regular')
                                                    .replace(/{{reconciliation_in_time}}/g, '09:00 AM')
                                                    .replace(/{{reconciliation_out_time}}/g, '06:00 PM')

                                                    // Visit / Application
                                                    .replace(/{{apply_date}}/g, new Date().toLocaleDateString())
                                                    .replace(/{{visit_start}}/g, '10:00 AM')
                                                    .replace(/{{visit_end}}/g, '11:30 AM')
                                                    .replace(/{{total_duration}}/g, '1h 30m')
                                                    .replace(/{{visit_purpose}}/g, 'Client Meeting')
                                                    .replace(/{{reason}}/g, 'Personal Leave')
                                            }} />
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </FormItem>
                    )}
                />

                {/* File Attachments */}
                <div className="space-y-3">
                    <Label>File Attachments (Optional)</Label>
                    <FormDescription>
                        Upload files to include as download links in the email (Max 10MB total)
                    </FormDescription>

                    <div className="flex items-center gap-2">
                        <Input
                            type="file"
                            multiple
                            onChange={handleFileUpload}
                            disabled={isUploading}
                            className="flex-1"
                            accept="*/*"
                        />
                        {isUploading && <Loader2 className="h-5 w-5 animate-spin" />}
                    </div>

                    {attachments.length > 0 && (
                        <div className="border rounded-md p-3 space-y-2">
                            <div className="text-sm font-medium">
                                Attached Files ({attachments.length}) - Total Size: {totalSizeMB} MB
                            </div>
                            {attachments.map((file, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        <span className="text-sm">{file.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            ({(file.size / 1024).toFixed(2)} KB)
                                        </span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeAttachment(index)}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <Separator />

                {/* Action Buttons */}
                <div className="flex gap-2 justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            form.reset();
                            setAttachments([]);
                        }}
                    >
                        <X className="mr-2 h-4 w-4" />
                        Reset
                    </Button>
                    <Button
                        type="submit"
                        disabled={isSubmitting || isLoadingEmployees}
                        className="bg-primary hover:bg-primary/90"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Send className="mr-2 h-4 w-4" />
                                Send Email
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
