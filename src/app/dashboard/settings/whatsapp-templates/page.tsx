
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Edit, Trash2, Smartphone } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import Swal from 'sweetalert2';
import { collection, deleteDoc, doc, onSnapshot, query, orderBy, getDocs, writeBatch, where, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { WhatsAppTemplate } from '@/types/whatsapp-settings';
import { Loader2, Download } from 'lucide-react';

export default function WhatsAppTemplatesPage() {
    const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [importEnabled, setImportEnabled] = useState(false);

    useEffect(() => {
        const q = query(collection(firestore, 'whatsapp_templates'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as WhatsAppTemplate[];
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
                await deleteDoc(doc(firestore, 'whatsapp_templates', id));
                Swal.fire('Deleted!', 'Template has been deleted.', 'success');
            }
        } catch (error) {
            console.error("Error deleting template:", error);
            Swal.fire('Error', 'Failed to delete template', 'error');
        }
    };

    const stripHtml = (html: string) => {
        if (typeof window === 'undefined') return html;
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    };

    const handleImportFromEmail = async () => {
        try {
            const result = await Swal.fire({
                title: 'Import Email Templates?',
                text: "This will attempt to import templates from the Email module. Existing WhatsApp templates with the same slug will be skipped.",
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: 'Yes, Import',
                cancelButtonText: 'Cancel'
            });

            if (!result.isConfirmed) return;

            setImporting(true);

            // 1. Fetch all email templates
            const emailTemplatesParams = collection(firestore, 'email_templates');
            const emailSnapshot = await getDocs(emailTemplatesParams);

            if (emailSnapshot.empty) {
                Swal.fire('Info', 'No email templates found to import.', 'info');
                setImporting(false);
                return;
            }

            const emailTemplates = emailSnapshot.docs.map(d => d.data());

            // 2. Fetch existing WA templates (slugs)
            // Or just check each one. Batch write is efficient.
            const batch = writeBatch(firestore);
            let importedCount = 0;
            let skippedCount = 0;

            // We need to check existing asynchronously, so maybe not pure batch blindly.
            // Let's fetch all WA slug list first for efficient checking.
            const waSnapshot = await getDocs(collection(firestore, 'whatsapp_templates'));
            const existingSlugs = new Set(waSnapshot.docs.map(d => d.data().slug));

            for (const et of emailTemplates) {
                if (!et.slug) continue;

                if (existingSlugs.has(et.slug)) {
                    skippedCount++;
                    continue;
                }

                const newRef = doc(collection(firestore, 'whatsapp_templates'));
                batch.set(newRef, {
                    name: et.name,
                    slug: et.slug,
                    subject: et.subject || 'No Subject',
                    body: stripHtml(et.body || ''),
                    variables: et.variables || [],
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
                importedCount++;
            }

            if (importedCount > 0) {
                await batch.commit();
                Swal.fire('Success', `Imported ${importedCount} templates. Skipped ${skippedCount} existing.`, 'success');
            } else {
                Swal.fire('Info', `No new templates imported. ${skippedCount} items already existed.`, 'info');
            }

        } catch (error) {
            console.error("Import error:", error);
            Swal.fire('Error', 'Failed to import templates', 'error');
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">WhatsApp Templates</h1>
                    <p className="text-muted-foreground">Manage templates for automated WhatsApp notifications.</p>
                </div>
                <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-2 border rounded-md px-3 py-2">
                        <Switch
                            id="import-toggle"
                            checked={importEnabled}
                            onCheckedChange={setImportEnabled}
                        />
                        <Label htmlFor="import-toggle" className="cursor-pointer text-sm">
                            Enable Import
                        </Label>
                    </div>
                    <Button
                        variant="outline"
                        onClick={handleImportFromEmail}
                        disabled={!importEnabled || importing}
                        className="gap-2"
                    >
                        {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {importing ? 'Importing...' : 'Import from Email'}
                    </Button>
                    <Link href="/dashboard/settings/whatsapp-templates/new">
                        <Button className="bg-[#25D366] hover:bg-[#128C7E]"><Plus className="mr-2 h-4 w-4" /> Create Template</Button>
                    </Link>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : templates.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                        <Smartphone className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium">No Templates Found</p>
                        <p className="text-muted-foreground mb-6">Create your first WhatsApp template to get started.</p>
                        <div className="flex gap-2 justify-center">
                            <Button variant="outline" onClick={handleImportFromEmail} disabled={!importEnabled || importing}>
                                {importing ? 'Importing...' : 'Import from Email'}
                            </Button>
                            <Link href="/dashboard/settings/whatsapp-templates/new">
                                <Button className="bg-[#25D366] hover:bg-[#128C7E]">
                                    <Plus className="mr-2 h-4 w-4" /> Create Template
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {templates.map((template) => (
                        <Card key={template.id} className="hover:border-[#25D366]/50 transition-colors">
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
                                    <div className="text-xs text-muted-foreground line-clamp-2 bg-muted/50 p-2 rounded">
                                        {template.body}
                                    </div>

                                    <div className="flex gap-2 justify-end mt-4">
                                        <Link href={`/dashboard/settings/whatsapp-templates/${template.id}`}>
                                            <Button variant="outline" size="sm">
                                                <Edit className="mr-2 h-4 w-4" /> Edit
                                            </Button>
                                        </Link>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(template.id!, template.name)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
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
