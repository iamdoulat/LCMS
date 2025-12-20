
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save, Loader2, Info } from 'lucide-react';
import Swal from 'sweetalert2';
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { EmailTemplate } from '@/types/email-settings';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Eye } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

export default function EditEmailTemplatePage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const isNew = id === 'new';

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState<Partial<EmailTemplate>>({
        name: '',
        slug: '',
        subject: '',
        body: '',
        variables: [],
    });

    const [variableInput, setVariableInput] = useState('');

    useEffect(() => {
        if (!isNew && id) {
            const fetchTemplate = async () => {
                try {
                    const docRef = doc(firestore, 'email_templates', id);
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        setFormData({ id: snap.id, ...snap.data() } as EmailTemplate);
                    } else {
                        Swal.fire('Error', 'Template not found', 'error');
                        router.push('/dashboard/settings/email-templates');
                    }
                } catch (error) {
                    console.error("Error fetching template:", error);
                    Swal.fire('Error', 'Failed to load template', 'error');
                } finally {
                    setLoading(false);
                }
            };
            fetchTemplate();
        }
    }, [id, isNew, router]);

    const handleInputChange = (field: keyof EmailTemplate, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleAddVariable = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && variableInput.trim()) {
            e.preventDefault();
            const newVar = variableInput.trim().startsWith('{{') ? variableInput.trim() : `{{${variableInput.trim()}}}`;
            if (!formData.variables?.includes(newVar)) {
                setFormData(prev => ({
                    ...prev,
                    variables: [...(prev.variables || []), newVar]
                }));
            }
            setVariableInput('');
        }
    };

    const removeVariable = (v: string) => {
        setFormData(prev => ({
            ...prev,
            variables: prev.variables?.filter(item => item !== v)
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            if (!formData.name || !formData.slug || !formData.subject || !formData.body) {
                Swal.fire('Error', 'Please fill all required fields', 'error');
                setSaving(false);
                return;
            }

            // Check slug uniqueness if new or slug changed
            if (isNew) {
                const q = query(collection(firestore, 'email_templates'), where('slug', '==', formData.slug));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    Swal.fire('Error', 'A template with this unique identifier already exists', 'error');
                    setSaving(false);
                    return;
                }
            }

            const dataToSave = {
                ...formData,
                updatedAt: serverTimestamp(),
            };

            if (isNew) {
                await addDoc(collection(firestore, 'email_templates'), {
                    ...dataToSave,
                    createdAt: serverTimestamp(),
                });
                Swal.fire({
                    title: 'Success',
                    text: 'Template created successfully',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            } else {
                const { id: _, ...updateData } = dataToSave; // Exclude ID from update
                await updateDoc(doc(firestore, 'email_templates', id), updateData);
                Swal.fire({
                    title: 'Success',
                    text: 'Template updated successfully',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            }

            router.push('/dashboard/settings/email-templates');
        } catch (error) {
            console.error("Error saving template:", error);
            Swal.fire('Error', 'Failed to save template', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="container mx-auto p-6 max-w-4xl space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/settings/email-templates">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{isNew ? 'Create New Template' : 'Edit Template'}</h1>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Template Details</CardTitle>
                    <CardDescription>Define the email content and placeholders.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="name">Template Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. Welcome Email"
                                    value={formData.name}
                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="slug">
                                    Unique Identifier (Slug)
                                    <span className="text-xs text-muted-foreground ml-2 font-normal">(Used in code to find this template)</span>
                                </Label>
                                <Input
                                    id="slug"
                                    placeholder="e.g. welcome_email"
                                    value={formData.slug}
                                    onChange={(e) => handleInputChange('slug', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                                    disabled={!isNew}
                                    className={!isNew ? "bg-muted font-mono" : "font-mono"}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="subject">Email Subject</Label>
                            <Input
                                id="subject"
                                placeholder="Subject line..."
                                value={formData.subject}
                                onChange={(e) => handleInputChange('subject', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label htmlFor="variables">Available Variables</Label>
                                <span className="text-xs text-muted-foreground">Press Enter to add</span>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-2 p-3 border rounded-md min-h-[50px]">
                                {formData.variables && formData.variables.map(v => (
                                    <Badge key={v} variant="secondary" className="cursor-pointer hover:bg-destructive/10" onClick={() => removeVariable(v)}>
                                        {v} ×
                                    </Badge>
                                ))}
                                <Input
                                    className="w-40 h-6 text-sm border-none shadow-none focus-visible:ring-0 p-0"
                                    placeholder="Add variable..."
                                    value={variableInput}
                                    onChange={(e) => setVariableInput(e.target.value)}
                                    onKeyDown={handleAddVariable}
                                />
                            </div>

                            <div className="space-y-2 mt-4">
                                <Label className="text-xs text-muted-foreground">Standard System Variables (Click to add):</Label>
                                <div className="flex flex-wrap gap-1">
                                    {[
                                        '{{name}}', '{{user_name}}', '{{password}}', '{{date}}',
                                        '{{department}}', '{{designation}}',
                                        '{{in_time}}', '{{out_time}}', '{{in_time_remarks}}', '{{out_time_remarks}}',
                                        '{{reconciliation_in_time}}', '{{reconciliation_out_time}}',
                                        '{{apply_date}}',
                                        '{{visit_start}}', '{{visit_end}}', '{{total_duration}}', '{{visit_purpose}}'
                                    ].map(v => (
                                        <Badge
                                            key={v}
                                            variant="outline"
                                            className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs font-normal"
                                            onClick={() => {
                                                if (!formData.variables?.includes(v)) {
                                                    setFormData(prev => ({ ...prev, variables: [...(prev.variables || []), v] }));
                                                }
                                            }}
                                        >
                                            + {v}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">Define variables that will be replaced dynamically.</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="body">Email Body (HTML)</Label>
                            <Alert className="mb-2 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <AlertTitle className="text-blue-800 dark:text-blue-300">HTML Supported</AlertTitle>
                                <AlertDescription className="text-blue-700 dark:text-blue-400">
                                    You can write raw HTML here. Use inline CSS for styling to ensure compatibility across email clients.
                                    Use variables like <code>{`{{name}}`}</code> inside the content.
                                </AlertDescription>
                            </Alert>
                            <Textarea
                                id="body"
                                className="font-mono min-h-[300px]"
                                placeholder="<html><body><h1>Hello {{name}},</h1>...</body></html>"
                                value={formData.body}
                                onChange={(e) => handleInputChange('body', e.target.value)}
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button type="button" variant="secondary" className="gap-2">
                                        <Eye className="h-4 w-4" /> Preview
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                    <DialogHeader>
                                        <DialogTitle>Email Preview</DialogTitle>
                                        <DialogDescription>
                                            This is how your email might look. Variables are replaced with sample data.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="border rounded-md p-4 mt-2 bg-white min-h-[300px] text-black">
                                        <div dangerouslySetInnerHTML={{
                                            __html: (formData.body || '')
                                                .replace(/{{name}}/g, 'John Doe')
                                                .replace(/{{user_name}}/g, 'johndoe123')
                                                .replace(/{{department}}/g, 'Production')
                                                .replace(/{{designation}}/g, 'Manager')
                                                .replace(/{{company_name}}/g, 'Nextsew')
                                                .replace(/{{date}}/g, new Date().toLocaleDateString())
                                                .replace(/{{apply_date}}/g, new Date().toLocaleDateString())
                                                .replace(/{{visit_start}}/g, '10:00 AM')
                                                .replace(/{{visit_end}}/g, '11:00 AM')
                                                .replace(/{{total_duration}}/g, '1 Hour')
                                                .replace(/{{visit_purpose}}/g, 'Meeting')
                                                .replace(/{{in_time}}/g, '09:00 AM')
                                                .replace(/{{out_time}}/g, '06:00 PM')
                                                .replace(/{{reconciliation_in_time}}/g, '09:05 AM')
                                                .replace(/{{reconciliation_out_time}}/g, '05:55 PM')
                                        }} />
                                    </div>
                                </DialogContent>
                            </Dialog>

                            <Link href="/dashboard/settings/email-templates">
                                <Button type="button" variant="outline">Cancel</Button>
                            </Link>
                            <Button type="submit" disabled={saving}>
                                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Template</>}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
