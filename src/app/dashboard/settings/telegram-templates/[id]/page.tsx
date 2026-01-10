
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save, Loader2, Info, Eye, Send } from 'lucide-react';
import Swal from 'sweetalert2';
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { TelegramTemplate } from '@/types/telegram-settings';
import { Badge } from '@/components/ui/badge';
import { getCompanyName } from '@/lib/settings/company';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

export default function EditTelegramTemplatePage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const isNew = id === 'new';
    const [companyName, setCompanyName] = useState('Nextsew');

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState<Partial<TelegramTemplate>>({
        name: '',
        slug: '',
        body: '',
        isActive: true,
    });

    useEffect(() => {
        getCompanyName().then(setCompanyName);

        if (!isNew && id) {
            const fetchTemplate = async () => {
                try {
                    const docRef = doc(firestore, 'telegram_templates', id);
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        setFormData({ id: snap.id, ...snap.data() } as TelegramTemplate);
                    } else {
                        Swal.fire('Error', 'Template not found', 'error');
                        router.push('/dashboard/settings/telegram-templates');
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

    const handleInputChange = (field: keyof TelegramTemplate, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            if (!formData.name || !formData.slug || !formData.body) {
                Swal.fire('Error', 'Please fill all required fields', 'error');
                setSaving(false);
                return;
            }

            // Check slug uniqueness if new or slug changed
            if (isNew) {
                const q = query(collection(firestore, 'telegram_templates'), where('slug', '==', formData.slug));
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
                await addDoc(collection(firestore, 'telegram_templates'), {
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
                const { id: _, ...updateData } = dataToSave;
                await updateDoc(doc(firestore, 'telegram_templates', id), updateData as any);
                Swal.fire({
                    title: 'Success',
                    text: 'Template updated successfully',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            }

            router.push('/dashboard/settings/telegram-templates');
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

    const standardVariables = [
        '{{employee_name}}', '{{employee_code}}', '{{time}}', '{{date}}',
        '{{location}}', '{{location_company_name}}', '{{remarks}}', '{{company_name}}'
    ];

    return (
        <div className="container mx-auto p-6 max-w-4xl space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/settings/telegram-templates">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{isNew ? 'Create Telegram Template' : 'Edit Telegram Template'}</h1>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Template Details</CardTitle>
                    <CardDescription>Define the Telegram message content and placeholders.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="name">Template Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. Employee Check-In"
                                    value={formData.name}
                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="slug">
                                    Unique Identifier (Slug)
                                    <span className="text-xs text-muted-foreground ml-2 font-normal">(Used in code)</span>
                                </Label>
                                <Input
                                    id="slug"
                                    placeholder="e.g. attendance_check_in"
                                    value={formData.slug}
                                    onChange={(e) => handleInputChange('slug', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                                    disabled={!isNew}
                                    className={!isNew ? "bg-muted font-mono" : "font-mono"}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Available Variables (Click to add)</Label>
                            <div className="flex flex-wrap gap-1 p-3 border rounded-md">
                                {standardVariables.map(v => (
                                    <Badge
                                        key={v}
                                        variant="outline"
                                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs font-normal"
                                        onClick={() => handleInputChange('body', (formData.body || '') + v)}
                                    >
                                        + {v}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="body">Message Body</Label>
                            <Alert className="mb-2 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <AlertTitle className="text-blue-800 dark:text-blue-300">Telegram Formatting</AlertTitle>
                                <AlertDescription className="text-blue-700 dark:text-blue-400">
                                    You can use HTML tags like <code>{`<b>, <i>, <code>`}</code> for formatting.
                                </AlertDescription>
                            </Alert>
                            <Textarea
                                id="body"
                                className="font-mono min-h-[250px]"
                                placeholder="<b>[CHECK IN]</b> - {{employee_name}}..."
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
                                        <DialogTitle>Telegram Preview</DialogTitle>
                                        <DialogDescription>
                                            Sample view of the message in Telegram.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="bg-[#242F3D] text-white p-4 rounded-lg mt-2 font-sans overflow-hidden">
                                        <div className="flex gap-3">
                                            <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 text-white font-bold">B</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-[#64B5F6] mb-1">Attendance Bot</div>
                                                <div className="whitespace-pre-wrap break-words text-sm" dangerouslySetInnerHTML={{
                                                    __html: (formData.body || '')
                                                        .replace(/{{employee_name}}/g, 'John Doe')
                                                        .replace(/{{employee_code}}/g, 'EMP001')
                                                        .replace(/{{time}}/g, '09:00 AM')
                                                        .replace(/{{date}}/g, new Date().toLocaleDateString())
                                                        .replace(/{{location}}/g, 'Uttara, Dhaka')
                                                        .replace(/{{location_company_name}}/g, 'Client ABC')
                                                        .replace(/{{remarks}}/g, 'On time')
                                                        .replace(/{{company_name}}/g, companyName)
                                                }} />
                                            </div>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>

                            <Link href="/dashboard/settings/telegram-templates">
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
