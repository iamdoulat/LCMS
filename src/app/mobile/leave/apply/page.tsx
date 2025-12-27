"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Swal from 'sweetalert2';
import type { EmployeeDocument, LeaveGroupDocument } from '@/types';
import { addDays, format } from 'date-fns';

export default function ApplyForLeavePage() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [employeeData, setEmployeeData] = useState<EmployeeDocument | null>(null);
    const [leaveGroup, setLeaveGroup] = useState<LeaveGroupDocument | null>(null);
    const [leaveTypes, setLeaveTypes] = useState<string[]>([]);

    const [formData, setFormData] = useState({
        leaveType: '',
        fromDate: '',
        toDate: '',
        purpose: ''
    });

    useEffect(() => {
        const fetchEmployeeData = async () => {
            if (!user?.email) return;
            try {
                const q = query(collection(firestore, 'employees'), where('email', '==', user.email));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const empDoc = snapshot.docs[0];
                    const empData = { id: empDoc.id, ...empDoc.data() } as EmployeeDocument;
                    setEmployeeData(empData);

                    // Fetch leave group if available
                    if (empData.leaveGroupId) {
                        const lgDocRef = await getDocs(
                            query(collection(firestore, 'hrm_settings/leave_groups/items'))
                        );
                        const leaveGroupDoc = lgDocRef.docs.find(doc => doc.id === empData.leaveGroupId);

                        if (leaveGroupDoc) {
                            const lgData = { id: leaveGroupDoc.id, ...leaveGroupDoc.data() } as LeaveGroupDocument;
                            setLeaveGroup(lgData);
                            setLeaveTypes(lgData.policies.map(p => p.leaveTypeName));
                        }
                    }
                }
            } catch (error) {
                console.error("Error fetching employee data:", error);
            }
        };
        fetchEmployeeData();
    }, [user?.email]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!employeeData) {
            Swal.fire('Error', 'Employee data not found', 'error');
            return;
        }

        if (!formData.leaveType || !formData.fromDate || !formData.toDate || !formData.purpose) {
            Swal.fire('Error', 'Please fill in all fields', 'error');
            return;
        }

        if (new Date(formData.toDate) < new Date(formData.fromDate)) {
            Swal.fire('Error', 'End date cannot be earlier than start date', 'error');
            return;
        }

        setLoading(true);
        try {
            await addDoc(collection(firestore, 'leave_applications'), {
                employeeId: employeeData.id,
                employeeName: employeeData.fullName,
                leaveType: formData.leaveType,
                fromDate: formData.fromDate,
                toDate: formData.toDate,
                reason: formData.purpose,
                status: 'Pending',
                appliedBy: user?.uid || '',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            await Swal.fire({
                title: 'Success!',
                text: 'Your leave application has been submitted successfully',
                icon: 'success',
                confirmButtonColor: '#3b82f6'
            });

            router.push('/mobile/leave/applications');
        } catch (error) {
            console.error("Error submitting application:", error);
            Swal.fire('Error', 'Failed to submit application', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            {/* Header */}
            <div className="bg-[#0a1e60] text-white p-6 pb-8 rounded-b-[2rem] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 rounded-full -ml-10 -mb-10 blur-2xl" />

                <div className="relative flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full active:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold tracking-tight">Apply for Leave</h1>
                    <div className="w-10" />
                </div>
            </div>

            {/* Form */}
            <div className="px-5 pt-6 pb-24">
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Leave Type */}
                        <div>
                            <Label className="text-sm font-bold text-slate-700 mb-2 block">
                                Leave Type <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                value={formData.leaveType}
                                onValueChange={(value) => setFormData({ ...formData, leaveType: value })}
                            >
                                <SelectTrigger className="w-full h-12 rounded-xl border-slate-200">
                                    <SelectValue placeholder="Select an option" />
                                </SelectTrigger>
                                <SelectContent>
                                    {leaveTypes.length > 0 ? (
                                        leaveTypes.map(type => (
                                            <SelectItem key={type} value={type}>{type}</SelectItem>
                                        ))
                                    ) : (
                                        <>
                                            <SelectItem value="Casual Leave">Casual Leave</SelectItem>
                                            <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                                            <SelectItem value="Annual Leave">Annual Leave</SelectItem>
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* From Date */}
                        <div>
                            <Label className="text-sm font-bold text-slate-700 mb-2 block">
                                From Date <span className="text-red-500">*</span>
                            </Label>
                            <input
                                type="date"
                                value={formData.fromDate}
                                onChange={(e) => setFormData({ ...formData, fromDate: e.target.value })}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                min={format(new Date(), 'yyyy-MM-dd')}
                            />
                        </div>

                        {/* To Date */}
                        <div>
                            <Label className="text-sm font-bold text-slate-700 mb-2 block">
                                To Date <span className="text-red-500">*</span>
                            </Label>
                            <input
                                type="date"
                                value={formData.toDate}
                                onChange={(e) => setFormData({ ...formData, toDate: e.target.value })}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                min={formData.fromDate || format(new Date(), 'yyyy-MM-dd')}
                            />
                        </div>

                        {/* Reason */}
                        <div>
                            <Label className="text-sm font-bold text-slate-700 mb-2 block">
                                Reason <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                                value={formData.purpose}
                                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                                placeholder="Enter the reason for your leave..."
                                className="w-full min-h-[120px] px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all resize-none"
                            />
                        </div>

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-2xl shadow-lg shadow-blue-200 active:scale-98 transition-all"
                        >
                            {loading ? 'Submitting...' : 'Apply for Leave'}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
