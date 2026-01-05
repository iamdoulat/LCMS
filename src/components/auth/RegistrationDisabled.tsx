"use client";

import React from 'react';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function RegistrationDisabled() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
            <div className="animate-in fade-in-0 zoom-in-95 duration-700">
                <Card className="w-full max-w-md shadow-2xl border-2">
                    <CardHeader className="text-center space-y-4">
                        {/* Animated 404 Icon */}
                        <div className="mx-auto">
                            <div className="relative">
                                <div className="absolute inset-0 animate-ping opacity-20">
                                    <AlertCircle className="h-24 w-24 text-destructive mx-auto" />
                                </div>
                                <AlertCircle className="h-24 w-24 text-destructive mx-auto animate-pulse" />
                            </div>
                        </div>

                        {/* 404 Title */}
                        <div className="space-y-2">
                            <h1 className="text-6xl font-bold text-destructive animate-in slide-in-from-top-5 duration-500">
                                404
                            </h1>
                            <CardTitle
                                className={cn(
                                    "font-bold text-2xl bg-gradient-to-r from-destructive via-orange-500 to-amber-500",
                                    "text-transparent bg-clip-text animate-in slide-in-from-bottom-5 duration-700"
                                )}
                            >
                                Registration Currently Disabled
                            </CardTitle>
                        </div>

                        <CardDescription className="text-base animate-in fade-in duration-1000 delay-300">
                            New user registration is temporarily unavailable.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6 animate-in fade-in duration-1000 delay-500">
                        {/* Information Box */}
                        <div className="bg-muted/50 backdrop-blur-sm rounded-lg p-4 border border-border/50">
                            <p className="text-sm text-muted-foreground text-center leading-relaxed">
                                Please contact your system administrator for assistance with account registration
                                or to request access to the platform.
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-3">
                            <Button asChild className="w-full" size="lg">
                                <Link href="/login">
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back to Login
                                </Link>
                            </Button>

                            <p className="text-xs text-center text-muted-foreground">
                                Already have an account?{" "}
                                <Link href="/login" className="font-medium text-primary hover:underline">
                                    Sign in here
                                </Link>
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Animated background elements */}
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-destructive/5 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse delay-700" />
            </div>
        </div>
    );
}
