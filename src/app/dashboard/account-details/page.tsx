
"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfile } from 'firebase/auth';
import { Loader2, UserCircle, Save, ShieldAlert, Image as ImageIcon, Link2, Upload, Crop as CropIcon, Building, Briefcase, Info, Banknote, GraduationCap, DollarSign, Clock, Check, MapPin, CalendarDays, UserCheck, RefreshCw, XCircle, BarChart3, TrendingUp, TrendingDown, Plane, UserX, Wallet, FileDigit, Bell, PlusCircle } from 'lucide-react';
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Swal from 'sweetalert2';
import Image from 'next/image';
import { doc, updateDoc, serverTimestamp, getDocs, query, where, collection, getDoc, setDoc, orderBy } from 'firebase/firestore';
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
import type { EmployeeDocument, AttendanceDocument, HolidayDocument, LeaveApplicationDocument, VisitApplicationDocument, AdvanceSalaryDocument, Payslip, NoticeBoardSettings } from '@/types';
import { format, isWithinInterval, parseISO, startOfDay, getDay, startOfMonth, endOfMonth, differenceInCalendarDays } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StarBorder from '@/components/ui/StarBorder';
import { LeaveCalendar } from '@/components/dashboard/LeaveCalendar';
import { StatCard } from '@/components/dashboard/StatCard';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { Badge } from '@/components/ui/badge';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';


const accountDetailsSchema = z.object({
  displayName: z.string().min(1, "Display name cannot be empty.").max(50, "Display name is too long."),
});

type AccountDetailsFormValues = z.infer<typeof accountDetailsSchema>;

