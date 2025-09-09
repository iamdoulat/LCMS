
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Calculator, Users, Building, CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, orderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { BranchDocument, DepartmentDocument, UnitDocument, EmployeeDocument } from '@/types';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import Swal from 'sweetalert2';

const toComboboxOptions = (data: any[] | undefined, labelKey: string, valueKey: string = 'id'): ComboboxOption[] => {
    if (!data) return [];
    return data.map(doc => ({ value: doc[valueKey], label: doc[labelKey] }));
};

const salaryGenerationSchema = z.object({
  generationType: z.enum(['Branch Wise', 'Department Wise', 'Department Unit Wise', 'Employee Wise']),
  branch: z.string().optional(),
  department: z.string().optional(),
  unit: z.string().optional(),
  employee: z.string().optional(),
  year: z.string().min(4, "Year is required."),
  month: z.string().min(1, "Month is required."),
  recalculate: z.boolean().default(false),
  includeBonus: z.boolean().default(false),
});

type SalaryGenerationFormValues = z.infer<typeof salaryGenerationSchema>;

const yearOptions = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - 5 + i).toString());
const monthOptions = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function SalaryGenerationPage() {
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [currentTime, setCurrentTime] = React.useState(new Date());

    React.useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const { data: branches, isLoading: isLoadingBranches } = useFirestoreQuery<BranchDocument[]>(query(collection(firestore, "branches"), orderBy("name")), undefined, ['branches']);
    const { data: departments, isLoading: isLoadingDepts } = useFirestoreQuery<DepartmentDocument[]>(query(collection(firestore, "departments"), orderBy("name")), undefined, ['departments']);
    const { data: units, isLoading: isLoadingUnits } = useFirestoreQuery<UnitDocument[]>(query(collection(firestore, "units"), orderBy("name")), undefined, ['units']);
    const { data: employees, isLoading: isLoadingEmployees } = useFirestoreQuery<EmployeeDocument[]>(query(collection(firestore, "employees"), orderBy("fullName")), undefined, ['employees']);

    const branchOptions = React.useMemo(() => toComboboxOptions(branches, 'name'), [branches]);
    const departmentOptions = React.useMemo(() => toComboboxOptions(departments, 'name'), [departments]);
    const unitOptions = React.useMemo(() => toComboboxOptions(units, 'name'), [units]);
    const employeeOptions = React.useMemo(() => toComboboxOptions(employees, 'fullName'), [employees]);

    const form = useForm<SalaryGenerationFormValues>({
        resolver: zodResolver(salaryGenerationSchema),
        defaultValues: {
            generationType: 'Branch Wise',
            year: new Date().getFullYear().toString(),
            month: monthOptions[new Date().getMonth()],
            recalculate: false,
            includeBonus: false,
        },
    });
    
    const generationType = form.watch('generationType');

    const onGenerateSalary = async (data: SalaryGenerationFormValues) => {
        setIsGenerating(true);
        Swal.fire({
          title: "Salary Generation",
          text: "This is a placeholder for the salary generation logic. In a real application, this would trigger a backend process.",
          icon: "info",
        });
        // Placeholder for generation logic
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsGenerating(false);
    };

    return (
        <div className="container mx-auto py-8">
            <Card className="max-w-6xl mx-auto shadow-xl">
                <CardHeader>
                    <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                       <Calculator className="h-7 w-7 text-primary" />
                        Salary Generation
                    </CardTitle>
                    <CardDescription>
                        Generate salaries for employees based on the selected criteria.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onGenerateSalary)} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-6">
                                <FormField
                                    control={form.control}
                                    name="generationType"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel>Generate Salary By</FormLabel>
                                            <FormControl>
                                                <RadioGroup
                                                    onValueChange={field.onChange}
                                                    defaultValue={field.value}
                                                    className="flex flex-wrap items-center gap-x-6 gap-y-2"
                                                >
                                                    <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Branch Wise" /></FormControl><FormLabel className="font-normal">Branch Wise</FormLabel></FormItem>
                                                    <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Department Wise" /></FormControl><FormLabel className="font-normal">Department Wise</FormLabel></FormItem>
                                                    <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Department Unit Wise" /></FormControl><FormLabel className="font-normal">Department Unit Wise</FormLabel></FormItem>
                                                    <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Employee Wise" /></FormControl><FormLabel className="font-normal">Employee Wise</FormLabel></FormItem>
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                     {generationType === 'Branch Wise' && <FormField control={form.control} name="branch" render={({ field }) => (<FormItem><FormLabel>Branch</FormLabel><Combobox options={branchOptions} {...field} onValueChange={field.onChange} placeholder="Select Branch..." selectPlaceholder="Select Branch" disabled={isLoadingBranches} /></FormItem>)} />}
                                     {generationType === 'Department Wise' && <FormField control={form.control} name="department" render={({ field }) => (<FormItem><FormLabel>Department</FormLabel><Combobox options={departmentOptions} {...field} onValueChange={field.onChange} placeholder="Select Department..." selectPlaceholder="Select Department" disabled={isLoadingDepts} /></FormItem>)} />}
                                     {generationType === 'Department Unit Wise' && <>
                                        <FormField control={form.control} name="department" render={({ field }) => (<FormItem><FormLabel>Department</FormLabel><Combobox options={departmentOptions} {...field} onValueChange={field.onChange} placeholder="Select Department..." selectPlaceholder="Select Department" disabled={isLoadingDepts} /></FormItem>)} />
                                        <FormField control={form.control} name="unit" render={({ field }) => (<FormItem><FormLabel>Unit</FormLabel><Combobox options={unitOptions} {...field} onValueChange={field.onChange} placeholder="Select Unit..." selectPlaceholder="Select Unit" disabled={isLoadingUnits} /></FormItem>)} />
                                     </>}
                                     {generationType === 'Employee Wise' && <FormField control={form.control} name="employee" render={({ field }) => (<FormItem className="md:col-span-3"><FormLabel>Employee</FormLabel><Combobox options={employeeOptions} {...field} onValueChange={field.onChange} placeholder="Select Employee..." selectPlaceholder="Select Employee" disabled={isLoadingEmployees} /></FormItem>)} />}
                                    
                                     <FormField control={form.control} name="year" render={({ field }) => (<FormItem><FormLabel>Year</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger></FormControl><SelectContent>{yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                     <FormField control={form.control} name="month" render={({ field }) => (<FormItem><FormLabel>Month</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger></FormControl><SelectContent>{monthOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                </div>
                                
                                <div className="space-y-2 text-sm text-muted-foreground">
                                    <p>Current Date: {currentTime.toLocaleString()}</p>
                                    <p>Generation Date: {new Date().toLocaleString()}</p>
                                </div>

                                <div className="flex items-center space-x-4 pt-4">
                                     <FormField control={form.control} name="recalculate" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Recalculate Old</FormLabel></FormItem>)} />
                                     <FormField control={form.control} name="includeBonus" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Calculate Bonus With Salary</FormLabel></FormItem>)} />
                                </div>

                                <Button type="submit" disabled={isGenerating}>
                                    {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : 'Generate Salary'}
                                </Button>
                            </div>
                            <div className="lg:col-span-1">
                                <Card className="bg-muted/30">
                                    <CardHeader>
                                        <CardTitle>Generation Steps</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-green-500" /><span>Calculate Bonus</span></div>
                                        <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-green-500" /><span>Salary or Leave Deduction</span></div>
                                        <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-green-500" /><span>Process Tax</span></div>
                                        <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-green-500" /><span>Generate Salary</span></div>
                                    </CardContent>
                                </Card>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}

