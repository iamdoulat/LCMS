
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit, Check, Eye, EyeOff, Mail, Server } from 'lucide-react';
import Swal from 'sweetalert2';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { SmtpConfiguration } from '@/types/email-settings';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { Loader2 } from 'lucide-react';

export default function SmtpSettingsPage() {
    const [configs, setConfigs] = useState<SmtpConfiguration[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    // Test Email State
    const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
    const [testEmail, setTestEmail] = useState('');
    const [sendingTest, setSendingTest] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<SmtpConfiguration>>({
        name: '',
        serviceProvider: 'smtp',
        host: '',
        port: 587,
        user: '',
        pass: '',
        fromEmail: '',
        resendApiKey: '',
        isActive: false,
    });

    useEffect(() => {
        const q = query(collection(firestore, 'smtp_settings'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as SmtpConfiguration[];
            setConfigs(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleInputChange = (field: keyof SmtpConfiguration, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const resetForm = () => {
        setFormData({
            name: '',
            serviceProvider: 'smtp',
            host: '',
            port: 587,
            user: '',
            pass: '',
            fromEmail: '',
            resendApiKey: '',
            isActive: false,
        });
        setIsEditing(false);
        setCurrentId(null);
        setShowPassword(false);
    };

    const handleEdit = (config: SmtpConfiguration) => {
        setFormData({ ...config });
        setCurrentId(config.id!);
        setIsEditing(true);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string, name: string) => {
        try {
            const result = await Swal.fire({
                title: 'Delete Config?',
                text: `Are you sure you want to delete "${name}"?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, delete it!'
            });

            if (result.isConfirmed) {
                await deleteDoc(doc(firestore, 'smtp_settings', id));
                Swal.fire('Deleted!', 'Configuration has been deleted.', 'success');
            }
        } catch (error) {
            console.error("Error deleting config:", error);
            Swal.fire('Error', 'Failed to delete configuration', 'error');
        }
    };

    const handleSetActive = async (id: string) => {
        try {
            const batch = writeBatch(firestore);

            // Set all others to inactive
            configs.forEach(config => {
                if (config.id !== id && config.isActive) {
                    const ref = doc(firestore, 'smtp_settings', config.id!);
                    batch.update(ref, { isActive: false });
                }
            });

            // Set selected to active
            const targetRef = doc(firestore, 'smtp_settings', id);
            batch.update(targetRef, { isActive: true });

            await batch.commit();
            Swal.fire('Updated', 'Active SMTP service updated successfully', 'success');
        } catch (error) {
            console.error("Error setting active config:", error);
            Swal.fire('Error', 'Failed to update active service', 'error');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (!formData.name) {
                Swal.fire('Error', 'Name is required', 'error');
                return;
            }

            if (formData.serviceProvider === 'smtp') {
                if (!formData.host || !formData.port || !formData.user || !formData.pass || !formData.fromEmail) {
                    Swal.fire('Error', 'All SMTP fields are required', 'error');
                    return;
                }
            } else if (formData.serviceProvider === 'resend_api') {
                if (!formData.resendApiKey || !formData.fromEmail) {
                    Swal.fire('Error', 'Resend API Key and From Email are required', 'error');
                    return;
                }
            }

            const dataToSave = {
                ...formData,
                updatedAt: serverTimestamp(),
            };

            if (isEditing && currentId) {
                await updateDoc(doc(firestore, 'smtp_settings', currentId), dataToSave);
                Swal.fire('Success', 'Configuration updated successfully', 'success');
            } else {
                await addDoc(collection(firestore, 'smtp_settings'), {
                    ...dataToSave,
                    createdAt: serverTimestamp(),
                });
                Swal.fire('Success', 'Configuration added successfully', 'success');
            }

            setIsDialogOpen(false);
            resetForm();
        } catch (error) {
            console.error("Error saving config:", error);
            Swal.fire('Error', 'Failed to save configuration', 'error');
        }
    };

    const handleSendTestEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!testEmail) return;

        setSendingTest(true);
        try {
            const response = await fetch('/api/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: testEmail,
                    subject: 'SMTP Test Email - Nextsew',
                    body: `
            <h1>SMTP Configuration Test</h1>
            <p>This is a test email sent from your Nextsew dashboard to verify your SMTP settings.</p>
            <p><strong>Status:</strong> <span style="color: green;">Success</span></p>
            <p>Timestamp: ${new Date().toLocaleString()}</p>
          `
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                Swal.fire('Success', 'Test email sent successfully! Please check your inbox.', 'success');
                setIsTestDialogOpen(false);
                setTestEmail('');
            } else {
                throw new Error(result.error || 'Failed to send email');
            }
        } catch (error: any) {
            console.error("Test Email Error:", error);
            Swal.fire('Test Failed', error.message || 'Could not send test email. Check your SMTP settings.', 'error');
        } finally {
            setSendingTest(false);
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">SMTP Settings</h1>
                    <p className="text-muted-foreground">Manage your email sending services. Select one as active.</p>
                </div>

                <div className="flex gap-2">
                    <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" disabled={configs.length === 0}><Mail className="mr-2 h-4 w-4" /> Test Connection</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Send Test Email</DialogTitle>
                                <CardDescription>
                                    This will send a test email using your currently <strong>ACTIVE</strong> configuration.
                                </CardDescription>
                            </DialogHeader>
                            <form onSubmit={handleSendTestEmail} className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="testEmail">Recipient Email</Label>
                                    <Input
                                        id="testEmail"
                                        type="email"
                                        placeholder="Enter an email to receive the test..."
                                        value={testEmail}
                                        onChange={(e) => setTestEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsTestDialogOpen(false)}>Cancel</Button>
                                    <Button type="submit" disabled={sendingTest}>
                                        {sendingTest ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : 'Send Test Email'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
                        <DialogTrigger asChild>
                            <Button><Plus className="mr-2 h-4 w-4" /> Add New Service</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>{isEditing ? 'Edit SMTP Configuration' : 'Add New SMTP Configuration'}</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4 py-4">
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="name">Configuration Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g. Corporate Gmail, Resend Production"
                                        value={formData.name}
                                        onChange={(e) => handleInputChange('name', e.target.value)}
                                    />
                                </div>

                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="provider">Service Provider</Label>
                                    <Select
                                        value={formData.serviceProvider}
                                        onValueChange={(val) => handleInputChange('serviceProvider', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Provider" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="smtp">Standard SMTP</SelectItem>
                                            <SelectItem value="resend_api">Resend API</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="fromEmail">From Email Address</Label>
                                    <Input
                                        id="fromEmail"
                                        type="email"
                                        placeholder="details@example.com"
                                        value={formData.fromEmail}
                                        onChange={(e) => handleInputChange('fromEmail', e.target.value)}
                                    />
                                </div>

                                {formData.serviceProvider === 'smtp' && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="host">SMTP Host</Label>
                                                <Input
                                                    id="host"
                                                    placeholder="smtp.gmail.com"
                                                    value={formData.host}
                                                    onChange={(e) => handleInputChange('host', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="port">Port</Label>
                                                <Input
                                                    id="port"
                                                    type="number"
                                                    placeholder="587"
                                                    value={formData.port}
                                                    onChange={(e) => handleInputChange('port', parseInt(e.target.value))}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="user">Username / Email</Label>
                                            <Input
                                                id="user"
                                                placeholder="username"
                                                value={formData.user}
                                                onChange={(e) => handleInputChange('user', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="pass">Password</Label>
                                            <div className="relative">
                                                <Input
                                                    id="pass"
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="••••••••"
                                                    value={formData.pass}
                                                    onChange={(e) => handleInputChange('pass', e.target.value)}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {formData.serviceProvider === 'resend_api' && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="apiKey">Resend API Key</Label>
                                        <div className="relative">
                                            <Input
                                                id="apiKey"
                                                type={showPassword ? "text" : "password"}
                                                placeholder="re_123456789"
                                                value={formData.resendApiKey}
                                                onChange={(e) => handleInputChange('resendApiKey', e.target.value)}
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                                onClick={() => setShowPassword(!showPassword)}
                                            >
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Get your API key from <a href="https://resend.com/api-keys" target="_blank" className="underline text-primary">Resend Dashboard</a>
                                        </p>
                                    </div>
                                )}

                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                                    <Button type="submit">Save Configuration</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : configs.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                        <Server className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium">No Email Services Configured</p>
                        <p className="text-muted-foreground mb-6">Add an SMTP or Resend API configuration to start sending emails.</p>
                        <Button onClick={() => { setIsEditing(false); setIsDialogOpen(true); }}>
                            <Plus className="mr-2 h-4 w-4" /> Configure Service
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {configs.map((config) => (
                        <Card key={config.id} className={`relative overflow-hidden transition-all ${config.isActive ? 'border-primary ring-1 ring-primary shadow-md' : 'border-border/60 hover:border-border'}`}>
                            {config.isActive && (
                                <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-medium rounded-bl-lg">
                                    Active
                                </div>
                            )}
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2">
                                    {config.serviceProvider === 'resend_api' ? <Mail className="h-5 w-5 text-orange-500" /> : <Server className="h-5 w-5 text-blue-500" />}
                                    {config.name}
                                </CardTitle>
                                <CardDescription>{config.serviceProvider === 'resend_api' ? 'Resend API' : 'SMTP Server'}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm text-muted-foreground mb-6">
                                    <div className="flex justify-between">
                                        <span>From:</span>
                                        <span className="font-medium text-foreground">{config.fromEmail}</span>
                                    </div>
                                    {config.serviceProvider === 'smtp' && (
                                        <div className="flex justify-between">
                                            <span>Host:</span>
                                            <span className="font-medium text-foreground">{config.host}:{config.port}</span>
                                        </div>
                                    )}
                                    {config.serviceProvider === 'resend_api' && (
                                        <div className="flex justify-between">
                                            <span>API Key:</span>
                                            <span className="font-medium text-foreground">••••••••</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    {!config.isActive && (
                                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleSetActive(config.id!)}>
                                            <Check className="mr-2 h-4 w-4" /> Set Active
                                        </Button>
                                    )}
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(config)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(config.id!, config.name)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
