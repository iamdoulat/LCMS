
"use client";

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { determineAttendanceFlag } from '@/lib/firebase/utils';
import { collection, query, orderBy, where, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import type { EmployeeDocument, BranchDocument, UnitDocument, DepartmentDocument, AttendanceDocument, AttendanceFlag, HolidayDocument, LeaveApplicationDocument, VisitApplicationDocument } from '@/types';
import { attendanceFlagOptions } from '@/types';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { cn } from '@/lib/utils';
import { format, isValid, eachDayOfInterval, startOfDay, endOfDay, parseISO, differenceInMinutes, parse as parseDateFns, getDay, isWithinInterval as isWithinDateInterval, subDays } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import Link from 'next/link';


import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Search, Minus, Plus, PlusCircle, Trash2, Calendar, Filter, Save, Upload, AlertTriangle, MapPin } from 'lucide-react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DatePickerField } from '@/components/forms/DatePickerField';


const ALL_BRANCHES_VALUE = "__ALL_BRANCHES_ATTENDANCE__";
const ALL_UNITS_VALUE = "__ALL_UNITS_ATTENDANCE__";
const ALL_DEPTS_VALUE = "__ALL_DEPTS_ATTENDANCE__";
const ALL_FLAGS_VALUE = "__ALL_FLAGS_ATTENDANCE__";


const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
};

const attendanceDaySchema = z.object({
    flag: z.enum(attendanceFlagOptions),
    inTime: z.string().optional(),
    inTimeRemarks: z.string().optional(),
    outTime: z.string().optional(),
    outTimeRemarks: z.string().optional(),
});
type AttendanceDayFormValues = z.infer<typeof attendanceDaySchema>;

// Helper to convert "10:41 AM" to "10:41"
const parse12HourTo24Hour = (time12h?: string): string => {
    if (!time12h) return '';
    try {
        const date = parseDateFns(time12h, 'hh:mm a', new Date());
        if (isValid(date)) {
            return format(date, 'HH:mm');
        }
    } catch (e) {
        console.warn(`Could not parse time: ${time12h}`, e);
    }
    return ''; // Return empty if parsing fails
};


