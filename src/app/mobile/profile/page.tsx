"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import {
    ChevronLeft,
    Phone,
    Mail,
    User,
    Briefcase,
    LayoutGrid,
    Calendar,
    CreditCard,
    Flag,
    Droplet,
    Smartphone,
    Users, // Using for Gender/Religion visual proxy
    MapPin,
    Building2,
    FileBadge,
    Pencil
} from 'lucide-react';

export default function MobileProfilePage() {
    const router = useRouter();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'personal' | 'official' | 'others'>('personal');

    const handleBack = () => {
        router.back();
    };

    // Placeholder data based on reference image
    // In a real app, this would come from a firestore document linked to user.uid
    const profileData = {
        name: user?.displayName || 'MOHAMMAD DOULAT MEAH',
        designation: 'Manager ( Commercial & Supplychain )',
        code: '006',
        personal: [
            { label: 'Date of Birth', value: '30-01-1990', icon: Calendar },
            { label: 'National ID', value: '1907710667', icon: CreditCard },
            { label: 'Nationality', value: 'Bangladeshi', icon: Flag },
            { label: 'Email', value: user?.email || 'doulat@smartsolution-bd.com', icon: Mail },
        ],
        official: [
            { label: 'Employee Code', value: '006', icon: FileBadge },
            { label: 'Joining Date', value: '01-08-2013', icon: Calendar },
            { label: 'Designation', value: 'Manager ( Commercial & Supplychain )', icon: Briefcase },
            { label: 'Functional Designation', value: 'Not Defined', icon: User },
            { label: 'Job Status', value: 'Active', icon: Briefcase },
        ],
        others: [
            { label: 'Blood Group', value: 'A+ (Positive)', icon: Droplet },
            { label: 'Mobile Number', value: '0177798986', icon: Smartphone },
            { label: 'Religion', value: 'Islam', icon: MapPin }, // Using MapPin as proxy or Flag
            { label: 'Gender', value: 'Male', icon: Users },
        ]
    };

    return (
        <div className="flex flex-col min-h-screen bg-[#0a1e60]">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#0a1e60] flex items-center justify-between px-4 py-4 text-white">
                <Button variant="ghost" size="icon" onClick={handleBack} className="text-white hover:bg-white/10">
                    <ChevronLeft className="h-6 w-6" />
                </Button>
                <h1 className="text-xl font-semibold">Profile</h1>
                <div className="w-10" /> {/* Spacer for centering */}
            </header>

            {/* Main Content Container */}
            <div className="flex-1 bg-slate-50 rounded-t-[2rem] px-6 pt-12 pb-8 relative mt-9">

                {/* Profile Header Avatar - Absolute Positioned */}
                <div className="absolute -top-16 left-6 z-50">
                    <div className="relative">
                        <div className="h-32 w-32 rounded-full border-4 border-white overflow-hidden bg-white shadow-sm">
                            <Avatar className="h-full w-full">
                                <AvatarImage src={user?.photoURL || undefined} className="object-cover" />
                                <AvatarFallback className="text-4xl text-slate-800">{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                            </Avatar>
                        </div>
                        <div className="absolute bottom-2 right-2 bg-white rounded-full p-1 shadow-sm border border-slate-100 text-amber-500">
                            <Pencil className="h-4 w-4" />
                        </div>
                    </div>
                </div>

                {/* Contact Actions (Phone/Mail) */}
                <div className="absolute top-6 right-6 flex gap-3">
                    <Button size="icon" className="bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-2xl h-12 w-12 shadow-sm">
                        <Phone className="h-6 w-6" />
                    </Button>
                    <Button size="icon" className="bg-purple-100 hover:bg-purple-200 text-purple-600 rounded-2xl h-12 w-12 shadow-sm">
                        <Mail className="h-6 w-6" />
                    </Button>
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
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-3 mb-6">
                    <button
                        onClick={() => setActiveTab('personal')}
                        className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-semibold transition-colors ${activeTab === 'personal'
                            ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-200'
                            : 'bg-white text-slate-600 shadow-sm'
                            }`}
                    >
                        <User className="h-5 w-5" />
                        {activeTab === 'personal' && <span>Personal</span>}
                    </button>
                    <button
                        onClick={() => setActiveTab('official')}
                        className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-semibold transition-colors ${activeTab === 'official'
                            ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-200'
                            : 'bg-white text-slate-600 shadow-sm'
                            }`}
                    >
                        <Briefcase className="h-5 w-5" />
                        {activeTab === 'official' && <span>Official</span>}
                    </button>
                    <button
                        onClick={() => setActiveTab('others')}
                        className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-semibold transition-colors ${activeTab === 'others'
                            ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-200'
                            : 'bg-white text-slate-600 shadow-sm'
                            }`}
                    >
                        <LayoutGrid className="h-5 w-5" />
                        {activeTab === 'others' && <span>Others</span>}
                    </button>
                </div>

                {/* Info Card */}
                <div className="bg-white rounded-2xl p-6 shadow-sm min-h-[400px]">
                    <h3 className="text-lg font-bold text-[#0a1e60] mb-6">
                        {activeTab === 'personal' && 'Personal Info'}
                        {activeTab === 'official' && 'Official Info'}
                        {activeTab === 'others' && 'Others Info'}
                    </h3>

                    <div className="space-y-6">
                        {profileData[activeTab].map((item, index) => {
                            const Icon = item.icon;
                            return (
                                <div key={index} className="flex items-start gap-4 pb-6 border-b border-slate-50 last:border-0 last:pb-0">
                                    <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-[#0a1e60]">
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <div className="text-sm text-blue-500 font-medium mb-1">{item.label}</div>
                                        <div className="text-lg font-bold text-[#0a1e60]">{item.value}</div>
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
