"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Upload, Loader2, Database } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';

export default function BackupRestorePage() {
    const { userRole } = useAuth();
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);

    // Restrict access to Super Admin and Admin
    const canAccess = userRole && (userRole.includes('Super Admin') || userRole.includes('Admin'));

    if (!canAccess) {
        return (
            <div className="max-w-none mx-[10px] md:mx-[25px] mt-[10px] md:mt-0 mb-[50px] md:mb-0 py-8 px-0">
                <div className="flex flex-col items-center justify-center min-h-[400px]">
                    <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
                    <p className="text-muted-foreground">You do not have permission to access this page.</p>
                </div>
            </div>
        );
    }

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const response = await fetch('/api/firestore/export');
            if (!response.ok) throw new Error('Failed to fetch backup data');

            const data = await response.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `firestore-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            Swal.fire({
                icon: 'success',
                title: 'Export Successful',
                text: 'Firestore data has been exported and downloaded.',
            });
        } catch (error: any) {
            console.error('Export error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Export Failed',
                text: error.message || 'An error occurred during export.',
            });
        } finally {
            setIsExporting(false);
        }
    };

    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!importFile) return;

        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "This will overwrite existing data in Firestore with the data from the backup file! This action cannot be undone.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, Restore and Overwrite!',
        });

        if (!result.isConfirmed) return;

        setIsImporting(true);
        try {
            const fileContent = await importFile.text();
            const backupData = JSON.parse(fileContent);

            const response = await fetch('/api/firestore/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(backupData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to import data');
            }

            Swal.fire({
                icon: 'success',
                title: 'Import Successful',
                text: 'Firestore data has been restored from the backup file.',
            });
            setImportFile(null);
        } catch (error: any) {
            console.error('Import error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Import Failed',
                text: error.message || 'An error occurred during import. Make sure the file is a valid JSON backup.',
            });
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="max-w-none mx-[10px] md:mx-[25px] mt-[10px] md:mt-0 mb-[50px] md:mb-0 py-8 px-0">
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Backup & Restore</h1>
                    <p className="text-muted-foreground">
                        Manage your Firestore database backups. Export your data to a JSON file or restore from a previous backup.
                    </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Export Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Download className="h-5 w-5" />
                                Export Database
                            </CardTitle>
                            <CardDescription>
                                Download a complete copy of your Firestore database in JSON format.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-4">
                                <p className="text-sm text-muted-foreground">
                                    The export will include all collections and documents that the system can access.
                                </p>
                                <Button
                                    onClick={handleExport}
                                    disabled={isExporting}
                                    className="w-full sm:w-auto"
                                >
                                    {isExporting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Exporting...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="mr-2 h-4 w-4" />
                                            Download JSON Backup
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Import Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Upload className="h-5 w-5" />
                                Restore Database
                            </CardTitle>
                            <CardDescription>
                                Restore Firestore data from a previously exported JSON backup.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleImport} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="backup-file">Select Backup File (.json)</Label>
                                    <Input
                                        id="backup-file"
                                        type="file"
                                        accept=".json"
                                        onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                                        disabled={isImporting}
                                        required
                                    />
                                    <p className="text-xs text-destructive font-medium">
                                        Warning: This will overwrite data in your database!
                                    </p>
                                </div>
                                <Button
                                    type="submit"
                                    variant="destructive"
                                    disabled={isImporting || !importFile}
                                    className="w-full sm:w-auto"
                                >
                                    {isImporting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Restoring...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="mr-2 h-4 w-4" />
                                            Restore From File
                                        </>
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                <Card className="bg-muted/50 border-dashed">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                            <Database className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-medium">Backup Information</p>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Backups are generated in JSON format. Each key in the root object corresponds to a Firestore collection ID,
                                    and each value is an object mapping document IDs to their respective data.
                                    Currently, this process handles top-level collections.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
