"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MapPin, Image as ImageIcon, Loader2 } from 'lucide-react';
import { getCheckInOutRecords } from '@/lib/firebase/checkInOut';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { MultipleCheckInOutRecord, CheckInOutType } from '@/types/checkInOut';
import type { EmployeeDocument } from '@/types';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function MultipleCheckInOutPage() {
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const myRecordsOnly = searchParams.get('myRecords') === 'true';

    const [records, setRecords] = useState<MultipleCheckInOutRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
    const [selectedType, setSelectedType] = useState<string>('all');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [selectedRecord, setSelectedRecord] = useState<MultipleCheckInOutRecord | null>(null);
    const [showImageDialog, setShowImageDialog] = useState(false);


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

    useEffect(() => {
        const fetchRecords = async () => {
            setIsLoading(true);
            try {
                const filters: any = {};

                if (selectedEmployee !== 'all') {
                    filters.employeeId = selectedEmployee;
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
                setRecords(data);
            } catch (error) {
                console.error('Error fetching records:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchRecords();
    }, [selectedEmployee, selectedType, fromDate, toDate]);

    const openMap = (record: MultipleCheckInOutRecord) => {
        const { latitude, longitude } = record.location;
        window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, '_blank');
    };

    return (
        <div className="w-full p-6 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl font-bold flex items-center gap-2">
                        <MapPin className="h-6 w-6 text-primary" />
                        {myRecordsOnly ? 'My Check In/Out History' : 'Multiple Check In/Out'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
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
                                    {employees?.map(emp => (
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

                    {/* Records Table */}
                    <div className="border rounded-lg">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : records.length === 0 ? (
                            <div className="flex items-center justify-center h-64 text-muted-foreground">
                                No records found
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Employee</TableHead>
                                        <TableHead>Company</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Date & Time</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>Photo</TableHead>
                                        <TableHead>Remarks</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {records.map((record) => (
                                        <TableRow key={record.id}>
                                            <TableCell className="font-medium">{record.employeeName}</TableCell>
                                            <TableCell>{record.companyName}</TableCell>
                                            <TableCell>
                                                <Badge variant={record.type === 'Check In' ? 'default' : 'secondary'}>
                                                    {record.type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {format(new Date(record.timestamp), 'dd-MM-yyyy, hh:mm a')}
                                            </TableCell>
                                            <TableCell className="max-w-[200px] truncate" title={record.location.address}>
                                                {record.location.address || `${record.location.latitude.toFixed(4)}, ${record.location.longitude.toFixed(4)}`}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setSelectedRecord(record);
                                                        setShowImageDialog(true);
                                                    }}
                                                >
                                                    <ImageIcon className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                            <TableCell className="max-w-[150px] truncate" title={record.remarks}>
                                                {record.remarks || '-'}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openMap(record)}
                                                >
                                                    <MapPin className="h-4 w-4 mr-1" />
                                                    Show On Map
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
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
                            <img
                                src={selectedRecord.imageURL}
                                alt="Check in/out photo"
                                className="w-full rounded-lg"
                            />
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
        </div>
    );
}
