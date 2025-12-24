
"use client";

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, UserPlus, Save, History, Building, GraduationCap, PlusCircle, Trash2, Banknote, DollarSign, Upload, Crop as CropIcon, Image as ImageIcon } from 'lucide-react';
import Swal from 'sweetalert2';
import { firestore, storage } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, getDocs, query as firestoreQuery, orderBy, setDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { EmployeeFormValues, EmployeeDocument, Education, BankDetails, SalaryBreakup, DesignationDocument, BranchDocument, DepartmentDocument, UnitDocument, DivisionDocument, LeaveGroupDocument } from '@/types';
import { EmployeeSchema, genderOptions, maritalStatusOptions, bloodGroupOptions, employeeStatusOptions, jobBaseOptions, jobStatusOptions, educationLevelOptions, gradeDivisionOptions, bankNameOptions, paymentFrequencyOptions, salaryBreakupOptions } from '@/types';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';


import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
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
import type { ComboboxOption } from '@/components/ui/combobox';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { getCroppedImg } from '@/lib/image-utils';
import { useAuth } from '@/context/AuthContext';


// Helper to transform Firestore documents into Combobox options
const toComboboxOptions = (data: any[], labelKey: string): ComboboxOption[] => {
  if (!data) return [];
  return data.map(doc => ({ value: doc.name, label: doc.name }));
};


