

"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfile } from 'firebase/auth';
import { Loader2, UserCircle, Save, ShieldAlert, Link2, Crop as CropIcon, Briefcase, Info, Clock, Check, MapPin, UserCheck, RefreshCw, XCircle, BarChart3, Plane, UserX, Wallet, FileDigit, Bell, PlusCircle, Calendar as CalendarIcon, Camera, Coffee, Timer } from 'lucide-react';
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { doc, updateDoc, serverTimestamp, getDocs, query, where, collection, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { auth, firestore, storage } from '@/lib/firebase/config';
import { determineAttendanceFlag } from '@/lib/firebase/utils';
import { useAuth } from '@/context/AuthContext';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { getCroppedImg } from '@/lib/image-utils';
import type { EmployeeDocument, AttendanceDocument, HolidayDocument, LeaveApplicationDocument, VisitApplicationDocument, AdvanceSalaryDocument, Payslip, NoticeBoardSettings, AttendanceFlag, AttendanceReconciliationConfiguration, MultipleCheckInOutConfiguration, LeaveGroupDocument, HotspotDocument } from '@/types';
import type { CheckInOutType, MultipleCheckInOutRecord, MultipleCheckInOutLocation } from '@/types/checkInOut';
import { getCurrentLocation, uploadCheckInOutImage, createCheckInOutRecord, reverseGeocode, getCheckInOutRecords } from '@/lib/firebase/checkInOut';
import { startBreak, stopBreak } from '@/lib/firebase/breakTime';
import type { BreakTimeRecord } from '@/types/breakTime';
import { format, isWithinInterval, parseISO, startOfDay, getDay, startOfMonth, endOfMonth, differenceInCalendarDays, eachDayOfInterval, subDays, isFuture, max, min, getDate, isSameMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StarBorder from '@/components/ui/StarBorder';
import { LeaveCalendar } from '@/components/dashboard/LeaveCalendar';
import { StatCard } from '@/components/dashboard/StatCard';
import { EmployeeSupervisionCard } from '@/components/dashboard/EmployeeSupervisionCard';
import { TeamCheckInCard } from '@/components/dashboard/TeamCheckInCard';
import { TeamBreakTimeCard } from '@/components/dashboard/TeamBreakTimeCard';
import dynamic from 'next/dynamic';
import type { BranchDocument } from '@/types';

// Dynamically import GeofenceMap
const GeofenceMap = dynamic(() => import('@/components/ui/GeofenceMap'), {
  ssr: false,
  loading: () => <div className="h-[250px] w-full bg-muted animate-pulse rounded-md flex items-center justify-center">Loading Map...</div>
});
import { TeamAttendanceCard } from '@/components/dashboard/TeamAttendanceCard';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { Badge } from '@/components/ui/badge';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';


import {
  createReconciliationRequest,
  getEmployeeReconciliations
} from '@/lib/firebase/reconciliation';
import type { AttendanceReconciliation, CreateReconciliationData } from '@/types/reconciliation';

const accountDetailsSchema = z.object({
  displayName: z.string().min(1, "Display name cannot be empty.").max(50, "Display name is too long."),
  photoURL: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
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
  const { user, loading: authLoading, setUser: setAuthUser } = useAuth();
  const { isSupervisor, supervisedEmployeeIds } = useSupervisorCheck(user?.email);
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
    totalBreakMinutes: 0,
  });

  const [payslips, setPayslips] = React.useState<Payslip[]>([]);
  const [isLoadingPayslips, setIsLoadingPayslips] = React.useState(true);

  const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [rangeAttendance, setRangeAttendance] = React.useState<AttendanceDocument[]>([]);
  const [rangeBreaks, setRangeBreaks] = React.useState<BreakTimeRecord[]>([]);
  const [isAttendanceLoading, setIsAttendanceLoading] = React.useState(true);
  const { data: notices, isLoading: isLoadingNotices } = useFirestoreQuery<(NoticeBoardSettings & { id: string })[]>(query(collection(firestore, "site_settings"), where("isEnabled", "==", true)), undefined, ['notices_hrm_dashboard']);
  const [selectedNotice, setSelectedNotice] = React.useState<(NoticeBoardSettings & { id: string }) | null>(null);
  const [isNoticeDialogOpen, setIsNoticeDialogOpen] = React.useState(false);

  // Multiple Check In/Out state
  const [checkInOutType, setCheckInOutType] = React.useState<CheckInOutType>('Check In');
  const [lastCheckInOutRecord, setLastCheckInOutRecord] = React.useState<MultipleCheckInOutRecord | null>(null);

  const fetchLastCheckInOutRecord = React.useCallback(async () => {
    if (!employeeData?.id) return;
    try {
      // Query without orderBy to avoid composite index requirement
      const q = query(
        collection(firestore, 'multiple_check_inout'),
        where('employeeId', '==', employeeData.id)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        // Sort documents by timestamp descending on client side
        const records = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as MultipleCheckInOutRecord))
          .sort((a, b) => {
            const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return bTime - aTime;
          });

        const record = records[0];
        setLastCheckInOutRecord(record);
        // Auto-set the next action based on last record
        if (record.type === 'Check In') {
          setCheckInOutType('Check Out');
          // Auto-fill company name for check-out from last check-in
          setCompanyName(record.companyName || '');
        } else {
          setCheckInOutType('Check In');
        }
      } else {
        setLastCheckInOutRecord(null);
        setCheckInOutType('Check In');
      }
    } catch (error) {
      console.error("Error fetching last check-in/out:", error);
    }
  }, [employeeData?.id]);

  React.useEffect(() => {
    fetchLastCheckInOutRecord();
  }, [fetchLastCheckInOutRecord]);
  const [companyName, setCompanyName] = React.useState('');
  const [checkInOutRemarks, setCheckInOutRemarks] = React.useState('');
  const [capturedImage, setCapturedImage] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string>('');
  const [currentLocation, setCurrentLocation] = React.useState<MultipleCheckInOutLocation | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = React.useState(false);
  const [isSubmittingCheckInOut, setIsSubmittingCheckInOut] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const profilePictureRef = React.useRef<HTMLInputElement>(null);

  // Reconciliation State
  const [reconciliations, setReconciliations] = useState<Map<string, AttendanceReconciliation>>(new Map());
  const [isReconciliationModalOpen, setIsReconciliationModalOpen] = useState(false);
  const [selectedAttendanceForReconciliation, setSelectedAttendanceForReconciliation] = useState<AttendanceDocument | null>(null);
  const [isSubmittingReconciliation, setIsSubmittingReconciliation] = useState(false);
  const [reconciliationForm, setReconciliationForm] = useState({
    inTime: '',
    outTime: '',
    inTimeRemarks: '',
    outTimeRemarks: ''
  });

  // Time picker state for In Time
  const [inTimeHour, setInTimeHour] = useState('');
  const [inTimeMinute, setInTimeMinute] = useState('');
  const [inTimePeriod, setInTimePeriod] = useState<'AM' | 'PM'>('AM');

  // Time picker state for Out Time
  const [outTimeHour, setOutTimeHour] = useState('');
  const [outTimeMinute, setOutTimeMinute] = useState('');
  const [outTimePeriod, setOutTimePeriod] = useState<'AM' | 'PM'>('PM');

  // Configuration for reconciliation
  const [reconConfig, setReconConfig] = useState<AttendanceReconciliationConfiguration | null>(null);

  // Configuration for Multiple Check In / Out
  const [multiCheckConfig, setMultiCheckConfig] = useState<MultipleCheckInOutConfiguration | null>(null);
  const [lastRecord, setLastRecord] = useState<MultipleCheckInOutRecord | null>(null);

  // Leave Group Policy
  const [leaveGroup, setLeaveGroup] = useState<LeaveGroupDocument | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');
  const [employeeBranch, setEmployeeBranch] = useState<BranchDocument | null>(null);
  const [branchHotspots, setBranchHotspots] = useState<HotspotDocument[]>([]);

  // Location View Modal State
  const [viewLocation, setViewLocation] = useState<{ lat: number; lng: number, address?: string } | null>(null);
  const [isViewLocationOpen, setIsViewLocationOpen] = useState(false);

  // Daily Attendance Dialog State
  const [isDailyAttendanceOpen, setIsDailyAttendanceOpen] = useState(false);
  const [dailyAttendanceType, setDailyAttendanceType] = useState<'in' | 'out'>('in');
  const [attendanceRemarks, setAttendanceRemarks] = useState('');
  const [attendanceLocation, setAttendanceLocation] = useState<MultipleCheckInOutLocation | null>(null);

  // Break Time State
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [activeBreakId, setActiveBreakId] = useState<string | null>(null);
  const [breakLoading, setBreakLoading] = useState(false);
  const [activeBreakRecord, setActiveBreakRecord] = useState<BreakTimeRecord | null>(null);
  const [breakElapsedTime, setBreakElapsedTime] = useState<string>("00:00:00");

  // Fetch Branch Data
  useEffect(() => {
    const fetchBranch = async () => {
      try {
        let branchDocId = "";

        if (employeeData?.branchId) {
          const branchDoc = await getDoc(doc(firestore, 'branches', employeeData.branchId));
          if (branchDoc.exists()) {
            setEmployeeBranch({ id: branchDoc.id, ...branchDoc.data() } as BranchDocument);
            branchDocId = branchDoc.id;
          }
        }

        // Fallback: Fetch by branch name if branchId is missing or document not found
        if (!branchDocId && employeeData?.branch && employeeData.branch !== 'Not Defined') {
          const q = query(collection(firestore, 'branches'), where('name', '==', employeeData.branch.trim()));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const branchDoc = snapshot.docs[0];
            setEmployeeBranch({ id: branchDoc.id, ...branchDoc.data() } as BranchDocument);
            branchDocId = branchDoc.id;
          }
        }

        // Fetch Hotspots for this branch
        if (branchDocId) {
          const hotspotsQ = query(
            collection(firestore, 'hotspots'),
            where('branchId', '==', branchDocId),
            where('isActive', '==', true)
          );
          const hotspotsSnapshot = await getDocs(hotspotsQ);
          const hotspotsData = hotspotsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HotspotDocument));
          setBranchHotspots(hotspotsData);
        } else {
          setBranchHotspots([]);
        }
      } catch (error) {
        console.error("Error fetching branch or hotspots:", error);
      }
    };
    fetchBranch();
  }, [employeeData?.branchId, employeeData?.branch]);

  useEffect(() => {
    const fetchLeaveGroup = async () => {
      if (employeeData?.leaveGroupId) {
        try {
          const docRef = doc(firestore, 'hrm_settings', 'leave_groups', 'items', employeeData.leaveGroupId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            setLeaveGroup({ id: snap.id, ...snap.data() } as LeaveGroupDocument);
          }
        } catch (e) { console.error("Error fetching leave group:", e); }
      }
    };
    fetchLeaveGroup();
  }, [employeeData?.leaveGroupId]);

  const leaveBalances = useMemo(() => {
    if (!leaveGroup) return [];

    const today = new Date();
    const startOfCurrentYear = startOfYear(today);
    const endOfCurrentYear = endOfYear(today);

    return leaveGroup.policies.map(policy => {
      let usedDays = 0;

      leaves.forEach(l => {
        // Match leave type (assuming name match for now) and status
        if (l.status === 'Approved' && l.leaveType === policy.leaveTypeName) {
          const leaveStart = parseISO(l.fromDate);
          const leaveEnd = parseISO(l.toDate);

          // Calculate overlap with current year
          const overlapStart = max([leaveStart, startOfCurrentYear]);
          const overlapEnd = min([leaveEnd, endOfCurrentYear]);

          if (overlapEnd >= overlapStart) {
            usedDays += differenceInCalendarDays(overlapEnd, overlapStart) + 1;
          }
        }
      });

      return {
        name: policy.leaveTypeName,
        allowed: policy.allowedBalance,
        used: usedDays,
        balance: policy.allowedBalance - usedDays
      };
    });
  }, [leaveGroup, leaves]);


  // Fetch reconciliations when employee data is loaded
  useEffect(() => {
    const fetchReconciliations = async () => {
      if (employeeData?.id) {
        try {
          const docs = await getEmployeeReconciliations(employeeData.id);
          const map = new Map<string, AttendanceReconciliation>();
          docs.forEach(doc => {
            // Key by date so we can match with attendance rows
            map.set(doc.attendanceDate, doc);
          });
          setReconciliations(map);
        } catch (error) {
          console.error("Error fetching reconciliations:", error);
        }
      }
    };
    fetchReconciliations();
  }, [employeeData?.id]);

  // Fetch reconciliation configuration
  useEffect(() => {
    const fetchReconConfig = async () => {
      try {
        const docSnap = await getDoc(doc(firestore, 'hrm_settings', 'attendance_reconciliation'));
        if (docSnap.exists()) {
          setReconConfig(docSnap.data() as AttendanceReconciliationConfiguration);
        }
      } catch (error) {
        console.error("Error fetching reconciliation config:", error);
      }
    };
    fetchReconConfig();
  }, []);

  // Fetch multiple check in/out configuration
  useEffect(() => {
    const unsub = onSnapshot(doc(firestore, 'hrm_settings', 'multi_check_in_out'), (docSnap) => {
      if (docSnap.exists()) {
        setMultiCheckConfig(docSnap.data() as MultipleCheckInOutConfiguration);
      }
    });
    return () => unsub();
  }, []);

  // Fetch last check-in/out record for the employee
  useEffect(() => {
    const fetchLastRecord = async () => {
      if (employeeData?.id) {
        try {
          const records = await getCheckInOutRecords({ employeeId: employeeData.id });
          if (records.length > 0) {
            setLastRecord(records[0]);
          }
        } catch (error) {
          console.error("Error fetching last record:", error);
        }
      }
    };
    fetchLastRecord();
  }, [employeeData?.id, checkInOutType]); // Refetch when check-in/out type changes

  // Timer effect for active break
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isOnBreak && activeBreakRecord?.startTime) {
      const updateTimer = () => {
        const start = new Date(activeBreakRecord.startTime);
        const now = new Date();
        const diff = Math.max(0, now.getTime() - start.getTime());

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setBreakElapsedTime(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      };

      updateTimer();
      interval = setInterval(updateTimer, 1000);
    } else {
      setBreakElapsedTime("00:00:00");
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOnBreak, activeBreakRecord?.startTime]);

  useEffect(() => {
    if (employeeData?.id) {
      const q = query(
        collection(firestore, 'break_time'),
        where('employeeId', '==', employeeData.id),
        where('onBreak', '==', true)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          setActiveBreakId(doc.id);
          setActiveBreakRecord({ id: doc.id, ...doc.data() } as BreakTimeRecord);
          setIsOnBreak(true);
        } else {
          setActiveBreakId(null);
          setActiveBreakRecord(null);
          setIsOnBreak(false);
        }
      });
      return () => unsubscribe();
    }
  }, [employeeData?.id]);

  const handleToggleBreak = async () => {
    if (!employeeData) return;

    if (employeeData.status === 'Terminated') {
      Swal.fire("Access Denied", "Your are Terminated. Please Contact with HR department.", "error");
      return;
    }

    if (!dailyAttendance?.inTime) {
      Swal.fire("Action Required", "You must Check-In first before taking a break.", "warning");
      return;
    }

    if (dailyAttendance?.outTime) {
      Swal.fire("Action Blocked", "You have already Checked-Out for the day.", "warning");
      return;
    }

    setBreakLoading(true);
    try {
      if (isOnBreak && activeBreakId) {
        // Stop break with confirmation
        const result = await Swal.fire({
          title: 'Stop Break?',
          text: "Are you sure you want to stop your break?",
          icon: 'question',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          cancelButtonColor: '#3085d6',
          confirmButtonText: 'Yes, stop it!'
        });

        if (!result.isConfirmed) {
          setBreakLoading(false);
          return;
        }

        const location = await updateLocation(true, true);
        if (!location) {
          Swal.fire({
            title: "Location Required",
            text: "Could not capture your current location. Location is mandatory to stop your break. Please ensure GPS is enabled and try again.",
            icon: "error"
          });
          setBreakLoading(false);
          return;
        }

        await stopBreak(activeBreakId, location || undefined);
        Swal.fire({
          title: "Break Ended",
          text: "Welcome back! Your break has been recorded.",
          icon: "success",
          timer: 1500,
          showConfirmButton: false
        });
      } else {
        const location = await updateLocation(true, true);
        if (!location) {
          Swal.fire({
            title: "Location Required",
            text: "Could not capture your current location. Location is mandatory to start your break. Please ensure GPS is enabled and try again.",
            icon: "error"
          });
          setBreakLoading(false);
          return;
        }

        // Start break
        await startBreak({
          id: employeeData.id,
          fullName: employeeData.fullName,
          employeeCode: employeeData.employeeCode,
          designation: employeeData.designation
        }, location || undefined);
        Swal.fire({
          title: "Break Started",
          text: "Take rest! Your break has started.",
          icon: "success",
          timer: 1500,
          showConfirmButton: false
        });
      }
    } catch (error: any) {
      console.error("Error toggling break:", error);
      Swal.fire("Error", error.message || "Failed to process break.", "error");
    } finally {
      setBreakLoading(false);
    }
  };


  // Sync In Time picker changes to form state
  useEffect(() => {
    if (inTimeHour && inTimeMinute && inTimePeriod) {
      setReconciliationForm(prev => ({
        ...prev,
        inTime: `${inTimeHour}:${inTimeMinute} ${inTimePeriod}`
      }));
    } else if (!inTimeHour && !inTimeMinute) {
      // Only clear if both are empty to avoid partial updates clearing it? 
      // Actually, if any part is missing, we might not want a valid time string yet, 
      // but typically we initialize them.
      // Let's just set it if all are present.
    }
  }, [inTimeHour, inTimeMinute, inTimePeriod]);

  // Sync Out Time picker changes to form state
  useEffect(() => {
    if (outTimeHour && outTimeMinute && outTimePeriod) {
      setReconciliationForm(prev => ({
        ...prev,
        outTime: `${outTimeHour}:${outTimeMinute} ${outTimePeriod}`
      }));
    }
  }, [outTimeHour, outTimeMinute, outTimePeriod]);

  const updateLocation = useCallback(async (showNotification = false, forceRefresh = false) => {
    if (isLoadingLocation) return null;
    setIsLoadingLocation(true);

    let progressToast: any = null;

    try {
      const location = await getCurrentLocation({
        forceRefresh,
        onProgress: (msg) => {
          if (showNotification) {
            if (!progressToast) {
              progressToast = Swal.fire({
                title: 'Capturing Location',
                text: msg,
                icon: 'info',
                allowOutsideClick: false,
                showConfirmButton: false,
                didOpen: () => {
                  Swal.showLoading();
                }
              });
            } else {
              Swal.update({
                text: msg
              });
            }
          }
        }
      });

      if (progressToast) Swal.close();

      setCurrentLocation(location);

      // Start reverse geocoding without blocking
      reverseGeocode(location.latitude, location.longitude).then(address => {
        setCurrentLocation(prev => prev ? { ...prev, address } : null);
        if (showNotification) {
          Swal.fire({
            title: 'Location Captured',
            text: address,
            icon: 'success',
            toast: true,
            position: 'top-end',
            timer: 3000,
            showConfirmButton: false
          });
        }
      });
      return location;
    } catch (error: any) {
      if (progressToast) Swal.close();
      console.error('Error capturing location:', error);
      if (showNotification) {
        Swal.fire('Location Error', error.message || 'Could not get location', 'error');
      }
      return null;
    } finally {
      setIsLoadingLocation(false);
    }
  }, [isLoadingLocation]);

  // Automatically capture location on component mount
  React.useEffect(() => {
    updateLocation(false);
  }, []);

  const handleReconciliationClick = (attendance: AttendanceDocument) => {
    if (employeeData?.status === 'Terminated') {
      Swal.fire("Access Denied", "Your are Terminated. Please Contact with HR department.", "error");
      return;
    }
    if (!attendance.date) return;
    const dateKey = attendance.date.split('T')[0];
    const existing = reconciliations.get(dateKey);

    // Warn if pending
    if (existing && existing.status === 'pending') {
      Swal.fire({
        title: "Pending Request",
        text: "You already have a pending reconciliation request for this date. Do you want to submit another one?",
        icon: "info",
        showCancelButton: true,
        confirmButtonText: "Yes, create new"
      }).then((result) => {
        if (!result.isConfirmed) return;
        openRecModal(attendance);
      });
    } else {
      openRecModal(attendance);
    }
  };

  const openRecModal = (attendance: AttendanceDocument) => {
    setSelectedAttendanceForReconciliation(attendance);

    // Parse existing times or default to empty
    // Format expected: "hh:mm a" e.g. "09:00 AM"
    const inTime = attendance.inTime || '';
    const outTime = attendance.outTime || '';

    // Helper to parse time string
    const parseTime = (timeStr: string) => {
      if (!timeStr) return { hour: '', minute: '', period: 'AM' as const };
      const [time, period] = timeStr.split(' ');
      const [hour, minute] = time.split(':');
      return { hour, minute, period: period as 'AM' | 'PM' };
    };

    const parsedIn = parseTime(inTime);
    setInTimeHour(parsedIn.hour);
    setInTimeMinute(parsedIn.minute);
    setInTimePeriod(parsedIn.period);

    const parsedOut = parseTime(outTime);
    setOutTimeHour(parsedOut.hour);
    setOutTimeMinute(parsedOut.minute);
    setOutTimePeriod(parsedOut.period);

    setReconciliationForm({
      inTime: inTime,
      outTime: outTime,
      inTimeRemarks: attendance.inTimeRemarks || '',
      outTimeRemarks: attendance.outTimeRemarks || ''
    });
    setIsReconciliationModalOpen(true);
  };

  const handleReconciliationSubmit = async () => {
    if (!selectedAttendanceForReconciliation || !user || !employeeData) return;

    if (employeeData.status === 'Terminated') {
      Swal.fire("Access Denied", "Your are Terminated. Please Contact with HR department.", "error");
      return;
    }

    // Use formatting from state immediately if form is empty or out of sync (though useEffect handles it)
    // Actually relying on useEffect is fine, but double check.
    const finalInTime = (inTimeHour && inTimeMinute) ? `${inTimeHour}:${inTimeMinute} ${inTimePeriod}` : '';
    const finalOutTime = (outTimeHour && outTimeMinute) ? `${outTimeHour}:${outTimeMinute} ${outTimePeriod}` : '';

    if (!finalInTime && !finalOutTime) {
      Swal.fire("Error", "Please provide at least an In Time or Out Time.", "error");
      return;
    }

    // Enforcement Logic based on reconConfig
    if (reconConfig) {
      const today = new Date();
      const attendanceDate = new Date(selectedAttendanceForReconciliation.date!);

      // 1. Date Range Check
      if (reconConfig.limitType === 'days') {
        const diffDays = differenceInCalendarDays(today, attendanceDate);
        if (diffDays > reconConfig.maxDaysLimit) {
          Swal.fire("Access Denied", `You can only request reconciliation for the previous ${reconConfig.maxDaysLimit} days.`, "warning");
          return;
        }
      } else if (reconConfig.limitType === 'month') {
        const isThisMonth = isSameMonth(today, attendanceDate);
        const isPrevMonth = isSameMonth(subMonths(today, 1), attendanceDate);

        if (!isThisMonth) {
          if (isPrevMonth) {
            const currentDayOfMonth = getDate(today);
            if (currentDayOfMonth > reconConfig.maxDateOfCurrentMonth) {
              Swal.fire("Access Denied", `Requests for the previous month must be submitted by the ${reconConfig.maxDateOfCurrentMonth}${reconConfig.maxDateOfCurrentMonth === 1 ? 'st' : reconConfig.maxDateOfCurrentMonth === 2 ? 'nd' : reconConfig.maxDateOfCurrentMonth === 3 ? 'rd' : 'th'} of the current month.`, "warning");
              return;
            }
          } else {
            Swal.fire("Access Denied", "You can only request reconciliation for the current or previous month within the allowed timeframe.", "warning");
            return;
          }
        }
      }

      // 2. Monthly Quantity Check
      if (reconConfig.maxMonthlyLimitPerEmployee) {
        const sameMonthRequests = Array.from(reconciliations.values()).filter(r =>
          isSameMonth(today, new Date(r.attendanceDate))
        );
        if (sameMonthRequests.length >= reconConfig.maxMonthlyLimitPerEmployee) {
          Swal.fire("Monthly Limit Reached", `You have already submitted the maximum ${reconConfig.maxMonthlyLimitPerEmployee} reconciliation requests allowed for this month.`, "warning");
          return;
        }
      }
    }

    setIsSubmittingReconciliation(true);
    try {
      const dateKey = selectedAttendanceForReconciliation.date!.split('T')[0];

      const data: CreateReconciliationData = {
        employeeId: employeeData.id,
        employeeCode: employeeData.employeeCode || 'N/A',
        employeeName: employeeData.fullName || 'Unknown',
        designation: employeeData.designation || 'N/A',
        attendanceDate: dateKey,
        originalInTime: selectedAttendanceForReconciliation.inTime || null as any,
        originalOutTime: selectedAttendanceForReconciliation.outTime || null as any,
        originalFlag: selectedAttendanceForReconciliation.flag || null as any,
        requestedInTime: reconciliationForm.inTime || null as any,
        requestedOutTime: reconciliationForm.outTime || null as any,
        inTimeRemarks: reconciliationForm.inTimeRemarks || null as any,
        outTimeRemarks: reconciliationForm.outTimeRemarks || null as any,
        shift: employeeData.shift || 'General',
      };

      const newReconciliationId = await createReconciliationRequest(data, user.uid);

      // Trigger Email Notification (Non-blocking)
      fetch('/api/attendance/notify-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: employeeData.fullName,
          attendanceDate: dateKey,
          reason: [reconciliationForm.inTimeRemarks, reconciliationForm.outTimeRemarks].filter(Boolean).join(' | '),
          reconciliationId: newReconciliationId
        })
      }).catch(err => console.error("Failed to trigger notification email:", err));

      // Refresh list
      const docs = await getEmployeeReconciliations(employeeData.id);
      const map = new Map<string, AttendanceReconciliation>();
      docs.forEach(doc => map.set(doc.attendanceDate, doc));
      setReconciliations(map);

      // ✅ Refresh attendance data to show updated flags immediately
      await fetchAttendanceForRange();

      setIsReconciliationModalOpen(false);
      await Swal.fire({
        title: "Success",
        text: "Reconciliation request submitted successfully.",
        icon: "success",
        allowOutsideClick: true,
        allowEscapeKey: true,
        timer: 1000,
        timerProgressBar: true,
        showConfirmButton: true,
      });
    } catch (error: any) {
      console.error("Error submitting reconciliation:", error);
      await Swal.fire({
        title: "Error",
        text: `Failed to submit request: ${error.message}`,
        icon: "error",
        allowOutsideClick: true,
        allowEscapeKey: true,
        showConfirmButton: true,
      });
    } finally {
      setIsSubmittingReconciliation(false);
    }
  };
  // Empty dependency array - run only once on mount

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
              // Fallback for non-employee roles (Admin, HR, etc.)
              const fallbackEmployee: EmployeeDocument = {
                id: user.uid,
                uid: user.uid,
                fullName: user.displayName || user.email.split('@')[0],
                email: user.email,
                phone: '',
                employeeCode: `EMP-${user.uid.substring(0, 5).toUpperCase()}`,
                designation: 'Staff',
                status: 'Active',
                joinedDate: new Date().toISOString(),
                dateOfBirth: new Date(1990, 0, 1).toISOString(),
                gender: 'Male',
              };
              setEmployeeData(fallbackEmployee);
              console.warn("No detailed employee profile found. Using fallback data for attendance.");
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
        setError(null);
        try {
          const today = new Date();
          const startOfCurrentMonth = startOfMonth(today);
          const endOfCurrentMonth = endOfMonth(today);

          const fromDate = format(startOfCurrentMonth, "yyyy-MM-dd'T'00:00:00.000xxx");
          const toDate = format(endOfCurrentMonth, "yyyy-MM-dd'T'23:59:59.999xxx");

          let allHolidays: HolidayDocument[] = [];
          try {
            const holidaysSnapshot = await getDocs(query(collection(firestore, 'holidays')));
            allHolidays = holidaysSnapshot.docs.map(doc => doc.data() as HolidayDocument);
            setHolidays(allHolidays);
          } catch (err) {
            console.warn("Could not fetch holidays (possibly permission denied).", err);
          }

          try {
            const employeesSnapshot = await getDocs(collection(firestore, 'employees'));
            setAllEmployees(employeesSnapshot.docs.map(doc => doc.data() as EmployeeDocument));
          } catch (err) {
            console.warn("Could not fetch all employees list (possibly permission denied).", err);
          }

          const leavesSnapshot = await getDocs(query(collection(firestore, 'leave_applications'), where('employeeId', '==', employeeData.id)));
          const allLeaves = leavesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveApplicationDocument));
          // setLeaves(allLeaves); // Handled by real-time listener

          const visitsSnapshot = await getDocs(query(collection(firestore, 'visit_applications'), where('employeeId', '==', employeeData.id)));
          const allVisits = visitsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VisitApplicationDocument));
          setVisits(allVisits);

          const advanceSalarySnapshot = await getDocs(query(collection(firestore, 'advance_salary'), where('employeeId', '==', employeeData.id)));
          setUserAdvanceSalary(advanceSalarySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdvanceSalaryDocument)));

          try {
            const payslipsSnapshot = await getDocs(query(collection(firestore, "payslips"), where("employeeId", "==", employeeData.id)));
            setPayslips(payslipsSnapshot.docs.map(d => d.data() as Payslip));
          } catch (err) {
            console.warn("Could not fetch payslips.", err);
          }

          const monthlyAttendanceSnapshot = await getDocs(query(collection(firestore, 'attendance'), where('employeeId', '==', employeeData.id), where('date', '>=', fromDate), where('date', '<=', toDate)));
          const currentMonthlyAttendance = monthlyAttendanceSnapshot.docs.map(doc => doc.data() as AttendanceDocument);

          let present = 0, delayed = 0, absent = 0, leaveDaysInMonth = 0, visitDaysInMonth = 0;
          const daysInMonth = eachDayOfInterval({ start: startOfCurrentMonth, end: today }); // Only count up to today

          allLeaves.forEach(l => {
            if (l.status === 'Approved') {
              const leaveStart = parseISO(l.fromDate);
              const leaveEnd = parseISO(l.toDate);
              const effectiveStart = max([leaveStart, startOfCurrentMonth]);
              const effectiveEnd = min([leaveEnd, endOfCurrentMonth]);
              if (effectiveEnd >= effectiveStart) {
                leaveDaysInMonth += differenceInCalendarDays(effectiveEnd, effectiveStart) + 1;
              }
            }
          });

          daysInMonth.forEach(day => {
            if (isFuture(day)) return;

            const dayStr = format(day, 'yyyy-MM-dd');
            const attendanceRecord = currentMonthlyAttendance.find(a => a.date.startsWith(dayStr));

            if (attendanceRecord) {
              if (attendanceRecord.flag === 'P') {
                present++;
              } else if (attendanceRecord.flag === 'D') {
                present++; // Delayed is still present, just late
                delayed++;
              } else if (attendanceRecord.flag === 'L') {
                leaveDaysInMonth++; // Count attendance records marked as leave
              } else if (attendanceRecord.flag === 'V') {
                visitDaysInMonth++; // Count attendance records marked as visit
              }
              return; // Don't count as absent if there is any record
            }

            // If no attendance record, check for other valid reasons for not being present
            const dayOfWeek = getDay(day);
            const isWeekend = dayOfWeek === 5; // Assuming Friday is the weekend
            const isOnLeave = allLeaves.some(l => l.status === 'Approved' && isWithinInterval(day, { start: parseISO(l.fromDate), end: parseISO(l.toDate) }));
            const isOnVisit = allVisits.some(v => v.status === 'Approved' && isWithinInterval(day, { start: parseISO(v.fromDate), end: parseISO(v.toDate) }));
            const isHoliday = allHolidays.some(h => isWithinInterval(day, { start: parseISO(h.fromDate), end: parseISO(h.toDate || h.fromDate) }));

            if (!isWeekend && !isOnLeave && !isOnVisit && !isHoliday) {
              absent++;
            }
          });

          // Fetch all advance salary records for this employee and filter client-side
          // to avoid composite index requirement
          const monthlyAdvanceSalarySnapshot = await getDocs(query(
            collection(firestore, 'advance_salary'),
            where('employeeId', '==', employeeData.id)
          ));
          const monthlyAdvance = monthlyAdvanceSalarySnapshot.docs
            .map(doc => doc.data() as AdvanceSalaryDocument)
            .filter(adv => {
              if (adv.status !== 'Approved') return false;
              const applyDate = adv.applyDate;
              return applyDate >= fromDate && applyDate <= toDate;
            });


          // Calculate monthly visit days from visit applications (adds to attendance-based count)
          allVisits.forEach(v => {
            if (v.status === 'Approved') {
              const visitStart = parseISO(v.fromDate);
              const visitEnd = parseISO(v.toDate);
              const effectiveStart = max([visitStart, startOfCurrentMonth]);
              const effectiveEnd = min([visitEnd, endOfCurrentMonth]);
              if (effectiveEnd >= effectiveStart) {
                visitDaysInMonth += differenceInCalendarDays(effectiveEnd, effectiveStart) + 1;
              }
            }
          });

          // Fetch monthly break records
          const fromDateStr = format(startOfCurrentMonth, 'yyyy-MM-dd');
          const toDateStr = format(endOfCurrentMonth, 'yyyy-MM-dd');
          const breaksSnapshot = await getDocs(query(
            collection(firestore, 'break_time'),
            where('employeeId', '==', employeeData.id)
          ));
          const monthlyBreakMinutes = breaksSnapshot.docs
            .map(doc => doc.data() as BreakTimeRecord)
            .filter(data => data.date >= fromDateStr && data.date <= toDateStr)
            .reduce((sum, data) => {
              return sum + (data.durationMinutes || 0);
            }, 0);

          setMonthlyStats({
            present: present,
            delayed: delayed,
            absent: absent,
            leave: leaveDaysInMonth,
            visit: visitDaysInMonth,
            advanceSalary: monthlyAdvance.reduce((sum, req) => sum + req.advanceAmount, 0),
            totalBreakMinutes: monthlyBreakMinutes,
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

  // Real-time listener for leave applications
  useEffect(() => {
    if (employeeData?.id) {
      const q = query(collection(firestore, 'leave_applications'), where('employeeId', '==', employeeData.id));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const updatedLeaves = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveApplicationDocument));
        setLeaves(updatedLeaves);
      }, (error) => {
        console.error("Error listening to leave applications:", error);
      });
      return () => unsubscribe();
    }
  }, [employeeData?.id]);

  const fetchAttendanceForRange = useCallback(async () => {
    if (!user || !employeeData?.id || !dateRange?.from) {
      setRangeAttendance([]);
      setIsAttendanceLoading(false);
      return;
    }
    setIsAttendanceLoading(true);
    try {
      const startDate = startOfDay(dateRange.from);
      const endDate = dateRange.to ? startOfDay(dateRange.to) : startDate;

      // Don't fetch future dates
      const today = startOfDay(new Date());
      const effectiveEndDate = endDate > today ? today : endDate;

      // Generate all dates in the range
      const allDates = eachDayOfInterval({ start: startDate, end: effectiveEndDate });

      // Fetch attendance documents individually by their IDs
      const fetchPromises = allDates.map(async (date) => {
        const formattedDate = format(date, 'yyyy-MM-dd');
        const docId = `${employeeData.id}_${formattedDate}`;
        const docRef = doc(firestore, 'attendance', docId);

        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            return { ...docSnap.data(), id: docSnap.id } as AttendanceDocument;
          }
        } catch (error) {
          console.error(`Error fetching attendance for ${formattedDate}:`, error);
        }
        return null;
      });

      const results = await Promise.all(fetchPromises);
      const attendanceRecords = results.filter((record): record is AttendanceDocument => record !== null);

      // Fetch breaks for this range
      const fromStr = format(startDate, 'yyyy-MM-dd');
      const toStr = format(effectiveEndDate, 'yyyy-MM-dd');
      const breaksSnap = await getDocs(query(
        collection(firestore, 'break_time'),
        where('employeeId', '==', employeeData.id)
      ));
      const breakRecords = breaksSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as BreakTimeRecord))
        .filter(rec => rec.date >= fromStr && rec.date <= toStr);

      setRangeAttendance(attendanceRecords);
      setRangeBreaks(breakRecords);
    } catch (err) {
      console.error("Error fetching attendance range:", err);
      setRangeAttendance([]);
    } finally {
      setIsAttendanceLoading(false);
    }
  }, [user, employeeData, dateRange]);

  useEffect(() => {
    fetchAttendanceForRange();
  }, [fetchAttendanceForRange]);


  const displayedAttendance = useMemo(() => {
    if (!employeeData?.id || !dateRange?.from) {
      return [];
    }

    const createPlaceholder = (day: Date, flag: AttendanceFlag): AttendanceDocument => ({
      date: format(day, 'yyyy-MM-dd'),
      flag,
      employeeId: employeeData.id,
      employeeName: employeeData.fullName,
    } as AttendanceDocument);

    // Generate all days in the range
    const startDate = startOfDay(dateRange.from);
    const endDate = dateRange.to ? startOfDay(dateRange.to) : startDate;

    // Don't show future dates
    const today = startOfDay(new Date());
    const effectiveEndDate = endDate > today ? today : endDate;

    if (startDate > effectiveEndDate) {
      return [];
    }

    const allDays = eachDayOfInterval({ start: startDate, end: effectiveEndDate });

    // Create a map of fetched attendance records by date
    const attendanceMap = new Map<string, AttendanceDocument>();
    rangeAttendance.forEach(att => {
      // Use ID if available for accurate date matching (avoids timezone/UTC mapping issues)
      // ID format is: employeeId_yyyy-MM-dd
      if (att.id && att.id.includes('_')) {
        const parts = att.id.split('_');
        const dateKey = parts[parts.length - 1]; // yyyy-MM-dd
        attendanceMap.set(dateKey, att);
      } else if (att.date) {
        // Fallback to date field if ID format is unexpected
        const dateKey = att.date.split('T')[0];
        attendanceMap.set(dateKey, att);
      }
    });

    // Generate attendance records for all days
    const records: AttendanceDocument[] = allDays.map(day => {
      const dateKey = format(day, 'yyyy-MM-dd');

      // If we have actual attendance data, use it
      if (attendanceMap.has(dateKey)) {
        return attendanceMap.get(dateKey)!;
      }

      // Otherwise create placeholder based on day status
      if (getDay(day) === 5) return createPlaceholder(day, 'W');

      const isHoliday = holidays.some(h => isWithinInterval(day, {
        start: parseISO(h.fromDate),
        end: parseISO(h.toDate || h.fromDate)
      }));
      if (isHoliday) return createPlaceholder(day, 'H');

      const isOnLeave = leaves.some(l => l.status === 'Approved' && isWithinInterval(day, {
        start: parseISO(l.fromDate),
        end: parseISO(l.toDate)
      }));
      if (isOnLeave) return createPlaceholder(day, 'L');

      const isOnVisit = visits.some(v => v.status === 'Approved' && isWithinInterval(day, {
        start: parseISO(v.fromDate),
        end: parseISO(v.toDate)
      }));
      if (isOnVisit) return createPlaceholder(day, 'V');

      return createPlaceholder(day, 'A');
    });

    // Sort by date descending (most recent first)
    return records.sort((a, b) => {
      const dateA = a.date ? new Date(a.date) : new Date(0);
      const dateB = b.date ? new Date(b.date) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [dateRange, rangeAttendance, holidays, leaves, visits, employeeData]);

  useEffect(() => {
    const today = startOfDay(new Date());

    if (employeeData?.status === 'Terminated') return;

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
    defaultValues: { displayName: '', photoURL: '' },
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
      form.reset({ displayName: user.displayName || '', photoURL: user.photoURL || '' });
    }
  }, [user, form]);

  const handleRefreshLocation = useCallback(async () => {
    const loc = await updateLocation(true, true);
    if (loc) setAttendanceLocation(loc);
  }, [updateLocation]);

  const submitDailyAttendance = async () => {
    if (!user || !employeeData || !attendanceLocation) {
      Swal.fire("Error", "Required data missing.", "error");
      return;
    }

    setAttendanceLoading(true);
    const now = new Date();
    const formattedDate = format(now, 'yyyy-MM-dd');
    const currentTime = format(now, 'hh:mm a');
    const docId = `${employeeData.id}_${formattedDate}`;
    const docRef = doc(firestore, 'attendance', docId);

    try {
      if (dailyAttendanceType === 'in') {
        const flag = determineAttendanceFlag(currentTime);
        const dataToSet = {
          employeeId: employeeData.id,
          employeeName: employeeData.fullName,
          date: format(now, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
          flag: flag,
          inTime: currentTime,
          inTimeRemarks: attendanceRemarks,
          inTimeLocation: attendanceLocation,
          updatedBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(docRef, dataToSet, { merge: true });
        setDailyAttendance(dataToSet as AttendanceDocument);

        fetch('/api/notify/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'in_time',
            employeeId: employeeData.id,
            employeeName: employeeData.fullName,
            employeeCode: employeeData.employeeCode,
            employeeEmail: employeeData.email,
            employeePhone: employeeData.phone,
            time: currentTime,
            date: format(now, 'PPP'),
            flag: flag,
            location: attendanceLocation,
            remarks: attendanceRemarks
          })
        }).catch(err => console.error('Notification error:', err));

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
          outTimeRemarks: attendanceRemarks,
          outTimeLocation: attendanceLocation,
          updatedAt: serverTimestamp(),
        };
        await updateDoc(docRef, dataToSet);
        setDailyAttendance(prev => prev ? { ...prev, ...dataToSet } as AttendanceDocument : null);

        fetch('/api/notify/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'out_time',
            employeeId: employeeData.id,
            employeeName: employeeData.fullName,
            employeeCode: employeeData.employeeCode,
            employeeEmail: employeeData.email,
            employeePhone: employeeData.phone,
            time: currentTime,
            date: format(now, 'PPP'),
            location: attendanceLocation,
            remarks: attendanceRemarks
          })
        }).catch(err => console.error('Notification error:', err));

        Swal.fire("Clocked Out!", `Your departure at ${currentTime} has been recorded.`, "success");
      }
      fetchAttendanceForRange();
      setIsDailyAttendanceOpen(false);
      setAttendanceRemarks('');
    } catch (error: any) {
      console.error("Error updating attendance:", error);
      Swal.fire("Error", `Failed to record attendance: ${error.message}`, "error");
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleAttendance = async (type: 'in' | 'out') => {
    if (!user || !employeeData) {
      Swal.fire("Error", "User or employee data not available.", "error");
      return;
    }

    if (employeeData.status === 'Terminated') {
      Swal.fire("Access Denied", "Your are Terminated. Please Contact with HR department.", "error");
      return;
    }

    setAttendanceLoading(true);
    try {
      const location = await updateLocation(true, true);
      if (location) {
        setAttendanceLocation(location);
        setDailyAttendanceType(type);
        setAttendanceRemarks('');
        setIsDailyAttendanceOpen(true);
      }
    } catch (error: any) {
      console.error("Geolocation error:", error);
      // Extra safety as updateLocation already shows Swal if true is passed
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleViewLocation = (location: { latitude: number; longitude: number; address?: string } | undefined | null) => {
    if (location) {
      setViewLocation({ lat: location.latitude, lng: location.longitude, address: location.address });
      setIsViewLocationOpen(true);
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
    if (employeeData?.status === 'Terminated') {
      Swal.fire("Access Denied", "Your are Terminated. Please Contact with HR department.", "error");
      return;
    }
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
    if (!completedCrop || !imgRef.current || !selectedFile) {
      Swal.fire("Error", "Could not process the image crop.", "error");
      return;
    }

    if (completedCrop.width === 0 || completedCrop.height === 0) {
      Swal.fire("Error", "Invalid crop selection. Please try again.", "error");
      return;
    }

    setIsUploading(true);
    const croppedImageBlob = await getCroppedImg(imgRef.current, completedCrop, selectedFile.name, 256, 256);

    if (!croppedImageBlob) {
      Swal.fire("Error", "Failed to create cropped image.", "error");
      setIsUploading(false);
      return;
    }

    if (!user || !auth.currentUser) {
      Swal.fire("Error", "You must be logged in to upload an image.", "error");
      setIsUploading(false);
      return;
    }

    try {
      const storageRef = ref(storage, `profileImages/${user.uid}/profile.jpg`);
      const snapshot = await uploadBytes(storageRef, croppedImageBlob);
      const downloadURL = await getDownloadURL(snapshot.ref);

      await updateProfile(auth.currentUser, { photoURL: downloadURL });
      form.setValue('photoURL', downloadURL, { shouldDirty: true }); // Update form state

      // This will be saved to Firestore on form submit

      setIsCroppingDialogOpen(false);
      Swal.fire({
        title: "Image Staged",
        text: "Your new profile picture is ready. Click 'Save Changes' to apply it.",
        icon: "info"
      });

    } catch (err: any) {
      console.error("Error staging profile picture:", err);
      Swal.fire("Upload Failed", `Failed to stage image: ${err.message}`, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handlePasteURL = async () => {
    if (employeeData?.status === 'Terminated') {
      Swal.fire("Access Denied", "Your are Terminated. Please Contact with HR department.", "error");
      return;
    }
    const result = await Swal.fire({
      title: 'Paste Profile Picture URL',
      input: 'url',
      inputPlaceholder: 'https://example.com/photo.jpg',
      showCancelButton: true,
      confirmButtonText: 'Set URL',
      inputValidator: (value) => {
        if (!value) {
          return 'Please enter a URL';
        }
        try {
          new URL(value);
          return null;
        } catch {
          return 'Please enter a valid URL';
        }
      }
    });

    if (result.isConfirmed && result.value) {
      form.setValue('photoURL', result.value, { shouldDirty: true });
      Swal.fire({
        title: 'URL Set',
        text: 'Click "Save Changes" to apply the new profile picture.',
        icon: 'success',
        timer: 1000,
        showConfirmButton: false
      });
    }
  };

  const onSubmitProfile = async (data: AccountDetailsFormValues) => {
    if (!auth.currentUser) {
      Swal.fire("Error", "No user logged in.", "error");
      return;
    }

    if (employeeData?.status === 'Terminated') {
      Swal.fire("Access Denied", "Your are Terminated. Please Contact with HR department.", "error");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await updateProfile(auth.currentUser, {
        displayName: data.displayName,
        photoURL: data.photoURL,
      });

      if (auth.currentUser.uid) {
        const userDocRef = doc(firestore, "users", auth.currentUser.uid);
        await updateDoc(userDocRef, {
          displayName: data.displayName,
          photoURL: data.photoURL,
          updatedAt: serverTimestamp()
        });
      }

      await auth.currentUser.reload();
      if (setAuthUser && auth.currentUser) {
        setAuthUser({ ...auth.currentUser });
      }

      Swal.fire({
        title: "Profile Updated",
        text: "Your profile has been updated successfully.",
        icon: "success",
        timer: 1000,
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

  const handleBlockedAction = (e: React.MouseEvent, href: string) => {
    if (employeeData?.status === 'Terminated') {
      e.preventDefault();
      Swal.fire("Access Denied", "Your are Terminated. Please Contact with HR department.", "error");
    } else {
      // Normal navigation will happen if not terminated and it's a Link
    }
  };

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
    <div className="mx-[10px] mt-[10px] mb-[50px] p-0 pb-[10px] md:mx-0 md:mt-0 md:mb-0 md:py-8 md:px-5 space-y-8 max-w-[calc(100vw-20px)] md:max-w-full overflow-x-hidden">
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
                    <img ref={imgRef} src={imgSrc} alt="Crop preview" onLoad={onImageLoad} style={{ maxHeight: '70vh' }} />
                  </ReactCrop>
                )}
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline" disabled={isUploading}>Cancel</Button></DialogClose>
                  <Button onClick={handleCropAndUpload} disabled={isUploading || !completedCrop?.width}>
                    {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : <><CropIcon className="mr-2 h-4 w-4" />Crop & Set</>}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Location View Dialog */}
            <Dialog open={isViewLocationOpen} onOpenChange={setIsViewLocationOpen}>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Location Details</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <GeofenceMap
                    userLocation={viewLocation}
                    branchLocation={employeeBranch ? {
                      lat: Number(employeeBranch.latitude),
                      lng: Number(employeeBranch.longitude),
                      radius: Number(employeeBranch.allowRadius || 100),
                      name: employeeBranch.name,
                      address: employeeBranch.address
                    } : null}
                    hotspots={branchHotspots.map(h => ({
                      lat: Number(h.latitude),
                      lng: Number(h.longitude),
                      radius: Number(h.allowRadius || 100),
                      name: h.name,
                      address: h.address
                    }))}
                  />
                  {/* Info cards removed as they are now in map popups */}
                </div>
                <DialogFooter>
                  <Button onClick={() => setIsViewLocationOpen(false)}>Close</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <form onSubmit={form.handleSubmit(onSubmitProfile)} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-x-8 gap-y-6 items-center">
                <div className="lg:col-span-1 flex flex-col items-center justify-center">
                  <Avatar className="h-24 w-24 border-2 border-primary shadow-md flex-shrink-0">
                    <AvatarImage src={user.photoURL || undefined} alt={user.displayName || "User Avatar"} />
                    <AvatarFallback className="text-3xl">
                      {getInitials(user.displayName || user.email || "U")}
                    </AvatarFallback>
                  </Avatar>
                </div>

                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Name</FormLabel>
                        <div className="flex gap-2 items-center">
                          <FormControl>
                            <Input placeholder="Your display name" {...field} />
                          </FormControl>
                          <div className="flex gap-1">
                            <input
                              type="file"
                              ref={profilePictureRef}
                              className="hidden"
                              accept="image/png, image/jpeg"
                              onChange={onFileSelect}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => profilePictureRef.current?.click()}
                              title="Upload Picture"
                              className="h-10 w-10 flex-shrink-0"
                            >
                              <Camera className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={handlePasteURL}
                              title="Paste URL"
                              className="h-10 w-10 flex-shrink-0"
                            >
                              <Link2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
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
                        {dayStatus === 'Working Day' && employeeData?.status !== 'Terminated' ? <UserCheck className="h-4 w-4 text-primary" /> : <XCircle className="h-4 w-4 text-destructive" />}
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
                            {attendanceLoading && !dailyAttendance?.inTime ? <Loader2 className="h-5 w-5 animate-spin" /> : (dailyAttendance?.inTime ? <Check className="h-5 w-5" /> : <Clock className="h-5 w-5" />)}
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
                            {attendanceLoading && !dailyAttendance?.outTime ? <Loader2 className="h-5 w-5 animate-spin" /> : (dailyAttendance?.outTime ? <Check className="h-5 w-5 text-green-500" /> : <Clock className="h-5 w-5" />)}
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
                  {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : (<><Save className="mr-2 h-4 w-4" />Save Changes</>)}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className={cn("flex items-center gap-2", "font-bold text-xl lg:text-2xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
              <BarChart3 className="h-6 w-6 text-primary" />
              This Month&apos;s Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
              <StatCard title="Total Present" value={monthlyStats.present} icon={<UserCheck />} description="Days present this month" className="bg-green-500" />
              <StatCard title="Total Absent" value={monthlyStats.absent} icon={<UserX />} description="Days absent this month" className="bg-red-500" />
              <StatCard title="Total Delayed" value={monthlyStats.delayed} icon={<Clock />} description="Late arrivals this month" className="bg-yellow-500" />
              <StatCard title="Total On Leave" value={monthlyStats.leave} icon={<Plane />} description="Leave days this month" className="bg-blue-500" />
              <StatCard title="Total On Visit" value={monthlyStats.visit} icon={<Briefcase />} description="Visit days this month" className="bg-indigo-500" />
              <StatCard title="Advance Salary" value={formatCurrency(monthlyStats.advanceSalary)} icon={<Wallet />} description="Taken this month" className="bg-purple-500" />
              <StatCard
                title="Total Break"
                value={`${Math.floor(monthlyStats.totalBreakMinutes / 60)}h ${monthlyStats.totalBreakMinutes % 60}m`}
                icon={<Coffee />}
                description="Total break time this month"
                className="bg-orange-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Supervisor Cards - My Team and Check-In History */}
        {employeeData && (isSupervisor || supervisedEmployeeIds.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EmployeeSupervisionCard currentEmployeeId={employeeData.id} />
            <TeamCheckInCard
              isSupervisor={isSupervisor}
              supervisedEmployeeIds={supervisedEmployeeIds}
            />
          </div>
        )}

        {employeeData && (isSupervisor || supervisedEmployeeIds.length > 0) && (
          <TeamAttendanceCard supervisedEmployeeIds={supervisedEmployeeIds} />
        )}


        {/* Break Time Section */}
        <div className={cn(
          "grid gap-6",
          employeeData && (isSupervisor || supervisedEmployeeIds.length > 0) ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
        )}>
          {/* Personal Break Time Card */}
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-xl lg:text-2xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <Clock className="h-6 w-6 text-primary" />
                Break Time
              </CardTitle>
              <CardDescription>
                Start or stop your break. Standard break (1:00 PM - 2:00 PM) is auto-approved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center p-6 space-y-4">
                <div className={cn(
                  "h-32 w-32 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-500 animate-pulse-slow",
                  isOnBreak ? "border-orange-500 bg-orange-50 text-orange-600 shadow-orange-100 shadow-2xl" : "border-green-500 bg-green-50 text-green-600"
                )}>
                  {isOnBreak ? <Timer className="h-10 w-10 animate-spin-slow" /> : <Coffee className="h-10 w-10" />}
                  <span className="text-sm font-bold mt-1">{isOnBreak ? "On Break" : "Working"}</span>
                </div>

                <div className="text-center">
                  {isOnBreak ? (
                    <div className="space-y-1">
                      <p className="text-3xl font-mono font-bold text-orange-600 tracking-wider">
                        {breakElapsedTime}
                      </p>
                      <p className="text-xs text-muted-foreground italic">
                        Started at: {activeBreakRecord?.startTime ? format(new Date(activeBreakRecord.startTime), 'hh:mm a') : '...'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Take a break when you need it.
                    </p>
                  )}
                </div>

                <Button
                  size="lg"
                  variant={isOnBreak ? "destructive" : "default"}
                  className={cn(
                    "w-48 h-12 font-bold transition-all duration-300 transform active:scale-95",
                    isOnBreak ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
                  )}
                  onClick={handleToggleBreak}
                  disabled={breakLoading}
                >
                  {breakLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    isOnBreak ? "Stop Break" : "Start Break"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Team Break Time Card for Supervisors */}
          {employeeData && (isSupervisor || supervisedEmployeeIds.length > 0) && (
            <TeamBreakTimeCard
              isSupervisor={isSupervisor}
              supervisedEmployeeIds={supervisedEmployeeIds}
            />
          )}
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className={cn("flex items-center gap-2", "font-bold text-xl lg:text-2xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
              <MapPin className="h-6 w-6 text-primary" />
              Multiple Check In/Out
            </CardTitle>
            <CardDescription>
              Record your check-in or check-out with location and photo verification.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Type Selector */}
              <div className="space-y-2">
                <Label htmlFor="checkInOutType">Type *</Label>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant={checkInOutType === 'Check In' ? 'default' : 'outline'}
                    onClick={() => setCheckInOutType('Check In')}
                    disabled={lastCheckInOutRecord?.type === 'Check In'}
                    className={cn(
                      "flex-1 transition-all duration-300",
                      checkInOutType === 'Check In' && "bg-blue-600 hover:bg-blue-700 text-white shadow-md transform scale-105"
                    )}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Check In
                  </Button>
                  <Button
                    type="button"
                    variant={checkInOutType === 'Check Out' ? 'default' : 'outline'}
                    onClick={() => setCheckInOutType('Check Out')}
                    disabled={!lastCheckInOutRecord || lastCheckInOutRecord?.type === 'Check Out'}
                    className={cn(
                      "flex-1 transition-all duration-300",
                      checkInOutType === 'Check Out' && "bg-blue-600 hover:bg-blue-700 text-white shadow-md transform scale-105"
                    )}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Check Out
                  </Button>
                </div>
              </div>

              {/* Company Name */}
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name {multiCheckConfig?.isCompanyNameMandatory && '*'}</Label>
                <Input
                  id="companyName"
                  placeholder={checkInOutType === 'Check Out' ? "Auto-filled from Check In" : "Enter company name"}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  readOnly={checkInOutType === 'Check Out'}
                  className={checkInOutType === 'Check Out' ? 'bg-muted cursor-not-allowed' : ''}
                />
                {checkInOutType === 'Check Out' && companyName && (
                  <p className="text-xs text-muted-foreground">Company name from your last check-in</p>
                )}
              </div>

              {/* Camera Capture */}
              <div className="space-y-2">
                <Label>
                  Photo {checkInOutType === 'Check In'
                    ? (multiCheckConfig?.isCheckInImageMandatory ? '*' : '(Optional)')
                    : (multiCheckConfig?.isCheckOutImageMandatory ? '*' : '(Optional)')}
                </Label>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setCapturedImage(file);
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setImagePreview(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1"
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    {capturedImage ? 'Change Photo' : 'Capture Photo'}
                  </Button>
                  {capturedImage && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={() => {
                        setCapturedImage(null);
                        setImagePreview('');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {imagePreview && (
                  <div className="mt-2 border rounded-lg p-2">
                    <img src={imagePreview} alt="Preview" className="w-full max-h-48 object-contain rounded" />
                  </div>
                )}
              </div>

              {/* Location captured section consolidated below */}

              <div className="space-y-2">
                <Label>Location * (Auto-captured)</Label>
                {isLoadingLocation ? (
                  <div className="flex items-center gap-2 p-3 border rounded-md bg-muted">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Capturing your location...</span>
                  </div>
                ) : currentLocation ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-3 border rounded-md bg-green-50 dark:bg-green-950">
                      <MapPin className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm text-green-700 dark:text-green-300 flex-1 break-words">
                        {currentLocation.address || `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          window.open(`https://www.google.com/maps?q=${currentLocation.latitude},${currentLocation.longitude}`, '_blank');
                        }}
                        title="View on Map"
                      >
                        <MapPin className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => updateLocation(true, true)}
                      className="w-full text-xs"
                    >
                      <RefreshCw className="mr-2 h-3 w-3" />
                      Refresh Location
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-3 border rounded-md bg-yellow-50 dark:bg-yellow-950">
                      <XCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      <span className="text-sm text-yellow-700 dark:text-yellow-300">Location not captured</span>
                    </div>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => updateLocation(true, true)}
                      className="w-full"
                    >
                      <MapPin className="mr-2 h-4 w-4" />
                      Capture Location
                    </Button>
                  </div>
                )}
              </div>

              {/* Remarks */}
              <div className="space-y-2">
                <Label htmlFor="checkInOutRemarks">Remarks *</Label>
                <Input
                  id="checkInOutRemarks"
                  placeholder="Add any additional notes"
                  value={checkInOutRemarks}
                  onChange={(e) => setCheckInOutRemarks(e.target.value)}
                />
              </div>

              {/* Submit Button */}
              <Button
                type="button"
                className="w-full"
                onClick={async () => {
                  if (!employeeData) {
                    Swal.fire('Error', 'Employee data not found', 'error');
                    return;
                  }

                  if (employeeData.status === 'Terminated') {
                    Swal.fire("Access Denied", "Your are Terminated. Please Contact with HR department.", "error");
                    return;
                  }

                  // Enrollment logic based on multiCheckConfig
                  if (multiCheckConfig) {
                    // 1. Mandatory Company Name
                    if (multiCheckConfig.isCompanyNameMandatory && !companyName.trim()) {
                      Swal.fire('Validation Error', 'Visited company name is mandatory.', 'error');
                      return;
                    }

                    // 2. Mandatory Images
                    if (checkInOutType === 'Check In' && multiCheckConfig.isCheckInImageMandatory && !capturedImage) {
                      Swal.fire('Validation Error', 'Check-in image is mandatory.', 'error');
                      return;
                    }
                    if (checkInOutType === 'Check Out' && multiCheckConfig.isCheckOutImageMandatory && !capturedImage) {
                      Swal.fire('Validation Error', 'Check-out image is mandatory.', 'error');
                      return;
                    }

                    // 3. Logic: Multiple check-in without check-out
                    if (checkInOutType === 'Check In' && !multiCheckConfig.isMultipleCheckInAllowedWithoutCheckOut) {
                      if (lastRecord && lastRecord.type === 'Check In') {
                        Swal.fire('Access Denied', 'You have an active check-in. Please check out before marking a new check-in.', 'warning');
                        return;
                      }
                    }

                    // 4. Logic: Multiple check-out against single check-in
                    if (checkInOutType === 'Check Out' && !multiCheckConfig.isMultipleCheckOutAllowedAgainstSingleCheckIn) {
                      if (!lastRecord || lastRecord.type === 'Check Out') {
                        Swal.fire('Access Denied', 'You must check-in before you can mark a check-out.', 'warning');
                        return;
                      }
                    }

                    // 5. Max Hour Limit for Check Out
                    if (checkInOutType === 'Check Out' && lastRecord && lastRecord.type === 'Check In') {
                      const checkInTime = new Date(lastRecord.timestamp).getTime();
                      const nowTime = new Date().getTime();
                      const diffHours = (nowTime - checkInTime) / (1000 * 60 * 60);

                      if (diffHours > multiCheckConfig.maxHourLimitOfCheckOut) {
                        Swal.fire('Limit Exceeded', `Maximum allowed time between check-in and check-out is ${multiCheckConfig.maxHourLimitOfCheckOut} hours. Your current duration is ${diffHours.toFixed(1)} hours.`, 'error');
                        return;
                      }
                    }
                  }

                  setIsSubmittingCheckInOut(true);
                  try {
                    // Force capture location if missing or stale
                    let submissionLocation = currentLocation;
                    if (!submissionLocation) {
                      submissionLocation = await updateLocation(true);
                      if (!submissionLocation) {
                        setIsSubmittingCheckInOut(false);
                        return; // updateLocation already showed the error
                      }
                    }

                    // Upload image
                    let imageURL = '';
                    if (capturedImage) {
                      imageURL = await uploadCheckInOutImage(capturedImage, employeeData.id, checkInOutType);
                    }

                    // Geofence Validation Logic
                    let status: 'Approved' | 'Pending' | 'Rejected' = 'Approved';
                    let distanceFromBranch = 0;
                    let isInsideGeofence = true;

                    if (employeeBranch && employeeBranch.latitude && employeeBranch.longitude) {
                      const R = 6371e3; // metres
                      const lat1 = submissionLocation?.latitude || 0;
                      const lon1 = submissionLocation?.longitude || 0;
                      const lat2 = employeeBranch.latitude;
                      const lon2 = employeeBranch.longitude;

                      const φ1 = lat1 * Math.PI / 180;
                      const φ2 = lat2 * Math.PI / 180;
                      const Δφ = (lat2 - lat1) * Math.PI / 180;
                      const Δλ = (lon2 - lon1) * Math.PI / 180;

                      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                        Math.cos(φ1) * Math.cos(φ2) *
                        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
                      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                      distanceFromBranch = R * c;

                      const radius = employeeBranch.allowRadius || 50;
                      isInsideGeofence = distanceFromBranch <= radius;

                      if (!isInsideGeofence) {
                        status = 'Pending';
                      }
                    }

                    // Create record
                    await createCheckInOutRecord(
                      employeeData.id,
                      employeeData.fullName,
                      companyName,
                      checkInOutType,
                      submissionLocation || { latitude: 0, longitude: 0, address: 'Location unavailable' },
                      imageURL,
                      checkInOutRemarks,
                      {
                        status,
                        distanceFromBranch,
                        isInsideGeofence
                      }
                    );

                    // Send notifications (non-blocking)
                    const now = new Date();
                    fetch('/api/notify/attendance', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        type: checkInOutType === 'Check In' ? 'check_in' : 'check_out',
                        employeeId: employeeData.id,
                        employeeName: employeeData.fullName,
                        employeeCode: employeeData.employeeCode,
                        employeeEmail: employeeData.email,
                        employeePhone: employeeData.phone,
                        time: format(now, 'hh:mm a'),
                        date: format(now, 'PPP'),
                        location: currentLocation,
                        companyName: companyName,
                        remarks: checkInOutRemarks,
                        photoUrl: imageURL
                      })
                    }).catch(err => console.error('Notification error:', err));

                    if (status === 'Pending') {
                      Swal.fire('Attendance Forwarded', 'You are outside the allowed radius. Your attendance has been forwarded to your Supervisor for review.', 'warning');
                    } else {
                      Swal.fire('Success', `${checkInOutType} recorded successfully!`, 'success');
                    }

                    // Reset form
                    setCompanyName('');
                    setCheckInOutRemarks('');
                    setCapturedImage(null);
                    setImagePreview('');
                    setCurrentLocation(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';

                    // Refresh status
                    await fetchLastCheckInOutRecord();
                  } catch (error: any) {
                    console.error('Error submitting check-in/out:', error);
                    Swal.fire('Submission Failed', error.message || 'Failed to record check-in/out', 'error');
                  } finally {
                    setIsSubmittingCheckInOut(false);
                  }
                }}
                disabled={isSubmittingCheckInOut}
              >
                {isSubmittingCheckInOut ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>
                ) : (
                  <><Check className="mr-2 h-4 w-4" />Submit {checkInOutType}</>
                )}
              </Button>

              {/* View Records Link */}
              <div className="text-center">
                <Link href="/dashboard/hr/multiple-check-in-out?myRecords=true" className="text-sm text-primary hover:underline">
                  View My Check-In/Out History →
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>


        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="shadow-xl h-full">
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 font-bold text-xl lg:text-2xl text-primary bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out">
                      <CalendarIcon className="h-6 w-6 text-primary" /> Quick Attendance View
                    </CardTitle>
                    <CardDescription>
                      Your attendance records for the selected date range.
                    </CardDescription>
                  </div>
                  <DatePickerWithRange
                    date={dateRange}
                    onDateChange={setDateRange}
                    className="w-full sm:w-auto"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {isAttendanceLoading ? (
                  <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : displayedAttendance.length === 0 ? (
                  <p className="text-muted-foreground text-center">No attendance data found for the selected day.</p>
                ) : (
                  <div className="overflow-x-auto w-full max-w-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>In Time</TableHead>
                          <TableHead>Out Time</TableHead>
                          <TableHead>Break</TableHead>
                          <TableHead>Flag</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayedAttendance.map((att, index) => (
                          <TableRow key={att?.date || index}>
                            <TableCell>{formatDisplayDate(att?.date)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {att?.inTime || 'N/A'}
                                {att?.inTimeLocation && (
                                  <Button
                                    type="button" variant="ghost" size="icon" className="h-6 w-6"
                                    onClick={() => handleViewLocation(att.inTimeLocation)} title="View In-Time Location">
                                    <MapPin className="h-3.5 w-3.5 text-blue-500" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {att?.outTime || 'N/A'}
                                {att?.outTimeLocation && (
                                  <Button
                                    type="button" variant="ghost" size="icon" className="h-6 w-6"
                                    onClick={() => handleViewLocation(att.outTimeLocation)} title="View Out-Time Location">
                                    <MapPin className="h-3.5 w-3.5 text-orange-500" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const dayDate = att?.date ? (typeof att.date === 'string' ? att.date : format(new Date(att.date), 'yyyy-MM-dd')) : '';
                                const dayBreaks = rangeBreaks.filter(b => b.date === dayDate);
                                const totalMins = dayBreaks.reduce((sum, b) => sum + (b.durationMinutes || 0), 0);
                                if (totalMins === 0) return <span className="text-muted-foreground">-</span>;
                                const h = Math.floor(totalMins / 60);
                                const m = totalMins % 60;
                                return <span className="font-mono text-xs">{h > 0 ? `${h}h ` : ''}{m}m</span>;
                              })()}
                            </TableCell>
                            <TableCell>
                              <Badge variant={att?.flag === 'P' ? 'default' : att?.flag === 'D' ? 'destructive' : 'secondary'}>
                                {att?.flag}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                let dateKey = '';
                                if (att.id && att.id.includes('_')) {
                                  // ID format: employeeId_yyyy-MM-dd
                                  const parts = att.id.split('_');
                                  dateKey = parts[parts.length - 1];
                                } else if (att.date) {
                                  dateKey = att.date.split('T')[0];
                                }

                                const rec = reconciliations.get(dateKey);
                                if (rec) {
                                  return (
                                    <Badge variant={rec.status === 'approved' ? 'default' : rec.status === 'rejected' ? 'destructive' : 'secondary'}>
                                      {rec.status.toUpperCase()}
                                    </Badge>
                                  );
                                }
                                return <span className="text-muted-foreground text-xs">None</span>;
                              })()}
                            </TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm" onClick={() => handleReconciliationClick(att)}>Edit</Button>
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
                <CardTitle className="flex items-center gap-2">
                  <div className="relative">
                    <Bell className="h-5 w-5 text-primary" />
                    <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full" />
                  </div>
                  <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent font-bold">
                    Notice Board
                  </span>
                </CardTitle>
              </CardHeader>

              <CardContent>
                {isLoadingNotices ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : !notices || notices.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center">No active notices available.</p>
                ) : (
                  <ScrollArea className="h-96 pr-4">
                    <div className="space-y-4">
                      {notices.map((notice, index) => (
                        <div
                          key={notice.id}
                          className="group/notice p-4 border-2 rounded-xl bg-gradient-to-br from-background via-background to-primary/5 hover:to-primary/10 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 cursor-pointer relative overflow-hidden"
                          style={{
                            animationDelay: `${index * 100}ms`,
                            animation: 'slideIn 0.5s ease-out forwards'
                          }}
                        >
                          {/* Animated corner accent */}
                          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-bl-full transform scale-0 group-hover/notice:scale-100 transition-transform duration-500" />

                          {/* Icon */}
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg group-hover/notice:shadow-blue-500/50 group-hover/notice:scale-110 transition-all duration-300">
                              <Bell className="h-5 w-5 text-white" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <h4
                                className="font-bold text-base mb-2 bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent group-hover/notice:from-blue-600 group-hover/notice:to-purple-600 transition-all duration-300 cursor-pointer hover:underline"
                                onClick={() => {
                                  setSelectedNotice(notice);
                                  setIsNoticeDialogOpen(true);
                                }}
                              >
                                {notice.title}
                              </h4>

                              {/* Separator line */}
                              <div className="h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent mb-3" />

                              <div className="text-xs prose prose-sm dark:prose-invert max-w-none text-muted-foreground line-clamp-2 mb-3"
                                dangerouslySetInnerHTML={{ __html: notice.content ? notice.content.substring(0, 100) + '...' : '' }}
                              />

                              <div className="flex items-center justify-between text-xs mt-auto pt-2">
                                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                  <CalendarIcon className="h-3 w-3" />
                                  <span className="font-medium">
                                    {notice.updatedAt ? format(new Date((notice.updatedAt as any).seconds * 1000), 'PPP') : 'N/A'}
                                  </span>
                                </div>
                                <span className="px-2 py-1 rounded-full bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 text-green-700 dark:text-green-300 font-semibold text-[10px]">
                                  ACTIVE
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Bottom shine effect */}
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover/notice:opacity-100 transition-opacity duration-500" />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Current Leave Status Card */}
        {leaveGroup && (
          <Card className="shadow-xl">
            <CardHeader>
              <div className="flex flex-row justify-between items-center">
                <div className="space-y-1.5">
                  <CardTitle className={cn("flex items-center gap-2", "font-bold text-xl lg:text-2xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                    <Plane className="h-6 w-6 text-primary" />
                    Current Leave Status
                  </CardTitle>
                  <CardDescription>
                    Leave balances based on <strong>{leaveGroup.groupName}</strong> policy for {new Date().getFullYear()}.
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="view-mode" className={cn("text-sm font-medium", viewMode === 'list' ? "text-primary" : "text-muted-foreground")}>List</Label>
                  <Switch
                    id="view-mode"
                    checked={viewMode === 'graph'}
                    onCheckedChange={(checked) => setViewMode(checked ? 'graph' : 'list')}
                  />
                  <Label htmlFor="view-mode" className={cn("text-sm font-medium", viewMode === 'graph' ? "text-primary" : "text-muted-foreground")}>Graph</Label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {viewMode === 'list' ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Leave Type</TableHead>
                        <TableHead className="text-center">Total Allowed</TableHead>
                        <TableHead className="text-center">Used (Approved)</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveBalances.map((balance) => (
                        <TableRow key={balance.name}>
                          <TableCell className="font-medium">{balance.name}</TableCell>
                          <TableCell className="text-center">{balance.allowed}</TableCell>
                          <TableCell className="text-center">{balance.used}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={balance.balance > 0 ? "default" : "destructive"}>
                              {balance.balance}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 py-4">
                  {leaveBalances.map((balance, index) => {
                    const data = [
                      { name: 'Leave remaining', value: balance.balance, color: '#10b981' }, // emerald-500
                      { name: 'Leave taken', value: balance.used, color: '#3b82f6' }, // blue-500
                    ];
                    // If purely empty (no balance, no used), don't show or show empty state? 
                    // Assuming valid config, at least allowed > 0.

                    return (
                      <div key={balance.name} className="flex flex-col items-center justify-center p-4 bg-background rounded-xl border shadow-sm">
                        <h4 className="text-lg font-semibold mb-2 text-center text-foreground">{balance.name}</h4>
                        <div className="h-[200px] w-full relative">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={0}
                                dataKey="value"
                                startAngle={90}
                                endAngle={-270}
                              >
                                {data.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                ))}
                              </Pie>
                              <RechartsTooltip
                                formatter={(value: any, name: any) => [value, name]}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          {/* Center Text Overlay */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-bold text-blue-500">{balance.used}</span>
                            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Takens</span>
                          </div>
                        </div>
                        <div className="w-full mt-4 space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-blue-500" />
                              <span className="text-muted-foreground">Leave taken</span>
                            </div>
                            <span className="font-bold text-blue-500">{balance.used}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-emerald-500" />
                              <span className="text-muted-foreground">Leave remaining</span>
                            </div>
                            <span className="font-bold text-emerald-500">{balance.balance}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-xl lg:text-2xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <Plane className="h-6 w-6 text-primary" />
                Leave Applications
              </CardTitle>
              <CardDescription>Your recent leave applications.</CardDescription>
            </div>
            <Button asChild onClick={(e) => handleBlockedAction(e, "/dashboard/hr/leaves/add")}>
              <Link href={employeeData?.status === 'Terminated' ? "#" : "/dashboard/hr/leaves/add"}>
                <PlusCircle className="mr-2 h-4 w-4" />Apply
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto w-full">
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
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-xl lg:text-2xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <Briefcase className="h-6 w-6 text-primary" />
                Visit Applications
              </CardTitle>
              <CardDescription>Your recent official visit applications.</CardDescription>
            </div>
            <Button asChild onClick={(e) => handleBlockedAction(e, "/dashboard/hr/visit-applications/add")}>
              <Link href={employeeData?.status === 'Terminated' ? "#" : "/dashboard/hr/visit-applications/add"}>
                <PlusCircle className="mr-2 h-4 w-4" />Apply
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto w-full">
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
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-xl lg:text-2xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <Wallet className="h-6 w-6 text-primary" />
                Advance Salary Requests
              </CardTitle>
              <CardDescription>Your recent advance salary applications.</CardDescription>
            </div>
            <Button asChild onClick={(e) => handleBlockedAction(e, "/dashboard/hr/payroll/advance-salary/add")}>
              <Link href={employeeData?.status === 'Terminated' ? "#" : "/dashboard/hr/payroll/advance-salary/add"}>
                <PlusCircle className="mr-2 h-4 w-4" />Apply
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto w-full">
              <Table><TableHeader><TableRow><TableHead>Apply Date</TableHead><TableHead>Amount</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {userAdvanceSalary.length > 0 ? userAdvanceSalary.slice(0, 3).map(req => (
                    <TableRow key={req.id}><TableCell>{formatDisplayDate(req.applyDate)}</TableCell><TableCell>{formatCurrency(req.advanceAmount)}</TableCell><TableCell>{req.reason}</TableCell><TableCell><Badge variant={req.status === 'Approved' ? 'default' : 'secondary'}>{req.status}</Badge></TableCell></TableRow>
                  )) : <TableRow><TableCell colSpan={4} className="text-center">No advance salary requests found.</TableCell></TableRow>}
                </TableBody></Table>
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
              <div className="overflow-x-auto w-full">
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



        <div className="mt-8 w-full">
          <LeaveCalendar birthdays={birthdaysToday} />
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className={cn("flex items-center gap-2", "font-bold text-xl lg:text-2xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
              <Info className="h-6 w-6 text-primary" />
              Employee Information
            </CardTitle>
            <CardDescription>Your complete employee profile details organized by category.</CardDescription>
          </CardHeader>
          <CardContent>
            {employeeData ? (
              <Tabs defaultValue="personal" className="w-full">
                <TabsList className="flex flex-wrap gap-2 mb-6 p-1 h-auto bg-transparent">
                  <TabsTrigger
                    value="personal"
                    className="flex-1 min-w-[120px] sm:min-w-[150px] rounded-xl px-4 py-3 text-xs font-bold transition-all duration-300 border-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:border-blue-500 data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/50 data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600 data-[state=inactive]:border-gray-200 hover:data-[state=inactive]:bg-gray-200 hover:data-[state=inactive]:border-gray-300 dark:data-[state=inactive]:bg-gray-800 dark:data-[state=inactive]:text-gray-400 dark:data-[state=inactive]:border-gray-700"
                  >
                    Personal Information
                  </TabsTrigger>
                  <TabsTrigger
                    value="professional"
                    className="flex-1 min-w-[120px] sm:min-w-[150px] rounded-xl px-4 py-3 text-xs font-bold transition-all duration-300 border-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:border-blue-500 data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/50 data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600 data-[state=inactive]:border-gray-200 hover:data-[state=inactive]:bg-gray-200 hover:data-[state=inactive]:border-gray-300 dark:data-[state=inactive]:bg-gray-800 dark:data-[state=inactive]:text-gray-400 dark:data-[state=inactive]:border-gray-700"
                  >
                    Professional Details
                  </TabsTrigger>
                  <TabsTrigger
                    value="education"
                    className="flex-1 min-w-[120px] sm:min-w-[150px] rounded-xl px-4 py-3 text-xs font-bold transition-all duration-300 border-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:border-blue-500 data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/50 data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600 data-[state=inactive]:border-gray-200 hover:data-[state=inactive]:bg-gray-200 hover:data-[state=inactive]:border-gray-300 dark:data-[state=inactive]:bg-gray-800 dark:data-[state=inactive]:text-gray-400 dark:data-[state=inactive]:border-gray-700"
                  >
                    Education Information
                  </TabsTrigger>
                  <TabsTrigger
                    value="bank"
                    className="flex-1 min-w-[120px] sm:min-w-[150px] rounded-xl px-4 py-3 text-xs font-bold transition-all duration-300 border-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:border-blue-500 data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/50 data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600 data-[state=inactive]:border-gray-200 hover:data-[state=inactive]:bg-gray-200 hover:data-[state=inactive]:border-gray-300 dark:data-[state=inactive]:bg-gray-800 dark:data-[state=inactive]:text-gray-400 dark:data-[state=inactive]:border-gray-700"
                  >
                    Bank Account Information
                  </TabsTrigger>
                  <TabsTrigger
                    value="salary"
                    className="flex-1 min-w-[120px] sm:min-w-[150px] rounded-xl px-4 py-3 text-xs font-bold transition-all duration-300 border-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:border-blue-500 data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/50 data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600 data-[state=inactive]:border-gray-200 hover:data-[state=inactive]:bg-gray-200 hover:data-[state=inactive]:border-gray-300 dark:data-[state=inactive]:bg-gray-800 dark:data-[state=inactive]:text-gray-400 dark:data-[state=inactive]:border-gray-700"
                  >
                    Salary Information
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="personal" className="space-y-4">
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
                </TabsContent>

                <TabsContent value="professional" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                    {renderReadOnlyField("Employee Code*", employeeData.employeeCode)}
                    {renderReadOnlyField("Designation*", employeeData.designation)}
                    {renderReadOnlyField("Joined Date*", formatDisplayDate(employeeData.joinedDate))}
                    {renderReadOnlyField("Mobile No*", employeeData.phone)}
                    {renderReadOnlyField("Employee Status", employeeData.status)}
                    {renderReadOnlyField("Job Base*", employeeData.jobBase)}
                    {renderReadOnlyField("Job Base Effective Date*", formatDisplayDate(employeeData.jobBaseEffectiveDate))}
                  </div>
                </TabsContent>

                <TabsContent value="education" className="space-y-4">
                  <div className="overflow-x-auto w-full">
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
                  </div>
                </TabsContent>

                <TabsContent value="bank" className="space-y-4">
                  <div className="overflow-x-auto w-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account Name</TableHead>
                          <TableHead>Bank</TableHead>
                          <TableHead>Account No.</TableHead>
                          <TableHead>Routing No</TableHead>
                          <TableHead>Branch Name</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employeeData.bankDetails && employeeData.bankDetails.length > 0 ? employeeData.bankDetails.map((bank, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{bank.accountName}</TableCell>
                            <TableCell>{bank.bankName}</TableCell>
                            <TableCell>{bank.accountNo}</TableCell>
                            <TableCell>{bank.accountRoutingNo || 'N/A'}</TableCell>
                            <TableCell>{bank.branchName || 'N/A'}</TableCell>
                          </TableRow>
                        )) : (
                          <TableRow><TableCell colSpan={5} className="text-center">No bank details found.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="salary" className="space-y-4">
                  {renderReadOnlyField("Gross Salary", formatCurrency(employeeData.salaryStructure?.grossSalary))}
                </TabsContent>
              </Tabs>
            ) : (
              <p className="text-muted-foreground">No detailed employee profile found.</p>
            )}
          </CardContent>
        </Card>


      </Form>
      <Dialog open={isReconciliationModalOpen} onOpenChange={setIsReconciliationModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Attendance Reconciliation Request</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="p-4 bg-muted/30 rounded-lg border">
              <h4 className="font-semibold mb-2 flex items-center gap-2"><CalendarIcon className="h-4 w-4" /> Date: {selectedAttendanceForReconciliation?.date ? formatDisplayDate(selectedAttendanceForReconciliation.date) : 'N/A'}</h4>
              <p className="text-sm text-muted-foreground">Original Status: {selectedAttendanceForReconciliation?.flag || 'N/A'}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* In Time Section */}
              <div className="space-y-4 border p-4 rounded-lg">
                <h4 className="font-medium text-primary flex items-center gap-2"><Clock className="h-4 w-4" /> In Time Correction</h4>
                <div className="space-y-2">
                  <Label>Current In Time</Label>
                  <Input value={selectedAttendanceForReconciliation?.inTime || 'Not Marked'} readOnly disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Current Remarks</Label>
                  <Input value={selectedAttendanceForReconciliation?.inTimeRemarks || 'None'} readOnly disabled className="bg-muted" />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>New In Time</Label>
                  <div className="flex gap-2">
                    {/* Hour Select */}
                    <Select value={inTimeHour} onValueChange={setInTimeHour}>
                      <SelectTrigger className="w-[70px]">
                        <SelectValue placeholder="HH" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => {
                          const h = (i + 1).toString().padStart(2, '0');
                          return <SelectItem key={h} value={h}>{h}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                    <span className="self-center font-bold">:</span>
                    {/* Minute Select */}
                    <Select value={inTimeMinute} onValueChange={setInTimeMinute}>
                      <SelectTrigger className="w-[70px]">
                        <SelectValue placeholder="MM" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 60 }, (_, i) => {
                          const m = i.toString().padStart(2, '0');
                          return <SelectItem key={m} value={m}>{m}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                    {/* Period Select */}
                    <Select value={inTimePeriod} onValueChange={(val: 'AM' | 'PM') => setInTimePeriod(val)}>
                      <SelectTrigger className="w-[70px]">
                        <SelectValue placeholder="AM/PM" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AM">AM</SelectItem>
                        <SelectItem value="PM">PM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Select hour, minute, and period.</p>
                </div>
                <div className="space-y-2">
                  <Label>Correction Remarks</Label>
                  <Input
                    placeholder="Why do you need this change?"
                    value={reconciliationForm.inTimeRemarks}
                    onChange={(e) => setReconciliationForm(prev => ({ ...prev, inTimeRemarks: e.target.value }))}
                  />
                </div>
              </div>

              {/* Out Time Section */}
              <div className="space-y-4 border p-4 rounded-lg">
                <h4 className="font-medium text-primary flex items-center gap-2"><Clock className="h-4 w-4" /> Out Time Correction</h4>
                <div className="space-y-2">
                  <Label>Current Out Time</Label>
                  <Input value={selectedAttendanceForReconciliation?.outTime || 'Not Marked'} readOnly disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Current Remarks</Label>
                  <Input value={selectedAttendanceForReconciliation?.outTimeRemarks || 'None'} readOnly disabled className="bg-muted" />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>New Out Time</Label>
                  <div className="flex gap-2">
                    {/* Hour Select */}
                    <Select value={outTimeHour} onValueChange={setOutTimeHour}>
                      <SelectTrigger className="w-[70px]">
                        <SelectValue placeholder="HH" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => {
                          const h = (i + 1).toString().padStart(2, '0');
                          return <SelectItem key={h} value={h}>{h}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                    <span className="self-center font-bold">:</span>
                    {/* Minute Select */}
                    <Select value={outTimeMinute} onValueChange={setOutTimeMinute}>
                      <SelectTrigger className="w-[70px]">
                        <SelectValue placeholder="MM" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 60 }, (_, i) => {
                          const m = i.toString().padStart(2, '0');
                          return <SelectItem key={m} value={m}>{m}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                    {/* Period Select */}
                    <Select value={outTimePeriod} onValueChange={(val: 'AM' | 'PM') => setOutTimePeriod(val)}>
                      <SelectTrigger className="w-[70px]">
                        <SelectValue placeholder="AM/PM" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AM">AM</SelectItem>
                        <SelectItem value="PM">PM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Select hour, minute, and period.</p>
                </div>
                <div className="space-y-2">
                  <Label>Correction Remarks</Label>
                  <Input
                    placeholder="Why do you need this change?"
                    value={reconciliationForm.outTimeRemarks}
                    onChange={(e) => setReconciliationForm(prev => ({ ...prev, outTimeRemarks: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReconciliationModalOpen(false)}>Cancel</Button>
            <Button onClick={handleReconciliationSubmit} disabled={isSubmittingReconciliation}>
              {isSubmittingReconciliation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notice Board Full View Dialog */}
      <Dialog open={isNoticeDialogOpen} onOpenChange={setIsNoticeDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              {selectedNotice?.title || "Notice"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedNotice?.updatedAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarIcon className="h-4 w-4" />
                <span>
                  {format(new Date((selectedNotice.updatedAt as any).seconds * 1000), 'PPP')}
                </span>
              </div>
            )}
            <Separator />
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: selectedNotice?.content || '' }}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setIsNoticeDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Daily Attendance Dialog */}
      <Dialog open={isDailyAttendanceOpen} onOpenChange={setIsDailyAttendanceOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Enter {dailyAttendanceType === 'in' ? 'In Time' : 'Out Time'} Remarks (Optional)</DialogTitle>
            <DialogDescription>
              Confirm your location and add any relevant notes for your attendance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="relative">
              <GeofenceMap
                userLocation={attendanceLocation ? { lat: attendanceLocation.latitude, lng: attendanceLocation.longitude, address: attendanceLocation.address } : null}
                branchLocation={employeeBranch ? {
                  lat: Number(employeeBranch.latitude),
                  lng: Number(employeeBranch.longitude),
                  radius: Number(employeeBranch.allowRadius || 100),
                  name: employeeBranch.name,
                  address: employeeBranch.address
                } : null}
                hotspots={branchHotspots.map(h => ({
                  lat: Number(h.latitude),
                  lng: Number(h.longitude),
                  radius: Number(h.allowRadius || 100),
                  name: h.name,
                  address: h.address
                }))}
                onRefresh={handleRefreshLocation}
                isLoading={isLoadingLocation}
              />
              {/* Manual legend and branch address overlay removed */}
            </div>

            <div className="space-y-2">
              <Label htmlFor="daily-remarks">Remarks</Label>
              <Textarea
                id="daily-remarks"
                placeholder="Type your remarks here..."
                value={attendanceRemarks}
                onChange={(e) => setAttendanceRemarks(e.target.value)}
                className="min-h-[80px]"
              />
              {/* Captured location text removed */}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDailyAttendanceOpen(false)}>Cancel</Button>
            <Button onClick={submitDailyAttendance} disabled={attendanceLoading}>
              {attendanceLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}







