"use client";

import React, { useState, useEffect } from 'react';
import {
    Save,
    Building,
    Palette,
    List,
    Plus,
    Trash2,
    Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

import { ProjectSettings, ProjectStatus, ProjectPriority } from '@/types/projectManagement';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';



export default function ProjectSettingsPage() {
    const [settings, setSettings] = useState<ProjectSettings>({
        id: 'global',
        statuses: [
            { name: 'Pending', color: '#94a3b8', isActive: true },
            { name: 'In Progress', color: '#3b82f6', isActive: true },
            { name: 'Completed', color: '#10b981', isActive: true },
            { name: 'On Hold', color: '#f59e0b', isActive: true },
        ],
        priorities: [
            { name: 'Low', color: '#94a3b8' },
            { name: 'Medium', color: '#3b82f6' },
            { name: 'High', color: '#f97316' },
            { name: 'Urgency', color: '#ef4444' },
        ],
        companyDetails: {
            companyName: '',
            address: '',
            email: '',
            mobileNo: '',
            invoiceName: 'TAX INVOICE',
            quotationName: 'QUOTATION'
        },
        updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any
    });
    const [loading, setLoading] = useState(true);

    // Temp states for new items
    const [newStatus, setNewStatus] = useState({ name: '', color: '#000000' });

    const [newPriority, setNewPriority] = useState({ name: '', color: '#000000' });
    const [newTag, setNewTag] = useState('');

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(firestore, 'project_settings', 'global');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSettings(docSnap.data() as ProjectSettings);
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
                Swal.fire({
                    title: "Error!",
                    text: "Failed to load settings.",
                    icon: "error",
                    confirmButtonColor: "#d33"
                });
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const handleSave = async () => {
        try {
            await setDoc(doc(firestore, 'project_settings', 'global'), {
                ...settings,
                updatedAt: serverTimestamp()
            }, { merge: true });

            Swal.fire({
                title: "Settings Saved!",
                text: "Your project settings have been updated successfully.",
                icon: "success",
                confirmButtonColor: "#3085d6",
            });
        } catch (error) {
            console.error("Error saving settings:", error);
            Swal.fire({
                title: "Error!",
                text: "Failed to save settings. You might not have permission.",
                icon: "error",
                confirmButtonColor: "#d33"
            });
        }
    };

    const handleCompanyChange = (field: string, value: string) => {
        setSettings(prev => ({
            ...prev,
            companyDetails: {
                ...prev.companyDetails,
                [field]: value
            }
        }));
    };

    // --- Status Handlers ---
    const handleAddStatus = () => {
        if (!newStatus.name.trim()) return;
        const exists = settings.statuses.some(s => s.name.toLowerCase() === newStatus.name.toLowerCase());
        if (exists) {
            Swal.fire({
                title: "Error",
                text: "Status already exists.",
                icon: "error",
                toast: true,
                position: "top-end",
                showConfirmButton: false,
                timer: 3000
            });
            return;
        }

        setSettings(prev => ({
            ...prev,
            statuses: [...prev.statuses, { name: newStatus.name as ProjectStatus, color: newStatus.color, isActive: true }]
        }));
        setNewStatus({ name: '', color: '#000000' });
        Swal.fire({
            title: "Added",
            text: "Status added to list. Don't forget to Save.",
            icon: "success",
            toast: true,
            position: "top-end",
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });
    };

    const handleDeleteStatus = (index: number) => {
        setSettings(prev => {
            const newStatuses = [...prev.statuses];
            newStatuses.splice(index, 1);
            return { ...prev, statuses: newStatuses };
        });
    };

    const toggleStatusActive = (index: number) => {
        setSettings(prev => {
            const newStatuses = [...prev.statuses];
            newStatuses[index].isActive = !newStatuses[index].isActive;
            return { ...prev, statuses: newStatuses };
        });
    }


    // --- Priority Handlers ---
    const handleAddPriority = () => {
        if (!newPriority.name.trim()) return;
        const exists = settings.priorities.some(p => p.name.toLowerCase() === newPriority.name.toLowerCase());
        if (exists) {
            Swal.fire({
                title: "Error",
                text: "Priority already exists.",
                icon: "error",
                toast: true,
                position: "top-end",
                showConfirmButton: false,
                timer: 3000
            });
            return;
        }

        setSettings(prev => ({
            ...prev,
            priorities: [...prev.priorities, { name: newPriority.name as ProjectPriority, color: newPriority.color }]
        }));
        setNewPriority({ name: '', color: '#000000' });

        Swal.fire({
            title: "Added",
            text: "Priority added to list. Don't forget to Save.",
            icon: "success",
            toast: true,
            position: "top-end",
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });
    };

    const handleDeletePriority = (index: number) => {
        setSettings(prev => {
            const newPriorities = [...prev.priorities];
            newPriorities.splice(index, 1);
            return { ...prev, priorities: newPriorities };
        });
    };

    // --- Tags Handlers ---
    const handleAddTag = () => {
        if (!newTag.trim()) return;
        const currentTags = settings.tags || [];
        if (currentTags.some(t => t.toLowerCase() === newTag.toLowerCase())) {
            Swal.fire({
                title: "Error",
                text: "Tag already exists.",
                icon: "error",
                toast: true,
                position: "top-end",
                showConfirmButton: false,
                timer: 3000
            });
            return;
        }

        setSettings(prev => ({
            ...prev,
            tags: [...(prev.tags || []), newTag.trim()]
        }));
        setNewTag('');

    };

    const handleDeleteTag = (index: number) => {
        setSettings(prev => {
            const newTags = [...(prev.tags || [])];
            newTags.splice(index, 1);
            return { ...prev, tags: newTags };
        });
    };

    if (loading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

    return (
        <div className="p-6 space-y-6 min-h-screen bg-slate-50/50">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Project Settings</h1>
                    <p className="text-muted-foreground">Manage global configurations for project module</p>
                </div>
                <Button onClick={handleSave} className="bg-primary text-white shadow-sm hover:bg-primary/90">
                    <Save className="h-4 w-4 mr-2" /> Save Changes
                </Button>
            </div>

            <Tabs defaultValue="company" className="w-full space-y-6">
                <TabsList className="bg-white p-1 shadow-sm border">
                    <TabsTrigger value="company" className="data-[state=active]:bg-slate-100">
                        <Building className="h-4 w-4 mr-2" /> Company Profile
                    </TabsTrigger>
                    <TabsTrigger value="statuses" className="data-[state=active]:bg-slate-100">
                        <List className="h-4 w-4 mr-2" /> Statuses & Priorities
                    </TabsTrigger>
                    <TabsTrigger value="tags" className="data-[state=active]:bg-slate-100">
                        <Tag className="h-4 w-4 mr-2" /> Tags
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="company">
                    <Card className="border-none shadow-md">
                        <CardHeader>
                            <CardTitle>Company Details</CardTitle>
                            <CardDescription>
                                These details will appear on generated Invoices and Quotations.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="companyName">Company Name</Label>
                                    <Input
                                        id="companyName"
                                        value={settings.companyDetails.companyName}
                                        onChange={(e) => handleCompanyChange('companyName', e.target.value)}
                                        placeholder="Acme Corp"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="address">Address</Label>
                                    <Input
                                        id="address"
                                        value={settings.companyDetails.address}
                                        onChange={(e) => handleCompanyChange('address', e.target.value)}
                                        placeholder="123 Business St, City, Country"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={settings.companyDetails.email}
                                        onChange={(e) => handleCompanyChange('email', e.target.value)}
                                        placeholder="contact@acme.com"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="mobile">Mobile / Phone</Label>
                                    <Input
                                        id="mobile"
                                        value={settings.companyDetails.mobileNo}
                                        onChange={(e) => handleCompanyChange('mobileNo', e.target.value)}
                                        placeholder="+1 234 567 890"
                                    />
                                </div>
                            </div>

                            <div className="pt-6 border-t grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="invoiceName">Invoice Title</Label>
                                    <Input
                                        id="invoiceName"
                                        value={settings.companyDetails.invoiceName}
                                        onChange={(e) => handleCompanyChange('invoiceName', e.target.value)}
                                        placeholder="TAX INVOICE"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="quoteName">Quotation Title</Label>
                                    <Input
                                        id="quoteName"
                                        value={settings.companyDetails.quotationName}
                                        onChange={(e) => handleCompanyChange('quotationName', e.target.value)}
                                        placeholder="QUOTATION"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="tags">
                    <Card className="border-none shadow-md">
                        <CardHeader>
                            <CardTitle>Project Tags</CardTitle>
                            <CardDescription>
                                Manage tags that can be assigned to projects for better categorization.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex gap-4 items-end">
                                <div className="space-y-2 flex-1 max-w-sm">
                                    <Label>New Tag Name</Label>
                                    <Input
                                        value={newTag}
                                        onChange={(e) => setNewTag(e.target.value)}
                                        placeholder="e.g. Phase 1, Urgent, Marketing"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                                    />
                                </div>
                                <Button onClick={handleAddTag} disabled={!newTag.trim()} variant="secondary">
                                    <Plus className="h-4 w-4 mr-2" /> Add Tag
                                </Button>
                            </div>

                            <div className="border rounded-lg p-4 bg-slate-50 min-h-[100px]">
                                {settings.tags && settings.tags.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {settings.tags.map((tag, index) => (
                                            <Badge key={index} variant="secondary" className="pl-3 pr-2 py-1 bg-white border shadow-sm text-slate-700 flex items-center gap-1 group">
                                                {tag}
                                                <button
                                                    onClick={() => handleDeleteTag(index)}
                                                    className="opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all ml-1 p-0.5 rounded-full hover:bg-slate-100"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">No tags added yet.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="statuses">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Statuses Column */}
                        <Card className="border-none shadow-md h-full">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Palette className="h-5 w-5 text-blue-500" /> Project Statuses
                                </CardTitle>
                                <CardDescription>Define statuses for project workflow.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-2 items-end p-4 bg-slate-50/50 rounded-lg border border-dashed">
                                    <div className="flex-1 space-y-2">
                                        <Label>New Status Name</Label>
                                        <Input
                                            placeholder="e.g. Reviewing"
                                            value={newStatus.name}
                                            onChange={(e) => setNewStatus({ ...newStatus, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Color</Label>
                                        <div className="flex items-center h-10 w-full">
                                            <Input
                                                type="color"
                                                className="w-12 h-10 p-1 cursor-pointer"
                                                value={newStatus.color}
                                                onChange={(e) => setNewStatus({ ...newStatus, color: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <Button size="icon" onClick={handleAddStatus} className="mb-0.5">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="space-y-2 mt-4">
                                    {settings.statuses.map((status, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-4 h-4 rounded-full border shadow-sm"
                                                    style={{ backgroundColor: status.color }}
                                                />
                                                <span className="font-medium text-sm">{status.name}</span>
                                                {!status.isActive && <Badge variant="outline" className="text-[10px] h-5">Inactive</Badge>}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={status.isActive}
                                                    onCheckedChange={() => toggleStatusActive(index)}
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    onClick={() => handleDeleteStatus(index)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Priorities Column */}
                        <Card className="border-none shadow-md h-full">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <List className="h-5 w-5 text-orange-500" /> Priorities
                                </CardTitle>
                                <CardDescription>Define priority levels for projects/tasks.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-2 items-end p-4 bg-slate-50/50 rounded-lg border border-dashed">
                                    <div className="flex-1 space-y-2">
                                        <Label>New Priority Name</Label>
                                        <Input
                                            placeholder="e.g. Critical"
                                            value={newPriority.name}
                                            onChange={(e) => setNewPriority({ ...newPriority, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Color</Label>
                                        <div className="flex items-center h-10 w-full">
                                            <Input
                                                type="color"
                                                className="w-12 h-10 p-1 cursor-pointer"
                                                value={newPriority.color}
                                                onChange={(e) => setNewPriority({ ...newPriority, color: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <Button size="icon" onClick={handleAddPriority} className="mb-0.5">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="space-y-2 mt-4">
                                    {settings.priorities.map((priority, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-4 h-4 rounded-full border shadow-sm"
                                                    style={{ backgroundColor: priority.color }}
                                                />
                                                <span className="font-medium text-sm">{priority.name}</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => handleDeletePriority(index)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
