"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { auth, firestore, storage } from '@/lib/firebase/config';
import { collection, query, where, getDocs, limit, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Swal from 'sweetalert2';
import {
    ChevronLeft,
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
    Pencil,
    Loader2,
    UserCheck,
    Network
} from 'lucide-react';
import type { Employee, UserRole } from '@/types';
import { format, parseISO, isValid } from 'date-fns';
import { RoleBadge } from '@/components/ui/RoleBadge';
import { ProfileSkeleton } from '@/components/mobile/skeletons/ProfileSkeleton';

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

export default function MobileProfilePage() {
    const router = useRouter();
    const { user, userRole, employeeData } = useAuth();
    const [employee, setEmployee] = useState<Employee | null>(employeeData);
    const [loading, setLoading] = useState(!employeeData);
    const [supervisorName, setSupervisorName] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'personal' | 'official' | 'others'>('personal');
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    // Format date for display
    const formatReadableDate = (dateValue: any): string => {
        if (!dateValue) return 'N/A';

        try {
            let date: Date;

            if (typeof dateValue === 'string') {
                date = parseISO(dateValue);
            } else if (dateValue?.toDate) {
                date = dateValue.toDate();
            } else if (dateValue instanceof Date) {
                date = dateValue;
            } else {
                return 'N/A';
            }

            if (isValid(date)) {
                return format(date, 'dd MMM yyyy');
            }
        } catch (error) {
            console.error('Error formatting date:', error);
        }

        return 'N/A';
    };

    useEffect(() => {
        if (employeeData) {
            setEmployee(employeeData);
            setLoading(false);
        }
    }, [employeeData]);

    useEffect(() => {
        async function fetchEmployee() {
            if (!user?.email || employeeData) return;
            try {
                const q = query(
                    collection(firestore, 'employees'),
                    where('email', '==', user.email),
                    limit(1)
                );
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const empData = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Employee;
                    setEmployee(empData);
                }
            } catch (error) {
                console.error("Error fetching employee profile:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchEmployee();
    }, [user, employeeData]);

    // Separate useEffect for supervisor to prevent blocking main content
    useEffect(() => {
        if (!employee?.supervisorId) return;

        async function fetchSupervisor() {
            try {
                const supervisorDocRef = doc(firestore, 'employees', employee!.supervisorId!);
                const supervisorDocSnap = await getDoc(supervisorDocRef);
                if (supervisorDocSnap.exists()) {
                    setSupervisorName(supervisorDocSnap.data()?.fullName || null);
                }
            } catch (err) {
                console.error("Error fetching supervisor:", err);
            }
        }
        fetchSupervisor();
    }, [employee?.supervisorId]);

    const handleBack = () => {
        router.back();
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user || !employee) return;

        // Check file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            Swal.fire({
                icon: 'error',
                title: 'File too large',
                text: 'Please select an image smaller than 5MB.',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        try {
            Swal.fire({
                title: 'Uploading...',
                text: 'Please wait while we update your profile picture.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const timestamp = Date.now();
            const fileName = `${timestamp}_${file.name.replace(/\s+/g, '_')}`;
            const storagePath = `profileImages/${user.uid}/${fileName}`;
            const storageRef = ref(storage, storagePath);

            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            // Update Firestore - employees collection
            const employeeRef = doc(firestore, 'employees', employee.id);
            await updateDoc(employeeRef, {
                photoURL: downloadURL,
                updatedAt: serverTimestamp()
            });

            // Sync with Firebase Auth Profile and users collection
            if (auth.currentUser) {
                const { updateProfile } = await import('firebase/auth');
                await updateProfile(auth.currentUser, { photoURL: downloadURL });

                const userDocRef = doc(firestore, 'users', auth.currentUser.uid);
                const updateData: any = {
                    photoURL: downloadURL,
                    updatedAt: serverTimestamp()
                };

                // Also ensure 'Employee' role is added if they have an employee record
                if (userRole && !userRole.includes('Employee')) {
                    updateData.role = [...new Set([...userRole, 'Employee'] as UserRole[])];
                }

                await updateDoc(userDocRef, updateData);
            }

            setEmployee(prev => prev ? { ...prev, photoURL: downloadURL } : null);

            Swal.fire({
                icon: 'success',
                title: 'Updated!',
                text: 'Your profile picture has been updated successfully.',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error("Error uploading image:", error);
            Swal.fire({
                icon: 'error',
                title: 'Upload Failed',
                text: 'Something went wrong. Please try again.',
                confirmButtonColor: '#3b82f6'
            });
        }
    };

    if (loading) {
        return <ProfileSkeleton />;
    }

    if (!employee) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a1e60] text-white p-6">
                <p className="text-lg mb-4 text-center">We couldn't find your employee record. Please contact HR.</p>
                <Button onClick={handleBack} className="bg-white text-[#0a1e60]">Go Back</Button>
            </div>
        );
    }

    // Map real data to UI structure
    const profileData = {
        name: employee.fullName,
        designation: employee.designation,
        code: employee.employeeCode,
        personal: [
            { label: 'Date of Birth', value: formatReadableDate(employee.dateOfBirth), icon: Calendar },
            { label: 'National ID', value: employee.nationalId || 'N/A', icon: CreditCard },
            { label: 'Nationality', value: employee.nationality || 'Bangladeshi', icon: Flag },
            { label: 'Email', value: employee.email, icon: Mail },
        ],
        official: [
            { label: 'Employee Code', value: employee.employeeCode, icon: FileBadge },
            { label: 'Joining Date', value: formatReadableDate(employee.joinedDate), icon: Calendar },
            { label: 'Designation', value: employee.designation, icon: Briefcase },
            { label: 'Job Status', value: employee.jobStatus || 'Active', icon: Briefcase },
            { label: 'Branch', value: employee.branch || 'Not Defined', icon: Building2 },
            { label: 'Department', value: employee.department || 'Not Defined', icon: Network },
            { label: 'Direct Supervisor', value: supervisorName || 'Not Assigned', icon: UserCheck },
        ],
        others: [
            { label: 'Blood Group', value: employee.bloodGroup || 'N/A', icon: Droplet },
            { label: 'Mobile Number', value: employee.phone || 'N/A', icon: Smartphone },
            { label: 'Religion', value: employee.religion || 'N/A', icon: MapPin },
            { label: 'Gender', value: employee.gender || 'N/A', icon: Users },
        ]
    };

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-y-auto">
            {/* Standard Header */}
            {/* Standard Header */}
            <header className="sticky top-0 z-50 bg-[#0a1e60] flex items-center gap-4 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] min-h-[calc(4rem+env(safe-area-inset-top))] text-white overflow-hidden shadow-sm transition-all">
                <button
                    onClick={handleBack}
                    className="p-1 hover:bg-white/10 rounded-full transition-colors mt-1"
                >
                    <ChevronLeft className="w-7 h-7" />
                </button>
                <h1 className="text-xl font-bold mt-1">Profile</h1>
            </header>

            {/* Main Content Container */}
            <div
                className="flex-1 bg-slate-50 rounded-t-[2.5rem] px-6 pt-12 pb-24 relative mt-10"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >

                {/* Profile Header Avatar - Absolute Positioned */}
                <div className="absolute -top-12 left-6 z-[60] translate-y-[10px]">
                    <div className="relative group">
                        <div
                            className="h-24 w-24 rounded-full border-4 border-white overflow-hidden bg-white shadow-md cursor-pointer active:scale-95 transition-transform"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Avatar className="h-full w-full">
                                <AvatarImage src={employee.photoURL || undefined} className="object-cover" />
                                <AvatarFallback className="text-3xl text-slate-800">{employee.fullName?.charAt(0) || 'U'}</AvatarFallback>
                            </Avatar>
                        </div>
                        <div
                            className="absolute bottom-1 right-1 bg-white rounded-full p-1.5 shadow-sm border border-slate-100 text-amber-500 cursor-pointer hover:bg-slate-50 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleImageUpload}
                        />
                    </div>
                </div>

                {/* Contact Actions */}
                <div className="absolute top-6 right-6 flex gap-2">
                    <a href={`tel:${employee.phone}`}>
                        <Button size="icon" className="bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-2xl h-11 w-11 shadow-sm">
                            <Phone className="h-5 w-5" />
                        </Button>
                    </a>
                    <a
                        href={`https://api.whatsapp.com/send?phone=${employee.phone?.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
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
                <div className="bg-white rounded-3xl p-6 shadow-md mb-8 max-h-[calc(100vh-420px)] flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-black text-[#0a1e60] tracking-tight">
                            {activeTab === 'personal' && 'Personal Information'}
                            {activeTab === 'official' && 'Official Records'}
                            {activeTab === 'others' && 'Contact & Identity'}
                        </h3>
                        <div className="h-1 w-12 bg-blue-600 rounded-full" />
                    </div>

                    <div className="space-y-6 overflow-y-auto pr-2">
                        {profileData[activeTab].map((item, index) => {
                            const Icon = item.icon;
                            return (
                                <div key={index} className="flex items-center gap-4 group transition-all">
                                    <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-[#0a1e60] group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors border border-slate-100">
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-[10px] text-blue-500 font-black uppercase tracking-widest mb-0.5">{item.label}</div>
                                        <div className="text-base font-bold text-[#0a1e60]">{item.value}</div>
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