const AttendanceDayRow = ({
    employee,
    date,
    initialData,
    onRecordUpdate,
    holidays,
    leaves,
    visits,
}: {
    employee: EmployeeDocument;
    date: Date;
    initialData?: AttendanceDocument;
    onRecordUpdate: () => void;
    holidays: HolidayDocument[];
    leaves: LeaveApplicationDocument[];
    visits: VisitApplicationDocument[];
}) => {
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [workingHours, setWorkingHours] = React.useState<string | undefined>(undefined);

    const getDefaultFlag = React.useCallback((): AttendanceFlag => {
        const dayOfWeek = getDay(date);
        if (dayOfWeek === 5) return 'W'; // Friday

        const isHoliday = holidays.some(h =>
            isWithinDateInterval(date, { start: parseISO(h.fromDate), end: parseISO(h.toDate || h.fromDate) })
        );
        if (isHoliday) return 'H';

        const isOnLeave = leaves.some(l =>
            l.employeeId === employee.id &&
            isWithinDateInterval(date, { start: parseISO(l.fromDate), end: parseISO(l.toDate) }) &&
            l.status === 'Approved'
        );
        if (isOnLeave) return 'L';

        const isOnVisit = visits.some(v =>
            v.employeeId === employee.id &&
            isWithinDateInterval(date, { start: parseISO(v.fromDate), end: parseISO(v.toDate) }) &&
            v.status === 'Approved'
        );
        if (isOnVisit) return 'V';

        return 'A'; // Default to Absent if no other condition is met
    }, [date, holidays, leaves, visits, employee.id]);

    const form = useForm<AttendanceDayFormValues>({
        resolver: zodResolver(attendanceDaySchema),
    });

    React.useEffect(() => {
        const defaultFlag = getDefaultFlag();
        const isPresent = initialData?.flag === 'P' || initialData?.flag === 'D';
        form.reset({
            flag: initialData?.flag || defaultFlag,
            inTime: isPresent ? parse12HourTo24Hour(initialData?.inTime) : '',
            outTime: isPresent ? parse12HourTo24Hour(initialData?.outTime) : '',
            inTimeRemarks: initialData?.inTimeRemarks || '',
            outTimeRemarks: initialData?.outTimeRemarks || '',
        });
    }, [initialData, getDefaultFlag, form]);


    const { watch, control, handleSubmit, setValue } = form;
    const inTime = watch('inTime');
    const outTime = watch('outTime');
    const flag = watch('flag');

    React.useEffect(() => {
        if (!initialData && inTime && flag === 'A') {
            try {
                const [hours, minutes] = inTime.split(':').map(Number);
                if (hours > 9 || (hours === 9 && minutes > 10)) {
                    setValue('flag', 'D', { shouldValidate: true });
                } else {
                    setValue('flag', 'P', { shouldValidate: true });
                }
            } catch { }
        }
    }, [inTime, flag, setValue, initialData]);

    React.useEffect(() => {
        if (flag !== 'P' && flag !== 'D') {
            setWorkingHours(undefined);
            return;
        }
        if (!inTime || !outTime) {
            setWorkingHours("Invalid Time");
            return;
        }
        try {
            const inDate = parseDateFns(inTime, 'HH:mm', new Date());
            const outDate = parseDateFns(outTime, 'HH:mm', new Date());
            if (isValid(inDate) && isValid(outDate) && outDate >= inDate) {
                const diffMins = differenceInMinutes(outDate, inDate);
                const hours = Math.floor(diffMins / 60);
                const minutes = diffMins % 60;
                setWorkingHours(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
            } else {
                setWorkingHours("0:00");
            }
        } catch {
            setWorkingHours("Error");
        }
    }, [inTime, outTime, flag]);

    const onSave = async (data: AttendanceDayFormValues) => {
        if (!user) {
            Swal.fire("Not Authenticated", "You must be logged in to save attendance.", "error");
            return;
        }
        setIsSubmitting(true);

        const formattedDate = format(date, 'yyyy-MM-dd');
        const docId = `${employee.id}_${formattedDate}`;

        const dataToSave: Partial<AttendanceDocument> = {
            employeeId: employee.id,
            employeeName: `${employee.fullName} (${employee.employeeCode})`,
            date: format(date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
            flag: data.flag,
            workingHours: workingHours,
            updatedBy: user.uid,
            updatedAt: serverTimestamp(),
        };

        if (data.flag === 'P' || data.flag === 'D') {
            const formatTimeForFirestore = (timeString?: string) => {
                if (!timeString) return undefined;
                try {
                    const dateObj = parseDateFns(timeString, 'HH:mm', new Date());
                    return format(dateObj, 'hh:mm a');
                } catch {
                    return undefined;
                }
            };

            const formattedInTime = formatTimeForFirestore(data.inTime);
            dataToSave.inTime = formattedInTime;
            dataToSave.inTimeRemarks = data.inTimeRemarks;
            dataToSave.outTime = formatTimeForFirestore(data.outTime);
            dataToSave.outTimeRemarks = data.outTimeRemarks;

            // Auto-determine flag based on in-time (P if ≤09:10 AM, D if >09:10 AM)
            if (formattedInTime) {
                dataToSave.flag = determineAttendanceFlag(formattedInTime);
            }
        }

        try {
            await setDoc(doc(firestore, "attendance", docId), dataToSave, { merge: true });
            Swal.fire({ title: "Saved!", icon: "success", timer: 1000, showConfirmButton: false });
            onRecordUpdate();
        } catch (e) {
            console.error("Error saving attendance:", e);
            Swal.fire("Error", "Could not save the record.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const onDelete = async () => {
        const formattedDate = format(date, 'yyyy-MM-dd');
        const docId = `${employee.id}_${formattedDate}`;

        Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(firestore, "attendance", docId));
                    Swal.fire('Deleted!', 'The record has been deleted.', 'success');
                    onRecordUpdate();
                } catch (e) {
                    console.error("Error deleting attendance:", e);
                    Swal.fire("Error", "Could not delete the record.", "error");
                }
            }
        });
    };

    const handleViewLocation = (location: { latitude: number; longitude: number } | undefined | null) => {
        if (location) {
            const url = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        } else {
            Swal.fire('No Location', 'Location data is not available for this entry.', 'info');
        }
    };

    return (
        <TableRow>
            <TableCell>{format(date, 'EEE, MM/dd/yyyy')}</TableCell>
            <TableCell>
                <Controller
                    control={control}
                    name="flag"
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="w-20 h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {attendanceFlagOptions.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}
                />
            </TableCell>
            <TableCell>
                <div className="flex items-center gap-1">
                    <Controller control={control} name="inTime" render={({ field }) => <Input type="time" {...field} className="h-9" disabled={flag !== 'P' && flag !== 'D'} />} />
                    {initialData?.inTimeLocation && (
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewLocation(initialData.inTimeLocation)} title="View In-Time Location">
                            <MapPin className="h-4 w-4 text-blue-500" />
                        </Button>
                    )}
                </div>
            </TableCell>
            <TableCell>
                <Controller control={control} name="inTimeRemarks" render={({ field }) => <Input placeholder="Enter remarks" {...field} className="h-9" disabled={flag !== 'P' && flag !== 'D'} />} />
            </TableCell>
            <TableCell>
                <div className="flex items-center gap-1">
                    <Controller control={control} name="outTime" render={({ field }) => <Input type="time" {...field} className="h-9" disabled={flag !== 'P' && flag !== 'D'} />} />
                    {initialData?.outTimeLocation && (
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewLocation(initialData.outTimeLocation)} title="View Out-Time Location">
                            <MapPin className="h-4 w-4 text-orange-500" />
                        </Button>
                    )}
                </div>
            </TableCell>
            <TableCell>
                <Controller control={control} name="outTimeRemarks" render={({ field }) => <Input placeholder="Enter remarks" {...field} className="h-9" disabled={flag !== 'P' && flag !== 'D'} />} />
            </TableCell>
            <TableCell>{(flag === 'P' || flag === 'D') ? workingHours : 'N/A'}</TableCell>
            <TableCell className="text-right">
                <div className="flex gap-1 justify-end">
                    <Button type="button" variant="ghost" size="icon" onClick={handleSubmit(onSave)} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={onDelete} disabled={isSubmitting}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
};


