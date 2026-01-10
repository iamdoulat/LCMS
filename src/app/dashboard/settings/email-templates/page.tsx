
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Edit, Trash2, FileText, Code, Download, Upload } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import Swal from 'sweetalert2';
import { collection, deleteDoc, doc, onSnapshot, query, orderBy, updateDoc, writeBatch, serverTimestamp, getDocs, where } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { EmailTemplate } from '@/types/email-settings';
import { Loader2 } from 'lucide-react';

export default function EmailTemplatesPage() {
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        const q = query(collection(firestore, 'email_templates'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as EmailTemplate[];
            setTemplates(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleDelete = async (id: string, name: string) => {
        try {
            const result = await Swal.fire({
                title: 'Delete Template?',
                text: `Are you sure you want to delete "${name}"?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, delete it!'
            });

            if (result.isConfirmed) {
                await deleteDoc(doc(firestore, 'email_templates', id));
                Swal.fire('Deleted!', 'Template has been deleted.', 'success');
            }
        } catch (error) {
            console.error("Error deleting template:", error);
            Swal.fire('Error', 'Failed to delete template', 'error');
        }
    };

    const handleToggle = async (id: string, currentStatus: boolean, name: string) => {
        try {
            await updateDoc(doc(firestore, 'email_templates', id), {
                isActive: !currentStatus
            });

            const statusText = !currentStatus ? 'enabled' : 'disabled';
            Swal.fire({
                title: 'Success',
                text: `Template "${name}" has been ${statusText}`,
                icon: 'success',
                timer: 1000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error("Error toggling template:", error);
            Swal.fire('Error', 'Failed to update template status', 'error');
        }
    };

    const handleExport = () => {
        try {
            const dataToExport = templates.map(({ name, slug, subject, body, variables, isActive }) => ({
                name,
                slug,
                subject,
                body,
                variables: variables || [],
                isActive: isActive !== false
            }));

            const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `email_templates_export_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            Swal.fire('Success', 'Templates exported successfully', 'success');
        } catch (error) {
            console.error("Export error:", error);
            Swal.fire('Error', 'Failed to export templates', 'error');
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input
        e.target.value = '';

        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const content = event.target?.result as string;
                    const importedTemplates = JSON.parse(content);

                    if (!Array.isArray(importedTemplates)) {
                        throw new Error("Invalid file format: Expected an array of templates");
                    }

                    // Basic validation
                    for (const t of importedTemplates) {
                        if (!t.name || !t.slug || !t.subject || !t.body) {
                            throw new Error(`Invalid template data: ${t.name || 'Unknown'} is missing required fields`);
                        }
                    }

                    const confirmResult = await Swal.fire({
                        title: 'Import Templates?',
                        text: `This will import ${importedTemplates.length} templates. Existing templates with the same slug will be overwritten.`,
                        icon: 'question',
                        showCancelButton: true,
                        confirmButtonText: 'Yes, import'
                    });

                    if (!confirmResult.isConfirmed) return;

                    setImporting(true);
                    const batch = writeBatch(firestore);
                    const templatesRef = collection(firestore, 'email_templates');

                    for (const t of importedTemplates) {
                        const q = query(templatesRef, where('slug', '==', t.slug));
                        const snapshot = await getDocs(q);

                        const templateData = {
                            ...t,
                            updatedAt: serverTimestamp()
                        };

                        if (!snapshot.empty) {
                            // Update existing
                            const docRef = doc(firestore, 'email_templates', snapshot.docs[0].id);
                            batch.update(docRef, templateData);
                        } else {
                            // Create new
                            const docRef = doc(templatesRef);
                            batch.set(docRef, {
                                ...templateData,
                                createdAt: serverTimestamp()
                            });
                        }
                    }

                    await batch.commit();
                    setImporting(false);
                    Swal.fire('Success', 'Templates imported successfully', 'success');
                } catch (error: any) {
                    setImporting(false);
                    console.error("Import parsing error:", error);
                    Swal.fire('Error', error.message || 'Failed to parse JSON file', 'error');
                }
            };
            reader.readAsText(file);
        } catch (error) {
            console.error("File reading error:", error);
            Swal.fire('Error', 'Failed to read file', 'error');
        }
    };

    return (
        <div className="max-w-none mx-[10px] md:mx-[25px] mt-[10px] md:mt-0 mb-[50px] md:mb-0 py-8 px-0">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Email Templates</h1>
                    <p className="text-muted-foreground">Manage templates for automated email notifications.</p>
                </div>
                <div className="flex gap-2">
                    <input
                        type="file"
                        accept=".json"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <Button variant="outline" onClick={handleExport} disabled={templates.length === 0}>
                        <Download className="mr-2 h-4 w-4" /> Export JSON
                    </Button>
                    <Button variant="outline" onClick={handleImportClick} disabled={importing}>
                        {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Import JSON
                    </Button>
                    <Link href="/dashboard/settings/email-templates/new">
                        <Button><Plus className="mr-2 h-4 w-4" /> Create Template</Button>
                    </Link>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : templates.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium">No Templates Found</p>
                        <p className="text-muted-foreground mb-6">Create your first email template to get started.</p>
                        <Link href="/dashboard/settings/email-templates/new">
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Create Template
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {templates.map((template) => (
                        <Card key={template.id} className="hover:border-primary/50 transition-colors">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center justify-between">
                                    <span className="truncate" title={template.name}>{template.name}</span>
                                </CardTitle>
                                <CardDescription className="font-mono text-xs bg-muted px-2 py-1 rounded w-fit">
                                    {template.slug}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="text-sm text-muted-foreground truncate">
                                        <span className="font-medium text-foreground">Subject:</span> {template.subject}
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t">
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                checked={template.isActive !== false}
                                                onCheckedChange={() => handleToggle(template.id!, template.isActive !== false, template.name)}
                                                id={`template-${template.id}`}
                                            />
                                            <label
                                                htmlFor={`template-${template.id}`}
                                                className="text-sm cursor-pointer"
                                            >
                                                {template.isActive !== false ? 'Active' : 'Inactive'}
                                            </label>
                                        </div>

                                        <div className="flex gap-2">
                                            <Link href={`/dashboard/settings/email-templates/${template.id}`}>
                                                <Button variant="outline" size="sm">
                                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                                </Button>
                                            </Link>
                                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(template.id!, template.name)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