export function AddEmployeeForm() {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // States for image cropping
  const [imgSrc, setImgSrc] = React.useState('');
  const [crop, setCrop] = React.useState<Crop>();
  const [completedCrop, setCompletedCrop] = React.useState<PixelCrop>();
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isCroppingDialogOpen, setIsCroppingDialogOpen] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const [externalUrl, setExternalUrl] = React.useState('');
  const [isUploading, setIsUploading] = React.useState(false);


  // Use the hook to fetch data
  const { data: designations, isLoading: isLoadingDesignations } = useFirestoreQuery<DesignationDocument[]>(firestoreQuery(collection(firestore, "designations"), orderBy("name")), undefined, ['designations']);
  const { data: branches, isLoading: isLoadingBranches } = useFirestoreQuery<BranchDocument[]>(firestoreQuery(collection(firestore, "branches"), orderBy("name")), undefined, ['branches']);
  const { data: departments, isLoading: isLoadingDepts } = useFirestoreQuery<DepartmentDocument[]>(firestoreQuery(collection(firestore, "departments"), orderBy("name")), undefined, ['departments']);
  const { data: units, isLoading: isLoadingUnits } = useFirestoreQuery<UnitDocument[]>(firestoreQuery(collection(firestore, "units"), orderBy("name")), undefined, ['units']);
  const { data: divisions, isLoading: isLoadingDivisions } = useFirestoreQuery<DivisionDocument[]>(firestoreQuery(collection(firestore, "divisions"), orderBy("name")), undefined, ['divisions']);
  const { data: leaveGroups, isLoading: isLoadingLeaveGroups } = useFirestoreQuery<LeaveGroupDocument[]>(firestoreQuery(collection(firestore, 'hrm_settings', 'leave_groups', 'items'), orderBy("groupName", "asc")), undefined, ['leave_groups']);
  const { data: employees, isLoading: isLoadingEmployees } = useFirestoreQuery<EmployeeDocument[]>(firestoreQuery(collection(firestore, "employees"), orderBy("employeeCode", "asc")), undefined, ['employees_list']);

  // ... (keeping existing memoized options) ...
  const designationOptions = React.useMemo(() => toComboboxOptions(designations || [], 'name'), [designations]);
  const branchOptions = React.useMemo(() => toComboboxOptions(branches || [], 'name'), [branches]);
  const departmentOptions = React.useMemo(() => toComboboxOptions(departments || [], 'name'), [departments]);
  const unitOptions = React.useMemo(() => toComboboxOptions(units || [], 'name'), [units]);
  const divisionOptions = React.useMemo(() => toComboboxOptions(divisions || [], 'name'), [divisions]);
  const leaveGroupOptions = React.useMemo(() => leaveGroups?.map(g => ({ value: g.id, label: g.groupName })) || [], [leaveGroups]);
  const supervisorOptions = React.useMemo(() => employees?.map(e => ({ value: e.id, label: `${e.fullName} (${e.employeeCode})` })) || [], [employees]);

  const isLoadingHrmOptions = isLoadingBranches || isLoadingDepts || isLoadingUnits || isLoadingDivisions;


  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(EmployeeSchema),
    // ... (rest of default values)
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
      supervisorId: '',
      leaveGroupId: '',
      division: 'Not Defined',
      branch: 'Not Defined',
      department: 'Not Defined',
      unit: 'Not Defined',
      remarksDivision: '',
      jobStatus: 'Active',
      jobStatusEffectiveDate: undefined,
      remarksJobBase: '',
      jobBase: 'Permanent',
      jobBaseEffectiveDate: undefined,
      educationDetails: [],
      presentAddress: { address: '', country: 'Bangladesh', state: '', city: '', zipCode: '' },
      permanentAddress: { address: '', country: 'Bangladesh', state: '', city: '', zipCode: '' },
      sameAsPresentAddress: false,
      salaryStructure: {
        isConsolidate: false,
        paymentType: 'Bank',
        structureDate: undefined,
        paymentFrequency: 'Monthly',
        salaryBreakup: [],
      },
    },
  });

  React.useEffect(() => {
    // Set default dates on the client side to prevent hydration mismatch
    const currentValues = form.getValues();
    if (!currentValues.jobBaseEffectiveDate && !currentValues.salaryStructure?.structureDate) {
      form.reset({
        ...currentValues,
        jobBaseEffectiveDate: new Date(),
        salaryStructure: {
          ...currentValues.salaryStructure,
          structureDate: new Date()
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


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

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined); // Reset crop state
      const file = e.target.files[0];
      setSelectedFile(file); // Store the original file
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImgSrc(reader.result?.toString() || '');
        setIsCroppingDialogOpen(true);
      });
      reader.readAsDataURL(file);
      e.target.value = ''; // Reset file input
    }
  };

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const crop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, 1, width, height),
      width, height
    );
    setCrop(crop);
  }

  const handleSetCroppedImage = async () => {
    const image = imgRef.current;
    if (!completedCrop || !image || !selectedFile) {
      Swal.fire("Error", "Could not process image crop. Please select and crop an image.", "error");
      return;
    }
    setIsUploading(true);
    const croppedImageBlob = await getCroppedImg(image, completedCrop, selectedFile.name, 256, 256);
    if (croppedImageBlob) {
      const tempUrl = URL.createObjectURL(croppedImageBlob);
      setPhotoPreview(tempUrl); // Set a temporary URL for preview
      setSelectedFile(croppedImageBlob); // Replace the original file with the cropped blob
      setIsCroppingDialogOpen(false);
      setIsUploading(false);
      Swal.fire("Photo Staged", "New photo is ready. Click 'Save Employee' to upload it.", "info");
    } else {
      setIsUploading(false);
      Swal.fire("Error", "Failed to create cropped image.", "error");
    }
  };


  async function onSubmit(data: EmployeeFormValues) {
    if (!user?.uid) {
      Swal.fire("Authentication Error", "Cannot create employee without a logged-in user.", "error");
      return;
    }
    setIsSubmitting(true);

    try {
      let photoDownloadURL: string | null = null;

      // Process image upload first (client-side)
      if (selectedFile) {
        // We need an ID for the image path. Since we don't have the UID yet (server generates it), 
        // we can use a temporary ID or a timestamp-based ID for storage, 
        // OR better, we can let the server handle image? No, client upload is standard for Firebase.
        // Let's use a random ID for the storage path to avoid collisions before we have the UID.
        // Or we can assume the server cleans it up? 
        // Let's us a temporary random string for the path.
        const tempId = Math.random().toString(36).substring(2, 15);
        const photoRef = ref(storage, `employeeImages/${tempId}/profile.jpg`);
        await uploadBytes(photoRef, selectedFile);
        photoDownloadURL = await getDownloadURL(photoRef);
      } else if (externalUrl) {
        photoDownloadURL = externalUrl;
      }

      const selectedLeaveGroup = leaveGroups?.find(lg => lg.id === data.leaveGroupId);

      const fullName = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ');

      const apiPayload = {
        ...data,
        leaveGroupName: selectedLeaveGroup?.groupName || '',
        fullName,
        photoURL: photoDownloadURL,
        // Convert dates to ISO strings for JSON transport
        dateOfBirth: data.dateOfBirth ? data.dateOfBirth.toISOString() : null,
        joinedDate: data.joinedDate ? data.joinedDate.toISOString() : null,
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
          totalSalary: salaryAmount,
          totalIncrement: increasedAmount,
          grossSalary: totalAmount,
        } : undefined,
      };

      // Call API
      const response = await fetch('/api/employees/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiPayload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create employee');
      }

      let successMessage = `Employee ${fullName} has been successfully added.`;
      if (result.emailStatus && result.emailStatus.includes('failed')) {
        successMessage += ` (Note: Welcome email failed to send: ${result.emailStatus})`;
      } else {
        successMessage += ` Welcome email sent.`;
      }

      Swal.fire({
        title: "Employee Added!",
        text: successMessage,
        icon: "success",
        timer: 1000,
        showConfirmButton: true,
      });

      form.reset();
      setSelectedFile(null);
      setPhotoPreview(null);
      setImgSrc('');
      setExternalUrl('');
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
          <div className="w-32 h-40 rounded-md border-2 border-dashed flex items-center justify-center bg-muted/50 overflow-hidden relative">
            <Image
              src={photoPreview || externalUrl || "https://placehold.co/128x160/e2e8f0/e2e8f0"}
              width={128}
              height={160}
              alt="Profile image placeholder"
              data-ai-hint="employee photo placeholder"
              className="object-cover w-full h-full"
            />
          </div>
          <div className="flex-1 space-y-6">
            <FormItem>
              <FormLabel>Photo</FormLabel>
              <FormControl>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input type="file" accept="image/png, image/jpeg" onChange={onFileSelect} className="w-full" />
                    <Button type="button" onClick={() => { setSelectedFile(null); setPhotoPreview(null); }} variant="outline" size="icon" title="Clear Photo">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Or External URL:</span>
                    <Input
                      placeholder="https://example.com/photo.jpg"
                      value={externalUrl}
                      onChange={(e) => setExternalUrl(e.target.value)}
                    />
                  </div>
                </div>
              </FormControl>
              <FormDescription>Upload a photo or provide an external image URL. Uploaded file takes precedence.</FormDescription>
              <FormMessage />
            </FormItem>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name*</FormLabel><FormControl><Input placeholder="Your name" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="middleName" render={({ field }) => (<FormItem><FormLabel>Middle Name</FormLabel><FormControl><Input placeholder="Enter here" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last Name*</FormLabel><FormControl><Input placeholder="Last name" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
          </div>
        </div>

        <Dialog open={isCroppingDialogOpen} onOpenChange={setIsCroppingDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Crop Your Image</DialogTitle></DialogHeader>
            {imgSrc && (
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                circularCrop
                minWidth={100}
              >
                <img ref={imgRef} src={imgSrc} alt="Crop preview" onLoad={onImageLoad} style={{ maxHeight: '70vh' }} />
              </ReactCrop>
            )}
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" disabled={isUploading}>Cancel</Button></DialogClose>
              <Button onClick={handleSetCroppedImage} disabled={isUploading || !completedCrop?.width}>
                {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : <><CropIcon className="mr-2 h-4 w-4" />Set Photo</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField control={control} name="gender" render={({ field }) => (<FormItem><FormLabel>Gender*</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl><SelectContent>{genderOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
          <FormField control={control} name="joinedDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Joined Date* (mm/dd/yyyy)</FormLabel><DatePickerField field={field} placeholder="Select join date" /><FormMessage /></FormItem>)} />
          <FormField control={control} name="dateOfBirth" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Date of Birth* (mm/dd/yyyy)</FormLabel><DatePickerField field={field} placeholder="Select birth date" /><FormMessage /></FormItem>)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField control={control} name="nationalId" render={({ field }) => (<FormItem><FormLabel>NID/SSN</FormLabel><FormControl><Input placeholder="Enter here" {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={control} name="nationality" render={({ field }) => (<FormItem><FormLabel>Nationality</FormLabel><FormControl><Input placeholder="Bangladeshi" {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={control} name="email" render={({ field }) => (<FormItem><FormLabel>Email*</FormLabel><FormControl><Input type="email" placeholder="smartsollutions21@gmail.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField control={control} name="maritalStatus" render={({ field }) => (<FormItem><FormLabel>Marital Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl><SelectContent>{maritalStatusOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
          <FormField control={control} name="bloodGroup" render={({ field }) => (<FormItem><FormLabel>Blood Group</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger></FormControl><SelectContent>{bloodGroupOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
          <FormField control={control} name="religion" render={({ field }) => (<FormItem><FormLabel>Religion</FormLabel><FormControl><Input placeholder="Islam" {...field} /></FormControl><FormMessage /></FormItem>)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField control={control} name="employeeCode" render={({ field }) => (<FormItem><FormLabel>Employee Code*</FormLabel><FormControl><Input placeholder="Enter employee code" {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField
            control={control}
            name="designation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Designation*</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingDesignations ? "Loading..." : "Select designation"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Not Defined">Not Defined</SelectItem>
                    {designationOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField control={control} name="phone" render={({ field }) => (<FormItem><FormLabel>Mobile No*</FormLabel><FormControl><Input type="tel" placeholder="Enter mobile number" {...field} /></FormControl><FormMessage /></FormItem>)} />
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
        )} />



        <FormField control={control} name="supervisorId" render={({ field }) => (
          <FormItem>
            <FormLabel>Direct Supervisor</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingEmployees ? "Loading..." : "Select Supervisor"} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {supervisorOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={control} name="leaveGroupId" render={({ field }) => (
          <FormItem>
            <FormLabel>Leave Group (Policy)*</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingLeaveGroups ? "Loading..." : "Select Leave Group"} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {leaveGroupOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-4">
            <CardHeader className="p-2 pt-0">
              <CardTitle className="text-lg flex items-center gap-2"><Building className="h-5 w-5 text-primary" />Division, Department...</CardTitle>
              <CardDescription className="text-xs">Setup division, branch etc.</CardDescription>
            </CardHeader>
            <CardContent className="p-2 space-y-4">
              <FormField control={control} name="division" render={({ field }) => (<FormItem><FormLabel>Division*</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Division" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Not Defined">Not Defined</SelectItem>{divisionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={control} name="branch" render={({ field }) => (<FormItem><FormLabel>Branch*</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoadingHrmOptions}><FormControl><SelectTrigger><SelectValue placeholder={isLoadingHrmOptions ? "Loading..." : "Select Branch"} /></SelectTrigger></FormControl><SelectContent><SelectItem value="Not Defined">Not Defined</SelectItem>{branchOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={control} name="department" render={({ field }) => (<FormItem><FormLabel>Department*</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoadingHrmOptions}><FormControl><SelectTrigger><SelectValue placeholder={isLoadingHrmOptions ? "Loading..." : "Select Department"} /></SelectTrigger></FormControl><SelectContent><SelectItem value="Not Defined">Not Defined</SelectItem>{departmentOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={control} name="unit" render={({ field }) => (<FormItem><FormLabel>Unit*</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoadingHrmOptions}><FormControl><SelectTrigger><SelectValue placeholder={isLoadingHrmOptions ? "Loading..." : "Select Unit"} /></SelectTrigger></FormControl><SelectContent><SelectItem value="Not Defined">Not Defined</SelectItem>{unitOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={control} name="remarksDivision" render={({ field }) => (<FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea placeholder="Enter Here" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </CardContent>
          </Card>

          <Card className="p-4">
            <CardHeader className="p-2 pt-0">
              <CardTitle className="text-lg flex items-center gap-2"><History className="h-5 w-5 text-primary" />Job Base Setup</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-4">
              <FormField control={control} name="jobBase" render={({ field }) => (<FormItem><FormLabel>Job Base*</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Base" /></SelectTrigger></FormControl><SelectContent>{jobBaseOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={control} name="jobBaseEffectiveDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Job Base Effective Date*</FormLabel><DatePickerField field={field} placeholder="Select date" /><FormMessage /></FormItem>)} />
              <FormField control={control} name="remarksJobBase" render={({ field }) => (<FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea placeholder="Enter Here" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </CardContent>
          </Card>
        </div>

        <Separator />

        <Card className="p-4">
          <CardHeader className="p-2 pt-0">
            <CardTitle className="text-lg flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary" />Education Information</CardTitle>
          </CardHeader>
          <CardContent className="p-2 space-y-4">
            {eduFields.map((field, index) => (
              <div key={field.id} className="p-4 border rounded-lg space-y-4 relative">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <FormField control={control} name={`educationDetails.${index}.education`} render={({ field }) => (<FormItem><FormLabel>Education*</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Education" /></SelectTrigger></FormControl><SelectContent>{educationLevelOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={control} name={`educationDetails.${index}.gradeDivision`} render={({ field }) => (<FormItem><FormLabel>Grade/Division</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Grade" /></SelectTrigger></FormControl><SelectContent>{gradeDivisionOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={control} name={`educationDetails.${index}.passedYear`} render={({ field }) => (<FormItem><FormLabel>Passed Year*</FormLabel><FormControl><Input placeholder="YYYY" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name={`educationDetails.${index}.scale`} render={({ field }) => (<FormItem><FormLabel>Scale</FormLabel><FormControl><Input type="number" placeholder="4" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name={`educationDetails.${index}.cgpa`} render={({ field }) => (<FormItem><FormLabel>CGPA</FormLabel><FormControl><Input type="number" step="0.01" placeholder="Enter CGPA" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <FormField control={control} name={`educationDetails.${index}.instituteName`} render={({ field }) => (<FormItem><FormLabel>Institute Name*</FormLabel><FormControl><Input placeholder="Enter Institute Name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="flex items-center space-x-4">
                  <FormField control={control} name={`educationDetails.${index}.foreignDegree`} render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Foreign Degree</FormLabel></FormItem>)} />
                  <FormField control={control} name={`educationDetails.${index}.professional`} render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Professional</FormLabel></FormItem>)} />
                  <FormField control={control} name={`educationDetails.${index}.lastEducation`} render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Last Education</FormLabel></FormItem>)} />
                </div>
                {eduFields.length > 1 && <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => removeEdu(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => appendEdu({ education: 'Bachelors', gradeDivision: 'A', passedYear: '', instituteName: '' })}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Education
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
            <CardTitle className="text-lg flex items-center gap-2"><Banknote className="h-5 w-5 text-primary" />Bank Account Information</CardTitle>
          </CardHeader>
          <CardContent className="p-2 space-y-4">
            {bankFields.map((field, index) => (
              <div key={field.id} className="p-4 border rounded-lg space-y-4 relative">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={control} name={`bankDetails.${index}.bankName`} render={({ field }) => (<FormItem><FormLabel>Bank*</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Bank" /></SelectTrigger></FormControl><SelectContent>{bankNameOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={control} name={`bankDetails.${index}.accountNo`} render={({ field }) => (<FormItem><FormLabel>Account No*</FormLabel><FormControl><Input placeholder="Enter Number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name={`bankDetails.${index}.accountRoutingNo`} render={({ field }) => (<FormItem><FormLabel>Account Routing No</FormLabel><FormControl><Input placeholder="Enter Number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FormField control={control} name={`bankDetails.${index}.accountName`} render={({ field }) => (<FormItem><FormLabel>Account Name*</FormLabel><FormControl><Input placeholder="Enter Name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name={`bankDetails.${index}.branchName`} render={({ field }) => (<FormItem><FormLabel>Branch Name</FormLabel><FormControl><Input placeholder="Enter Branch Name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name={`bankDetails.${index}.remarks`} render={({ field }) => (<FormItem><FormLabel>Remarks</FormLabel><FormControl><Input placeholder="Enter Remarks" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                {bankFields.length > 1 && <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => removeBank(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => appendBank({ bankName: 'AB Bank', accountNo: '', accountName: '', branchName: '' })}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Bank Account
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
            <CardTitle className="text-lg flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" />Salary Structure</CardTitle>
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
              )} />
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
              )} />
              <FormField control={control} name="salaryStructure.structureDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Structure Date*</FormLabel><DatePickerField field={field} placeholder="Select date" /><FormMessage /></FormItem>)} />
              <FormField control={control} name="salaryStructure.paymentFrequency" render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Frequency*</FormLabel>
                  <div>
                    <Select onValueChange={field.onChange} value={field.value}>
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
              )} />
            </div>
            <Separator />
            <FormItem>
              <div>
                <Label>Add Salary Breakup*</Label>
                <Select onValueChange={(value) => { if (value && !salaryFields.some(f => f.breakupName === value)) { appendSalary({ breakupName: value, amount: 0, increaseAmount: 0 }); } }}>
                  <SelectTrigger><SelectValue placeholder="Select Salary Breakup to Add" /></SelectTrigger>
                  <SelectContent>
                    {salaryBreakupOptions.map(opt => <SelectItem key={opt} value={opt} disabled={salaryFields.some(f => f.breakupName === opt)}>{opt}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </FormItem>
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-center mb-2">
                <Label className="text-sm font-medium">Salary Breakup</Label>
                <Label className="text-sm font-medium">Salary Amount</Label>
                <Label className="text-sm font-medium">Increment Amount</Label>
                <div className="w-8"></div>
              </div>
              {salaryFields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-center">
                  <FormField control={control} name={`salaryStructure.salaryBreakup.${index}.breakupName`} render={({ field }) => (<FormItem><FormLabel className="sr-only">Breakup Name</FormLabel><FormControl><Input readOnly disabled {...field} className="bg-muted/50 font-semibold" /></FormControl></FormItem>)} />
                  <FormField control={control} name={`salaryStructure.salaryBreakup.${index}.amount`} render={({ field }) => (<FormItem><FormLabel className="sr-only">Amount</FormLabel><FormControl><Input type="number" placeholder="Amount" {...field} /></FormControl></FormItem>)} />
                  <FormField control={control} name={`salaryStructure.salaryBreakup.${index}.increaseAmount`} render={({ field }) => (<FormItem><FormLabel className="sr-only">Increase Amount</FormLabel><FormControl><Input type="number" placeholder="Increase Amount" {...field} /></FormControl></FormItem>)} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeSalary(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </div>
            <div className="rounded-md border mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Salary Amount</TableHead>
                    <TableHead>Increased Amount</TableHead>
                    <TableHead>Gross Salary Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>{salaryAmount.toFixed(2)}</TableCell>
                    <TableCell>{increasedAmount.toFixed(2)}</TableCell>
                    <TableCell className="font-bold text-primary">{totalAmount.toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>


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










