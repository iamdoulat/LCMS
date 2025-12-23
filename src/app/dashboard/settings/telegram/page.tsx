
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit, Check, Eye, EyeOff, Send, MessageSquare } from 'lucide-react';
import Swal from 'sweetalert2';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import { TelegramConfiguration } from '@/types/telegram-settings';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, writeBatch, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { Loader2 } from 'lucide-react';

export default function TelegramSettingsPage() {
    const [configs, setConfigs] = useState<TelegramConfiguration[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [showToken, setShowToken] = useState(false);

    // Test State
    const [sendingTest, setSendingTest] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<TelegramConfiguration>>({
        name: '',
        botToken: '',
        chatId: '',
        isActive: false,
    });

    useEffect(() => {
        const q = query(collection(firestore, 'telegram_settings'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as TelegramConfiguration[];
            setConfigs(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleInputChange = (field: keyof TelegramConfiguration, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const resetForm = () => {
        setFormData({
            name: '',
            botToken: '',
            chatId: '',
            isActive: false,
        });
        setIsEditing(false);
        setCurrentId(null);
        setShowToken(false);
    };

    const handleEdit = (config: TelegramConfiguration) => {
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
                await deleteDoc(doc(firestore, 'telegram_settings', id));
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
                    const ref = doc(firestore, 'telegram_settings', config.id!);
                    batch.update(ref, { isActive: false });
                }
            });

            // Set selected to active
            const targetRef = doc(firestore, 'telegram_settings', id);
            batch.update(targetRef, { isActive: true });

            await batch.commit();
            Swal.fire('Updated', 'Active Telegram service updated successfully', 'success');
        } catch (error) {
            console.error("Error setting active config:", error);
            Swal.fire('Error', 'Failed to update active service', 'error');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (!formData.name || !formData.botToken || !formData.chatId) {
                Swal.fire('Error', 'All fields are required', 'error');
                return;
            }

            const dataToSave = {
                ...formData,
                updatedAt: serverTimestamp(),
            };

            if (isEditing && currentId) {
                await updateDoc(doc(firestore, 'telegram_settings', currentId), dataToSave);
                Swal.fire('Success', 'Configuration updated successfully', 'success');
            } else {
                await addDoc(collection(firestore, 'telegram_settings'), {
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

    const handleSendTest = async (config: TelegramConfiguration) => {
        setSendingTest(true);
        try {
            const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: config.chatId,
                    text: `<b>Telegram Bot Test</b>\n\nYour Nextsew Telegram integration is working correctly!\n\nTimestamp: ${new Date().toLocaleString()}`,
                    parse_mode: 'HTML'
                })
            });

            const result = await response.json();

            if (response.ok && result.ok) {
                Swal.fire('Success', 'Test message sent successfully! Please check your Telegram group.', 'success');
            } else {
                throw new Error(result.description || 'Failed to send message');
            }
        } catch (error: any) {
            console.error("Test Telegram Error:", error);
            Swal.fire('Test Failed', error.message || 'Could not send test message. Check your Token and Chat ID.', 'error');
        } finally {
            setSendingTest(false);
        }
    };

    const handleSendSystemTest = async (type: 'in_time' | 'check_in') => {
        setSendingTest(true);
        try {
            const response = await fetch('/api/notify/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: type,
                    employeeId: 'TEST_ID',
                    employeeName: 'Test Admin',
                    employeeCode: 'ADMIN_001',
                    time: new Date().toLocaleTimeString(),
                    date: new Date().toLocaleDateString(),
                    location: { latitude: 23.8103, longitude: 90.4125, address: 'Test Location, Dhaka' },
                    companyName: type === 'check_in' ? 'Test Company' : undefined,
                    remarks: 'This is a system test notification.'
                })
            });

            const result = await response.json();

            if (response.ok) {
                Swal.fire({
                    title: 'System Notification Triggered',
                    text: 'The notification request was sent to the background processor. Please check the Telegram group in a few seconds.',
                    icon: 'info'
                });
            } else {
                throw new Error(result.error || 'API request failed');
            }
        } catch (error: any) {
            console.error("System Test Error:", error);
            Swal.fire('System Test Failed', error.message || 'Could not trigger system notification.', 'error');
        } finally {
            setSendingTest(false);
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Telegram Bot Settings</h1>
                    <p className="text-muted-foreground">Manage your Telegram bot for attendance notifications.</p>
                </div>

                <div className="flex gap-2">
                    <div className="flex bg-muted p-1 rounded-md border text-xs items-center gap-1 font-medium mr-2">
                        <span className="px-2">System Pipeline Tests:</span>
                        <Button variant="secondary" size="sm" className="h-7 text-xs px-2" onClick={() => handleSendSystemTest('in_time')} disabled={sendingTest}>
                            Test In-Time
                        </Button>
                        <Button variant="secondary" size="sm" className="h-7 text-xs px-2" onClick={() => handleSendSystemTest('check_in')} disabled={sendingTest}>
                            Test Check-In
                        </Button>
                    </div>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Add New Bot</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>{isEditing ? 'Edit Telegram Bot' : 'Add New Telegram Bot'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 py-4">
                            <div className="grid w-full items-center gap-1.5">
                                <Label htmlFor="name">Bot Display Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. HR Notifications Bot"
                                    value={formData.name}
                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                />
                            </div>

                            <div className="grid w-full items-center gap-1.5">
                                <Label htmlFor="botToken">Bot API Token</Label>
                                <div className="relative">
                                    <Input
                                        id="botToken"
                                        type={showToken ? "text" : "password"}
                                        placeholder="123456789:ABCDefgh..."
                                        value={formData.botToken}
                                        onChange={(e) => handleInputChange('botToken', e.target.value)}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                        onClick={() => setShowToken(!showToken)}
                                    >
                                        {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Get token from <a href="https://t.me/BotFather" target="_blank" className="underline text-primary">@BotFather</a>
                                </p>
                            </div>

                            <div className="grid w-full items-center gap-1.5">
                                <Label htmlFor="chatId">Group Chat ID</Label>
                                <Input
                                    id="chatId"
                                    placeholder="e.g. -100123456789"
                                    value={formData.chatId}
                                    onChange={(e) => handleInputChange('chatId', e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Use <a href="https://t.me/GetMyChatID_Bot" target="_blank" className="underline text-primary">@GetMyChatID_Bot</a> to find your group's ID.
                                </p>
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                                <Button type="submit">Save Configuration</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : configs.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                        <Send className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium">No Telegram Bots Configured</p>
                        <p className="text-muted-foreground mb-6">Add a Telegram bot configuration to start sending notifications.</p>
                        <Button onClick={() => { setIsEditing(false); setIsDialogOpen(true); }}>
                            <Plus className="mr-2 h-4 w-4" /> Configure Bot
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
                                    <MessageSquare className="h-5 w-5 text-blue-500" />
                                    {config.name}
                                </CardTitle>
                                <CardDescription>Telegram Bot Configuration</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm text-muted-foreground mb-6">
                                    <div className="flex justify-between">
                                        <span>Chat ID:</span>
                                        <span className="font-medium text-foreground">{config.chatId}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Token:</span>
                                        <span className="font-medium text-foreground">••••••••</span>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    {!config.isActive && (
                                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleSetActive(config.id!)}>
                                            <Check className="mr-2 h-4 w-4" /> Set Active
                                        </Button>
                                    )}
                                    <Button variant="outline" size="icon" onClick={() => handleSendTest(config)} disabled={sendingTest}>
                                        <Send className="h-4 w-4" />
                                    </Button>
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
