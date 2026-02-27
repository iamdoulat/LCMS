"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit, Check, Eye, EyeOff, MessageSquare, Smartphone, Power, PowerOff } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import Swal from 'sweetalert2';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { WhatsAppGatewayConfig } from '@/types/whatsapp-settings';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, writeBatch, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { Loader2 } from 'lucide-react';
import { getCompanyName } from '@/lib/settings/company';

export default function WhatsAppSettingsPage() {
    const [configs, setConfigs] = useState<WhatsAppGatewayConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [companyName, setCompanyName] = useState('LCMS');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [showSecret, setShowSecret] = useState(false);
    const [usages, setUsages] = useState<Record<string, number>>({});
    const [loadingUsages, setLoadingUsages] = useState<Record<string, boolean>>({});

    // Test Message State
    const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
    const [testNumber, setTestNumber] = useState('');
    const [sendingTest, setSendingTest] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<WhatsAppGatewayConfig>>({
        name: '',
        apiSecret: '',
        accountUniqueId: '',
        isActive: false,
        dailyUsageLimit: 0,
        isDisabled: false,
    });

    useEffect(() => {
        // Fetch company name
        getCompanyName().then(setCompanyName);

        // Removed orderBy temporarily to rule out index issues
        const q = query(collection(firestore, 'whatsapp_gateways'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as WhatsAppGatewayConfig[];
            setConfigs(data);
            setLoading(false);

            // Initial fetch for usages
            data.forEach(config => {
                if (config.id) fetchUsage(config.id);
            });
        }, (error) => {
            console.error("Firestore Snapshot Error:", error);
            Swal.fire('Error', 'Failed to load gateways: ' + error.message, 'error');
            setLoading(false);
        });

        const fetchUsage = async (gatewayId: string) => {
            setLoadingUsages(prev => ({ ...prev, [gatewayId]: true }));
            try {
                const response = await fetch(`/api/settings/whatsapp/usage?id=${gatewayId}`, { cache: 'no-store' });
                if (response.ok) {
                    const data = await response.json();
                    setUsages(prev => ({ ...prev, [gatewayId]: data.count }));
                }
            } catch (error) {
                console.error("Error fetching usage:", error);
            } finally {
                setLoadingUsages(prev => ({ ...prev, [gatewayId]: false }));
            }
        };

        return () => unsubscribe();
    }, []);

    const handleInputChange = (field: keyof WhatsAppGatewayConfig, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const resetForm = () => {
        setFormData({
            name: '',
            apiSecret: '',
            accountUniqueId: '',
            isActive: false,
            dailyUsageLimit: 0,
            isDisabled: false,
        });
        setIsEditing(false);
        setCurrentId(null);
        setShowSecret(false);
    };

    const handleEdit = (config: WhatsAppGatewayConfig) => {
        setFormData({ ...config });
        setCurrentId(config.id!);
        setIsEditing(true);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string, name: string) => {
        try {
            const result = await Swal.fire({
                title: 'Delete Gateway?',
                text: `Are you sure you want to delete "${name}"?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, delete it!'
            });

            if (result.isConfirmed) {
                await deleteDoc(doc(firestore, 'whatsapp_gateways', id));
                Swal.fire('Deleted!', 'Gateway has been deleted.', 'success');
            }
        } catch (error) {
            console.error("Error deleting gateway:", error);
            Swal.fire('Error', 'Failed to delete gateway', 'error');
        }
    };

    const handleSetActive = async (id: string) => {
        try {
            const batch = writeBatch(firestore);

            // Set all others to inactive
            configs.forEach(config => {
                if (config.id !== id && config.isActive) {
                    const ref = doc(firestore, 'whatsapp_gateways', config.id!);
                    batch.update(ref, { isActive: false });
                }
            });

            // Set selected to active
            const targetConfig = configs.find(c => c.id === id);
            if (targetConfig?.isDisabled) {
                Swal.fire('Error', 'Cannot activate a disabled gateway. Please enable it first.', 'error');
                return;
            }

            const targetRef = doc(firestore, 'whatsapp_gateways', id);
            batch.update(targetRef, { isActive: true });

            await batch.commit();
            Swal.fire('Updated', 'Active WhatsApp gateway updated successfully', 'success');
        } catch (error) {
            console.error("Error setting active gateway:", error);
            Swal.fire('Error', 'Failed to update active gateway', 'error');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (!formData.name || !formData.apiSecret || !formData.accountUniqueId) {
                Swal.fire('Error', 'All fields are required', 'error');
                return;
            }

            const dataToSave = {
                ...formData,
                updatedAt: serverTimestamp(),
            };

            if (isEditing && currentId) {
                await updateDoc(doc(firestore, 'whatsapp_gateways', currentId), dataToSave);
                Swal.fire('Success', 'Gateway updated successfully', 'success');
            } else {
                await addDoc(collection(firestore, 'whatsapp_gateways'), {
                    ...dataToSave,
                    createdAt: serverTimestamp(),
                });
                Swal.fire('Success', 'Gateway added successfully', 'success');
            }

            setIsDialogOpen(false);
            resetForm();
        } catch (error) {
            console.error("Error saving gateway:", error);
            Swal.fire('Error', 'Failed to save gateway', 'error');
        }
    };

    const handleSendTestMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!testNumber) return;

        setSendingTest(true);
        try {
            const response = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: testNumber,
                    message: `This is a test message from your ${companyName} WhatsApp settings.`
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                Swal.fire('Success', 'Test message sent successfully!', 'success');
                setIsTestDialogOpen(false);
                setTestNumber('');
            } else {
                throw new Error(result.error || 'Failed to send message');
            }
        } catch (error: any) {
            console.error("Test Message Error:", error);
            Swal.fire('Test Failed', error.message || 'Could not send test message. Check your settings.', 'error');
        } finally {
            setSendingTest(false);
        }
    };

    return (
        <div className="max-w-none mx-[10px] md:mx-[25px] mt-[10px] md:mt-0 mb-[50px] md:mb-0 py-8 px-0">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{companyName} WhatsApp Settings</h1>
                    <p className="text-muted-foreground">Manage your WhatsApp API gateways (bipsms.com). Select one as active.</p>
                </div>

                <div className="flex gap-2">
                    <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" disabled={configs.length === 0}><MessageSquare className="mr-2 h-4 w-4" /> Test Gateway</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Send Test Message</DialogTitle>
                                <CardDescription>
                                    This will send a test message using your currently <strong>ACTIVE</strong> gateway.
                                </CardDescription>
                            </DialogHeader>
                            <form onSubmit={handleSendTestMessage} className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="testNumber">Recipient Phone Number</Label>
                                    <Input
                                        id="testNumber"
                                        placeholder="e.g. 8801812345678"
                                        value={testNumber}
                                        onChange={(e) => setTestNumber(e.target.value)}
                                        required
                                    />
                                    <p className="text-xs text-muted-foreground">Enter number with country code (e.g. 880...)</p>
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsTestDialogOpen(false)}>Cancel</Button>
                                    <Button type="submit" disabled={sendingTest}>
                                        {sendingTest ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : 'Send Test Message'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
                        <DialogTrigger asChild>
                            <Button><Plus className="mr-2 h-4 w-4" /> Add New Gateway</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>{isEditing ? 'Edit WhatsApp Gateway' : 'Add New WhatsApp Gateway'}</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4 py-4">
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="name">Gateway Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g. Corporate WhatsApp"
                                        value={formData.name}
                                        onChange={(e) => handleInputChange('name', e.target.value)}
                                    />
                                </div>

                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="accountUniqueId">Account Unique ID</Label>
                                    <Input
                                        id="accountUniqueId"
                                        placeholder="Enter Account Unique ID"
                                        value={formData.accountUniqueId}
                                        onChange={(e) => handleInputChange('accountUniqueId', e.target.value)}
                                    />
                                </div>

                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="apiSecret">API Secret</Label>
                                    <div className="relative">
                                        <Input
                                            id="apiSecret"
                                            type={showSecret ? "text" : "password"}
                                            placeholder="Enter API Secret"
                                            value={formData.apiSecret}
                                            onChange={(e) => handleInputChange('apiSecret', e.target.value)}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                            onClick={() => setShowSecret(!showSecret)}
                                        >
                                            {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid w-full items-center gap-1.5 pt-2">
                                    <Label htmlFor="dailyUsageLimit">Daily Usage Limit (Messages per Day)</Label>
                                    <Input
                                        id="dailyUsageLimit"
                                        type="number"
                                        placeholder="0 for unlimited"
                                        value={formData.dailyUsageLimit || 0}
                                        onChange={(e) => handleInputChange('dailyUsageLimit', parseInt(e.target.value))}
                                    />
                                </div>

                                <div className="flex items-center justify-between space-x-2 pt-2 border-t mt-4">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="isDisabled" className="text-base">Disable Gateway</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Permanently stop this gateway from being used or automatically activated.
                                        </p>
                                    </div>
                                    <Switch
                                        id="isDisabled"
                                        checked={formData.isDisabled || false}
                                        onCheckedChange={(checked) => handleInputChange('isDisabled', checked)}
                                    />
                                </div>

                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                                    <Button type="submit">Save Gateway</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {
                loading ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : configs.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                            <Smartphone className="h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-lg font-medium">No WhatsApp Gateways Configured</p>
                            <p className="text-muted-foreground mb-6">Add a gateway to start sending WhatsApp notifications.</p>
                            <Button onClick={() => { setIsEditing(false); setIsDialogOpen(true); }}>
                                <Plus className="mr-2 h-4 w-4" /> Configure Gateway
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {configs.map((config) => (
                            <Card key={config.id} className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg border-2 ${config.isActive ? 'border-primary shadow-primary/10' : 'border-border'} ${config.isDisabled ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                                {config.isActive && !config.isDisabled && (
                                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-bold rounded-bl-lg flex items-center gap-1 animate-in fade-in slide-in-from-top-2 duration-500">
                                        <Check className="h-3 w-3" /> Active
                                    </div>
                                )}
                                {config.isDisabled && (
                                    <div className="absolute top-0 right-0 bg-destructive text-destructive-foreground px-3 py-1 text-xs font-bold rounded-bl-lg flex items-center gap-1">
                                        <PowerOff className="h-3 w-3" /> Disabled
                                    </div>
                                )}
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2">
                                        <MessageSquare className="h-5 w-5 text-green-500" />
                                        {config.name}
                                    </CardTitle>
                                    <CardDescription>ID: {config.accountUniqueId}</CardDescription>
                                    <CardDescription className="flex items-center gap-1 mt-1 text-xs font-mono opacity-50 text-[10px]">
                                        Related ID: {config.id}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2 text-sm text-muted-foreground mb-6">
                                        <div className="flex justify-between">
                                            <span>API Secret:</span>
                                            <span className="font-medium text-foreground">••••••••</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2 mb-6">
                                        <div className="flex justify-between items-center text-xs mb-1">
                                            <span className="text-muted-foreground flex items-center gap-1">
                                                Daily Usage: {loadingUsages[config.id!] ? <Loader2 className="h-3 w-3 animate-spin" /> : <b>{usages[config.id!] || 0} / {config.dailyUsageLimit || '∞'}</b>}
                                            </span>
                                            {config.dailyUsageLimit ? (
                                                <span className={`${(usages[config.id!] || 0) >= config.dailyUsageLimit ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                                                    {Math.round(((usages[config.id!] || 0) / config.dailyUsageLimit) * 100)}%
                                                </span>
                                            ) : null}
                                        </div>
                                        {config.dailyUsageLimit ? (
                                            <Progress
                                                value={Math.min(((usages[config.id!] || 0) / config.dailyUsageLimit) * 100, 100)}
                                                className={`h-2 ${((usages[config.id!] || 0) >= config.dailyUsageLimit) ? 'bg-destructive/20 [&>div]:bg-destructive' : ''}`}
                                            />
                                        ) : (
                                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                                <div className="h-full bg-primary/20 w-full animate-pulse"></div>
                                            </div>
                                        )}
                                        <p className="text-[10px] text-muted-foreground text-center mt-1 italic">
                                            Counts messages sent within the current 24h period
                                        </p>
                                    </div>

                                    <div className="flex gap-2">
                                        {!config.isActive && !config.isDisabled && (
                                            <Button variant="outline" size="sm" className="flex-1" onClick={() => handleSetActive(config.id!)}>
                                                <Check className="mr-2 h-4 w-4" /> Set Active
                                            </Button>
                                        )}
                                        {config.isDisabled && (
                                            <Button variant="outline" size="sm" className="flex-1 opacity-50 cursor-not-allowed" disabled>
                                                <PowerOff className="mr-2 h-4 w-4" /> Disabled
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
