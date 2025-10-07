
"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfile } from 'firebase/auth';
import { Loader2, UserCircle, Save, ShieldAlert, Image as ImageIcon, Link2, Upload, Crop as CropIcon, Building, Briefcase, Info, Banknote, GraduationCap, DollarSign, Clock, Check, MapPin, CalendarDays, UserCheck, RefreshCw } from 'lucide-react';
import React, { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Swal from 'sweetalert2';
import Image from 'next/image';
import { doc, updateDoc, serverTimestamp, getDocs, query, where, collection, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { auth, firestore, storage } from '@/lib/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { getCroppedImg } from '@/lib/image-utils';
import type { EmployeeDocument, AttendanceDocument } from '@/types';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const accountDetailsSchema = z.object({
  displayName: z.string().min(1, "Display name cannot be empty.").max(50, "Display name is too long."),
});

type AccountDetailsFormValues = z.infer<typeof accountDetailsSchema>;

const formatDisplayDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return format(date, 'PPP');
    } catch (error) {
        return 'Invalid Date';
    }
};

const formatCurrency = (value?: number) => {
  if (typeof value !== 'number' || isNaN(value)) return 'N/A';
  return `BDT ${value.toLocaleString()}`;
};


export default function AccountDetailsPage() {
  const { user, loading: authLoading, setUser: setAuthUser, userRole } = useAuth();
  const [employeeData, setEmployeeData] = useState<EmployeeDocument | null>(null);
  const [isEmployeeDataLoading, setIsEmployeeDataLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCroppingDialogOpen, setIsCroppingDialogOpen] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [dailyAttendance, setDailyAttendance] = useState<AttendanceDocument | null>(null);


  const form = useForm<AccountDetailsFormValues>({
    resolver: zodResolver(accountDetailsSchema),
    defaultValues: { displayName: '' },
  });

  useEffect(() => {
    if (user && employeeData) {
      const formattedDate = format(new Date(), 'yyyy-MM-dd');
      const attendanceDocId = `${employeeData.id}_${formattedDate}`;
      const docRef = doc(firestore, 'attendance', attendanceDocId);

      getDoc(docRef).then(docSnap => {
        if (docSnap.exists()) {
          setDailyAttendance(docSnap.data() as AttendanceDocument);
        } else {
          setDailyAttendance(null);
        }
      });
    }
  }, [user, employeeData]);


  useEffect(() => {
    if (user) {
      form.reset({ displayName: user.displayName || '' });
      
      const fetchEmployeeData = async () => {
        if (!user.email) {
            setIsEmployeeDataLoading(false);
            return;
        };
        setIsEmployeeDataLoading(true);
        try {
            const q = query(collection(firestore, 'employees'), where('email', '==', user.email));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const employeeDoc = querySnapshot.docs[0];
                setEmployeeData({ id: employeeDoc.id, ...employeeDoc.data() } as EmployeeDocument);
            }
        } catch (err) {
            console.error("Error fetching employee data:", err);
            setError("Could not load detailed employee profile.");
        } finally {
            setIsEmployeeDataLoading(false);
        }
      };
      
      fetchEmployeeData();
    }
  }, [user, form]);
  
  const handleAttendance = async (type: 'in' | 'out') => {
    if (!user || !employeeData) {
      Swal.fire("Error", "User or employee data not available.", "error");
      return;
    }

    setAttendanceLoading(true);

    if (!navigator.geolocation) {
      Swal.fire("Geolocation Not Supported", "Your browser does not support geolocation.", "error");
      setAttendanceLoading(false);
      return;
    }

    const showLocationSwal = (latitude: number, longitude: number) => {
        const mapHtml = `
          <iframe
            id="swal-map-iframe"
            width="100%"
            height="250"
            style="border:0; border-radius: 8px; margin-bottom: 1rem;"
            loading="lazy"
            allowfullscreen
            src="https://maps.google.com/maps?q=${latitude},${longitude}&hl=es;z=14&amp;output=embed">
          </iframe>
        `;
        
        Swal.fire({
            title: `<div style="font-size: 1.1rem; display: flex; justify-content: space-between; align-items: center;">Enter ${type === 'in' ? 'In Time' : 'Out Time'} Remarks (Optional)<button id="refresh-location-btn" class="swal2-confirm swal2-styled" style="font-size: 0.8rem; padding: 0.4rem 0.6rem; margin: 0; min-width: auto; background: hsl(var(--secondary)) !important; color: hsl(var(--secondary-foreground)) !important;">Refresh Location</button></div>`,
            html: `${mapHtml}<textarea id="swal-textarea" class="swal2-textarea" placeholder="Type your remarks here..."></textarea>`,
            showCancelButton: true,
            confirmButtonText: 'Submit',
            customClass: { htmlContainer: 'p-0', title: 'w-full' },
            didOpen: () => {
                document.getElementById('refresh-location-btn')?.addEventListener('click', () => {
                    Swal.showLoading();
                    navigator.geolocation.getCurrentPosition(
                        (newPosition) => {
                            Swal.close();
                            showLocationSwal(newPosition.coords.latitude, newPosition.coords.longitude);
                        },
                        (error) => {
                           Swal.fire("Location Error", "Could not refresh location.", "error");
                        }
                    );
                });
            },
            preConfirm: () => {
              const textarea = document.getElementById('swal-textarea') as HTMLTextAreaElement;
              return { remarks: textarea.value || '', latitude, longitude };
            }
        }).then(async (result) => {
            if (!result.isConfirmed) {
                setAttendanceLoading(false);
                return;
            }

            const { remarks, latitude: finalLatitude, longitude: finalLongitude } = result.value;
            const locationData = { latitude: finalLatitude, longitude: finalLongitude };

            const now = new Date();
            const formattedDate = format(now, 'yyyy-MM-dd');
            const currentTime = format(now, 'hh:mm a');
            const docId = `${employeeData.id}_${formattedDate}`;
            const docRef = doc(firestore, 'attendance', docId);

            try {
                if (type === 'in') {
                    const flag = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 10) ? 'D' : 'P';
                    const dataToSet = {
                        employeeId: employeeData.id,
                        employeeName: employeeData.fullName,
                        date: format(now, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
                        flag: flag,
                        inTime: currentTime,
                        inTimeRemarks: remarks,
                        inTimeLocation: locationData,
                        updatedBy: user.uid,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    };
                    await setDoc(docRef, dataToSet, { merge: true });
                    setDailyAttendance(dataToSet as AttendanceDocument);
                    Swal.fire("Clocked In!", `Your arrival at ${currentTime} has been recorded.`, "success");
                } else {
                    const currentDoc = await getDoc(docRef);
                    if (!currentDoc.exists() || !currentDoc.data().inTime) {
                        Swal.fire("Cannot Clock Out", "You must clock in before you can clock out.", "warning");
                        setAttendanceLoading(false);
                        return;
                    }
                    const dataToSet = {
                        outTime: currentTime,
                        outTimeRemarks: remarks,
                        outTimeLocation: locationData,
                        updatedAt: serverTimestamp(),
                    };
                    await updateDoc(docRef, dataToSet);
                    setDailyAttendance(prev => prev ? { ...prev, ...dataToSet } as AttendanceDocument : null);
                    Swal.fire("Clocked Out!", `Your departure at ${currentTime} has been recorded.`, "success");
                }
            } catch (error: any) {
                console.error("Error updating attendance:", error);
                Swal.fire("Error", `Failed to record attendance: ${error.message}`, "error");
            } finally {
                setAttendanceLoading(false);
            }
        });
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        showLocationSwal(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        let errorMessage = "Could not get your location. ";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += "You denied the request for Geolocation.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage += "The request to get user location timed out.";
            break;
          default:
            errorMessage += "An unknown error occurred.";
            break;
        }
        Swal.fire("Location Error", errorMessage, "error");
        setAttendanceLoading(false);
      }
    );
  };
  
  const handleViewLocation = (location: { latitude: number; longitude: number } | undefined | null) => {
    if (location) {
      const url = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      Swal.fire('No Location', 'Location data is not available for this entry.', 'info');
    }
  };


  const getInitials = (nameOrEmail: string) => {
    if (!nameOrEmail) return 'U';
    const namePart = nameOrEmail.includes('@') ? nameOrEmail.split('@')[0] : nameOrEmail;
    return namePart
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };
  
  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined); // Reset crop state
      const file = e.target.files[0];
      setSelectedFile(file);
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

  const handleCropAndUpload = async () => {
    const image = imgRef.current;
    if (!completedCrop || !image || !selectedFile) {
      Swal.fire("Error", "Could not process the image crop.", "error");
      return;
    }

    if (completedCrop.width === 0 || completedCrop.height === 0) {
       Swal.fire("Error", "Invalid crop selection. Please try again.", "error");
       return;
    }

    setIsUploading(true);
    const croppedImageBlob = await getCroppedImg(image, completedCrop, selectedFile.name, 256, 256);

    if (!croppedImageBlob) {
        Swal.fire("Error", "Failed to create cropped image.", "error");
        setIsUploading(false);
        return;
    }

    try {
        const storageRef = ref(storage, `profileImages/${user!.uid}/profile.jpg`);
        const snapshot = await uploadBytes(storageRef, croppedImageBlob);
        const downloadURL = await getDownloadURL(snapshot.ref);

        await updateProfile(auth.currentUser!, { photoURL: downloadURL });

        if (auth.currentUser!.uid) {
            const userDocRef = doc(firestore, "users", auth.currentUser!.uid);
            await updateDoc(userDocRef, { photoURL: downloadURL, updatedAt: serverTimestamp() });
        }
        
        if (setAuthUser && auth.currentUser) {
            const refreshedUser = { ...auth.currentUser, photoURL: downloadURL };
            setAuthUser(refreshedUser);
        }

        setIsCroppingDialogOpen(false);
        Swal.fire({
            title: "Profile Picture Updated",
            icon: "success",
            timer: 2000,
            showConfirmButton: false,
        });

    } catch (err: any) {
        console.error("Error uploading profile picture:", err);
        Swal.fire("Upload Failed", `Failed to upload image: ${err.message}`, "error");
    } finally {
        setIsUploading(false);
    }
  };

  const onSubmitDisplayName = async (data: AccountDetailsFormValues) => {
    if (!auth.currentUser) {
      Swal.fire("Error", "No user logged in.", "error");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await updateProfile(auth.currentUser, { displayName: data.displayName });
      if (auth.currentUser.uid) {
        const userDocRef = doc(firestore, "users", auth.currentUser.uid);
        await updateDoc(userDocRef, { displayName: data.displayName, updatedAt: serverTimestamp() });
      }
      if (setAuthUser && auth.currentUser) {
        setAuthUser({ ...auth.currentUser, displayName: data.displayName });
      }
      Swal.fire({
        title: "Profile Updated",
        text: "Display name updated successfully.",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err: any) {
      setError(err.message);
      Swal.fire("Update Failed", err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderReadOnlyField = (label: string, value: string | number | null | undefined) => (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <Input value={value || 'N/A'} readOnly disabled className="cursor-not-allowed bg-muted/50" />
      </FormControl>
    </FormItem>
  );

  if (authLoading || isEmployeeDataLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
     return (
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <Card className="shadow-lg"><CardHeader><CardTitle>Account Details</CardTitle></CardHeader><CardContent><p>Please log in.</p></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="py-8 space-y-8 px-5">
      <Form {...form}>
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
              <UserCircle className="h-7 w-7 text-primary" />
              Account Settings
            </CardTitle>
            <CardDescription>
              Manage your display name and profile picture.
            </CardDescription>
          </CardHeader>
          <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-6">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>Update Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
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
                            <img ref={imgRef} src={imgSrc} alt="Crop preview" onLoad={onImageLoad} style={{ maxHeight: '70vh' }}/>
                        </ReactCrop>
                    )}
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline" disabled={isUploading}>Cancel</Button></DialogClose>
                        <Button onClick={handleCropAndUpload} disabled={isUploading || !completedCrop?.width}>
                            {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Uploading...</> : <><CropIcon className="mr-2 h-4 w-4" />Crop & Upload</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
              </Dialog>

              <form onSubmit={form.handleSubmit(onSubmitDisplayName)} className="space-y-6">
                 <div className="grid grid-cols-1 lg:grid-cols-4 gap-x-8 gap-y-6 items-center">
                    <div className="lg:col-span-1 flex items-center gap-4">
                       <Avatar className="h-24 w-24 border-2 border-primary shadow-md">
                          <AvatarImage src={user.photoURL || undefined} alt={user.displayName || "User Avatar"} />
                          <AvatarFallback className="text-3xl">
                            {getInitials(user.displayName || user.email || "U")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1 w-full">
                            <FormLabel htmlFor="profile-picture-upload" className="text-sm">Update Picture</FormLabel>
                            <Input id="profile-picture-upload" type="file" accept="image/png, image/jpeg" onChange={onFileSelect} className="w-full h-9 text-xs" />
                        </div>
                    </div>
                    
                    <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                        <FormField
                            control={form.control}
                            name="displayName"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Display Name</FormLabel>
                                <FormControl>
                                <Input placeholder="Your display name" {...field} />
                                </FormControl>
                                <FormDescription>This name will be displayed to others.</FormDescription>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                                <Input placeholder="your.email@example.com" value={user.email || ''} readOnly disabled className="cursor-not-allowed bg-muted/50" />
                            </FormControl>
                            <FormDescription>Your email address cannot be changed.</FormDescription>
                        </FormItem>
                    </div>

                    <div className="lg:col-span-1 flex flex-col gap-2 items-center border border-black p-4 rounded-lg">
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><UserCheck className="h-4 w-4 text-primary"/>Daily Attendance</h4>
                        <div className="flex items-center gap-4 justify-around w-full">
                            <div className="flex flex-col items-center gap-2">
                                <Button
                                    type="button"
                                    variant={dailyAttendance?.inTime ? 'default' : 'outline'}
                                    className={cn(
                                        "h-20 w-20 rounded-full flex flex-col items-center justify-center transition-all duration-300 ease-in-out font-bold",
                                        !dailyAttendance?.inTime && "bg-gradient-to-br from-blue-500 to-teal-500 text-white hover:opacity-90",
                                        dailyAttendance?.inTime && dailyAttendance.flag === 'P' && "bg-green-600 hover:bg-green-700 text-white",
                                        dailyAttendance?.inTime && dailyAttendance.flag === 'D' && "bg-red-600 hover:bg-red-700 text-white"
                                    )}
                                    onClick={() => handleAttendance('in')}
                                    disabled={attendanceLoading || !!dailyAttendance?.inTime}
                                    >
                                    {attendanceLoading && !dailyAttendance?.inTime ? <Loader2 className="h-5 w-5 animate-spin" /> : (dailyAttendance?.inTime ? <Check className="h-5 w-5" /> : <Clock className="h-5 w-5"/>)}
                                    <span className="text-xs mt-1">In Time</span>
                                    {dailyAttendance?.inTime && <span className="text-[10px] font-mono">({dailyAttendance.inTime})</span>}
                                </Button>
                                {dailyAttendance?.inTimeLocation && (
                                    <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full"
                                    onClick={() => handleViewLocation(dailyAttendance.inTimeLocation)}
                                    title="View In-Time Location"
                                    >
                                    <MapPin className="h-4 w-4 text-blue-500" />
                                    </Button>
                                )}
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className={cn(
                                        "h-20 w-20 rounded-full flex flex-col items-center justify-center transition-all duration-300 ease-in-out font-bold",
                                        !dailyAttendance?.outTime && !!dailyAttendance?.inTime && "bg-gradient-to-br from-orange-500 to-rose-500 text-white hover:opacity-90 hover:text-white"
                                    )}
                                    onClick={() => handleAttendance('out')}
                                    disabled={attendanceLoading || !dailyAttendance?.inTime || !!dailyAttendance?.outTime}
                                    >
                                    {attendanceLoading && !dailyAttendance?.outTime ? <Loader2 className="h-5 w-5 animate-spin" /> : (dailyAttendance?.outTime ? <Check className="h-5 w-5 text-green-500" /> : <Clock className="h-5 w-5"/>)}
                                    <span className="text-xs mt-1">Out Time</span>
                                    {dailyAttendance?.outTime && <span className="text-[10px] font-mono">({dailyAttendance.outTime})</span>}
                                </Button>
                                {dailyAttendance?.outTimeLocation && (
                                    <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full"
                                    onClick={() => handleViewLocation(dailyAttendance.outTimeLocation)}
                                    title="View Out-Time Location"
                                    >
                                    <MapPin className="h-4 w-4 text-orange-500" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-start pt-2">
                  <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                    {isSubmitting ? ( <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> ) : ( <><Save className="mr-2 h-4 w-4" />Save Name</>)}
                  </Button>
                </div>
              </form>
          </CardContent>
        </Card>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Info className="h-6 w-6 text-primary" />Personal Information</CardTitle>
            <CardDescription>Your personal details from your employee profile.</CardDescription>
          </CardHeader>
          <CardContent>
              {employeeData ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 text-sm">
                      {renderReadOnlyField("First Name*", employeeData.fullName?.split(' ')[0])}
                      {renderReadOnlyField("Last Name*", employeeData.fullName?.split(' ').slice(1).join(' '))}
                      {renderReadOnlyField("Gender*", employeeData.gender)}
                      {renderReadOnlyField("Date of Birth*", formatDisplayDate(employeeData.dateOfBirth))}
                      {renderReadOnlyField("NID/SSN", employeeData.nationalId)}
                      {renderReadOnlyField("Nationality", employeeData.nationality)}
                      {renderReadOnlyField("Marital Status", employeeData.maritalStatus)}
                      {renderReadOnlyField("Blood Group", employeeData.bloodGroup)}
                      {renderReadOnlyField("Religion", employeeData.religion)}
                  </div>
              ) : (
                  <p className="text-muted-foreground">No detailed employee profile found.</p>
              )}
          </CardContent>
        </Card>
      
        {employeeData && (
            <>
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Briefcase className="h-6 w-6 text-primary" />Professional Details</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                      {renderReadOnlyField("Employee Code*", employeeData.employeeCode)}
                      {renderReadOnlyField("Designation*", employeeData.designation)}
                      {renderReadOnlyField("Joined Date*", formatDisplayDate(employeeData.joinedDate))}
                      {renderReadOnlyField("Mobile No*", employeeData.phone)}
                      {renderReadOnlyField("Employee Status", employeeData.status)}
                      {renderReadOnlyField("Job Base*", employeeData.jobBase)}
                      {renderReadOnlyField("Job Base Effective Date*", formatDisplayDate(employeeData.jobBaseEffectiveDate))}
                  </div>
              </CardContent>
            </Card>
            
            <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><GraduationCap className="h-6 w-6 text-primary" />Education Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Education</TableHead>
                              <TableHead>Institute</TableHead>
                              <TableHead>Year</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {employeeData.educationDetails && employeeData.educationDetails.length > 0 ? employeeData.educationDetails.map((edu, idx) => (
                              <TableRow key={idx}>
                                  <TableCell>{edu.education}</TableCell>
                                  <TableCell>{edu.instituteName}</TableCell>
                                  <TableCell>{edu.passedYear}</TableCell>
                              </TableRow>
                          )) : (
                              <TableRow><TableCell colSpan={3} className="text-center">No education details found.</TableCell></TableRow>
                          )}
                      </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Banknote className="h-6 w-6 text-primary" />Bank Account Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Bank</TableHead>
                              <TableHead>Account No.</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {employeeData.bankDetails && employeeData.bankDetails.length > 0 ? employeeData.bankDetails.map((bank, idx) => (
                              <TableRow key={idx}>
                                  <TableCell>{bank.bankName}</TableCell>
                                  <TableCell>{bank.accountNo}</TableCell>
                              </TableRow>
                          )) : (
                              <TableRow><TableCell colSpan={2} className="text-center">No bank details found.</TableCell></TableRow>
                          )}
                      </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-xl">
              <CardHeader>
                  <CardTitle className="flex items-center gap-2"><DollarSign className="h-6 w-6 text-primary" />Salary Information</CardTitle>
              </CardHeader>
              <CardContent>
                  {renderReadOnlyField("Gross Salary", formatCurrency(employeeData.salaryStructure?.grossSalary))}
              </CardContent>
            </Card>

            </>
        )}
      </Form>
    </div>
  );
}

    

    


