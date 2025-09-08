
"use client";

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, UserPlus, Save, History, Building, GraduationCap, PlusCircle, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { EmployeeFormValues, Education } from '@/types';
import { EmployeeSchema, genderOptions, maritalStatusOptions, bloodGroupOptions, jobStatusOptions, jobBaseOptions, educationLevelOptions, gradeDivisionOptions } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from './DatePickerField';
import Image from 'next/image';
import { Separator } from '../ui/separator';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '../ui/label';

export function AddEmployeeForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(EmployeeSchema),
    defaultValues: {
      employeeCode: '',
      firstName: '',
      middleName: '',
      lastName: '',
      email: '',
      phone: '',
      gender: undefined,
      dateOfBirth: undefined,
      joinedDate: undefined,
      designation: '',
      maritalStatus: undefined,
      nationality: 'Bangladeshi',
      religion: '',
      nationalId: '',
      bloodGroup: undefined,
      photoURL: '',
      status: 'Active',
      division: 'Not Defined',
      branch: 'Chattogram',
      department: 'SALES & MARKI',
      unit: 'Not Defined',
      effectiveDate: undefined,
      remarksDivision: '',
      jobStatus: 'Active',
      jobStatusEffectiveDate: undefined,
      remarksJobStatus: '',
      jobBase: 'Permanent',
      jobBaseEffectiveDate: undefined,
      remarksJobBase: '',
      educationDetails: [],
      presentAddress: { address: '', country: 'Bangladesh', state: '', city: '', zipCode: '' },
      permanentAddress: { address: '', country: 'Bangladesh', state: '', city: '', zipCode: '' },
      sameAsPresentAddress: false,
    },
  });

  const { control, handleSubmit, reset, watch, setValue } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "educationDetails",
  });
  
  const watchSameAsPresent = watch("sameAsPresentAddress");
  const watchPresentAddress = watch("presentAddress");

  React.useEffect(() => {
    if (watchSameAsPresent) {
      setValue("permanentAddress", watchPresentAddress);
    }
  }, [watchSameAsPresent, watchPresentAddress, setValue]);


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
      educationDetails: data.educationDetails?.map(edu => ({
          ...edu,
          scale: Number(edu.scale) || undefined,
          cgpa: Number(edu.cgpa) || undefined,
      })),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    delete (dataToSave as any).firstName;
    delete (dataToSave as any).middleName;
    delete (dataToSave as any).lastName;
    delete (dataToSave as any).sameAsPresentAddress;


    try {
      await addDoc(collection(firestore, "employees"), dataToSave);
      Swal.fire({
        title: "Employee Added!",
        text: `Employee ${fullName} has been successfully added.`,
        icon: "success",
        timer: 3000,
        showConfirmButton: true,
      });
      form.reset();
    } catch (error) {
      console.error("Error adding employee: ", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      Swal.fire({
        title: "Save Failed",
        text: `Failed to add employee: ${errorMessage}`,
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        
        <div className="flex items-center gap-6">
            <div className="w-32 h-40 rounded-md border-2 border-dashed flex items-center justify-center bg-muted/50">
                <Image src="https://placehold.co/128x160/e2e8f0/e2e8f0" width={128} height={160} alt="Profile image placeholder" data-ai-hint="placeholder image"/>
            </div>
            <div className="flex-1 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <FormField control={control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name*</FormLabel><FormControl><Input placeholder="Mohammed Swaif" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                     <FormField control={control} name="middleName" render={({ field }) => (<FormItem><FormLabel>Middle Name</FormLabel><FormControl><Input placeholder="Enter here" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                     <FormField control={control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last Name*</FormLabel><FormControl><Input placeholder="Ullah" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <FormField control={control} name="gender" render={({ field }) => (<FormItem><FormLabel>Gender*</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl><SelectContent>{genderOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                     <FormField control={control} name="joinedDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Joined Date*</FormLabel><DatePickerField field={field} placeholder="Select join date" /><FormMessage /></FormItem>)} />
                     <FormField control={control} name="dateOfBirth" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Date of Birth*</FormLabel><DatePickerField field={field} placeholder="Select birth date" /><FormMessage /></FormItem>)} />
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField control={control} name="nationalId" render={({ field }) => (<FormItem><FormLabel>NID/SSN</FormLabel><FormControl><Input placeholder="Enter here" {...field} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={control} name="nationality" render={({ field }) => (<FormItem><FormLabel>Nationality</FormLabel><FormControl><Input placeholder="Bangladeshi" {...field} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={control} name="email" render={({ field }) => (<FormItem><FormLabel>Email*</FormLabel><FormControl><Input type="email" placeholder="smartsollutions21@gmail.com" {...field} /></FormControl><FormMessage /></FormItem>)}/>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField control={control} name="maritalStatus" render={({ field }) => (<FormItem><FormLabel>Marital Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl><SelectContent>{maritalStatusOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
            <FormField control={control} name="bloodGroup" render={({ field }) => (<FormItem><FormLabel>Blood Group</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger></FormControl><SelectContent>{bloodGroupOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
            <FormField control={control} name="religion" render={({ field }) => (<FormItem><FormLabel>Religion</FormLabel><FormControl><Input placeholder="Islam" {...field} /></FormControl><FormMessage /></FormItem>)}/>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField control={control} name="employeeCode" render={({ field }) => (<FormItem><FormLabel>Employee Code*</FormLabel><FormControl><Input placeholder="Enter employee code" {...field} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={control} name="designation" render={({ field }) => (<FormItem><FormLabel>Designation*</FormLabel><FormControl><Input placeholder="Enter designation" {...field} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={control} name="phone" render={({ field }) => (<FormItem><FormLabel>Mobile No*</FormLabel><FormControl><Input type="tel" placeholder="Enter mobile number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
        </div>
        
        <Separator />

        <Card className="p-4">
          <CardHeader className="p-2 pt-0">
            <CardTitle>Present Address</CardTitle>
          </CardHeader>
          <CardContent className="p-2 space-y-4">
            <FormField control={control} name="presentAddress.address" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Textarea placeholder="Enter Here" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <FormField control={control} name="presentAddress.country" render={({ field }) => (<FormItem><FormLabel>Country</FormLabel><FormControl><Input placeholder="Country" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="presentAddress.state" render={({ field }) => (<FormItem><FormLabel>State</FormLabel><FormControl><Input placeholder="State" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="presentAddress.city" render={({ field }) => (<FormItem><FormLabel>City</FormLabel><FormControl><Input placeholder="City" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="presentAddress.zipCode" render={({ field }) => (<FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input placeholder="Zip Code" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
            </div>
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardHeader className="p-2 pt-0 flex flex-row items-center justify-between">
            <CardTitle>Permanent Address</CardTitle>
            <FormField
              control={control}
              name="sameAsPresentAddress"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="sameAsPresent" /></FormControl>
                  <Label htmlFor="sameAsPresent" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Same as present address</Label>
                </FormItem>
              )}
            />
          </CardHeader>
          <CardContent className="p-2 space-y-4">
            <FormField control={control} name="permanentAddress.address" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Textarea placeholder="Enter Here" {...field} value={field.value || ''} disabled={watchSameAsPresent} /></FormControl><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <FormField control={control} name="permanentAddress.country" render={({ field }) => (<FormItem><FormLabel>Country</FormLabel><FormControl><Input placeholder="Country" {...field} value={field.value || ''} disabled={watchSameAsPresent} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="permanentAddress.state" render={({ field }) => (<FormItem><FormLabel>State</FormLabel><FormControl><Input placeholder="State" {...field} value={field.value || ''} disabled={watchSameAsPresent} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="permanentAddress.city" render={({ field }) => (<FormItem><FormLabel>City</FormLabel><FormControl><Input placeholder="City" {...field} value={field.value || ''} disabled={watchSameAsPresent} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="permanentAddress.zipCode" render={({ field }) => (<FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input placeholder="Zip Code" {...field} value={field.value || ''} disabled={watchSameAsPresent} /></FormControl><FormMessage /></FormItem>)} />
            </div>
          </CardContent>
        </Card>

        <Separator />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 p-4">
                <CardHeader className="p-2 pt-0">
                    <CardTitle className="text-lg flex items-center gap-2"><Building className="h-5 w-5 text-primary"/>Division, Department...</CardTitle>
                    <CardDescription className="text-xs">Setup division, branch etc.</CardDescription>
                </CardHeader>
                <CardContent className="p-2 space-y-4">
                    <FormField control={control} name="division" render={({ field }) => (<FormItem><FormLabel>Division*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={control} name="branch" render={({ field }) => (<FormItem><FormLabel>Branch*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={control} name="department" render={({ field }) => (<FormItem><FormLabel>Department*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={control} name="unit" render={({ field }) => (<FormItem><FormLabel>Unit*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={control} name="effectiveDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Effective Date*</FormLabel><DatePickerField field={field} placeholder="Select date" /><FormMessage /></FormItem>)} />
                    <FormField control={control} name="remarksDivision" render={({ field }) => (<FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea placeholder="Enter Here" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                </CardContent>
            </Card>

            <Card className="md:col-span-1 p-4">
                <CardHeader className="p-2 pt-0">
                    <CardTitle className="text-lg flex items-center gap-2"><History className="h-5 w-5 text-primary"/>Job Status Setup</CardTitle>
                </CardHeader>
                <CardContent className="p-2 space-y-4">
                    <FormField control={control} name="jobStatus" render={({ field }) => (<FormItem><FormLabel>Job Status*</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger></FormControl><SelectContent>{jobStatusOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                    <FormField control={control} name="jobStatusEffectiveDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Job Status Effective Date*</FormLabel><DatePickerField field={field} placeholder="Select date" /><FormMessage /></FormItem>)} />
                    <FormField control={control} name="remarksJobStatus" render={({ field }) => (<FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea placeholder="Enter Here" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                </CardContent>
            </Card>
            
            <Card className="md:col-span-1 p-4">
                <CardHeader className="p-2 pt-0">
                    <CardTitle className="text-lg flex items-center gap-2"><History className="h-5 w-5 text-primary"/>Job Base Setup</CardTitle>
                </CardHeader>
                <CardContent className="p-2 space-y-4">
                    <FormField control={control} name="jobBase" render={({ field }) => (<FormItem><FormLabel>Job Base*</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Base" /></SelectTrigger></FormControl><SelectContent>{jobBaseOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                    <FormField control={control} name="jobBaseEffectiveDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Job Base Effective Date*</FormLabel><DatePickerField field={field} placeholder="Select date" /><FormMessage /></FormItem>)} />
                    <FormField control={control} name="remarksJobBase" render={({ field }) => (<FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea placeholder="Enter Here" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                </CardContent>
            </Card>
        </div>

        <Separator />
        
        <Card className="p-4">
            <CardHeader className="p-2 pt-0">
                <CardTitle className="text-lg flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary"/>Education Information</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-4">
                {fields.map((field, index) => (
                    <div key={field.id} className="p-4 border rounded-lg space-y-4 relative">
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            <FormField control={control} name={`educationDetails.${index}.education`} render={({ field }) => (<FormItem><FormLabel>Education*</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Education" /></SelectTrigger></FormControl><SelectContent>{educationLevelOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                            <FormField control={control} name={`educationDetails.${index}.gradeDivision`} render={({ field }) => (<FormItem><FormLabel>Grade/Division</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Grade" /></SelectTrigger></FormControl><SelectContent>{gradeDivisionOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                            <FormField control={control} name={`educationDetails.${index}.passedYear`} render={({ field }) => (<FormItem><FormLabel>Passed Year*</FormLabel><FormControl><Input placeholder="YYYY" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={control} name={`educationDetails.${index}.scale`} render={({ field }) => (<FormItem><FormLabel>Scale</FormLabel><FormControl><Input type="number" placeholder="4" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={control} name={`educationDetails.${index}.cgpa`} render={({ field }) => (<FormItem><FormLabel>CGPA</FormLabel><FormControl><Input type="number" step="0.01" placeholder="Enter CGPA" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        </div>
                        <FormField control={control} name={`educationDetails.${index}.instituteName`} render={({ field }) => (<FormItem><FormLabel>Institute Name*</FormLabel><FormControl><Input placeholder="Enter Institute Name" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <div className="flex items-center space-x-4">
                            <FormField control={control} name={`educationDetails.${index}.foreignDegree`} render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Foreign Degree</FormLabel></FormItem>)}/>
                            <FormField control={control} name={`educationDetails.${index}.professional`} render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Professional</FormLabel></FormItem>)}/>
                            <FormField control={control} name={`educationDetails.${index}.lastEducation`} render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Last Education</FormLabel></FormItem>)}/>
                        </div>
                        {fields.length > 1 && <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => append({ education: 'Bachelors', gradeDivision: 'A', passedYear: '', instituteName: '' })}>
                    <PlusCircle className="mr-2 h-4 w-4"/> Add Education
                </Button>

                 <div className="rounded-md border mt-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Education</TableHead>
                                <TableHead>Passed Year</TableHead>
                                <TableHead>Grade</TableHead>
                                <TableHead>Institute Name</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.length > 0 ? (
                                fields.map((field, index) => (
                                    <TableRow key={field.id}>
                                        <TableCell>{watch(`educationDetails.${index}.education`)}</TableCell>
                                        <TableCell>{watch(`educationDetails.${index}.passedYear`)}</TableCell>
                                        <TableCell>{watch(`educationDetails.${index}.gradeDivision`)}</TableCell>
                                        <TableCell>{watch(`educationDetails.${index}.instituteName`)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground">No education details added.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>

        <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving Employee...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Employee
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
