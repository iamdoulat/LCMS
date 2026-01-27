
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit, Check, Eye, EyeOff, Database, Server, Cloud, ExternalLink, AlertTriangle } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
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
import { StorageConfiguration, StorageProviderType } from '@/types/storage';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, writeBatch, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { Loader2 } from 'lucide-react';

export default function StorageSettingsPage() {
    const { user } = useAuth();
    const [configs, setConfigs] = useState<StorageConfiguration[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [showSecret, setShowSecret] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<StorageConfiguration>>({
        name: '',
        provider: 'firebase',
        isActive: false,
        bucketName: '',
        region: 'us-east-1',
        accessKeyId: '',
        secretAccessKey: '',
        publicUrl: '',
        accountId: '',
    });

    useEffect(() => {
        const q = query(collection(firestore, 'storage_settings'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as StorageConfiguration[];

            setConfigs(data);
            setLoading(false);

            // If no configs exist, add default Firebase config
            if (data.length === 0 && !loading) {
                setupDefaultFirebase();
            }
        });

        return () => unsubscribe();
    }, []);

    const setupDefaultFirebase = async () => {
        try {
            await addDoc(collection(firestore, 'storage_settings'), {
                name: 'Default Firebase Storage',
                provider: 'firebase',
                isActive: true,
                createdAt: serverTimestamp(),
            });
        } catch (error) {
            console.error("Error setting up default firebase:", error);
        }
    };

    const handleInputChange = (field: keyof StorageConfiguration, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const resetForm = () => {
        setFormData({
            name: '',
            provider: 'firebase',
            isActive: false,
            bucketName: '',
            region: 'us-east-1',
            accessKeyId: '',
            secretAccessKey: '',
            publicUrl: '',
            accountId: '',
        });
        setIsEditing(false);
        setCurrentId(null);
        setShowSecret(false);
    };

    const handleEdit = (config: StorageConfiguration) => {
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
                await deleteDoc(doc(firestore, 'storage_settings', id));
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
                    const ref = doc(firestore, 'storage_settings', config.id!);
                    batch.update(ref, { isActive: false });
                }
            });

            // Set selected to active
            const targetRef = doc(firestore, 'storage_settings', id);
            batch.update(targetRef, { isActive: true });

            await batch.commit();
            Swal.fire('Updated', 'Active storage service updated successfully', 'success');
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

            if (formData.provider === 's3' || formData.provider === 'r2') {
                if (!formData.bucketName || !formData.accessKeyId || !formData.secretAccessKey) {
                    Swal.fire('Error', 'All required fields (Bucket, Key ID, Secret) must be filled', 'error');
                    return;
                }
                if (formData.provider === 'r2' && !formData.accountId) {
                    Swal.fire('Error', 'Account ID is required for Cloudflare R2', 'error');
                    return;
                }
            }

            // Clean up data to avoid sending undefined values to Firestore
            // and remove fields that don't belong to the selected provider
            const cleanedData: any = {
                name: formData.name,
                provider: formData.provider,
                isActive: formData.isActive || false,
                updatedAt: serverTimestamp(),
            };

            if (formData.provider === 's3' || formData.provider === 'r2') {
                cleanedData.bucketName = formData.bucketName || '';
                cleanedData.region = formData.region || '';
                cleanedData.accessKeyId = formData.accessKeyId || '';
                cleanedData.secretAccessKey = formData.secretAccessKey || '';
                cleanedData.publicUrl = formData.publicUrl || '';

                if (formData.provider === 'r2') {
                    cleanedData.accountId = formData.accountId || '';
                }
            }

            if (isEditing && currentId) {
                await updateDoc(doc(firestore, 'storage_settings', currentId), cleanedData);
                Swal.fire('Success', 'Configuration updated successfully', 'success');
            } else {
                await addDoc(collection(firestore, 'storage_settings'), {
                    ...cleanedData,
                    createdAt: serverTimestamp(),
                });
                Swal.fire('Success', 'Configuration added successfully', 'success');
            }

            setIsDialogOpen(false);
            resetForm();
        } catch (error: any) {
            console.error("Error saving config:", error);
            Swal.fire('Error', `Failed to save configuration: ${error.message || 'Unknown error'}`, 'error');
        }
    };

    const getProviderIcon = (provider: StorageProviderType) => {
        switch (provider) {
            case 'firebase': return <Database className="h-5 w-5 text-orange-500" />;
            case 's3': return <Server className="h-5 w-5 text-blue-500" />;
            case 'r2': return <Cloud className="h-5 w-5 text-orange-400" />;
            default: return <Server className="h-5 w-5" />;
        }
    };

    return (
        <div className="max-w-none mx-[10px] md:mx-[25px] mt-[10px] md:mt-0 mb-[50px] md:mb-0 py-8 px-0">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Storage Settings</h1>
                    <p className="text-muted-foreground">Manage your image and file storage services. Select one as active.</p>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Add New Service</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>{isEditing ? 'Edit Storage Configuration' : 'Add New Storage Configuration'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 py-4">
                            <div className="grid w-full items-center gap-1.5">
                                <Label htmlFor="name">Configuration Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. AWS Production, R2 Backup"
                                    value={formData.name}
                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                />
                            </div>

                            <div className="grid w-full items-center gap-1.5">
                                <Label htmlFor="provider">Storage Provider</Label>
                                <Select
                                    value={formData.provider}
                                    onValueChange={(val: StorageProviderType) => handleInputChange('provider', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Provider" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="firebase">Firebase Storage (Built-in)</SelectItem>
                                        <SelectItem value="s3">Amazon S3</SelectItem>
                                        <SelectItem value="r2">Cloudflare R2</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {formData.provider !== 'firebase' && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="bucketName">Bucket Name</Label>
                                            <Input
                                                id="bucketName"
                                                placeholder="my-bucket"
                                                value={formData.bucketName}
                                                onChange={(e) => handleInputChange('bucketName', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="region">Region</Label>
                                            <Input
                                                id="region"
                                                placeholder="us-east-1"
                                                value={formData.region}
                                                onChange={(e) => handleInputChange('region', e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {formData.provider === 'r2' && (
                                        <div className="space-y-1.5">
                                            <Label htmlFor="accountId">Account ID (Cloudflare)</Label>
                                            <Input
                                                id="accountId"
                                                placeholder="account_id_string"
                                                value={formData.accountId}
                                                onChange={(e) => handleInputChange('accountId', e.target.value)}
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-1.5">
                                        <Label htmlFor="accessKeyId">Access Key ID</Label>
                                        <Input
                                            id="accessKeyId"
                                            placeholder="AKIA..."
                                            value={formData.accessKeyId}
                                            onChange={(e) => handleInputChange('accessKeyId', e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="secretAccessKey">Secret Access Key</Label>
                                        <div className="relative">
                                            <Input
                                                id="secretAccessKey"
                                                type={showSecret ? "text" : "password"}
                                                placeholder="••••••••"
                                                value={formData.secretAccessKey}
                                                onChange={(e) => handleInputChange('secretAccessKey', e.target.value)}
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

                                    <div className="space-y-1.5">
                                        <Label htmlFor="publicUrl">Public URL / CDN (Optional)</Label>
                                        <Input
                                            id="publicUrl"
                                            placeholder="https://cdn.example.com"
                                            value={formData.publicUrl}
                                            onChange={(e) => handleInputChange('publicUrl', e.target.value)}
                                        />
                                        <p className="text-xs text-muted-foreground">If provided, this URL will be used to serve files.</p>
                                    </div>
                                </>
                            )}

                            {formData.provider === 'firebase' && (
                                <p className="text-sm text-muted-foreground bg-secondary p-3 rounded-md">
                                    Firebase storage uses the default bucket configured in your environment variables.
                                </p>
                            )}

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
                        <Database className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium">No Storage Services Configured</p>
                        <p className="text-muted-foreground mb-6">Initialize your storage configurations to start using modern CDN services.</p>
                        <Button onClick={() => setupDefaultFirebase()}>
                            Initialize Default Storage
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {configs.map((config) => (
                        <Card key={config.id} className={`relative overflow-hidden transition-all ${config.isActive ? 'border-primary ring-1 ring-primary shadow-md' : 'border-border/60 hover:border-border'}`}>
                            {config.isActive && (
                                <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-medium rounded-bl-lg z-10">
                                    Active
                                </div>
                            )}
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2">
                                    {getProviderIcon(config.provider)}
                                    {config.name}
                                </CardTitle>
                                <CardDescription>
                                    {config.provider === 'firebase' && 'Firebase Cloud Storage'}
                                    {config.provider === 's3' && 'Amazon S3 Bucket'}
                                    {config.provider === 'r2' && 'Cloudflare R2 Storage'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm text-muted-foreground mb-6">
                                    <div className="flex justify-between">
                                        <span>Status:</span>
                                        <Badge variant={config.isActive ? "default" : "secondary"}>
                                            {config.isActive ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </div>
                                    {config.provider !== 'firebase' && (
                                        <>
                                            <div className="flex justify-between">
                                                <span>Bucket:</span>
                                                <span className="font-medium text-foreground">{config.bucketName}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Region:</span>
                                                <span className="font-medium text-foreground">{config.region}</span>
                                            </div>
                                        </>
                                    )}
                                    {config.publicUrl && (
                                        <div className="flex flex-col gap-1 mt-2">
                                            <span className="text-xs uppercase font-bold tracking-wider">Public Domain:</span>
                                            <a href={config.publicUrl} target="_blank" className="text-primary hover:underline flex items-center gap-1 truncate text-xs">
                                                {config.publicUrl} <ExternalLink className="h-3 w-3" />
                                            </a>
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
                                    {config.provider !== 'firebase' && (
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(config.id!, config.name)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
