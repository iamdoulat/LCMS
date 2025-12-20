
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Edit, Trash2, FileText, Code } from 'lucide-react';
import Swal from 'sweetalert2';
import { collection, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { EmailTemplate } from '@/types/email-settings';
import { Loader2 } from 'lucide-react';

export default function EmailTemplatesPage() {
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [loading, setLoading] = useState(true);

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

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Email Templates</h1>
                    <p className="text-muted-foreground">Manage templates for automated email notifications.</p>
                </div>
                <Link href="/dashboard/settings/email-templates/new">
                    <Button><Plus className="mr-2 h-4 w-4" /> Create Template</Button>
                </Link>
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

                                    <div className="flex gap-2 justify-end mt-4">
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
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
