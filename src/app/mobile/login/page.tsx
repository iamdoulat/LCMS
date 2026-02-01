"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, LogIn } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { UAParser } from 'ua-parser-js';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { sendPasswordResetEmail, signOut } from 'firebase/auth';
import { auth, firestore } from '@/lib/firebase/config';
import { DeviceApprovalPopup } from '@/components/auth/DeviceApprovalPopup';
import { doc, getDoc, updateDoc, arrayUnion, Timestamp, collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import type { UserDocumentForAdmin, AllowedDevice } from '@/types';

// Schema - same as main app
const loginSchema = z.object({
    email: z.string().email("Invalid email address").min(1, "Email is required"),
    password: z.string().min(6, "Password must be at least 6 characters long"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function MobileLoginPage() {
    const router = useRouter();
    const { login: contextLogin, companyName, companyLogoUrl, loading: authLoading, user, userRole, viewMode } = useAuth();
    const [isEmailLoading, setIsEmailLoading] = useState(false);
    const [showDevicePopup, setShowDevicePopup] = useState(false);
    const [isCheckingDevice, setIsCheckingDevice] = useState(false);

    const form = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    // Helper: Get or Create Device ID
    const getDeviceId = () => {
        if (typeof window === 'undefined') return 'unknown-device';
        let deviceId = localStorage.getItem('device_id');
        if (!deviceId) {
            deviceId = crypto.randomUUID();
            localStorage.setItem('device_id', deviceId);
        }
        return deviceId;
    };

    const getDeviceName = () => {
        if (typeof window === 'undefined') return 'Unknown Device';
        const parser = new UAParser();
        const result = parser.getResult();
        const browser = result.browser.name || 'Unknown Browser';
        const os = result.os.name || 'Unknown OS';
        const type = result.device.type || 'Mobile';
        return `${browser} on ${os} (${type})`;
    };

    const shouldCheckDevice = (role: string[] | string | undefined | null): boolean => {
        if (!role) return false;
        const roles = Array.isArray(role) ? role : [role];
        return roles.some(r => r.toLowerCase() === 'employee');
    };

    const verifyDevice = async (currentUser: any) => {
        setIsCheckingDevice(true);
        try {
            if (!currentUser?.uid) return;

            const isEmployee = userRole?.includes('Employee');
            let targetPath = '/mobile/dashboard';

            if (viewMode === 'mobile') {
                targetPath = '/mobile/dashboard';
            } else if (viewMode === 'web') {
                targetPath = '/dashboard';
            } else if (!isEmployee) {
                targetPath = '/dashboard';
            }

            // Check if device change feature is enabled
            const settingsRef = doc(firestore, 'system_settings', 'device_change_feature');
            const settingsSnap = await getDoc(settingsRef);
            const featureEnabled = settingsSnap.exists() ? (settingsSnap.data().enabled ?? true) : true;

            // If feature is disabled, skip device check
            if (!featureEnabled) {
                router.push(targetPath);
                return;
            }

            // Only check devices for employee role
            if (!shouldCheckDevice(userRole)) {
                router.push(targetPath);
                return;
            }

            const userDocRef = doc(firestore, 'users', currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (!userDocSnap.exists()) {
                router.push(targetPath);
                return;
            }

            const userData = userDocSnap.data() as UserDocumentForAdmin;
            const allowedDevices = userData.allowedDevices || [];
            const deviceId = getDeviceId();
            const deviceName = getDeviceName();

            // Gather device info
            const parser = new UAParser();
            const result = parser.getResult();
            const browser = result.browser.name;
            const os = result.os.name;
            const deviceType = result.device.type || 'Mobile';
            const brand = result.device.vendor;
            const model = result.device.model;
            const userAgent = navigator.userAgent;

            const newDevice: AllowedDevice = {
                deviceId,
                deviceName,
                registeredAt: Timestamp.now(),
                userAgent
            };

            // Case 1: No devices registered yet -> Auto-approve first device
            if (allowedDevices.length === 0) {
                const userRef = doc(firestore, 'users', currentUser.uid);
                await updateDoc(userRef, {
                    allowedDevices: arrayUnion(newDevice),
                    registeredAt: Timestamp.now()
                });
                router.push(targetPath);
                return;
            }

            // Case 2: Check if current device is allowed
            const isAllowed = allowedDevices.some(d => d.deviceId === deviceId);
            if (isAllowed) {
                router.push(targetPath);
                return;
            }

            // Case 3: Unrecognized Device - Show popup
            setShowDevicePopup(true);

            // Check if pending request exists
            const requestsRef = collection(firestore, 'device_change_requests');
            const q = query(
                requestsRef,
                where('userId', '==', currentUser.uid)
            );
            const querySnapshot = await getDocs(q);
            const existingReqs = querySnapshot.docs.filter(doc => {
                const data = doc.data();
                return data.deviceId === deviceId && data.status === 'pending';
            });

            if (existingReqs.length === 0) {
                // Create new request
                await addDoc(requestsRef, {
                    userId: currentUser.uid,
                    userName: userData.displayName || currentUser.displayName || 'Unknown User',
                    userEmail: userData.email || currentUser.email || 'No Email',
                    deviceId,
                    deviceName,
                    browser,
                    os,
                    deviceType,
                    brand,
                    model,
                    userAgent,
                    status: 'pending',
                    createdAt: serverTimestamp()
                });
                Swal.fire({
                    title: "Request Sent",
                    text: "A device change request has been sent to HR.",
                    icon: "success",
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000,
                    timerProgressBar: true,
                });
            }
        } catch (err) {
            console.error("Device verification error:", err);
        } finally {
            setIsCheckingDevice(false);
        }
    };

    useEffect(() => {
        if (!authLoading && user && !showDevicePopup) {
            verifyDevice(user);
        }
    }, [user, userRole, authLoading, viewMode]);

    const handleCheckNow = async () => {
        if (user) {
            await verifyDevice(user);
        }
    };

    const handleTryLater = async () => {
        await signOut(auth);
        setShowDevicePopup(false);
        router.push('/mobile/login');
    };

    const onEmailSubmit = async (data: LoginFormValues) => {
        setIsEmailLoading(true);
        try {
            await contextLogin(data.email, data.password);
            // Device check will happen in useEffect
        } catch (err: any) {
            Swal.fire({
                icon: 'error',
                title: 'Login Failed',
                text: err.message || "Invalid credentials",
                confirmButtonColor: '#0a1e60'
            });
        } finally {
            setIsEmailLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        const { value: email } = await Swal.fire({
            title: 'Forgot Password?',
            input: 'email',
            inputLabel: 'Enter your email address',
            inputPlaceholder: 'you@example.com',
            showCancelButton: true,
            confirmButtonText: 'Send Reset Link',
            confirmButtonColor: '#0a1e60',
            cancelButtonText: 'Cancel',
            inputValidator: (value) => {
                if (!value) return 'You need to write something!';
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address.';
                return null;
            }
        });

        if (email) {
            try {
                await sendPasswordResetEmail(auth, email);
                Swal.fire({
                    title: 'Email Sent',
                    text: `Password reset link sent to ${email}`,
                    icon: 'success',
                    confirmButtonColor: '#0a1e60'
                });
            } catch (err: any) {
                Swal.fire({
                    title: 'Error',
                    text: err.message,
                    icon: 'error',
                    confirmButtonColor: '#0a1e60'
                });
            }
        }
    };

    if (authLoading || (!authLoading && user && !showDevicePopup)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0a1e60]">
                <Loader2 className="h-12 w-12 animate-spin text-white" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0a1e60] pt-[calc(env(safe-area-inset-top)+10px)] pb-[env(safe-area-inset-bottom)]">
            <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-xl">
                <div className="flex flex-col items-center mb-6">
                    <div className="h-20 w-20 rounded-2xl bg-blue-50 flex items-center justify-center mb-4 shadow-sm">
                        <Image
                            src={companyLogoUrl || "/icons/icon-192x192.png"}
                            alt="Logo"
                            width={50}
                            height={50}
                            className="object-contain"
                        />
                    </div>
                    <h1 className="text-2xl font-bold text-[#0a1e60] text-center">Welcome Back</h1>
                    <p className="text-slate-500 text-sm text-center">Login to your employee account</p>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onEmailSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input placeholder="name@company.com" className="h-12 rounded-xl bg-slate-50 border-slate-200" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-center justify-between">
                                        <FormLabel>Password</FormLabel>
                                        <button type="button" onClick={handleForgotPassword} className="text-xs text-[#0a1e60] font-semibold">Forgot?</button>
                                    </div>
                                    <FormControl>
                                        <Input type="password" placeholder="••••••••" className="h-12 rounded-xl bg-slate-50 border-slate-200" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <Button type="submit" className="w-full h-12 rounded-xl bg-[#0a1e60] hover:bg-[#0a1e60]/90 text-lg shadow-lg shadow-blue-900/20" disabled={isEmailLoading}>
                            {isEmailLoading ? <Loader2 className="animate-spin" /> : "Sign In"}
                        </Button>
                    </form>
                </Form>
            </div>
            <p className="mt-8 text-white/50 text-xs">© {new Date().getFullYear()} {companyName}. All rights reserved.</p>

            <DeviceApprovalPopup
                isOpen={showDevicePopup}
                onCheckNow={handleCheckNow}
                onTryNewUser={handleTryLater}
            />
        </div>
    );
}
