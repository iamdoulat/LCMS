
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Calculator, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, orderBy, where, getDocs, writeBatch, doc, serverTimestamp, getDoc, documentId } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { BranchDocument, DepartmentDocument, UnitDocument, EmployeeDocument, Payslip, AttendanceDocument, LeaveApplicationDocument, HolidayDocument, SalaryGenerationPolicy } from '@/types';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { format, getDaysInMonth, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isWithinInterval, parseISO } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const toComboboxOptions = (data: any[] | undefined, labelKey: string, valueKey: string = 'id'): ComboboxOption[] => {
    if (!data) return [];
    return data.map(doc => ({ value: doc[valueKey], label: doc[labelKey] || 'Unnamed' }));
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
    const { user } = useAuth();
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [currentTime, setCurrentTime] = React.useState<Date | null>(null);
    const [generationDate, setGenerationDate] = React.useState<Date | null>(null);

    React.useEffect(() => {
        const now = new Date();
        setCurrentTime(now);
        setGenerationDate(now);
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const { data: branches, isLoading: isLoadingBranches } = useFirestoreQuery<BranchDocument[]>(query(collection(firestore, "branches"), orderBy("name")), undefined, ['branches']);
    const { data: departments, isLoading: isLoadingDepts } = useFirestoreQuery<DepartmentDocument[]>(query(collection(firestore, "departments"), orderBy("name")), undefined, ['departments']);
    const { data: units, isLoading: isLoadingUnits } = useFirestoreQuery<UnitDocument[]>(query(collection(firestore, "units"), orderBy("name")), undefined, ['units']);
    const { data: employees, isLoading: isLoadingEmployees } = useFirestoreQuery<EmployeeDocument[]>(query(collection(firestore, "employees"), where("status", "==", "Active")), undefined, ['employees_for_salary']);
    
    const branchOptions = React.useMemo(() => toComboboxOptions(branches, 'name'), [branches]);
    const departmentOptions = React.useMemo(() => toComboboxOptions(departments, 'name'), [departments]);
    const unitOptions = React.useMemo(() => toComboboxOptions(units, 'name'), [units]);
    const employeeOptions = React.useMemo(() => toComboboxOptions(employees, 'fullName', 'id'), [employees]);
    const isLoadingOptions = isLoadingBranches || isLoadingDepts || isLoadingUnits || isLoadingEmployees;


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
        setGenerationDate(new Date());

        const payrollId = `PAYROLL-${data.year}-${data.month.toUpperCase()}`;
        const payPeriod = `${data.month}, ${data.year}`;

        if (!data.recalculate) {
            const payrollDocRef = doc(firestore, 'payrolls', payrollId);
            const payrollDoc = await getDoc(payrollDocRef);
            if (payrollDoc.exists()) {
                Swal.fire({ title: "Payroll Already Exists", text: `Payroll for ${payPeriod} has already been generated. To re-generate, please check the 'Recalculate Old' box.`, icon: "warning" });
                setIsGenerating(false);
                return;
            }
        }
        
        let employeesToProcessQuery;
        const baseQuery = collection(firestore, "employees");

        switch(data.generationType) {
            case 'Branch Wise': {
                const selectedBranch = branchOptions.find(b => b.value === data.branch);
                if (!selectedBranch) { Swal.fire("Validation Error", "Please select a valid branch.", "error"); setIsGenerating(false); return; }
                employeesToProcessQuery = query(baseQuery, where("branch", "==", selectedBranch.label), where("status", "==", "Active"));
                break;
            }
            case 'Department Wise': {
                const selectedDept = departmentOptions.find(d => d.value === data.department);
                if (!selectedDept) { Swal.fire("Validation Error", "Please select a valid department.", "error"); setIsGenerating(false); return; }
                 employeesToProcessQuery = query(baseQuery, where("department", "==", selectedDept.label), where("status", "==", "Active"));
                break;
            }
            case 'Department Unit Wise': {
                 const selectedDept = departmentOptions.find(d => d.value === data.department);
                 const selectedUnit = unitOptions.find(u => u.value === data.unit);
                 if (!selectedDept || !selectedUnit) { Swal.fire("Validation Error", "Please select a valid department and unit.", "error"); setIsGenerating(false); return; }
                 employeesToProcessQuery = query(baseQuery, where("department", "==", selectedDept.label), where("unit", "==", selectedUnit.label), where("status", "==", "Active"));
                break;
            }
            case 'Employee Wise': {
                 if (!data.employee) { Swal.fire("Validation Error", "Please select an employee.", "error"); setIsGenerating(false); return; }
                 employeesToProcessQuery = query(baseQuery, where(documentId(), "==", data.employee), where("status", "==", "Active"));
                break;
            }
            default:
                employeesToProcessQuery = query(baseQuery, where("status", "==", "Active"));
                break;
        }

        try {
            const employeesSnapshot = await getDocs(employeesToProcessQuery);
            if (employeesSnapshot.empty) {
                Swal.fire("No Employees Found", "No active employees match the selected criteria for salary generation.", "info");
                setIsGenerating(false);
                return;
            }
            
            const monthIndex = monthOptions.indexOf(data.month);
            const year = parseInt(data.year);
            const startDate = startOfMonth(new Date(year, monthIndex));
            const endDate = endOfMonth(new Date(year, monthIndex));

            const [attendanceSnapshot, leavesSnapshot, holidaysSnapshot, policySnapshot] = await Promise.all([
                getDocs(query(collection(firestore, "attendance"), where("date", ">=", format(startDate, "yyyy-MM-dd'T'00:00:00.000xxx")), where("date", "<=", format(endDate, "yyyy-MM-dd'T'23:59:59.999xxx")))),
                getDocs(query(collection(firestore, "leave_applications"), where("status", "==", "Approved"))),
                getDocs(collection(firestore, "holidays")),
                getDoc(doc(firestore, 'hrm_settings', 'salary_generation_policy'))
            ]);
            
            const attendanceRecs = attendanceSnapshot.docs.map(d => d.data() as AttendanceDocument);
            const approvedLeaves = leavesSnapshot.docs.map(d => d.data() as LeaveApplicationDocument);
            const holidays = holidaysSnapshot.docs.map(d => d.data() as HolidayDocument);
            const salaryPolicy = policySnapshot.exists() ? policySnapshot.data() as SalaryGenerationPolicy : {};

            const batch = writeBatch(firestore);
            let totalGrossSalary = 0, totalDeductions = 0, processedCount = 0;
            
            for (const empDoc of employeesSnapshot.docs) {
                const employee = {id: empDoc.id, ...empDoc.data()} as EmployeeDocument;
                if (!employee.salaryStructure || !employee.salaryStructure.grossSalary) continue;

                const daysInMonth = salaryPolicy.dayConsideration === 'Fixed Days' ? (salaryPolicy.fixedDaysInMonth || 30) : getDaysInMonth(startDate);
                let absentDays = 0;

                const daysInterval = eachDayOfInterval({ start: startDate, end: endDate });
                
                daysInterval.forEach(day => {
                    const attendance = attendanceRecs.find(a => a.employeeId === employee.id && format(new Date(a.date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'));
                    
                    if (attendance?.flag === 'A') {
                        absentDays++;
                    } else if (!attendance) {
                        const dayOfWeek = getDay(day);
                        const isWeeklyHoliday = dayOfWeek === 5 && salaryPolicy.includeWeeklyHoliday;
                        const isGovtHoliday = holidays.some(h => h.type === 'Public Holiday' && isWithinInterval(day, { start: new Date(h.fromDate), end: new Date(h.toDate || h.fromDate) })) && salaryPolicy.includeGovtHoliday;
                        const isFestivalHoliday = holidays.some(h => h.type === 'Company Holiday' && isWithinInterval(day, { start: new Date(h.fromDate), end: new Date(h.toDate || h.fromDate) })) && salaryPolicy.includeFestivalHoliday;
                        const isOnLeave = approvedLeaves.some(l => l.employeeId === employee.id && isWithinInterval(day, { start: new Date(l.fromDate), end: new Date(l.toDate) }));

                        if (!isWeeklyHoliday && !isGovtHoliday && !isFestivalHoliday && !isOnLeave) {
                            absentDays++;
                        }
                    }
                });
                
                const fullGrossSalary = employee.salaryStructure.grossSalary;
                const perDaySalary = fullGrossSalary / daysInMonth;
                const deductionForAbsence = absentDays * perDaySalary;
                
                totalGrossSalary += fullGrossSalary;
                totalDeductions += deductionForAbsence;
                processedCount++;

                const payslipId = `PAYSLIP-${data.year}-${data.month.toUpperCase()}-${employee.id}`;
                const payslipDocRef = doc(firestore, 'payslips', payslipId);
                const payslipData: Payslip = {
                    id: payslipId, payrollId, employeeId: employee.id, employeeName: employee.fullName, employeeCode: employee.employeeCode,
                    designation: employee.designation, payPeriod,
                    grossSalary: fullGrossSalary,
                    totalDeductions: deductionForAbsence,
                    netSalary: fullGrossSalary - deductionForAbsence,
                    basicSalary: employee.salaryStructure.salaryBreakup?.find(i => i.breakupName === 'Basic')?.amount ?? null,
                    houseRent: employee.salaryStructure.salaryBreakup?.find(i => i.breakupName === 'House Rent')?.amount ?? null,
                    medicalAllowance: employee.salaryStructure.salaryBreakup?.find(i => i.breakupName === 'Medical Allowance')?.amount ?? null,
                    leaveDeduction: deductionForAbsence,
                    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
                };
                batch.set(payslipDocRef, payslipData);
            }

            if (processedCount > 0) {
                const payrollDocRef = doc(firestore, 'payrolls', payrollId);
                batch.set(payrollDocRef, {
                    id: payrollId, month: data.month, year: parseInt(data.year),
                    generationDate: serverTimestamp(), generatedBy: user?.displayName || user?.email,
                    totalEmployees: processedCount, totalGrossSalary, totalDeductions, totalNetSalary: totalGrossSalary - totalDeductions,
                    status: 'Generated',
                }, { merge: true });
            }

            await batch.commit();

            Swal.fire({ title: "Salary Generation Complete!", text: `Successfully generated payroll for ${processedCount} employees for ${payPeriod}.`, icon: "success" });

        } catch (error: any) {
             Swal.fire("Error", `Salary generation failed: ${error.message}`, "error");
        } finally {
            setIsGenerating(false);
        }
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
                        Generate salaries for employees based on attendance and selected criteria.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onGenerateSalary)} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-6">
                                <FormField control={form.control} name="generationType" render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel>Generate Salary By</FormLabel>
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-wrap items-center gap-x-6 gap-y-2">
                                                <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Branch Wise" /></FormControl><FormLabel className="font-normal">Branch Wise</FormLabel></FormItem>
                                                <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Department Wise" /></FormControl><FormLabel className="font-normal">Department Wise</FormLabel></FormItem>
                                                <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Department Unit Wise" /></FormControl><FormLabel className="font-normal">Unit Wise</FormLabel></FormItem>
                                                <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Employee Wise" /></FormControl><FormLabel className="font-normal">Employee Wise</FormLabel></FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                     {generationType === 'Branch Wise' && <FormField control={form.control} name="branch" render={({ field }) => (<FormItem><FormLabel>Branch</FormLabel><Combobox options={branchOptions} {...field} onValueChange={field.onChange} placeholder="Select Branch..." selectPlaceholder="Select Branch" disabled={isLoadingOptions} /></FormItem>)} />}
                                     {generationType === 'Department Wise' && <FormField control={form.control} name="department" render={({ field }) => (<FormItem><FormLabel>Department</FormLabel><Combobox options={departmentOptions} {...field} onValueChange={field.onChange} placeholder="Select Department..." selectPlaceholder="Select Department" disabled={isLoadingOptions} /></FormItem>)} />}
                                     {generationType === 'Department Unit Wise' && <>
                                        <FormField control={form.control} name="department" render={({ field }) => (<FormItem><FormLabel>Department</FormLabel><Combobox options={departmentOptions} {...field} onValueChange={field.onChange} placeholder="Select Department..." selectPlaceholder="Select Department" disabled={isLoadingOptions} /></FormItem>)} />
                                        <FormField control={form.control} name="unit" render={({ field }) => (<FormItem><FormLabel>Unit</FormLabel><Combobox options={unitOptions} {...field} onValueChange={field.onChange} placeholder="Select Unit..." selectPlaceholder="Select Unit" disabled={isLoadingOptions} /></FormItem>)} />
                                     </>}
                                     {generationType === 'Employee Wise' && <FormField control={form.control} name="employee" render={({ field }) => (<FormItem className="md:col-span-3"><FormLabel>Employee</FormLabel><Combobox options={employeeOptions} {...field} onValueChange={field.onChange} placeholder="Select Employee..." selectPlaceholder="Select Employee" disabled={isLoadingOptions} /></FormItem>)} />}
                                    
                                     <FormField control={form.control} name="year" render={({ field }) => (<FormItem><FormLabel>Year</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger></FormControl><SelectContent>{yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                     <FormField control={form.control} name="month" render={({ field }) => (<FormItem><FormLabel>Month</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger></FormControl><SelectContent>{monthOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                </div>
                                
                                <div className="space-y-2 text-sm text-muted-foreground">
                                    <p>Current Date: {currentTime ? currentTime.toLocaleString() : 'Loading...'}</p>
                                    <p>Generation Date: {generationDate ? generationDate.toLocaleString() : '...'}</p>
                                </div>

                                <div className="flex items-center space-x-4 pt-4">
                                     <FormField control={form.control} name="recalculate" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Recalculate Old</FormLabel></FormItem>)} />
                                     <FormField control={form.control} name="includeBonus" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Calculate Bonus With Salary</FormLabel></FormItem>)} />
                                </div>

                                <Button type="submit" disabled={isGenerating || isLoadingOptions}>
                                    {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : 'Generate Salary'}
                                </Button>
                            </div>
                            <div className="lg:col-span-1">
                                <Card className="bg-muted/30">
                                    <CardHeader>
                                        <CardTitle>Generation Steps</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-green-500" /><span>Fetch Employees based on criteria</span></div>
                                        <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-green-500" /><span>Calculate Salary & Deductions based on attendance</span></div>
                                        <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-green-500" /><span>Create individual Payslips</span></div>
                                        <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-green-500" /><span>Create master Payroll record</span></div>
                                         <Alert variant="destructive" className="mt-4">
                                            <AlertTriangle className="h-4 w-4" />
                                            <AlertTitle>Important</AlertTitle>
                                            <AlertDescription className="text-xs">Ensure employee salary structures and attendance data are correctly configured before generating payroll to avoid errors.</AlertDescription>
                                        </Alert>
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

    