
"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { Loader2, LogIn } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { UAParser } from 'ua-parser-js';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, Timestamp, collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { firestore, auth } from '@/lib/firebase/config';
import { DeviceApprovalPopup } from '@/components/auth/DeviceApprovalPopup';
import type { UserDocumentForAdmin, AllowedDevice } from '@/types';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
// Separator component is no longer needed for the "OR" line if we use the div-based approach.
// import { Separator } from '@/components/ui/separator'; 

import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  email: z.string().email("Invalid email address").min(1, "Email is required"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { user, userRole, loading: authLoading, viewMode, login: contextLogin, companyLogoUrl } = useAuth();
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Device Approval States
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
    const type = result.device.type || 'Desktop';
    return `${browser} on ${os} (${type})`;
  };

  // Helper: Check if user should have device security (ONLY employees)
  const shouldCheckDevice = (role: string[] | string | undefined | null): boolean => {
    if (!role) return false;
    const roles = Array.isArray(role) ? role : [role];
    return roles.some(r => r.toLowerCase() === 'employee');
  };

  // Verify Device Function
  const verifyDevice = async (currentUser: any) => {
    setIsCheckingDevice(true);
    setError(null);

    try {
      if (!currentUser?.uid) return;

      // Determine redirection path based on role
      // If userRole is not yet loaded but user is logged in, we might default to dashboard or wait? 
      // Assuming userRole is populated if user is populated.
      // We'll check the fetched 'userRole' from context.
      const isEmployee = userRole?.includes('Employee');
      let targetPath = '/dashboard';

      // Check screen size first - force mobile mode on small screens
      const isMobileScreen = typeof window !== 'undefined' && window.innerWidth < 768;

      if (isMobileScreen) {
        targetPath = '/mobile/dashboard';
      } else if (viewMode === 'mobile') {
        targetPath = '/mobile/dashboard';
      } else if (viewMode === 'web') {
        targetPath = '/dashboard';
      } else if (isEmployee) {
        targetPath = '/mobile/dashboard';
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

      const userDocRef = doc(firestore, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        router.push(targetPath);
        return;
      }

      const userData = userDocSnap.data() as any; // Cast to any to ensure we can access 'role'

      // Check role directly from fresh data
      const freshRole = userData.role;

      if (!shouldCheckDevice(freshRole)) {
        router.push(targetPath);
        return;
      }

      const allowedDevices = (userData.allowedDevices || []) as AllowedDevice[];
      const deviceId = getDeviceId();
      const deviceName = getDeviceName();

      // Gather device info for logging/request
      const parser = new UAParser();
      const result = parser.getResult();
      const browser = result.browser.name;
      const os = result.os.name;
      const deviceType = result.device.type || 'Desktop';
      const brand = result.device.vendor;
      const model = result.device.model;
      const userAgent = navigator.userAgent;

      const newDevice: AllowedDevice = {
        deviceId,
        deviceName,
        registeredAt: Timestamp.now(),
        userAgent
      };

      // Case 1: No devices registered yet -> Auto-approve this first device
      if (allowedDevices.length === 0) {
        const userRef = doc(firestore, 'users', currentUser.uid);
        // Also update `registeredAt` if missing?
        const updateData: any = {
          allowedDevices: arrayUnion(newDevice),
          registeredAt: Timestamp.now()
        };
        await updateDoc(userRef, updateData);
        router.push(targetPath);
        return;
      }

      // Case 2: Check if current device is allowed
      const isAllowed = allowedDevices.some((d) => d.deviceId === deviceId);
      if (isAllowed) {
        router.push(targetPath);
        return;
      }

      // Case 3: New/Unrecognized Device
      setShowDevicePopup(true);

      // Check if a pending request already exists to avoid spamming
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
          text: "A device change request has been sent to the administrator.",
          icon: "success",
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true,
        });
      } else {
      }

    } catch (err) {
      console.error("Device verification error:", err);
      setError("Failed to verify device. Please try again.");
    } finally {
      setIsCheckingDevice(false);
    }
  };

  React.useEffect(() => {
    // Only run verification if we have a user and aren't already dealing with the popup
    if (!authLoading && user && !showDevicePopup) {
      verifyDevice(user);
    }
  }, [user, userRole, authLoading, router]); // removing showDevicePopup from dependency to avoid loop, but we use it in logic

  const handleCheckNow = async () => {
    if (user) {
      await verifyDevice(user);
    }
  };

  const handleTryNewUser = async () => {
    await signOut(auth);
    setShowDevicePopup(false);
    // Ensure we are ready for new login
    router.push('/login');
  };



  const onEmailSubmit = async (data: LoginFormValues) => {
    setIsEmailLoading(true);
    setError(null);
    try {
      await contextLogin(data.email, data.password);
      // Success is handled by onAuthStateChanged, which will redirect
    } catch (err: any) {
      // The context now throws the error, so we can catch it here if needed,
      // but the user-facing alert is already shown in the context.
      // We can still set a local error state if we want to display it inline.
      setError(err.message || "Login failed.");
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
      cancelButtonText: 'Cancel',
      inputValidator: (value) => {
        if (!value) {
          return 'You need to write something!';
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Please enter a valid email address.';
        }
        return null; // Return null on successful validation
      }
    });

    if (email) {
      setIsEmailLoading(true);
      setError(null);
      try {
        await sendPasswordResetEmail(auth, email);
        Swal.fire({
          title: 'Password Reset Email Sent',
          text: `If an account exists for ${email}, a password reset link has been sent. Please check your inbox.`,
          icon: 'success'
        });
      } catch (err: any) {
        console.error("Forgot password error:", err);
        let friendlyMessage = "Failed to send password reset email. Please try again.";
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          // Firebase now uses auth/invalid-credential for user not found in some flows
          friendlyMessage = "No account found with that email address.";
        } else if (err.code === 'auth/invalid-email') {
          friendlyMessage = "The email address is not valid.";
        }
        Swal.fire({
          title: 'Error',
          text: friendlyMessage,
          icon: 'error'
        });
      } finally {
        setIsEmailLoading(false);
      }
    }
  };


  if (authLoading || (!authLoading && user && !showDevicePopup && !error)) {
    // Show loader while checking auth OR while verifying device (user exists but popup not shown yet)
    // We added !error so if there's an error we show the form again (or the error state)
    // Actually, if user is logged in but blocked, we might want to keep showing loader?
    // No, if blocked, we show popup. The popup is rendered below.
    // So if (user && !showDevicePopup), it means we are verifying.
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-24 w-full items-center justify-center">
            <Image
              src={companyLogoUrl}
              alt="Company Logo"
              width={200}
              height={80}
              className="h-full w-auto object-contain max-h-20"
              priority
              data-ai-hint="logo company"
            />
          </div>
          <CardTitle
            className={cn("font-bold text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}
          >
            LC Management System Login
          </CardTitle>
          <CardDescription>Access your Letter of Credit Management Dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEmailSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} />
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
                      <Button
                        type="button"
                        variant="link"
                        className="p-0 h-auto text-xs text-primary hover:underline"
                        onClick={handleForgotPassword}
                      >
                        Forgot Password?
                      </Button>
                    </div>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isEmailLoading}>
                {isEmailLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Login with Email
                  </>
                )}
              </Button>
            </form>
          </Form>

        </CardContent>
      </Card>
      <DeviceApprovalPopup
        isOpen={showDevicePopup}
        onCheckNow={handleCheckNow}
        onTryNewUser={handleTryNewUser}
      />
    </div>
  );
}
