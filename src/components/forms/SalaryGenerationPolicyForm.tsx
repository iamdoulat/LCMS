
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { SalaryGenerationPolicy as SalaryGenerationPolicyType } from '@/types';
import { SalaryGenerationPolicySchema } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Save, Settings, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/context/AuthContext';
import { Label } from '@/components/ui/label';


const SALARY_POLICY_COLLECTION = 'hrm_settings';
const SALARY_POLICY_DOC_ID = 'salary_generation_policy';

export function SalaryGenerationPolicyForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const { userRole } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');

  const form = useForm<SalaryGenerationPolicyType>({
    resolver: zodResolver(SalaryGenerationPolicySchema),
    defaultValues: {
      dayConsideration: 'Actual Days',
      fixedDaysInMonth: 30,
      includeWeeklyHoliday: false,
      includeGovtHoliday: false,
      includeFestivalHoliday: false,
      considerJoiningDate: false,
      salaryRounding: 'No Rounding',
    },
  });

  const watchDayConsideration = form.watch("dayConsideration");

  React.useEffect(() => {
    const fetchPolicy = async () => {
      setIsLoadingData(true);
      try {
        const docRef = doc(firestore, SALARY_POLICY_COLLECTION, SALARY_POLICY_DOC_ID);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as SalaryGenerationPolicyType;
          form.reset(data);
        }
      } catch (error) {
        console.error("Error fetching salary policy:", error);
        Swal.fire("Error", "Could not load salary generation policy settings.", "error");
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchPolicy();
  }, [form]);

  async function onSubmit(data: SalaryGenerationPolicyType) {
    if (isReadOnly) {
        Swal.fire("Permission Denied", "You have read-only access and cannot change settings.", "error");
        return;
    }
    setIsSubmitting(true);
    const dataToSave = {
      ...data,
      fixedDaysInMonth: Number(data.fixedDaysInMonth),
      updatedAt: serverTimestamp(),
    };

    try {
      const docRef = doc(firestore, SALARY_POLICY_COLLECTION, SALARY_POLICY_DOC_ID);
      await setDoc(docRef, dataToSave, { merge: true });
      Swal.fire({
        title: "Settings Saved!",
        text: "Salary Generation Policy has been updated.",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error: any) {
      Swal.fire("Save Failed", `Failed to save settings: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingData) {
    return (
        <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
          <FormField
            control={form.control}
            name="dayConsideration"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>Day Consideration for Salary</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="flex flex-col space-y-1"
                    disabled={isReadOnly}
                  >
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl><RadioGroupItem value="Actual Days" /></FormControl>
                      <FormLabel className="font-normal">Actual Days of the Month</FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl><RadioGroupItem value="Fixed Days" /></FormControl>
                      <FormLabel className="font-normal">Fixed Days</FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {watchDayConsideration === 'Fixed Days' && (
            <FormField
              control={form.control}
              name="fixedDaysInMonth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fixed Days in a Month</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 30" {...field} disabled={isReadOnly} />
                  </FormControl>
                  <FormDescription>Specify the fixed number of days to consider for salary calculation.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <div className="space-y-4">
              <Label>Holidays to Include in Salary</Label>
              <FormField control={form.control} name="includeWeeklyHoliday" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isReadOnly} /></FormControl><Label className="font-normal">Weekly Holiday</Label></FormItem>)}/>
              <FormField control={form.control} name="includeGovtHoliday" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isReadOnly} /></FormControl><Label className="font-normal">Govt. Holiday</Label></FormItem>)}/>
              <FormField control={form.control} name="includeFestivalHoliday" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isReadOnly} /></FormControl><Label className="font-normal">Festival Holiday</Label></FormItem>)}/>
          </div>

          <FormField
            control={form.control}
            name="considerJoiningDate"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2 rounded-md border p-4 shadow-sm bg-background">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isReadOnly} /></FormControl>
                <div className="space-y-1 leading-none">
                    <FormLabel>Consider Joining Date</FormLabel>
                    <FormDescription>If checked, salary will be calculated from the joining date for the first month.</FormDescription>
                </div>
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="salaryRounding"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Salary Rounding</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={isReadOnly}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a rounding option" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="No Rounding">No Rounding</SelectItem>
                    <SelectItem value="Round to Nearest">Round to Nearest</SelectItem>
                    <SelectItem value="Round Up">Round Up</SelectItem>
                    <SelectItem value="Round Down">Round Down</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {!isReadOnly && (
            <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? ( <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Policy...</> ) : ( <><Save className="mr-2 h-4 w-4" /> Save Policy</> )}
                </Button>
            </div>
        )}
      </form>
    </Form>
  );
}