const EmployeeAttendanceRow = ({
    employee,
    dateRange,
    attendanceRecords,
    holidays,
    leaves,
    visits,
    onRecordUpdate
}: {
    employee: EmployeeDocument,
    dateRange: DateRange | undefined,
    attendanceRecords: AttendanceDocument[],
    holidays: HolidayDocument[],
    leaves: LeaveApplicationDocument[],
    visits: VisitApplicationDocument[],
    onRecordUpdate: () => void;
}) => {
    const [isExpanded, setIsExpanded] = React.useState(false);

    const datesToDisplay = React.useMemo(() => {
        const from = dateRange?.from;
        const to = dateRange?.to || from;

        if (from && to && isValid(from) && isValid(to) && to >= from) {
            try {
                return eachDayOfInterval({ start: from, end: to });
            } catch (error) {
                console.error("Error creating date interval:", error);
                return [startOfDay(new Date())];
            }
        }
        return [startOfDay(new Date())];
    }, [dateRange]);

    return (
        <Card className="mb-2">
            <Accordion type="single" collapsible onValueChange={(value) => setIsExpanded(!!value)}>
                <AccordionItem value={`item-${employee.id}`} className="border-b-0">
                    <AccordionTrigger className="p-4 hover:no-underline">
                        <div className="flex items-center justify-between w-full gap-4">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <Avatar>
                                    <AvatarImage src={employee.photoURL} alt={employee.fullName} />
                                    <AvatarFallback>{getInitials(employee.fullName)}</AvatarFallback>
                                </Avatar>
                                <div className="text-left">
                                    <p className="font-semibold truncate text-black dark:text-white">{employee.fullName}</p>
                                    <p className="text-sm text-muted-foreground">{employee.employeeCode}</p>
                                </div>
                            </div>
                            <div className="hidden sm:block text-sm text-muted-foreground text-left flex-shrink-0 ml-auto mr-4">
                                <p>{employee.designation}</p>
                                <p>{employee.branch || 'N/A'}</p>
                            </div>
                            {isExpanded ? <Minus className="h-5 w-5 text-primary flex-shrink-0" /> : <Plus className="h-5 w-5 text-primary flex-shrink-0" />}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <div className="p-4 bg-muted/50 overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Attendance Date</TableHead>
                                        <TableHead>Flag</TableHead>
                                        <TableHead>In Time</TableHead>
                                        <TableHead>In Time Remarks</TableHead>
                                        <TableHead>Out Time</TableHead>
                                        <TableHead>Out Time Remarks</TableHead>
                                        <TableHead>Working Hour</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {datesToDisplay.map(date => {
                                        const formattedDateKey = format(date, 'yyyy-MM-dd');
                                        const attendanceData = attendanceRecords.find(rec => {
                                            if (!rec.date) return false;
                                            try {
                                                const recordDate = format(parseISO(rec.date), 'yyyy-MM-dd');
                                                return recordDate === formattedDateKey;
                                            } catch {
                                                return false;
                                            }
                                        });

                                        return (
                                            <AttendanceDayRow
                                                key={date.toISOString()}
                                                employee={employee}
                                                date={date}
                                                initialData={attendanceData}
                                                onRecordUpdate={onRecordUpdate}
                                                holidays={holidays}
                                                leaves={leaves}
                                                visits={visits}
                                            />
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </Card>
    );
};

export default function DailyAttendancePage() {

    const { user } = useAuth();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const { data: employees, isLoading: isLoadingEmployees } = useFirestoreQuery<EmployeeDocument[]>(
        query(collection(firestore, "employees"), orderBy("fullName")),
        undefined,
        ['employees_for_attendance']
    );
    const { data: branches, isLoading: isLoadingBranches } = useFirestoreQuery<BranchDocument[]>(
        query(collection(firestore, "branches")),
        undefined,
        ['branches']
    );
    const { data: units, isLoading: isLoadingUnits } = useFirestoreQuery<UnitDocument[]>(
        query(collection(firestore, "units")),
        undefined,
        ['units']
    );
    const { data: departments, isLoading: isLoadingDepts } = useFirestoreQuery<DepartmentDocument[]>(
        query(collection(firestore, "departments")),
        undefined,
        ['departments']
    );
    const { data: holidays, isLoading: isLoadingHolidays } = useFirestoreQuery<HolidayDocument[]>(
        query(collection(firestore, "holidays")),
        undefined,
        ['holidays']
    );
    const { data: leaves, isLoading: isLoadingLeaves } = useFirestoreQuery<LeaveApplicationDocument[]>(
        query(collection(firestore, "leave_applications"), where("status", "==", "Approved")),
        undefined,
        ['approved_leaves']
    );
    const { data: visits, isLoading: isLoadingVisits } = useFirestoreQuery<VisitApplicationDocument[]>(
        query(collection(firestore, "visit_applications"), where("status", "==", "Approved")),
        undefined,
        ['approved_visits']
    );

    const [searchTerm, setSearchTerm] = React.useState('');
    const [selectedBranch, setSelectedBranch] = React.useState(ALL_BRANCHES_VALUE);
    const [selectedUnit, setSelectedUnit] = React.useState(ALL_UNITS_VALUE);
    const [selectedDept, setSelectedDept] = React.useState(ALL_DEPTS_VALUE);
    const [filterFlag, setFilterFlag] = React.useState(ALL_FLAGS_VALUE);


    const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
        from: startOfDay(subDays(new Date(), 1)),
        to: startOfDay(new Date()),
    });

    const [allAttendance, setAllAttendance] = React.useState<AttendanceDocument[]>([]);
    const [isLoadingAttendance, setIsLoadingAttendance] = React.useState(true);

    const sampleCsvContent = "employeeCode,date,flag,inTime,outTime,remarks\nEMP001,2024-09-28,P,09:00,18:00,\nEMP002,2024-09-28,A,,,Late arrival";

    const handleDownloadSample = () => {
        const blob = new Blob([sampleCsvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "sample_attendance_upload.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user || !employees) {
            Swal.fire("Error", "File, user, or employee data is not available.", "error");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result;
            if (typeof text !== 'string') return;

            const rows = text.split('\n').filter(row => row.trim() !== '');
            const headerRow = rows.shift()?.trim();
            if (!headerRow) {
                Swal.fire("Invalid CSV", "CSV file is empty or has no header.", "error");
                return;
            }
            const header = headerRow.split(',');

            const requiredHeaders = ['employeeCode', 'date', 'flag'];
            if (!requiredHeaders.every(h => header.includes(h.trim()))) {
                Swal.fire("Invalid CSV Header", `CSV must contain columns: ${requiredHeaders.join(', ')}.`, "error");
                return;
            }

            const batch = writeBatch(firestore);
            const employeeMap = new Map(employees.map(emp => [emp.employeeCode, emp]));

            let processedCount = 0;
            const errorRows = [];
            for (const [index, row] of rows.entries()) {
                const values = row.trim().split(',');
                const rowData = header.reduce((obj, h, i) => ({ ...obj, [h.trim()]: values[i]?.trim() }), {} as any);

                const employee = employeeMap.get(rowData.employeeCode);
                if (!employee) {
                    console.warn(`Skipping row ${index + 2}: Employee with code ${rowData.employeeCode} not found.`);
                    errorRows.push({ row: index + 2, reason: `Employee code '${rowData.employeeCode}' not found.` });
                    continue;
                }

                let parsedDate;
                if (rowData.date) {
                    const dateFormats = ['M/d/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'];
                    for (const dateFormat of dateFormats) {
                        parsedDate = parseDateFns(rowData.date, dateFormat, new Date());
                        if (isValid(parsedDate)) break;
                    }
                }

                if (!parsedDate || !isValid(parsedDate)) {
                    console.warn(`Skipping row ${index + 2}: Invalid date format for ${rowData.employeeCode}. Use YYYY-MM-DD or MM/DD/YYYY.`);
                    errorRows.push({ row: index + 2, reason: `Invalid date format: '${rowData.date}'.` });
                    continue;
                }

                const formattedDate = format(parsedDate, 'yyyy-MM-dd');
                const docId = `${employee.id}_${formattedDate}`;
                const docRef = doc(firestore, "attendance", docId);

                const dataToSave: Partial<AttendanceDocument> = {
                    employeeId: employee.id,
                    employeeName: `${employee.fullName} (${employee.employeeCode})`,
                    date: format(parsedDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
                    flag: (attendanceFlagOptions.includes(rowData.flag) ? rowData.flag : 'A') as AttendanceFlag,
                    updatedBy: user.uid,
                    updatedAt: serverTimestamp(),
                };

                if (['P', 'D'].includes(dataToSave.flag!)) {
                    const parsedInTime = rowData.inTime ? parseDateFns(rowData.inTime, 'H:mm', new Date()) : null;
                    const parsedOutTime = rowData.outTime ? parseDateFns(rowData.outTime, 'H:mm', new Date()) : null;

                    // Format times as 12-hour format for consistency
                    const formattedInTime = parsedInTime && isValid(parsedInTime) ? format(parsedInTime, 'hh:mm a') : undefined;
                    const formattedOutTime = parsedOutTime && isValid(parsedOutTime) ? format(parsedOutTime, 'hh:mm a') : undefined;

                    if (formattedInTime) dataToSave.inTime = formattedInTime;
                    if (formattedOutTime) dataToSave.outTime = formattedOutTime;

                    // Auto-determine flag based on in-time (P if ≤09:10 AM, D if >09:10 AM)
                    if (formattedInTime) {
                        dataToSave.flag = determineAttendanceFlag(formattedInTime);
                    }
                }

                batch.set(docRef, dataToSave, { merge: true });
                processedCount++;
            }

            if (errorRows.length > 0) {
                Swal.fire("Upload Warning", `Processed ${processedCount} records, but skipped ${errorRows.length} rows due to errors. Check console for details.`, "warning");
                console.error("CSV Upload Errors:", errorRows);
            }
            if (processedCount === 0 && errorRows.length > 0) {
                Swal.fire("Upload Failed", "No valid records were found to upload. Please check your file and the console for errors.", "error");
            } else if (processedCount > 0) {
                try {
                    await batch.commit();
                    Swal.fire("Upload Complete", `${processedCount} records processed successfully.`, "success");
                    await refetchAttendance();
                    // Reset file input
                    if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                    }
                } catch (error: any) {
                    Swal.fire("Upload Failed", `An error occurred during database write: ${error.message}`, "error");
                }
            }
        };
        reader.readAsText(file);
    };


    const refetchAttendance = React.useCallback(async () => {
        setIsLoadingAttendance(true);
        if (!dateRange?.from) {
            setAllAttendance([]);
            setIsLoadingAttendance(false);
            return;
        }

        const fromDateStr = format(startOfDay(dateRange.from), "yyyy-MM-dd'T'00:00:00.000xxx");
        const toDateStr = format(endOfDay(dateRange.to || dateRange.from), "yyyy-MM-dd'T'23:59:59.999xxx");

        const attendanceQuery = query(
            collection(firestore, "attendance"),
            where('date', '>=', fromDateStr),
            where('date', '<=', toDateStr)
        );

        const unsubscribe = onSnapshot(attendanceQuery, (snapshot) => {
            const fetchedAttendance = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceDocument));
            setAllAttendance(fetchedAttendance);
            setIsLoadingAttendance(false);
        }, (error) => {
            console.error("Error fetching attendance:", error);
            Swal.fire("Error", "Could not fetch attendance data in real-time.", "error");
            setIsLoadingAttendance(false);
        });

        return unsubscribe;
    }, [dateRange]);

    React.useEffect(() => {
        const unsubscribePromise = refetchAttendance();
        return () => {
            unsubscribePromise.then(unsub => unsub && unsub());
        };
    }, [refetchAttendance]);


    const filteredEmployees = React.useMemo(() => {
        if (!employees) return [];
        return employees.filter(emp => {
            const flagMatch = !filterFlag || filterFlag === ALL_FLAGS_VALUE || !dateRange?.from || !dateRange.to || (
                eachDayOfInterval({ start: dateRange.from, end: dateRange.to }).some(day => {
                    const formattedDateKey = format(day, 'yyyy-MM-dd');
                    const attRecord = attendanceByEmployee.get(emp.id)?.find(rec => rec.date.startsWith(formattedDateKey));
                    if (attRecord) return attRecord.flag === filterFlag;
                    // If no record, check if default flag matches
                    const defaultFlag = getDefaultFlag(day, emp.id, holidays || [], leaves || [], visits || []);
                    return defaultFlag === filterFlag;
                })
            );

            return (
                (emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || emp.employeeCode.includes(searchTerm)) &&
                (selectedBranch === ALL_BRANCHES_VALUE || emp.branch === selectedBranch) &&
                (selectedUnit === ALL_UNITS_VALUE || emp.unit === selectedUnit) &&
                (selectedDept === ALL_DEPTS_VALUE || emp.department === selectedDept) &&
                flagMatch
            );
        });
    }, [employees, searchTerm, selectedBranch, selectedUnit, selectedDept, filterFlag, dateRange]);

    const attendanceByEmployee = React.useMemo(() => {
        const map = new Map<string, AttendanceDocument[]>();
        if (allAttendance) {
            allAttendance.forEach(att => {
                const employeeId = att.employeeId;
                if (!map.has(employeeId)) {
                    map.set(employeeId, []);
                }
                map.get(employeeId)!.push(att);
            });
        }
        return map;
    }, [allAttendance]);

    const getDefaultFlag = (date: Date, employeeId: string, holidays: HolidayDocument[], leaves: LeaveApplicationDocument[], visits: VisitApplicationDocument[]): AttendanceFlag => {
        const dayOfWeek = getDay(date);
        if (dayOfWeek === 5) return 'W';
        const isHoliday = holidays.some(h => isWithinDateInterval(date, { start: parseISO(h.fromDate), end: parseISO(h.toDate || h.fromDate) }));
        if (isHoliday) return 'H';
        const isOnLeave = leaves.some(l => l.employeeId === employeeId && isWithinDateInterval(date, { start: parseISO(l.fromDate), end: parseISO(l.toDate) }) && l.status === 'Approved');
        if (isOnLeave) return 'L';
        const isOnVisit = visits.some(v => v.employeeId === employeeId && isWithinDateInterval(date, { start: parseISO(v.fromDate), end: parseISO(v.toDate) }) && v.status === 'Approved');
        if (isOnVisit) return 'V';
        return 'A';
    };

    const isLoading = isLoadingEmployees || isLoadingBranches || isLoadingUnits || isLoadingDepts || isLoadingAttendance || isLoadingHolidays || isLoadingLeaves || isLoadingVisits;

    return (
        <div className="py-8 px-5">
            <Card className="shadow-xl">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                                <Calendar className="h-7 w-7 text-primary" /> Daily Attendance
                            </CardTitle>
                            <CardDescription>
                                Manage and view daily attendance records for employees.
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleBulkUpload}
                                className="hidden"
                                accept=".csv"
                            />
                            <Button variant="outline" onClick={handleDownloadSample}>
                                Sample
                            </Button>
                            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                                <Upload className="mr-2 h-4 w-4" /> Bulk Upload
                            </Button>
                            <Link href="/dashboard/hr/attendance/add" passHref>
                                <Button>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Add Record
                                </Button>
                            </Link>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Alert className="mb-6 border-blue-500/50 bg-blue-500/10 text-blue-800 dark:text-blue-200">
                        <AlertTriangle className="h-4 w-4 !text-blue-600" />
                        <AlertTitle className="font-semibold !text-blue-700 dark:!text-blue-300">Bulk Upload CSV Format</AlertTitle>
                        <AlertDescription>
                            The CSV file must have the following headers: <strong>employeeCode,date,flag,inTime,outTime,remarks</strong>. Date format should be MM/DD/YYYY or YYYY-MM-DD. Time format must be HH:mm (24-hour).
                        </AlertDescription>
                    </Alert>
                    <Card className="mb-6 shadow-md p-4">
                        <CardHeader className="p-2 pb-4">
                            <CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter Options</CardTitle>
                        </CardHeader>
                        <CardContent className="p-2 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
                                <div className="space-y-1">
                                    <Label htmlFor='search-term-employee-attendance'>Employee Name or Code</Label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                        <Input id="search-term-employee-attendance" placeholder="Search..." className="pl-10 h-10 w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="flagFilter">Flag</Label>
                                    <Select value={filterFlag} onValueChange={(v) => setFilterFlag(v)}>
                                        <SelectTrigger id="flagFilter" className="h-10"><SelectValue placeholder="All Flags" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL_FLAGS_VALUE}>All Flags</SelectItem>
                                            {attendanceFlagOptions.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label>From*</Label>
                                        <DatePickerField
                                            field={{
                                                name: 'from',
                                                value: dateRange?.from,
                                                onChange: (date) => setDateRange(prev => {
                                                    const newFrom = date || prev?.from || startOfDay(new Date());
                                                    return {
                                                        from: newFrom,
                                                        to: prev?.to
                                                    };
                                                }),
                                                onBlur: () => { },
                                                ref: () => { }
                                            }}
                                            placeholder="MM/DD/YYYY"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>To*</Label>
                                        <DatePickerField
                                            field={{
                                                name: 'to',
                                                value: dateRange?.to,
                                                onChange: (date) => setDateRange(prev => {
                                                    return {
                                                        from: prev?.from || startOfDay(new Date()),
                                                        to: date
                                                    };
                                                }),
                                                onBlur: () => { },
                                                ref: () => { }
                                            }}
                                            placeholder="MM/DD/YYYY"
                                            fromDate={dateRange?.from}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-4">
                                <div className="space-y-1">
                                    <Label>Branch</Label>
                                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                                        <SelectTrigger className="h-10"><SelectValue placeholder="Select Branch" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL_BRANCHES_VALUE}>All Branches</SelectItem>
                                            {branches?.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label>Unit</Label>
                                    <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                                        <SelectTrigger className="h-10"><SelectValue placeholder="Select Unit" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL_UNITS_VALUE}>All Units</SelectItem>
                                            {units?.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label>Department</Label>
                                    <Select value={selectedDept} onValueChange={setSelectedDept}>
                                        <SelectTrigger className="h-10"><SelectValue placeholder="Select Department" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL_DEPTS_VALUE}>All Departments</SelectItem>
                                            {departments?.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {isLoading ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : (
                        <div className="space-y-2">
                            {filteredEmployees.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    No employees found matching your criteria.
                                </div>
                            ) : (
                                filteredEmployees.map(emp => (
                                    <EmployeeAttendanceRow
                                        key={emp.id}
                                        employee={emp}
                                        dateRange={dateRange}
                                        attendanceRecords={attendanceByEmployee.get(emp.id) || []}
                                        holidays={holidays || []}
                                        leaves={leaves || []}
                                        visits={visits || []}
                                        onRecordUpdate={refetchAttendance}
                                    />
                                ))
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
