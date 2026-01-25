"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { DollarSign, RotateCcw, Save, Loader2 } from 'lucide-react';
import { getSalaryCalculationSettings, updateSalaryCalculationSettings, resetSalaryCalculationSettings, DEFAULT_SALARY_SETTINGS } from '@/lib/settings/salary-calculation';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';

const salarySettingsSchema = z.object({
    medicalAllowance: z.number().min(0, 'Must be a positive number'),
    conveyanceAllowance: z.number().min(0, 'Must be a positive number'),
    foodAllowance: z.number().min(0, 'Must be a positive number'),
});

type SalarySettingsFormValues = z.infer<typeof salarySettingsSchema>;

export default function SalaryCalculationSettingsPage() {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);

    const form = useForm<SalarySettingsFormValues>({
        resolver: zodResolver(salarySettingsSchema),
        defaultValues: {
            medicalAllowance: DEFAULT_SALARY_SETTINGS.medicalAllowance,
            conveyanceAllowance: DEFAULT_SALARY_SETTINGS.conveyanceAllowance,
            foodAllowance: DEFAULT_SALARY_SETTINGS.foodAllowance,
        },
    });

    React.useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setIsLoading(true);
            const settings = await getSalaryCalculationSettings();
            form.reset({
                medicalAllowance: settings.medicalAllowance,
                conveyanceAllowance: settings.conveyanceAllowance,
                foodAllowance: settings.foodAllowance,
            });
        } catch (error) {
            console.error('Failed to load settings:', error);
            Swal.fire('Error', 'Failed to load settings', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const onSubmit = async (data: SalarySettingsFormValues) => {
        if (!user?.uid) {
            Swal.fire('Error', 'You must be logged in to save settings', 'error');
            return;
        }

        try {
            setIsSaving(true);
            await updateSalaryCalculationSettings(data, user.uid);
            Swal.fire({
                title: 'Success!',
                text: 'Salary calculation settings updated successfully',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false,
            });
        } catch (error) {
            console.error('Failed to save settings:', error);
            Swal.fire('Error', 'Failed to save settings', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = async () => {
        const result = await Swal.fire({
            title: 'Reset to Defaults?',
            text: 'This will reset all allowances to their default values.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, reset',
            cancelButtonText: 'Cancel',
        });

        if (result.isConfirmed && user?.uid) {
            try {
                setIsSaving(true);
                await resetSalaryCalculationSettings(user.uid);
                form.reset(DEFAULT_SALARY_SETTINGS);
                Swal.fire({
                    title: 'Reset Complete!',
                    text: 'Settings have been reset to defaults',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false,
                });
            } catch (error) {
                console.error('Failed to reset settings:', error);
                Swal.fire('Error', 'Failed to reset settings', 'error');
            } finally {
                setIsSaving(false);
            }
        }
    };

    const totalAllowances = form.watch('medicalAllowance') + form.watch('conveyanceAllowance') + form.watch('foodAllowance');

    if (isLoading) {
        return (
            <div className="container mx-auto py-8 px-5">
                <div className="flex items-center justify-center min-h-[400px]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 px-5">
            <Card className="max-w-3xl mx-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                        <DollarSign className="h-6 w-6 text-primary" />
                        Salary Calculation Settings
                    </CardTitle>
                    <CardDescription>
                        Configure fixed allowances used in automatic salary breakdown calculations. These values will be used when generating salary structures.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <FormField
                                    control={form.control}
                                    name="medicalAllowance"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Medical Allowance</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="750"
                                                    {...field}
                                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                                    className="font-mono"
                                                />
                                            </FormControl>
                                            <FormDescription>Fixed monthly medical allowance</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="conveyanceAllowance"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Conveyance Allowance</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="450"
                                                    {...field}
                                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                                    className="font-mono"
                                                />
                                            </FormControl>
                                            <FormDescription>Fixed monthly conveyance allowance</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="foodAllowance"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Food Allowance</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="1250"
                                                    {...field}
                                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                                    className="font-mono"
                                                />
                                            </FormControl>
                                            <FormDescription>Fixed monthly food allowance</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <Card className="bg-muted/50">
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium">Total Fixed Allowances</p>
                                            <p className="text-xs text-muted-foreground">Sum of all allowances</p>
                                        </div>
                                        <p className="text-2xl font-bold text-primary font-mono">{totalAllowances.toLocaleString()}</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="flex items-center gap-3">
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-2 h-4 w-4" />
                                            Save Settings
                                        </>
                                    )}
                                </Button>
                                <Button type="button" variant="outline" onClick={handleReset} disabled={isSaving}>
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Reset to Defaults
                                </Button>
                            </div>

                            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-4">
                                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Default Values</h4>
                                <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                                    <p>• Medical Allowance: {DEFAULT_SALARY_SETTINGS.medicalAllowance}</p>
                                    <p>• Conveyance Allowance: {DEFAULT_SALARY_SETTINGS.conveyanceAllowance}</p>
                                    <p>• Food Allowance: {DEFAULT_SALARY_SETTINGS.foodAllowance}</p>
                                    <p className="mt-2 text-blue-700 dark:text-blue-300">These values are used when no custom settings are configured.</p>
                                </div>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
