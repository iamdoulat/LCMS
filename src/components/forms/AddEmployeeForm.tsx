
"use client";

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, UserPlus, Save, History, Building, GraduationCap, PlusCircle, Trash2, Banknote, DollarSign } from 'lucide-react';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { EmployeeFormValues, Education, BankDetails, SalaryBreakup } from '@/types';
import { EmployeeSchema, genderOptions, maritalStatusOptions, bloodGroupOptions, employeeStatusOptions, jobBaseOptions, jobStatusOptions, educationLevelOptions, gradeDivisionOptions, bankNameOptions, paymentFrequencyOptions, salaryBreakupOptions } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from './DatePickerField';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

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
      bankDetails: [],
      salaryStructure: {
        isConsolidate: false,
        paymentType: 'Bank',
        structureDate: new Date(),
        paymentFrequency: 'Monthly',
        salaryBreakup: [],
      },
    },
  });

  const { control, handleSubmit, reset, watch, setValue } = form;

  const { fields: eduFields, append: appendEdu, remove: removeEdu } = useFieldArray({
    control,
    name: "educationDetails",
  });
  
  const { fields: bankFields, append: appendBank, remove: removeBank } = useFieldArray({
    control,
    name: "bankDetails",
  });
  
  const { fields: salaryFields, append: appendSalary, remove: removeSalary } = useFieldArray({
    control,
    name: "salaryStructure.salaryBreakup",
  });

  const watchSameAsPresent = watch("sameAsPresentAddress");
  const watchPresentAddress = watch("presentAddress");
  const watchSalaryBreakup = watch("salaryStructure.salaryBreakup");

  const { salaryAmount, increasedAmount, totalAmount } = React.useMemo(() => {
    let salary = 0;
    let increased = 0;
    watchSalaryBreakup?.forEach(item => {
      salary += Number(item.amount || 0);
      increased += Number(item.increaseAmount || 0);
    });
    return { salaryAmount: salary, increasedAmount: increased, totalAmount: salary + increased };
  }, [watchSalaryBreakup]);


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
      salaryStructure: data.salaryStructure ? {
        ...data.salaryStructure,
        structureDate: data.salaryStructure.structureDate ? data.salaryStructure.structureDate.toISOString() : null,
      } : undefined,
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
        
        <FormField control={control} name="status" render={({ field }) => (
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                {eduFields.map((field, index) => (
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
                        {eduFields.length > 1 && <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => removeEdu(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => appendEdu({ education: 'Bachelors', gradeDivision: 'A', passedYear: '', instituteName: '' })}>
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
                            {eduFields.length > 0 ? (
                                eduFields.map((field, index) => (
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
        
        <Separator />
        
        <Card className="p-4">
            <CardHeader className="p-2 pt-0">
                <CardTitle className="text-lg flex items-center gap-2"><Banknote className="h-5 w-5 text-primary"/>Bank Account Information</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-4">
                 {bankFields.map((field, index) => (
                    <div key={field.id} className="p-4 border rounded-lg space-y-4 relative">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField control={control} name={`bankDetails.${index}.bankName`} render={({ field }) => (<FormItem><FormLabel>Bank*</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Bank" /></SelectTrigger></FormControl><SelectContent>{bankNameOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                            <FormField control={control} name={`bankDetails.${index}.accountNo`} render={({ field }) => (<FormItem><FormLabel>Account No*</FormLabel><FormControl><Input placeholder="Enter Number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={control} name={`bankDetails.${index}.accountRoutingNo`} render={({ field }) => (<FormItem><FormLabel>Account Routing No</FormLabel><FormControl><Input placeholder="Enter Number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={control} name={`bankDetails.${index}.accountName`} render={({ field }) => (<FormItem><FormLabel>Account Name*</FormLabel><FormControl><Input placeholder="Enter Name" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                          <FormField control={control} name={`bankDetails.${index}.remarks`} render={({ field }) => (<FormItem><FormLabel>Remarks</FormLabel><FormControl><Input placeholder="Enter Remarks" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        </div>
                        {bankFields.length > 1 && <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => removeBank(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                 ))}
                <Button type="button" variant="outline" size="sm" onClick={() => appendBank({ bankName: 'AB Bank', accountNo: '', accountName: '' })}>
                    <PlusCircle className="mr-2 h-4 w-4"/> Add Bank Account
                </Button>
                <div className="rounded-md border mt-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Bank Name</TableHead>
                                <TableHead>Account No</TableHead>
                                <TableHead>Account Routing No</TableHead>
                                <TableHead>Account Name</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {bankFields.length > 0 ? (
                                bankFields.map((field, index) => (
                                    <TableRow key={field.id}>
                                        <TableCell>{watch(`bankDetails.${index}.bankName`)}</TableCell>
                                        <TableCell>{watch(`bankDetails.${index}.accountNo`)}</TableCell>
                                        <TableCell>{watch(`bankDetails.${index}.accountRoutingNo`)}</TableCell>
                                        <TableCell>{watch(`bankDetails.${index}.accountName`)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground">No bank details added.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
        <Separator />
        
        <Card className="p-4">
            <CardHeader className="p-2 pt-0">
                <CardTitle className="text-lg flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary"/>Salary Structure</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
                    <FormField control={control} name="salaryStructure.isConsolidate" render={({ field }) => (
                         <FormItem>
                            <FormLabel>Is Consolidate*</FormLabel>
                            <FormControl>
                                 <RadioGroup onValueChange={(val) => field.onChange(val === 'true')} value={String(field.value)} className="flex items-center space-x-4 pt-2">
                                   <div className="flex items-center space-x-2"><RadioGroupItem value="true" id="isConsolidateYes" /><Label htmlFor="isConsolidateYes">Yes</Label></div>
                                   <div className="flex items-center space-x-2"><RadioGroupItem value="false" id="isConsolidateNo" /><Label htmlFor="isConsolidateNo">No</Label></div>
                                 </RadioGroup>
                            </FormControl>
                            <FormMessage />
                         </FormItem>
                    )}/>
                    <FormField control={control} name="salaryStructure.paymentType" render={({ field }) => (
                         <FormItem>
                            <FormLabel>Payment Type*</FormLabel>
                            <FormControl>
                                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex items-center space-x-4 pt-2">
                                  <div className="flex items-center space-x-2"><RadioGroupItem value="Bank" id="paymentTypeBank" /><Label htmlFor="paymentTypeBank">Bank</Label></div>
                                  <div className="flex items-center space-x-2"><RadioGroupItem value="Cash" id="paymentTypeCash" /><Label htmlFor="paymentTypeCash">Cash</Label></div>
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                         </FormItem>
                    )}/>
                    <FormField control={control} name="salaryStructure.structureDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Structure Date*</FormLabel><DatePickerField field={field} placeholder="Select date" /><FormMessage /></FormItem>)}/>
                    <FormField control={control} name="salaryStructure.paymentFrequency" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Frequency*</FormLabel>
                          <div>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select frequency" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {paymentFrequencyOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </div>
                        </FormItem>
                    )}/>
                </div>
                <Separator />
                <FormItem>
                   <div>
                    <Label>Add Salary Breakup*</Label>
                    <Select onValueChange={(value) => { if (value && !salaryFields.some(f => f.breakupName === value)) { appendSalary({ breakupName: value, amount: 0, increaseAmount: 0 }); }}}>
                        <SelectTrigger><SelectValue placeholder="Select Salary Breakup to Add" /></SelectTrigger>
                        <SelectContent>
                            {salaryBreakupOptions.map(opt => <SelectItem key={opt} value={opt} disabled={salaryFields.some(f => f.breakupName === opt)}>{opt}</SelectItem>)}
                        </SelectContent>
                    </Select>
                   </div>
                </FormItem>
                <div className="space-y-3">
                    {salaryFields.map((field, index) => (
                        <div key={field.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-center">
                            <FormField control={control} name={`salaryStructure.salaryBreakup.${index}.breakupName`} render={({ field }) => (<FormItem><FormLabel className="sr-only">Breakup Name</FormLabel><FormControl><Input readOnly disabled {...field} className="bg-muted/50 font-semibold" /></FormControl></FormItem>)}/>
                            <FormField control={control} name={`salaryStructure.salaryBreakup.${index}.amount`} render={({ field }) => (<FormItem><FormLabel className="sr-only">Amount</FormLabel><FormControl><Input type="number" placeholder="Amount" {...field} /></FormControl></FormItem>)}/>
                            <FormField control={control} name={`salaryStructure.salaryBreakup.${index}.increaseAmount`} render={({ field }) => (<FormItem><FormLabel className="sr-only">Increase Amount</FormLabel><FormControl><Input type="number" placeholder="Increase Amount" {...field} /></FormControl></FormItem>)}/>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeSalary(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                    ))}
                </div>
                 <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                        <Label>Salary Amount</Label>
                        <Input value={salaryAmount.toFixed(2)} readOnly disabled />
                    </div>
                    <div className="flex items-center gap-2">
                        <Label>Increased Amount</Label>
                        <Input value={increasedAmount.toFixed(2)} readOnly disabled />
                    </div>
                     <div className="flex items-center gap-2">
                        <Label>Total Amount</Label>
                        <Input value={totalAmount.toFixed(2)} readOnly disabled className="font-bold text-primary" />
                    </div>
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
