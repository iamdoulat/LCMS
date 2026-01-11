"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import {
    ArrowLeft,
    Phone,
    Mail,
    MessageCircle,
    User,
    Briefcase,
    LayoutGrid,
    Calendar,
    CreditCard,
    Flag,
    Droplet,
    Smartphone,
    Users,
    MapPin,
    Building2,
    FileBadge,
    Loader2,
    AlertCircle
} from 'lucide-react';
import type { Employee } from '@/types';
import { format, parseISO, isValid } from 'date-fns';
import { RoleBadge } from '@/components/ui/RoleBadge';

const WhatsAppIcon = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        xmlns="http://www.w3.org/2000/svg"
    >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.89 9.89 0 019.884 9.89c-.001 5.45-4.437 9.884-9.889 9.884m0-21.667C6.014.118.118 6.015.118 13.337a13.15 13.15 0 001.767 6.64L.018 24l4.184-1.096c1.616.88 3.447 1.344 5.31 1.345h.005c7.322 0 13.22-5.9 13.223-13.222A13.24 13.24 0 0012.051.118z" />
    </svg>
);

export default function MobileEmployeeProfilePage() {
    const router = useRouter();
    const params = useParams();
    const employeeId = params.id as string;

    const [employee, setEmployee] = useState<Employee | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'personal' | 'official' | 'others'>('personal');

    // Swipe Handling
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const [touchStartY, setTouchStartY] = useState<number | null>(null);
    const [touchEndY, setTouchEndY] = useState<number | null>(null);
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchEndY(null);
        setTouchStart(e.targetTouches[0].clientX);
        setTouchStartY(e.targetTouches[0].clientY);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
        setTouchEndY(e.targetTouches[0].clientY);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd || !touchStartY || !touchEndY) return;

        const xDistance = touchStart - touchEnd;
        const yDistance = touchStartY - touchEndY;

        // Ensure movement is primarily horizontal and exceeds minimum distance
        if (Math.abs(xDistance) > Math.abs(yDistance) * 1.5 && Math.abs(xDistance) > minSwipeDistance) {
            const tabs = ['personal', 'official', 'others'];
            const currentIndex = tabs.indexOf(activeTab);

            if (xDistance > 0 && currentIndex < tabs.length - 1) {
                setActiveTab(tabs[currentIndex + 1] as any);
            } else if (xDistance < 0 && currentIndex > 0) {
                setActiveTab(tabs[currentIndex - 1] as any);
            }
        }
    };

    useEffect(() => {
        async function fetchEmployee() {
            if (!employeeId) return;
            try {
                const docRef = doc(firestore, 'employees', employeeId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setEmployee({ id: docSnap.id, ...docSnap.data() } as Employee);
                } else {
                    setError("Employee not found");
                }
            } catch (err) {
                console.error("Error fetching employee profile:", err);
                setError("Failed to load profile");
            } finally {
                setLoading(false);
            }
        }

        fetchEmployee();
    }, [employeeId]);

    const handleBack = () => {
        router.back();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#0a1e60]">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
        );
    }

    if (error || !employee) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a1e60] text-white p-6 text-center">
                <div className="bg-red-500/20 p-4 rounded-full mb-4">
                    <AlertCircle className="h-10 w-10 text-red-500" />
                </div>
                <h2 className="text-xl font-bold mb-2">{error || "Error"}</h2>
                <p className="text-white/60 mb-6 font-medium">This employee record might have been removed or the ID is invalid.</p>
                <Button onClick={handleBack} className="bg-white text-[#0a1e60] px-8 rounded-xl font-bold">Back to Directory</Button>
            </div>
        );
    }

    // Helper function to format dates
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'N/A';
        try {
            const date = parseISO(dateStr);
            if (isValid(date)) {
                return format(date, 'dd MMM yyyy');
            }
            return dateStr;
        } catch {
            return dateStr;
        }
    };

    // Map real data to UI structure (Same as in main profile page)
    const profileData = {
        name: employee.fullName,
        designation: employee.designation,
        code: employee.employeeCode,
        personal: [
            { label: 'Date of Birth', value: formatDate(employee.dateOfBirth), icon: Calendar },
            { label: 'National ID', value: employee.nationalId || 'N/A', icon: CreditCard },
            { label: 'Nationality', value: employee.nationality || 'Bangladeshi', icon: Flag },
            { label: 'Email', value: employee.email, icon: Mail },
        ],
        official: [
            { label: 'Employee Code', value: employee.employeeCode, icon: FileBadge },
            { label: 'Joining Date', value: formatDate(employee.joinedDate), icon: Calendar },
            { label: 'Designation', value: employee.designation, icon: Briefcase },
            { label: 'Job Status', value: employee.jobStatus || 'Active', icon: Briefcase },
            { label: 'Branch', value: employee.branch || 'Not Defined', icon: Building2 },
        ],
        others: [
            { label: 'Blood Group', value: employee.bloodGroup || 'N/A', icon: Droplet },
            { label: 'Mobile Number', value: employee.phone || 'N/A', icon: Smartphone },
            { label: 'Religion', value: employee.religion || 'N/A', icon: MapPin },
            { label: 'Gender', value: employee.gender || 'N/A', icon: Users },
        ]
    };

    return (
        <div className="flex flex-col min-h-screen bg-[#0a1e60]">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#0a1e60] flex items-center justify-between px-4 py-4 text-white">
                <Button variant="ghost" size="icon" onClick={handleBack} className="rounded-full bg-white/10 hover:bg-white/20 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)] h-10 w-10 p-0 flex items-center justify-center">
                    <ArrowLeft className="h-9 w-9" />
                </Button>
                <h1 className="text-xl font-semibold">Employee Profile</h1>
                <div className="w-10" />
            </header>

            {/* Main Content Container */}
            <div
                className="flex-1 bg-slate-50 rounded-t-[2rem] px-6 pt-12 pb-[120px] relative mt-9"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >

                {/* Profile Header Avatar */}
                <div className="absolute -top-11 left-6 z-50">
                    <div className="h-32 w-32 rounded-full border-4 border-white overflow-hidden bg-white shadow-md">
                        <Avatar className="h-full w-full">
                            <AvatarImage src={employee.photoURL || undefined} className="object-cover" />
                            <AvatarFallback className="text-3xl text-slate-800 font-bold bg-slate-200">
                                {employee.fullName?.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                </div>

                {/* Contact Actions */}
                <div className="absolute top-6 right-6 flex gap-2">
                    <a href={`tel:${employee.phone}`}>
                        <Button size="icon" className="bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-2xl h-11 w-11 shadow-sm">
                            <Phone className="h-5 w-5" />
                        </Button>
                    </a>
                    <a href={`https://wa.me/${employee.phone?.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer">
                        <Button size="icon" className="bg-green-100 hover:bg-green-200 text-green-600 rounded-2xl h-11 w-11 shadow-sm">
                            <WhatsAppIcon className="h-6 w-6" />
                        </Button>
                    </a>
                    <a href={`mailto:${employee.email}`}>
                        <Button size="icon" className="bg-purple-100 hover:bg-purple-200 text-purple-600 rounded-2xl h-11 w-11 shadow-sm">
                            <Mail className="h-5 w-5" />
                        </Button>
                    </a>
                </div>

                {/* Name & Title */}
                <div className="mt-16 mb-8">
                    <h2 className="text-xl font-bold text-[#0a1e60] uppercase leading-tight mb-1">
                        {profileData.name}
                    </h2>
                    <div className="flex items-center flex-wrap gap-2 text-sm text-slate-500 font-medium">
                        <span>{profileData.designation}</span>
                        <span className="bg-purple-100 text-purple-600 px-2 py-0.5 rounded text-xs font-bold">
                            {profileData.code}
                        </span>
                    </div>
                    {/* Role Badges */}
                    {employee.role && employee.role.length > 0 && (
                        <div className="mt-2">
                            <RoleBadge roles={employee.role} size="sm" />
                        </div>
                    )}
                </div>

                {/* Tabs - Horizontal Scrollable */}
                <div className="overflow-x-auto scrollbar-hide -mx-6 px-6 mb-6">
                    <div className="flex gap-3 min-w-max">
                        <button
                            onClick={() => setActiveTab('personal')}
                            className={`px-6 py-3 rounded-xl flex items-center gap-2 font-semibold transition-all whitespace-nowrap ${activeTab === 'personal'
                                ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-200'
                                : 'bg-white text-slate-600 shadow-sm'
                                }`}
                        >
                            <User className="h-5 w-5" />
                            <span>Personal</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('official')}
                            className={`px-6 py-3 rounded-xl flex items-center gap-2 font-semibold transition-all whitespace-nowrap ${activeTab === 'official'
                                ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-200'
                                : 'bg-white text-slate-600 shadow-sm'
                                }`}
                        >
                            <Briefcase className="h-5 w-5" />
                            <span>Official</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('others')}
                            className={`px-6 py-3 rounded-xl flex items-center gap-2 font-semibold transition-all whitespace-nowrap ${activeTab === 'others'
                                ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-200'
                                : 'bg-white text-slate-600 shadow-sm'
                                }`}
                        >
                            <LayoutGrid className="h-5 w-5" />
                            <span>Others</span>
                        </button>
                    </div>
                </div>

                {/* Info Card */}
                <div className="bg-white rounded-2xl p-6 shadow-sm max-h-[calc(100vh-420px)] flex flex-col">
                    <h3 className="text-lg font-bold text-[#0a1e60] mb-6">
                        {activeTab === 'personal' && 'Personal Info'}
                        {activeTab === 'official' && 'Official Info'}
                        {activeTab === 'others' && 'Others Info'}
                    </h3>

                    <div className="space-y-6 overflow-y-auto pr-2 flex-1 min-h-0">
                        {profileData[activeTab].map((item, index) => {
                            const Icon = item.icon;
                            return (
                                <div key={index} className="flex items-start gap-4 pb-6 border-b border-slate-50 last:border-0 last:pb-0">
                                    <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-[#0a1e60]">
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <div className="text-sm text-blue-500 font-medium mb-1">{item.label}</div>
                                        <div className="text-lg font-bold text-[#0a1e60] truncate">{item.value}</div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

            </div>
        </div>
    );
}