type DayStatus = 'Working Day' | 'Weekend' | 'Holiday' | 'On Leave' | 'On Visit';


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
  
  const [holidays, setHolidays] = useState<HolidayDocument[]>([]);
  const [leaves, setLeaves] = useState<LeaveApplicationDocument[]>([]);
  const [visits, setVisits] = useState<VisitApplicationDocument[]>([]);
  const [userAdvanceSalary, setUserAdvanceSalary] = useState<AdvanceSalaryDocument[]>([]);
  const [dayStatus, setDayStatus] = useState<DayStatus>('Working Day');
  const [isDayStatusLoading, setIsDayStatusLoading] = useState(true);
  
  const [allEmployees, setAllEmployees] = useState<EmployeeDocument[]>([]);
  const [birthdaysToday, setBirthdaysToday] = React.useState<EmployeeDocument[]>([]);
  
  const [monthlyStats, setMonthlyStats] = useState({
    present: 0,
    absent: 0,
    delayed: 0,
    leave: 0,
    visit: 0,
    advanceSalary: 0,
  });

  const [payslips, setPayslips] = React.useState<Payslip[]>([]);
  const [isLoadingPayslips, setIsLoadingPayslips] = React.useState(true);

  const [attendanceDateRange, setAttendanceDateRange] = React.useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [filteredAttendance, setFilteredAttendance] = React.useState<AttendanceDocument[]>([]);
  const [isAttendanceLoading, setIsAttendanceLoading] = React.useState(true);
  const { data: notices, isLoading: isLoadingNotices } = useFirestoreQuery<(NoticeBoardSettings & { id: string })[]>(query(collection(firestore, "site_settings"), where("isEnabled", "==", true)), undefined, ['notices_hrm_dashboard']);


  // Step 1: Fetch employee data based on user's email
  useEffect(() => {
    if (user) {
      const fetchEmployeeData = async () => {
        setIsEmployeeDataLoading(true);
        if (user.email) {
          try {
            const q = query(collection(firestore, 'employees'), where('email', '==', user.email));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const employeeDoc = querySnapshot.docs[0];
              setEmployeeData({ id: employeeDoc.id, ...employeeDoc.data() } as EmployeeDocument);
            } else {
              setError("No detailed employee profile found for this user.");
            }
          } catch (err) {
            console.error("Error fetching employee data:", err);
            setError("Could not load detailed employee profile.");
          }
        }
        setIsEmployeeDataLoading(false);
      };
      fetchEmployeeData();
    } else if (!authLoading) {
      setIsEmployeeDataLoading(false);
    }
  }, [user, authLoading]);

  // Step 2: Fetch other auxiliary data, some of which may depend on employeeData
  useEffect(() => {
    if (user && !isEmployeeDataLoading && employeeData) { 
      const fetchAuxData = async () => {
        setIsDayStatusLoading(true);
        try {
          const today = startOfDay(new Date());
          const startOfCurrentMonth = startOfMonth(today);
          const endOfCurrentMonth = endOfMonth(today);

          const fromDate = format(startOfCurrentMonth, "yyyy-MM-dd'T'00:00:00.000xxx");
          const toDate = format(endOfCurrentMonth, "yyyy-MM-dd'T'23:59:59.999xxx");
          
          const [holidaysSnapshot, employeesSnapshot, leavesSnapshot, visitsSnapshot, advanceSalarySnapshot, monthlyAttendanceSnapshot, monthlyAdvanceSalarySnapshot, payslipsSnapshot] = await Promise.all([
              getDocs(query(collection(firestore, 'holidays'))),
              getDocs(collection(firestore, 'employees')),
              getDocs(query(collection(firestore, 'leave_applications'), where('employeeId', '==', employeeData.id))),
              getDocs(query(collection(firestore, 'visit_applications'), where('employeeId', '==', employeeData.id))),
              getDocs(query(collection(firestore, 'advance_salary'), where('employeeId', '==', employeeData.id))),
              getDocs(query(collection(firestore, 'attendance'), where('employeeId', '==', employeeData.id), where('date', '>=', fromDate), where('date', '<=', toDate))),
              getDocs(query(collection(firestore, 'advance_salary'), where('employeeId', '==', employeeData.id), where('applyDate', '>=', fromDate), where('applyDate', '<=', toDate), where('status', '==', 'Approved'))),
              getDocs(query(collection(firestore, "payslips"), where("employeeId", "==", employeeData.id))),
          ]);
              
          setHolidays(holidaysSnapshot.docs.map(doc => doc.data() as HolidayDocument));
          setAllEmployees(employeesSnapshot.docs.map(doc => doc.data() as EmployeeDocument));
          setLeaves(leavesSnapshot.docs.map(doc => doc.data() as LeaveApplicationDocument));
          setVisits(visitsSnapshot.docs.map(doc => doc.data() as VisitApplicationDocument));
          setUserAdvanceSalary(advanceSalarySnapshot.docs.map(doc => doc.data() as AdvanceSalaryDocument));
          setPayslips(payslipsSnapshot.docs.map(d => d.data() as Payslip));

          const monthlyAttendance = monthlyAttendanceSnapshot.docs.map(doc => doc.data() as AttendanceDocument);
          const monthlyAdvance = monthlyAdvanceSalarySnapshot.docs.map(doc => doc.data() as AdvanceSalaryDocument);
          
          setMonthlyStats({
              present: monthlyAttendance.filter(a => a.flag === 'P').length,
              delayed: monthlyAttendance.filter(a => a.flag === 'D').length,
              absent: monthlyAttendance.filter(a => a.flag === 'A').length,
              leave: monthlyAttendance.filter(a => a.flag === 'L').length,
              visit: monthlyAttendance.filter(a => a.flag === 'V').length,
              advanceSalary: monthlyAdvance.reduce((sum, req) => sum + req.advanceAmount, 0),
          });

        } catch (err) {
          console.error("Could not load all account data.", err);
          setError("Could not load all account data.");
        } finally {
          setIsDayStatusLoading(false);
          setIsLoadingPayslips(false);
        }
      };
      fetchAuxData();
    } else if (!isEmployeeDataLoading) {
        setIsDayStatusLoading(false);
        setIsLoadingPayslips(false);
    }
  }, [user, employeeData, isEmployeeDataLoading]);

  React.useEffect(() => {
    if (user && employeeData?.id && attendanceDateRange?.from) {
      const fetchAttendance = async () => {
        setIsAttendanceLoading(true);
        const fromDate = format(attendanceDateRange.from, "yyyy-MM-dd'T'00:00:00.000xxx");
        const toDate = format(attendanceDateRange.to || attendanceDateRange.from!, "yyyy-MM-dd'T'23:59:59.999xxx");
        
        const q = query(
          collection(firestore, 'attendance'),
          where('employeeId', '==', employeeData.id),
          where('date', '>=', fromDate),
          where('date', '<=', toDate),
          orderBy('date', 'desc')
        );

        try {
          const snapshot = await getDocs(q);
          const attendanceData = snapshot.docs.map(doc => ({...doc.data(), id: doc.id} as AttendanceDocument));
          setFilteredAttendance(attendanceData);
        } catch (err) {
          console.error("Error fetching filtered attendance:", err);
        } finally {
          setIsAttendanceLoading(false);
        }
      };
      fetchAttendance();
    }
  }, [user, employeeData, attendanceDateRange]);

  useEffect(() => {
    const today = startOfDay(new Date());
    
    if(employeeData?.status === 'Terminated') return;

    if (getDay(today) === 5) {
      setDayStatus('Weekend');
      return;
    }

    const holiday = holidays.find(h => isWithinInterval(today, { start: parseISO(h.fromDate), end: parseISO(h.toDate || h.fromDate) }));
    if (holiday) {
      setDayStatus('Holiday');
      return;
    }
    
    const activeLeaves = leaves.filter(l => l.status === 'Approved');
    const leave = activeLeaves.find(l => isWithinInterval(today, { start: parseISO(l.fromDate), end: parseISO(l.toDate) }));
    if (leave) {
      setDayStatus('On Leave');
      return;
    }

    const activeVisits = visits.filter(v => v.status === 'Approved');
    const visit = activeVisits.find(v => isWithinInterval(today, { start: parseISO(v.fromDate), end: parseISO(v.toDate) }));
    if (visit) {
        setDayStatus('On Visit');
        return;
    }

    setDayStatus('Working Day');
  }, [holidays, leaves, visits, employeeData?.status]);


  React.useEffect(() => {
    if (allEmployees.length > 0) {
        const todayMonthDay = format(new Date(), 'MM-dd');
        const todayBirthdays = allEmployees.filter(emp => {
            if (!emp.dateOfBirth) return false;
            try {
                const dob = parseISO(emp.dateOfBirth);
                return format(dob, 'MM-dd') === todayMonthDay;
            } catch { return false; }
        });
        setBirthdaysToday(todayBirthdays);
    }
  }, [allEmployees]);


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

  const getAttendanceTitle = () => {
    if (employeeData?.status === 'Terminated') return 'Account Terminated';
    switch (dayStatus) {
      case 'Weekend': return 'Today is a Weekend';
      case 'Holiday': return 'Today is a Holiday';
      case 'On Leave': return 'You are on Leave';
      case 'On Visit': return 'You are on Visit';
      default: return 'Daily Attendance';
    }
  };
  
  const isAttendanceDisabled = dayStatus !== 'Working Day' || employeeData?.status === 'Terminated';


  if (authLoading || isEmployeeDataLoading || isDayStatusLoading) {
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

                    <div className="lg:col-span-1">
                        <StarBorder as="div" className="w-full" color="magenta" thickness={2}>
                            <div className="p-4">
                                <h4 className={cn("text-sm font-semibold mb-2 flex items-center gap-2", dayStatus !== 'Working Day' && "text-muted-foreground")}>
                                    {dayStatus === 'Working Day' && employeeData?.status !== 'Terminated' ? <UserCheck className="h-4 w-4 text-primary"/> : <XCircle className="h-4 w-4 text-destructive"/>}
                                    {getAttendanceTitle()}
                                </h4>
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
                                            disabled={attendanceLoading || !!dailyAttendance?.inTime || isAttendanceDisabled}
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
                                            disabled={attendanceLoading || !dailyAttendance?.inTime || !!dailyAttendance?.outTime || isAttendanceDisabled}
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
                        </StarBorder>
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
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-xl lg:text-2xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                  <BarChart3 className="h-6 w-6 text-primary" />
                  This Month's Summary
              </CardTitle>
          </CardHeader>
          <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <StatCard title="Total Present" value={monthlyStats.present} icon={<UserCheck />} description="Days present this month" className="bg-green-500"/>
                  <StatCard title="Total Absent" value={monthlyStats.absent} icon={<UserX />} description="Days absent this month" className="bg-red-500"/>
                  <StatCard title="Total Delayed" value={monthlyStats.delayed} icon={<Clock />} description="Late arrivals this month" className="bg-yellow-500" />
                  <StatCard title="Total On Leave" value={monthlyStats.leave} icon={<Plane />} description="Leave days this month" className="bg-blue-500" />
                  <StatCard title="Total On Visit" value={monthlyStats.visit} icon={<Briefcase />} description="Official visit days" className="bg-indigo-500"/>
                  <StatCard title="Advance Salary" value={formatCurrency(monthlyStats.advanceSalary)} icon={<Wallet />} description="Taken this month" className="bg-purple-500"/>
              </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className={cn("flex items-center gap-2", "font-bold text-xl lg:text-2xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
              <FileDigit className="h-6 w-6 text-primary" />
              Monthly Payslip Summary
            </CardTitle>
            <CardDescription>
              A summary of your generated payslips.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingPayslips ? (
              <div className="flex justify-center items-center h-24">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : payslips.length === 0 ? (
              <p className="text-muted-foreground text-center">No payslip data found for this account.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Gross Salary</TableHead>
                      <TableHead>Advance Paid</TableHead>
                      <TableHead>Total Deductions</TableHead>
                      <TableHead className="font-bold">Net Salary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payslips.map((payslip) => (
                      <TableRow key={payslip.id}>
                        <TableCell>{payslip.payPeriod}</TableCell>
                        <TableCell>{formatCurrency(payslip.grossSalary)}</TableCell>
                        <TableCell>{formatCurrency(payslip.advanceDeduction)}</TableCell>
                        <TableCell>{formatCurrency(payslip.totalDeductions)}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(payslip.netSalary)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                <Card className="shadow-xl h-full">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                    <div>
                        <CardTitle className="flex items-center gap-2 font-bold text-xl lg:text-2xl text-primary bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out">
                        <CalendarDays className="h-6 w-6 text-primary" /> Quick Attendance View
                        </CardTitle>
                        <CardDescription>
                        Your attendance records for the selected period.
                        </CardDescription>
                    </div>
                    <DatePickerWithRange date={attendanceDateRange} onDateChange={setAttendanceDateRange} />
                    </div>
                </CardHeader>
                <CardContent>
                    {isAttendanceLoading ? (
                    <div className="flex justify-center items-center h-48">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                    ) : filteredAttendance.length === 0 ? (
                    <p className="text-muted-foreground text-center">No attendance data found for the selected range.</p>
                    ) : (
                    <div className="rounded-md border">
                        <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>In Time</TableHead>
                            <TableHead>In Time Remarks</TableHead>
                            <TableHead>Out Time</TableHead>
                            <TableHead>Out Time Remarks</TableHead>
                            <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAttendance.map((att) => (
                            <TableRow key={att.id}>
                                <TableCell>{formatDisplayDate(att.date)}</TableCell>
                                <TableCell>
                                <div className="flex items-center gap-1">
                                    {att.inTime || 'N/A'}
                                    {att.inTimeLocation && (
                                    <Button
                                        type="button" variant="ghost" size="icon" className="h-6 w-6"
                                        onClick={() => handleViewLocation(att.inTimeLocation)} title="View In-Time Location">
                                        <MapPin className="h-3.5 w-3.5 text-blue-500" />
                                    </Button>
                                    )}
                                </div>
                                </TableCell>
                                <TableCell>{att.inTimeRemarks || 'N/A'}</TableCell>
                                <TableCell>
                                <div className="flex items-center gap-1">
                                    {att.outTime || 'N/A'}
                                    {att.outTimeLocation && (
                                    <Button
                                        type="button" variant="ghost" size="icon" className="h-6 w-6"
                                        onClick={() => handleViewLocation(att.outTimeLocation)} title="View Out-Time Location">
                                        <MapPin className="h-3.5 w-3.5 text-orange-500" />
                                    </Button>
                                    )}
                                </div>
                                </TableCell>
                                <TableCell>{att.outTimeRemarks || 'N/A'}</TableCell>
                                <TableCell>
                                <Badge variant={att.flag === 'P' ? 'default' : att.flag === 'D' ? 'destructive' : 'secondary'}>
                                    {att.flag}
                                </Badge>
                                </TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                    </div>
                    )}
                </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-1">
                 <Card className="h-full">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary"/>Notice Board</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoadingNotices ? (
                            <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin"/></div>
                        ) : !notices || notices.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center">No active notices available.</p>
                        ) : (
                            <ScrollArea className="h-96 pr-4">
                                <div className="space-y-4">
                                    {notices.map(notice => (
                                        <div key={notice.id} className="p-3 border rounded-lg bg-background shadow-sm">
                                            <h4 className="font-semibold text-sm mb-1">{notice.title}</h4>
                                            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: notice.content ? notice.content.substring(0, 100) + '...' : '' }} />
                                            <div className="text-xs text-muted-foreground mt-2">
                                                {notice.updatedAt ? format(new Date((notice.updatedAt as any).seconds * 1000), 'PPP') : 'N/A'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>

        <Card className="shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary"/>Advance Salary Requests</CardTitle>
                    <CardDescription>Your recent advance salary applications.</CardDescription>
                </div>
                <Button asChild><Link href="/dashboard/hr/payroll/advance-salary/add"><PlusCircle className="mr-2 h-4 w-4"/>Apply</Link></Button>
            </CardHeader>
            <CardContent>
                <Table><TableHeader><TableRow><TableHead>Apply Date</TableHead><TableHead>Amount</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                    {userAdvanceSalary.length > 0 ? userAdvanceSalary.slice(0, 3).map(req => (
                        <TableRow key={req.id}><TableCell>{formatDisplayDate(req.applyDate)}</TableCell><TableCell>{formatCurrency(req.advanceAmount)}</TableCell><TableCell>{req.reason}</TableCell><TableCell><Badge variant={req.status === 'Approved' ? 'default' : 'secondary'}>{req.status}</Badge></TableCell></TableRow>
                    )) : <TableRow><TableCell colSpan={4} className="text-center">No advance salary requests found.</TableCell></TableRow>}
                </TableBody></Table>
            </CardContent>
        </Card>

        <Card className="shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2"><Plane className="h-5 w-5 text-primary"/>Leave Applications</CardTitle>
                    <CardDescription>Your recent leave applications.</CardDescription>
                </div>
                <Button asChild><Link href="/dashboard/hr/leaves/add"><PlusCircle className="mr-2 h-4 w-4"/>Apply</Link></Button>
            </CardHeader>
            <CardContent>
                <Table><TableHeader><TableRow><TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Days</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                    {leaves.length > 0 ? leaves.slice(0, 3).map(leave => (
                        <TableRow key={leave.id}>
                            <TableCell>{leave.leaveType}</TableCell>
                            <TableCell>{formatDisplayDate(leave.fromDate)}</TableCell>
                            <TableCell>{formatDisplayDate(leave.toDate)}</TableCell>
                            <TableCell>{differenceInCalendarDays(parseISO(leave.toDate), parseISO(leave.fromDate)) + 1}</TableCell>
                            <TableCell>{leave.reason}</TableCell>
                            <TableCell><Badge variant={leave.status === 'Approved' ? 'default' : 'secondary'}>{leave.status}</Badge></TableCell>
                        </TableRow>
                    )) : <TableRow><TableCell colSpan={6} className="text-center">No leave applications found.</TableCell></TableRow>}
                </TableBody></Table>
            </CardContent>
        </Card>
        
        <Card className="shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary"/>Visit Applications</CardTitle>
                    <CardDescription>Your recent official visit applications.</CardDescription>
                </div>
                <Button asChild><Link href="/dashboard/hr/visit-applications/add"><PlusCircle className="mr-2 h-4 w-4"/>Apply</Link></Button>
            </CardHeader>
            <CardContent>
                <Table><TableHeader><TableRow><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Days</TableHead><TableHead>Remarks</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                    {visits.length > 0 ? visits.slice(0, 3).map(visit => (
                        <TableRow key={visit.id}>
                            <TableCell>{formatDisplayDate(visit.fromDate)}</TableCell>
                            <TableCell>{formatDisplayDate(visit.toDate)}</TableCell>
                            <TableCell>{visit.day}</TableCell>
                            <TableCell>{visit.remarks}</TableCell>
                            <TableCell><Badge variant={visit.status === 'Approved' ? 'default' : 'secondary'}>{visit.status}</Badge></TableCell>
                        </TableRow>
                    )) : <TableRow><TableCell colSpan={5} className="text-center">No visit applications found.</TableCell></TableRow>}
                </TableBody></Table>
            </CardContent>
        </Card>

        <div className="mt-8">
            <LeaveCalendar birthdays={birthdaysToday} />
        </div>

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
