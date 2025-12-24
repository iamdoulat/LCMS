"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Image as ImageIcon, Loader2, Clock, AlertCircle, Building2, User, Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2 } from 'lucide-react';
import { getCheckInOutRecords, createCheckInOutRecord } from '@/lib/firebase/checkInOut';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, where, getDocs, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { firestore, storage } from '@/lib/firebase/config';
import type { MultipleCheckInOutRecord, CheckInOutType } from '@/types/checkInOut';
import type { EmployeeDocument, MultipleCheckInOutConfiguration } from '@/types';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Grouped visit type
interface GroupedVisit {
    employeeId: string;
    employeeName: string;
    companyName: string;
    checkIn: MultipleCheckInOutRecord;
    checkOut: MultipleCheckInOutRecord | null;
    duration: number | null; // in milliseconds
    exceedsEightHours: boolean;
    companyColor: string;
}

// Function to generate consistent color based on company name
function getCompanyColor(companyName: string): string {
    const colors = [
        'from-blue-500 to-blue-600',
        'from-purple-500 to-purple-600',
        'from-pink-500 to-pink-600',
        'from-green-500 to-green-600',
        'from-orange-500 to-orange-600',
        'from-teal-500 to-teal-600',
        'from-indigo-500 to-indigo-600',
        'from-rose-500 to-rose-600',
        'from-cyan-500 to-cyan-600',
        'from-emerald-500 to-emerald-600',
    ];

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < companyName.length; i++) {
        hash = ((hash << 5) - hash) + companyName.charCodeAt(i);
        hash = hash & hash;
    }

    return colors[Math.abs(hash) % colors.length];
}

