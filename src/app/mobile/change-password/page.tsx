"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { auth } from '@/lib/firebase/config';
import { sendPasswordResetEmail } from 'firebase/auth';
import { ChevronLeft, Lock, Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import Swal from 'sweetalert2';

export default function MobileChangePasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleBack = () => {
        router.back();
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            Swal.fire({
                icon: 'error',
                title: 'Email Required',
                text: 'Please enter your email address.',
                confirmButtonColor: '#0a1e60'
            });
            return;
        }

        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, email);
            setSuccess(true);
            Swal.fire({
                icon: 'success',
                title: 'Reset Link Sent',
                text: 'A password reset link has been sent to your email address. Please check your inbox.',
                confirmButtonColor: '#0a1e60'
            });
        } catch (error: any) {
            console.error("Error sending reset email:", error);
            let message = "Failed to send reset email. Please try again.";
            if (error.code === 'auth/user-not-found') {
                message = "No account found with this email address.";
            } else if (error.code === 'auth/invalid-email') {
                message = "The email address is invalid.";
            }

            Swal.fire({
                icon: 'error',
                title: 'Reset Failed',
                text: message,
                confirmButtonColor: '#0a1e60'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-[#0a1e60]">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#0a1e60] flex items-center justify-between px-4 py-4 text-white">
                <Button variant="ghost" size="icon" onClick={handleBack} className="text-white hover:bg-white/10">
                    <ChevronLeft className="h-6 w-6" />
                </Button>
                <h1 className="text-xl font-semibold">Change Password</h1>
                <div className="w-10" /> {/* Spacer */}
            </header>

            {/* Content Area */}
            <div className="flex-1 bg-slate-50 rounded-t-[2rem] px-6 pt-12 pb-8 flex flex-col items-center">
                <div className="bg-blue-100 p-5 rounded-full mb-8 text-blue-600">
                    <Lock className="h-10 w-10" />
                </div>

                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-[#0a1e60] mb-2">Reset Password</h2>
                    <p className="text-slate-500 text-sm max-w-[280px]">
                        Enter your email address and we'll send you a link to reset your password.
                    </p>
                </div>

                {success ? (
                    <div className="w-full space-y-6">
                        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 flex flex-col items-center text-center">
                            <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4" />
                            <h3 className="font-bold text-emerald-900 mb-1">Email Sent!</h3>
                            <p className="text-emerald-700 text-sm">
                                Please check <strong>{email}</strong> for instructions to reset your password.
                            </p>
                        </div>
                        <Button
                            onClick={handleBack}
                            className="w-full h-14 bg-[#0a1e60] hover:bg-[#0a1e60]/90 text-white rounded-2xl font-bold shadow-lg"
                        >
                            Back to Dashboard
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => setSuccess(false)}
                            className="w-full text-slate-500 font-semibold"
                        >
                            Try another email
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleResetPassword} className="w-full space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-1">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <Input
                                    type="email"
                                    placeholder="Enter your email"
                                    className="h-14 pl-12 rounded-2xl border-slate-200 bg-white focus-visible:ring-blue-500 shadow-sm font-medium"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading || !email}
                            className="w-full h-14 bg-[#0a1e60] hover:bg-[#0a1e60]/90 text-white rounded-2xl font-bold shadow-xl flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <span>Sending Reset Link...</span>
                                </>
                            ) : (
                                <span>Send Reset Link</span>
                            )}
                        </Button>

                        <div className="flex items-center gap-2 p-4 bg-amber-50 rounded-2xl border border-amber-100 mt-4">
                            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                            <p className="text-[11px] text-amber-700 font-medium italic">
                                Note: You will be logged out after resetting your password for security reasons.
                            </p>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
