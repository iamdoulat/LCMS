
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save, Loader2, Info, Smartphone, Eye } from 'lucide-react';
import Swal from 'sweetalert2';
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { WhatsAppTemplate } from '@/types/whatsapp-settings';
import { Badge } from '@/components/ui/badge';
import { getCompanyName } from '@/lib/settings/company';
import Link from 'next/link';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

export default function EditWhatsAppTemplatePage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const isNew = id === 'new';
    const [companyName, setCompanyName] = useState('Nextsew');

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState<Partial<WhatsAppTemplate>>({
        name: '',
        slug: '',
        subject: '',
        body: '',
        variables: [],
    });

    const [variableInput, setVariableInput] = useState('');

    useEffect(() => {
        getCompanyName().then(setCompanyName);

        if (!isNew && id) {
            const fetchTemplate = async () => {
                try {
                    const docRef = doc(firestore, 'whatsapp_templates', id);
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        setFormData({ id: snap.id, ...snap.data() } as WhatsAppTemplate);
                    } else {
                        Swal.fire('Error', 'Template not found', 'error');
                        router.push('/dashboard/settings/whatsapp-templates');
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

    const handleInputChange = (field: keyof WhatsAppTemplate, value: any) => {
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
                const q = query(collection(firestore, 'whatsapp_templates'), where('slug', '==', formData.slug));
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
                await addDoc(collection(firestore, 'whatsapp_templates'), {
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
                await updateDoc(doc(firestore, 'whatsapp_templates', id), updateData);
                Swal.fire({
                    title: 'Success',
                    text: 'Template updated successfully',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            }

            router.push('/dashboard/settings/whatsapp-templates');
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
                <Link href="/dashboard/settings/whatsapp-templates">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{isNew ? 'Create WhatsApp Template' : 'Edit WhatsApp Template'}</h1>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Template Details</CardTitle>
                    <CardDescription>Define the message content and placeholders.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="name">Template Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. Welcome Message"
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
                                    placeholder="e.g. welcome_message"
                                    value={formData.slug}
                                    onChange={(e) => handleInputChange('slug', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                                    disabled={!isNew}
                                    className={!isNew ? "bg-muted font-mono" : "font-mono"}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="subject">Subject (Header)</Label>
                            <Input
                                id="subject"
                                placeholder="Subject line..."
                                value={formData.subject}
                                onChange={(e) => handleInputChange('subject', e.target.value)}
                            />
                            <p className="text-[10px] text-muted-foreground">Will be formatted as: <code>*// Subject //*</code> followed by a separator line.</p>
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
                                        '{{company_name}}',
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
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="body">Message Body (Plain Text)</Label>
                            <Textarea
                                id="body"
                                className="font-sans min-h-[300px]"
                                placeholder="Hello {{name}}, ..."
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
                                        {formData.subject && (
                                            <>
                                                <strong>{`// ${formData.subject} //`}</strong>
                                                <div className="border-b border-black/20 dark:border-white/20 my-2">----------------</div>
                                            </>
                                        )}
                                        {formData.body
                                            // Simple mock replacements for preview
                                            ?.replace(/{{name}}/g, 'John Doe')
                                            .replace(/{{user_name}}/g, 'johndoe123')
                                            .replace(/{{department}}/g, 'Production')
                                            .replace(/{{designation}}/g, 'Manager')
                                            .replace(/{{company_name}}/g, companyName)
                                            .replace(/{{password}}/g, '(hidden)')
                                        }
                                        <div className="text-[10px] text-right mt-2 opacity-60">
                                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>

                            <Link href="/dashboard/settings/whatsapp-templates">
                                <Button type="button" variant="outline">Cancel</Button>
                            </Link>
                            <Button type="submit" disabled={saving} className="bg-[#25D366] hover:bg-[#128C7E]">
                                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Template</>}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
