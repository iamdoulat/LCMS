
"use client";

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp, getDoc, runTransaction } from 'firebase/firestore';
import type { Payslip, SalaryBreakup } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Loader2, Save, DollarSign } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PayslipEditSchema = z.object({
  grossSalary: z.number().nonnegative(),
  taxDeduction: z.number().nonnegative().optional(),
  providentFund: z.number().nonnegative().optional(),
  absentDeduction: z.number().nonnegative().optional(),
  advanceDeduction: z.number().nonnegative().optional(),
});

type PayslipEditFormValues = z.infer<typeof PayslipEditSchema>;

interface EditPayslipFormProps {
  initialData: Payslip;
}

export function EditPayslipForm({ initialData }: EditPayslipFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<PayslipEditFormValues>({
    resolver: zodResolver(PayslipEditSchema),
    defaultValues: {
      grossSalary: initialData.grossSalary || 0,
      taxDeduction: initialData.taxDeduction || 0,
      providentFund: initialData.providentFund || 0,
      absentDeduction: initialData.absentDeduction || 0,
      advanceDeduction: initialData.advanceDeduction || 0,
    },
  });
  
  const watchedFields = form.watch();

  const { totalDeductions, netSalary } = React.useMemo(() => {
    const gross = watchedFields.grossSalary || 0;
    const tax = watchedFields.taxDeduction || 0;
    const pf = watchedFields.providentFund || 0;
    const absent = watchedFields.absentDeduction || 0;
    const advance = watchedFields.advanceDeduction || 0;
    const deductions = tax + pf + absent + advance;
    const net = gross - deductions;
    return { totalDeductions: deductions, netSalary: net };
  }, [watchedFields]);

  const salaryBreakupForDisplay = initialData.salaryBreakup || [];

  async function onSubmit(data: PayslipEditFormValues) {
    setIsSubmitting(true);

    const dataToUpdate = {
      grossSalary: data.grossSalary,
      taxDeduction: data.taxDeduction,
      providentFund: data.providentFund,
      absentDeduction: data.absentDeduction,
      advanceDeduction: data.advanceDeduction,
      totalDeductions: totalDeductions,
      netSalary: netSalary,
      updatedAt: serverTimestamp(),
    };

    try {
      const payslipDocRef = doc(firestore, "payslips", initialData.id);
      await updateDoc(payslipDocRef, dataToUpdate);

      Swal.fire({
        title: "Payslip Updated!",
        icon: "success",
        timer: 1000,
        showConfirmButton: false,
      });
    } catch (error: any) {
      Swal.fire("Update Failed", `Failed to update payslip: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="p-4 border rounded-md bg-muted/50">
            <h3 className="font-semibold text-lg">{initialData.employeeName}</h3>
            <p className="text-sm text-muted-foreground">{initialData.designation}</p>
            <p className="text-sm text-muted-foreground">Pay Period: {initialData.payPeriod}</p>
        </div>
        
        <Separator />
        <h4 className="text-md font-semibold">Earnings</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Earning Component</TableHead>
                    <TableHead className="text-right">Amount (BDT)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryBreakupForDisplay.length > 0 ? (
                    salaryBreakupForDisplay.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.breakupName}</TableCell>
                        <TableCell className="text-right">{item.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">No earning breakdown available.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
             <FormField
              control={form.control}
              name="grossSalary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gross Salary</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                  </FormControl>
                  <FormDescription>This is the total earnings before any deductions.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>

        <Separator />
        <h4 className="text-md font-semibold">Deductions</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FormField
              control={form.control}
              name="taxDeduction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax Deduction</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="providentFund"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provident Fund</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="absentDeduction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Absent Deduction</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                  </FormControl>
                   <FormDescription>Calculated based on {initialData.absentDays || 0} absent days.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="advanceDeduction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Advance Paid Deduction</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>
        
        <Separator />
        
        <div className="p-4 border rounded-lg bg-muted/50 space-y-2">
            <div className="flex justify-between font-medium text-sm">
                <span className="text-muted-foreground">Total Deductions:</span>
                <span>BDT {totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
                <span className="text-primary">Net Salary:</span>
                <span className="text-primary">BDT {netSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
        </div>

        <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
                <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
                </>
            ) : (
                <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
                </>
            )}
            </Button>
        </div>
      </form>
    </Form>
  );
}
