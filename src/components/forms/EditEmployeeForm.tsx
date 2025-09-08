
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, UserPlus, Save, Building, History } from 'lucide-react';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { EmployeeFormValues, EmployeeDocument } from '@/types';
import { EmployeeSchema, genderOptions, maritalStatusOptions, bloodGroupOptions, employeeStatusOptions, jobBaseOptions, jobStatusOptions } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from './DatePickerField';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { Textarea } from '../ui/textarea';

interface EditEmployeeFormProps {
  employee: EmployeeDocument;
}

export function EditEmployeeForm({ employee }: EditEmployeeFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(EmployeeSchema),
    defaultValues: {
      ...employee,
      // Handle potential name splitting issues if middleName is not present
      firstName: employee.fullName?.split(' ')[0] || '',
      middleName: employee.fullName?.split(' ').length > 2 ? employee.fullName.split(' ')[1] : '',
      lastName: employee.fullName?.split(' ').length > 2 ? employee.fullName.split(' ').slice(2).join(' ') : (employee.fullName?.split(' ')[1] || ''),
      dateOfBirth: employee.dateOfBirth ? new Date(employee.dateOfBirth) : undefined,
      joinedDate: employee.joinedDate ? new Date(employee.joinedDate) : undefined,
      effectiveDate: employee.effectiveDate ? new Date(employee.effectiveDate) : undefined,
      jobStatusEffectiveDate: employee.jobStatusEffectiveDate ? new Date(employee.jobStatusEffectiveDate) : undefined,
      jobBaseEffectiveDate: employee.jobBaseEffectiveDate ? new Date(employee.jobBaseEffectiveDate) : undefined,
    },
  });

  async function onSubmit(data: EmployeeFormValues) {
    setIsSubmitting(true);

    const fullName = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ');

    const dataToSave = {
      ...data,
      fullName: fullName,
      dateOfBirth: data.dateOfBirth ? data.dateOfBirth.toISOString() : null,
      joinedDate: data.joinedDate ? data.joinedDate.toISOString() : null,
      effectiveDate: data.effectiveDate ? data.effectiveDate.toISOString() : null,
      jobStatusEffectiveDate: data.jobStatusEffectiveDate ? data.jobStatusEffectiveDate.toISOString() : null,
      jobBaseEffectiveDate: data.jobBaseEffectiveDate ? data.jobBaseEffectiveDate.toISOString() : null,
      updatedAt: serverTimestamp(),
    };

    // Remove fields not in the final schema
    delete (dataToSave as any).firstName;
    delete (dataToSave as any).middleName;
    delete (dataToSave as any).lastName;

    try {
      await updateDoc(doc(firestore, "employees", employee.id as string), dataToSave);
      Swal.fire({
        title: "Employee Updated!",
        text: `Employee ${fullName} has been successfully updated.`,
        icon: "success",
        timer: 3000,
        showConfirmButton: true,
      });
    } catch (error) {
      console.error("Error updating employee: ", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      Swal.fire({
        title: "Update Failed",
        text: `Failed to update employee: ${errorMessage}`,
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

        <div className="flex items-center gap-6">
          <div className="w-32 h-40 rounded-md border-2 border-dashed flex items-center justify-center bg-muted/50">
            <Image src={employee.photoURL || "https://placehold.co/128x160/e2e8f0/e2e8f0"} width={128} height={160} alt="Profile image" data-ai-hint="employee photo"/>
          </div>
          <div className="flex-1 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="firstName" render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name*</FormLabel>
                  <FormControl>
                    <Input placeholder="Mohammed Swaif" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="middleName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Middle Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter here" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="lastName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name*</FormLabel>
                  <FormControl>
                    <Input placeholder="Ullah" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="gender" render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender*</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {genderOptions.map(o => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="joinedDate" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Joined Date*</FormLabel>
                  <DatePickerField field={field} placeholder="Select join date" />
                  <FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date of Birth*</FormLabel>
                  <DatePickerField field={field} placeholder="Select birth date" />
                  <FormMessage />
                </FormItem>
              )}/>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField control={form.control} name="nationalId" render={({ field }) => (
            <FormItem>
              <FormLabel>NID/SSN</FormLabel>
              <FormControl>
                <Input placeholder="Enter here" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}/>
          <FormField control={form.control} name="nationality" render={({ field }) => (
            <FormItem>
              <FormLabel>Nationality</FormLabel>
              <FormControl>
                <Input placeholder="Bangladeshi" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}/>
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>Email*</FormLabel>
              <FormControl>
                <Input type="email" placeholder="smartsollutions21@gmail.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}/>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField control={form.control} name="maritalStatus" render={({ field }) => (
            <FormItem>
              <FormLabel>Marital Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {maritalStatusOptions.map(o => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}/>
          <FormField control={form.control} name="bloodGroup" render={({ field }) => (
            <FormItem>
              <FormLabel>Blood Group</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select blood group" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {bloodGroupOptions.map(o => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}/>
          <FormField control={form.control} name="religion" render={({ field }) => (
            <FormItem>
              <FormLabel>Religion</FormLabel>
              <FormControl>
                <Input placeholder="Islam" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}/>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField control={form.control} name="employeeCode" render={({ field }) => (
            <FormItem>
              <FormLabel>Employee Code*</FormLabel>
              <FormControl>
                <Input placeholder="Enter employee code" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}/>
          <FormField control={form.control} name="designation" render={({ field }) => (
            <FormItem>
              <FormLabel>Designation*</FormLabel>
              <FormControl>
                <Input placeholder="Enter designation" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}/>
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem>
              <FormLabel>Mobile No*</FormLabel>
              <FormControl>
                <Input type="tel" placeholder="Enter mobile number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}/>
        </div>
        
        <FormField control={form.control} name="status" render={({ field }) => (
          <FormItem>
            <FormLabel>Employee Status</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {employeeStatusOptions.map(o => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}/>

        <Separator />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 p-4">
                <CardHeader className="p-2 pt-0">
                    <CardTitle className="text-lg flex items-center gap-2"><Building className="h-5 w-5 text-primary"/>Division, Department...</CardTitle>
                    <CardDescription className="text-xs">Setup division, branch etc.</CardDescription>
                </CardHeader>
                <CardContent className="p-2 space-y-4">
                    <FormField control={form.control} name="division" render={({ field }) => (<FormItem><FormLabel>Division*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="branch" render={({ field }) => (<FormItem><FormLabel>Branch*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="department" render={({ field }) => (<FormItem><FormLabel>Department*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="unit" render={({ field }) => (<FormItem><FormLabel>Unit*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="effectiveDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Effective Date*</FormLabel><DatePickerField field={field} placeholder="Select date" /><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="remarksDivision" render={({ field }) => (<FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea placeholder="Enter Here" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                </CardContent>
            </Card>

            <Card className="md:col-span-1 p-4">
                <CardHeader className="p-2 pt-0">
                    <CardTitle className="text-lg flex items-center gap-2"><History className="h-5 w-5 text-primary"/>Job Status Setup</CardTitle>
                </CardHeader>
                <CardContent className="p-2 space-y-4">
                    <FormField control={form.control} name="jobStatus" render={({ field }) => (<FormItem><FormLabel>Job Status*</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger></FormControl><SelectContent>{jobStatusOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="jobStatusEffectiveDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Job Status Effective Date*</FormLabel><DatePickerField field={field} placeholder="Select date" /><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="remarksJobStatus" render={({ field }) => (<FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea placeholder="Enter Here" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                </CardContent>
            </Card>
            
            <Card className="md:col-span-1 p-4">
                <CardHeader className="p-2 pt-0">
                    <CardTitle className="text-lg flex items-center gap-2"><History className="h-5 w-5 text-primary"/>Job Base Setup</CardTitle>
                </CardHeader>
                <CardContent className="p-2 space-y-4">
                    <FormField control={form.control} name="jobBase" render={({ field }) => (<FormItem><FormLabel>Job Base*</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Base" /></SelectTrigger></FormControl><SelectContent>{jobBaseOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="jobBaseEffectiveDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Job Base Effective Date*</FormLabel><DatePickerField field={field} placeholder="Select date" /><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="remarksJobBase" render={({ field }) => (<FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea placeholder="Enter Here" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                </CardContent>
            </Card>
        </div>


        <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating Employee...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Update Employee
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

  