// Function to format duration
function formatDuration(milliseconds: number): string {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

export default function MultipleCheckInOutPage() {
    const searchParams = useSearchParams();
    const { user, userRole } = useAuth();
    const { isSupervisor, supervisedEmployeeIds } = useSupervisorCheck(user?.email);
    const isHROrAdmin = userRole?.some(role => ['Super Admin', 'Admin', 'HR'].includes(role));
    const viewTeam = searchParams.get('view') === 'team';
    const myRecordsOnly = searchParams.get('myRecords') === 'true';

    const [records, setRecords] = useState<MultipleCheckInOutRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
    const [selectedType, setSelectedType] = useState<string>('all');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [selectedRecord, setSelectedRecord] = useState<MultipleCheckInOutRecord | null>(null);
    const [showImageDialog, setShowImageDialog] = useState(false);
    const [multiCheckConfig, setMultiCheckConfig] = useState<MultipleCheckInOutConfiguration | null>(null);

    // Fetch multiple check in/out configuration
    useEffect(() => {
        const unsub = onSnapshot(doc(firestore, 'hrm_settings', 'multi_check_in_out'), (docSnap) => {
            if (docSnap.exists()) {
                setMultiCheckConfig(docSnap.data() as MultipleCheckInOutConfiguration);
            }
        });
        return () => unsub();
    }, []);

    // Fetch current user's employee data
    useEffect(() => {
        const fetchEmployeeData = async () => {
            if (user?.email && myRecordsOnly) {
                try {
                    const employeesQuery = query(
                        collection(firestore, 'employees'),
                        where('email', '==', user.email)
                    );
                    const snapshot = await getDocs(employeesQuery);
                    if (!snapshot.empty) {
                        const employeeData = snapshot.docs[0];
                        setSelectedEmployee(employeeData.id);
                    }
                } catch (error) {
                    console.error('Error fetching employee data:', error);
                }
            }
        };
        fetchEmployeeData();
    }, [user, myRecordsOnly]);

    const { data: employees } = useFirestoreQuery<EmployeeDocument[]>(
        collection(firestore, 'employees'),
        undefined,
        ['employees_for_checkinout']
    );

    // Filter employees based on supervisor access
    const filteredEmployees = React.useMemo(() => {
        if (!employees) return [];
        if (isHROrAdmin) return employees; // HR/Admin see all
        if (isSupervisor) {
            // Supervisors see only their team
            return employees.filter(emp => supervisedEmployeeIds.includes(emp.id));
        }
        return []; // Regular users see nothing in the list
    }, [employees, isHROrAdmin, isSupervisor, supervisedEmployeeIds]);

    useEffect(() => {
        const fetchRecords = async () => {
            setIsLoading(true);
            try {
                const filters: any = {};

                if (selectedEmployee !== 'all') {
                    filters.employeeId = selectedEmployee;
                } else if (!isHROrAdmin && isSupervisor && supervisedEmployeeIds.length > 0) {
                    // For supervisors viewing 'all', fetch only their team's records
                    // Note: getCheckInOutRecords might need to support filtering by employee IDs array
                    // For now, we'll fetch all and filter client-side
                }

                if (selectedType !== 'all') {
                    filters.type = selectedType as CheckInOutType;
                }

                if (fromDate) {
                    filters.fromDate = fromDate;
                }

                if (toDate) {
                    filters.toDate = toDate;
                }

                const data = await getCheckInOutRecords(filters);

                // Filter by supervisor access if needed
                let accessFilteredData = data;
                if (((!isHROrAdmin && isSupervisor) || (isHROrAdmin && isSupervisor && viewTeam)) && selectedEmployee === 'all') {
                    accessFilteredData = data.filter(record =>
                        supervisedEmployeeIds.includes(record.employeeId)
                    );
                }

                // Auto-checkout logic for visits exceeding 8 hours
                await handleAutoCheckout(accessFilteredData);

                // Refetch after auto-checkout to get updated records
                const updatedData = await getCheckInOutRecords(filters);

                // Apply same filtering after refetch
                let finalData = updatedData;
                if (((!isHROrAdmin && isSupervisor) || (isHROrAdmin && isSupervisor && viewTeam)) && selectedEmployee === 'all') {
                    finalData = updatedData.filter(record =>
                        supervisedEmployeeIds.includes(record.employeeId)
                    );
                }

                setRecords(finalData);
            } catch (error) {
                console.error('Error fetching records:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchRecords();
    }, [selectedEmployee, selectedType, fromDate, toDate, isHROrAdmin, isSupervisor, supervisedEmployeeIds]);

    // Function to handle automatic checkout for visits exceeding 8 hours
    const handleAutoCheckout = async (allRecords: MultipleCheckInOutRecord[]) => {
        try {
            const checkIns = allRecords.filter(r => r.type === 'Check In');
            const checkOuts = allRecords.filter(r => r.type === 'Check Out');
            const now = new Date().getTime();
            const maxHoursInMs = (multiCheckConfig?.maxHourLimitOfCheckOut || 8) * 60 * 60 * 1000;

            for (const checkIn of checkIns) {
                // Check if there's already a checkout for this check-in
                const hasCheckout = checkOuts.some(checkOut =>
                    checkOut.employeeId === checkIn.employeeId &&
                    checkOut.companyName === checkIn.companyName &&
                    new Date(checkOut.timestamp) > new Date(checkIn.timestamp) &&
                    new Date(checkOut.timestamp).getTime() - new Date(checkIn.timestamp).getTime() < 24 * 60 * 60 * 1000
                );

                if (!hasCheckout) {
                    const checkInTime = new Date(checkIn.timestamp).getTime();
                    const timeSinceCheckIn = now - checkInTime;

                    // If more than max hours have passed, auto-checkout
                    if (timeSinceCheckIn > maxHoursInMs) {
                        // Calculate checkout time as exactly max hours after check-in
                        const autoCheckoutTime = new Date(checkInTime + maxHoursInMs);

                        await createCheckInOutRecord(
                            checkIn.employeeId,
                            checkIn.employeeName,
                            checkIn.companyName,
                            'Check Out',
                            checkIn.location, // Use same location as check-in
                            '', // No image for auto-checkout
                            `Auto check-out: Visit exceeded ${multiCheckConfig?.maxHourLimitOfCheckOut || 8} hours. Automatically checked out at ${format(autoCheckoutTime, 'hh:mm a')}`
                        );


                    }
                }
            }
        } catch (error) {
            console.error('Error in auto-checkout:', error);
        }
    };

    const openMap = (record: MultipleCheckInOutRecord) => {
        const { latitude, longitude } = record.location;
        window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, '_blank');
    };

    const handleDeleteVisit = async (visit: GroupedVisit) => {
        const result = await Swal.fire({
            title: 'Delete Visit?',
            text: `Are you sure you want to delete this visit for ${visit.employeeName} at ${visit.companyName}? This will remove both check-in and check-out records.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                // Delete images from storage if they exist
                if (visit.checkIn.imageURL) {
                    try {
                        const imageRef = ref(storage, visit.checkIn.imageURL);
                        await deleteObject(imageRef);
                    } catch (err) {
                        console.error('Error deleting check-in image:', err);
                    }
                }

                if (visit.checkOut?.imageURL) {
                    try {
                        const imageRef = ref(storage, visit.checkOut.imageURL);
                        await deleteObject(imageRef);
                    } catch (err) {
                        console.error('Error deleting check-out image:', err);
                    }
                }

                // Delete check-in
                await deleteDoc(doc(firestore, 'multiple_check_inout', visit.checkIn.id!));

                // Delete check-out if exists
                if (visit.checkOut) {
                    await deleteDoc(doc(firestore, 'multiple_check_inout', visit.checkOut.id!));
                }

                Swal.fire('Deleted!', 'The visit records have been deleted.', 'success');

                // Refresh records list
                setRecords(prev => prev.filter(r =>
                    r.id !== visit.checkIn.id &&
                    (!visit.checkOut || r.id !== visit.checkOut.id)
                ));
            } catch (error: any) {
                console.error('Error deleting visit:', error);
                Swal.fire('Error', `Failed to delete: ${error.message}`, 'error');
            }
        }
    };

    // Group records into visits
    const groupedVisits = useMemo(() => {
        const maxHours = multiCheckConfig?.maxHourLimitOfCheckOut || 8;
        const maxHoursInMs = maxHours * 60 * 60 * 1000;
        const visits: GroupedVisit[] = [];
        const checkIns = records.filter(r => r.type === 'Check In');
        const checkOuts = records.filter(r => r.type === 'Check Out');

        checkIns.forEach(checkIn => {
            // Find matching checkout (same employee, same company, after check-in time)
            const matchingCheckOut = checkOuts.find(checkOut =>
                checkOut.employeeId === checkIn.employeeId &&
                checkOut.companyName === checkIn.companyName &&
                new Date(checkOut.timestamp) > new Date(checkIn.timestamp) &&
                new Date(checkOut.timestamp).getTime() - new Date(checkIn.timestamp).getTime() < 24 * 60 * 60 * 1000 // Within 24 hours
            );

            let duration: number | null = null;
            let exceedsEightHours = false;

            if (matchingCheckOut) {
                duration = new Date(matchingCheckOut.timestamp).getTime() - new Date(checkIn.timestamp).getTime();
                exceedsEightHours = duration > maxHoursInMs; // Check against configured max hours
            } else {
                // No checkout yet - check if it's been more than max hours since check-in
                const now = new Date().getTime();
                const checkInTime = new Date(checkIn.timestamp).getTime();
                const timeSinceCheckIn = now - checkInTime;
                exceedsEightHours = timeSinceCheckIn > maxHoursInMs;
            }

            visits.push({
                employeeId: checkIn.employeeId,
                employeeName: checkIn.employeeName,
                companyName: checkIn.companyName,
                checkIn,
                checkOut: matchingCheckOut || null,
                duration,
                exceedsEightHours,
                companyColor: getCompanyColor(checkIn.companyName),
            });
        });

        return visits;
    }, [records, multiCheckConfig]);

    // Pagination Logic
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 5;

    // Reset to first page when records change (e.g. filters applied)
    useEffect(() => {
        setCurrentPage(1);
    }, [records]);

    const totalPages = Math.ceil(groupedVisits.length / ITEMS_PER_PAGE);
    const paginatedVisits = groupedVisits.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="m-[10px] p-0 md:w-full md:p-6 md:space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl font-bold flex items-center gap-2">
                        <MapPin className="h-6 w-6 text-primary" />
                        {myRecordsOnly ? 'My Check In/Out History' : 'Multiple Check In/Out'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {!isHROrAdmin && isSupervisor && (
                        <Alert className="mb-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                You are viewing check-in/out records for your team members only ({supervisedEmployeeIds.length} employee{supervisedEmployeeIds.length !== 1 ? 's' : ''}).
                            </AlertDescription>
                        </Alert>
                    )}
                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>Employee</Label>
                            <Select
                                value={selectedEmployee}
                                onValueChange={setSelectedEmployee}
                                disabled={myRecordsOnly}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Employee" />
                                </SelectTrigger>
                                <SelectContent>
                                    {!myRecordsOnly && <SelectItem value="all">All Employees</SelectItem>}
                                    {filteredEmployees?.map(emp => (
                                        <SelectItem key={emp.id} value={emp.id}>
                                            {emp.fullName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>From Date</Label>
                            <Input
                                type="datetime-local"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>To Date</Label>
                            <Input
                                type="datetime-local"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Select Options</Label>
                            <Select value={selectedType} onValueChange={setSelectedType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="Check In">Check In</SelectItem>
                                    <SelectItem value="Check Out">Check Out</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Grouped Records Display */}
                    <div className="space-y-4">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : groupedVisits.length === 0 ? (
                            <div className="flex items-center justify-center h-64 text-muted-foreground">
                                No records found
                            </div>
                        ) : (
                            <>
                                {paginatedVisits.map((visit, index) => (
                                    <Card
                                        key={`${visit.checkIn.id}-${index}`}
                                        className="overflow-hidden border-2 hover:shadow-lg transition-shadow duration-300"
                                    >
                                        {/* Company Header */}
                                        <div className={cn(
                                            "bg-gradient-to-r text-white p-4",
                                            visit.companyColor
                                        )}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Building2 className="h-5 w-5" />
                                                    <div>
                                                        <h3 className="font-bold text-lg">{visit.companyName}</h3>
                                                        <p className="text-sm opacity-90 flex items-center gap-1">
                                                            <User className="h-3 w-3" />
                                                            {visit.employeeName}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    {visit.duration && (
                                                        <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
                                                            <Clock className="h-4 w-4" />
                                                            <span className="font-semibold">{formatDuration(visit.duration)}</span>
                                                        </div>
                                                    )}
                                                    {visit.exceedsEightHours && (
                                                        <Badge variant="destructive" className="mt-2">
                                                            <AlertCircle className="h-3 w-3 mr-1" />
                                                            Exceeded 8 Hours
                                                        </Badge>
                                                    )}
                                                </div>
                                                {/* Delete Button for Admin/HR */}
                                                {(userRole?.includes('Super Admin') || userRole?.includes('Admin') || userRole?.includes('HR')) && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-white hover:bg-white/20 hover:text-white transition-colors"
                                                        onClick={() => handleDeleteVisit(visit)}
                                                        title="Delete Visit"
                                                    >
                                                        <Trash2 className="h-5 w-5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Visit Details */}
                                        <CardContent className="p-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {/* Check In */}
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                                            <div className="h-3 w-3 rounded-full bg-green-500"></div>
                                                        </div>
                                                        <h4 className="font-semibold text-green-700 dark:text-green-400">Check In</h4>
                                                    </div>

                                                    <div className="space-y-2 pl-10">
                                                        <div className="flex items-start gap-2 text-sm">
                                                            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                            <span>{format(new Date(visit.checkIn.timestamp), 'PPP')}</span>
                                                        </div>
                                                        <div className="flex items-start gap-2 text-sm">
                                                            <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                            <span className="font-medium">{format(new Date(visit.checkIn.timestamp), 'hh:mm a')}</span>
                                                        </div>
                                                        <div className="flex items-start gap-2 text-sm">
                                                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                            <span className="text-muted-foreground truncate">
                                                                {visit.checkIn.location.address || `${visit.checkIn.location.latitude.toFixed(4)}, ${visit.checkIn.location.longitude.toFixed(4)}`}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm">
                                                            <span className="font-medium text-muted-foreground">Remarks: </span>
                                                            <span className="text-muted-foreground italic">
                                                                {visit.checkIn.remarks || 'No remarks'}
                                                            </span>
                                                        </div>

                                                        <div className="flex gap-2 pt-2">
                                                            <div className="flex items-center gap-2">
                                                                {visit.checkIn.imageURL && (
                                                                    <img
                                                                        src={visit.checkIn.imageURL}
                                                                        alt="Check-in thumbnail"
                                                                        className="h-12 w-12 rounded-md object-cover border-2 border-gray-200 dark:border-gray-700 hover:border-primary transition-colors cursor-pointer"
                                                                        onClick={() => {
                                                                            setSelectedRecord(visit.checkIn);
                                                                            setShowImageDialog(true);
                                                                        }}
                                                                    />
                                                                )}
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setSelectedRecord(visit.checkIn);
                                                                        setShowImageDialog(true);
                                                                    }}
                                                                >
                                                                    <ImageIcon className="h-4 w-4 mr-1" />
                                                                    View Photo
                                                                </Button>
                                                            </div>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => openMap(visit.checkIn)}
                                                            >
                                                                <MapPin className="h-4 w-4 mr-1" />
                                                                View Map
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Check Out */}
                                                <div className="space-y-3">
                                                    {visit.checkOut ? (
                                                        <>
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                                                    <div className="h-3 w-3 rounded-full bg-red-500"></div>
                                                                </div>
                                                                <h4 className="font-semibold text-red-700 dark:text-red-400">Check Out</h4>
                                                            </div>

                                                            <div className="space-y-2 pl-10">
                                                                <div className="flex items-start gap-2 text-sm">
                                                                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                                    <span>{format(new Date(visit.checkOut.timestamp), 'PPP')}</span>
                                                                </div>
                                                                <div className="flex items-start gap-2 text-sm">
                                                                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                                    <span className="font-medium">{format(new Date(visit.checkOut.timestamp), 'hh:mm a')}</span>
                                                                </div>
                                                                <div className="flex items-start gap-2 text-sm">
                                                                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                                    <span className="text-muted-foreground truncate">
                                                                        {visit.checkOut.location.address || `${visit.checkOut.location.latitude.toFixed(4)}, ${visit.checkOut.location.longitude.toFixed(4)}`}
                                                                    </span>
                                                                </div>
                                                                <div className="text-sm">
                                                                    <span className="font-medium text-muted-foreground">Remarks: </span>
                                                                    <span className="text-muted-foreground italic">
                                                                        {visit.checkOut.remarks || 'No remarks'}
                                                                    </span>
                                                                </div>

                                                                <div className="flex gap-2 pt-2">
                                                                    <div className="flex items-center gap-2">
                                                                        {visit.checkOut.imageURL && (
                                                                            <img
                                                                                src={visit.checkOut.imageURL}
                                                                                alt="Check-out thumbnail"
                                                                                className="h-12 w-12 rounded-md object-cover border-2 border-gray-200 dark:border-gray-700 hover:border-primary transition-colors cursor-pointer"
                                                                                onClick={() => {
                                                                                    setSelectedRecord(visit.checkOut);
                                                                                    setShowImageDialog(true);
                                                                                }}
                                                                            />
                                                                        )}
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => {
                                                                                setSelectedRecord(visit.checkOut);
                                                                                setShowImageDialog(true);
                                                                            }}
                                                                        >
                                                                            <ImageIcon className="h-4 w-4 mr-1" />
                                                                            View Photo
                                                                        </Button>
                                                                    </div>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => openMap(visit.checkOut!)}
                                                                    >
                                                                        <MapPin className="h-4 w-4 mr-1" />
                                                                        View Map
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="flex items-center justify-center h-full">
                                                            <div className="text-center space-y-2 p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border-2 border-dashed border-yellow-300 dark:border-yellow-700">
                                                                <AlertCircle className="h-8 w-8 text-yellow-600 dark:text-yellow-400 mx-auto" />
                                                                <p className="font-semibold text-yellow-700 dark:text-yellow-400">No Check Out Yet</p>
                                                                <p className="text-sm text-yellow-600 dark:text-yellow-500">
                                                                    {(() => {
                                                                        const now = new Date().getTime();
                                                                        const checkInTime = new Date(visit.checkIn.timestamp).getTime();
                                                                        const elapsed = now - checkInTime;
                                                                        return `Elapsed: ${formatDuration(elapsed)}`;
                                                                    })()}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-2 mt-8 py-4">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => handlePageChange(1)}
                                            disabled={currentPage === 1}
                                            title="First Page"
                                        >
                                            <ChevronsLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                                            disabled={currentPage === 1}
                                            title="Previous Page"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>

                                        <div className="flex items-center gap-1 mx-2">
                                            <span className="text-sm font-medium">Page {currentPage} of {totalPages}</span>
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                                            disabled={currentPage === totalPages}
                                            title="Next Page"
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => handlePageChange(totalPages)}
                                            disabled={currentPage === totalPages}
                                            title="Last Page"
                                        >
                                            <ChevronsRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Image Dialog */}
            <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Check In/Out Photo</DialogTitle>
                    </DialogHeader>
                    {selectedRecord && (
                        <div className="space-y-4">
                            {selectedRecord.imageURL ? (
                                <img
                                    src={selectedRecord.imageURL}
                                    alt="Check in/out photo"
                                    className="w-full rounded-lg"
                                    onError={(e) => {
                                        // Handle broken image
                                        e.currentTarget.style.display = 'none';
                                        const parent = e.currentTarget.parentElement;
                                        if (parent) {
                                            const errorDiv = document.createElement('div');
                                            errorDiv.className = 'flex items-center justify-center h-64 bg-muted rounded-lg';
                                            errorDiv.innerHTML = '<div class="text-center space-y-2"><svg class="h-12 w-12 text-muted-foreground mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg><p class="text-muted-foreground font-medium">Image could not be loaded</p></div>';
                                            parent.appendChild(errorDiv);
                                        }
                                    }}
                                />
                            ) : (
                                <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
                                    <div className="text-center space-y-2">
                                        <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto" />
                                        <p className="text-muted-foreground font-medium">No image available</p>
                                        <p className="text-sm text-muted-foreground">Photo was not captured during {selectedRecord.type.toLowerCase()}</p>
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="font-semibold">Employee:</p>
                                    <p>{selectedRecord.employeeName}</p>
                                </div>
                                <div>
                                    <p className="font-semibold">Company:</p>
                                    <p>{selectedRecord.companyName}</p>
                                </div>
                                <div>
                                    <p className="font-semibold">Type:</p>
                                    <p>{selectedRecord.type}</p>
                                </div>
                                <div>
                                    <p className="font-semibold">Time:</p>
                                    <p>{format(new Date(selectedRecord.timestamp), 'dd-MM-yyyy, hh:mm a')}</p>
                                </div>
                            </div>
                            {selectedRecord.remarks && (
                                <div>
                                    <p className="font-semibold text-sm">Remarks:</p>
                                    <p className="text-sm text-muted-foreground">{selectedRecord.remarks}</p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div >
    );
}
