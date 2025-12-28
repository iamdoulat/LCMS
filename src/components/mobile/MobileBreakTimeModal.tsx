"use client";

import React, { useState, useEffect } from 'react';
import { X, Coffee, Timer, Loader2, CheckCircle2, AlertCircle, MapPin, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, onSnapshot, query, collection, where } from 'firebase/firestore';
import { format } from 'date-fns';
import { startBreak, stopBreak } from '@/lib/firebase/breakTime';
import { BreakTimeRecord } from '@/types/breakTime';
import Swal from 'sweetalert2';
import { getCurrentLocation, reverseGeocode } from '@/lib/firebase/checkInOut';
import { cn } from '@/lib/utils';

interface MobileBreakTimeModalProps {
    isOpen: boolean;
    onClose: () => void;
    isFrozen?: boolean;
    externalIsOnBreak?: boolean;
    externalBreakRecord?: BreakTimeRecord | null;
}

export function MobileBreakTimeModal({ isOpen, onClose, isFrozen = false, externalIsOnBreak, externalBreakRecord }: MobileBreakTimeModalProps) {
    const { user } = useAuth();
    const [employeeData, setEmployeeData] = useState<any>(null);
    const [internalIsOnBreak, setInternalIsOnBreak] = useState(false);
    const [internalActiveBreakRecord, setInternalActiveBreakRecord] = useState<BreakTimeRecord | null>(null);
    const [breakLoading, setBreakLoading] = useState(false);
    const [breakElapsedTime, setBreakElapsedTime] = useState<string>("00:00:00");
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<any>(null);
    const [todayAttendance, setTodayAttendance] = useState<any>(null);
    const [showStopConfirmation, setShowStopConfirmation] = useState(false);

    const isOnBreak = externalIsOnBreak !== undefined ? externalIsOnBreak : internalIsOnBreak;
    const activeBreakRecord = externalBreakRecord !== undefined ? externalBreakRecord : internalActiveBreakRecord;

    // Fetch employee data and today's attendance
    useEffect(() => {
        if (!user || !isOpen) return;

        const fetchData = async () => {
            try {
                const empDoc = await getDoc(doc(firestore, 'employees', user.uid));
                if (empDoc.exists()) {
                    setEmployeeData({ id: empDoc.id, ...empDoc.data() });
                }

                const today = format(new Date(), 'yyyy-MM-dd');
                const attDocId = `${user.uid}_${today}`;
                const attDoc = await getDoc(doc(firestore, 'attendance', attDocId));
                if (attDoc.exists()) {
                    setTodayAttendance(attDoc.data());
                } else {
                    setTodayAttendance(null);
                }
            } catch (err) {
                console.error("Error fetching data for break modal:", err);
            }
        };

        fetchData();
    }, [user, isOpen]);

    // Real-time listener for active break (Only if external state not provided)
    useEffect(() => {
        if (!user?.uid || !isOpen || externalIsOnBreak !== undefined) return;

        const q = query(
            collection(firestore, 'break_time'),
            where('employeeId', '==', user.uid),
            where('onBreak', '==', true)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                setInternalActiveBreakRecord({ id: doc.id, ...doc.data() } as BreakTimeRecord);
                setInternalIsOnBreak(true);
            } else {
                setInternalActiveBreakRecord(null);
                setInternalIsOnBreak(false);
            }
        });

        return () => unsubscribe();
    }, [user, isOpen, externalIsOnBreak]);

    // Timer effect
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isOnBreak && activeBreakRecord?.startTime) {
            const updateTimer = () => {
                const start = new Date(activeBreakRecord.startTime);
                const now = new Date();
                const diff = Math.max(0, now.getTime() - start.getTime());

                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);

                setBreakElapsedTime(
                    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                );
            };

            updateTimer();
            interval = setInterval(updateTimer, 1000);
        } else {
            setBreakElapsedTime("00:00:00");
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isOnBreak, activeBreakRecord?.startTime]);

    const captureLocation = async () => {
        setIsLoadingLocation(true);
        try {
            const location = await getCurrentLocation({ forceRefresh: true });
            const address = await reverseGeocode(location.latitude, location.longitude);
            const locData = { ...location, address };
            setCurrentLocation(locData);
            return locData;
        } catch (error: any) {
            console.error('Error capturing location for break:', error);
            Swal.fire({
                title: 'Location Error',
                text: error.message || 'Could not get location',
                icon: 'error',
                customClass: {
                    container: 'z-[99999] !important'
                }
            });
            return null;
        } finally {
            setIsLoadingLocation(false);
        }
    };

    const handleToggleBreak = async () => {
        if (!employeeData) return;

        if (employeeData.status === 'Terminated') {
            Swal.fire("Access Denied", "Your are Terminated. Please Contact with HR department.", "error");
            return;
        }

        if (!todayAttendance?.inTime) {
            Swal.fire("Action Required", "You must Check-In first before taking a break.", "warning");
            return;
        }

        if (todayAttendance?.outTime) {
            Swal.fire("Action Blocked", "You have already Checked-Out for the day.", "warning");
            return;
        }

        if (isOnBreak && activeBreakRecord?.id) {
            // Show confirmation UI instead of Swal
            setShowStopConfirmation(true);
            return;
        }

        // Start Break Logic
        await performBreakAction(false);
    };

    const confirmStopBreak = async () => {
        setShowStopConfirmation(false);
        await performBreakAction(true);
    };

    const performBreakAction = async (isStopping: boolean) => {
        setBreakLoading(true);
        try {
            const location = await captureLocation();
            if (!location) {
                setBreakLoading(false);
                return;
            }

            if (isStopping && activeBreakRecord?.id) {
                await stopBreak(activeBreakRecord.id, location);
                Swal.fire({
                    title: "Break Ended",
                    text: "Welcome back! Your break has been recorded.",
                    icon: "success",
                    timer: 1500,
                    showConfirmButton: false,
                    customClass: {
                        container: 'z-[99999] !important'
                    }
                });
            } else {
                await startBreak({
                    id: employeeData.id,
                    fullName: employeeData.fullName,
                    employeeCode: employeeData.employeeCode,
                    designation: employeeData.designation
                }, location);

                Swal.fire({
                    title: "Break Started",
                    text: "Take rest! Your break has started.",
                    icon: "success",
                    timer: 1500,
                    showConfirmButton: false,
                    customClass: {
                        container: 'z-[99999] !important'
                    }
                });
            }
        } catch (error: any) {
            console.error("Error toggling break:", error);
            Swal.fire({
                title: "Error",
                text: error.message || "Failed to process break.",
                icon: "error",
                customClass: {
                    container: 'z-[99999] !important'
                }
            });
        } finally {
            setBreakLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open && isFrozen) return; // Prevent closing if frozen
            if (!open) onClose();
        }}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-slate-50 border-0 h-auto max-h-[85vh] sm:h-auto flex flex-col relative w-[90%] rounded-2xl top-[300px] translate-y-0">
                {/* Confirmation Overlay */}
                {showStopConfirmation && (
                    <div className="fixed inset-0 z-[100] bg-white/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-xs border border-slate-100 text-center">
                            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                                <AlertCircle className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Stop Break?</h3>
                            <p className="text-sm text-slate-500 mb-6">
                                Are you sure you want to stop your break? This will record your break end time.
                            </p>
                            <div className="flex gap-3">
                                <Button
                                    onClick={() => setShowStopConfirmation(false)}
                                    variant="outline"
                                    className="flex-1 rounded-xl h-12 font-bold border-slate-200"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={confirmStopBreak}
                                    className="flex-1 rounded-xl h-12 font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-100"
                                >
                                    Yes, Stop
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-white border-b sticky top-0 z-10">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Coffee className="h-5 w-5 text-orange-500" />
                        Break Time
                    </h2>
                    {!isFrozen && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="h-8 w-8 rounded-full hover:bg-slate-100"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto">
                    <div className="p-6 flex flex-col items-center justify-center space-y-8">
                        {/* Status Indicator */}
                        <div className={cn(
                            "h-48 w-48 rounded-full border-8 flex flex-col items-center justify-center transition-all duration-500 shadow-2xl relative",
                            isOnBreak
                                ? "border-orange-500 bg-orange-50 text-orange-600 shadow-orange-100"
                                : "border-emerald-500 bg-emerald-50 text-emerald-600 shadow-emerald-100"
                        )}>
                            <div className="absolute -top-2 -right-2">
                                <div className={cn(
                                    "h-6 w-6 rounded-full border-4 border-white",
                                    isOnBreak ? "bg-orange-500 animate-pulse" : "bg-emerald-500"
                                )} />
                            </div>

                            {isOnBreak ? (
                                <>
                                    <Timer className="h-12 w-12 animate-spin-slow mb-2" />
                                    <span className="text-lg font-black tracking-widest">ON BREAK</span>
                                </>
                            ) : (
                                <>
                                    <Coffee className="h-12 w-12 mb-2" />
                                    <span className="text-lg font-black tracking-widest">WORKING</span>
                                </>
                            )}
                        </div>

                        {/* Timer Section */}
                        <div className="text-center space-y-2">
                            {isOnBreak ? (
                                <>
                                    <p className="text-5xl font-mono font-black text-slate-800 tracking-tighter">
                                        {breakElapsedTime}
                                    </p>
                                    <p className="text-sm text-slate-500 font-medium">
                                        Started at: {activeBreakRecord?.startTime ? format(new Date(activeBreakRecord.startTime), 'hh:mm a') : '--:--'}
                                    </p>
                                </>
                            ) : (
                                <p className="text-slate-500 font-medium px-8">
                                    Refresh your mind with a short break.
                                </p>
                            )}
                        </div>

                        {/* Location Badge */}
                        {currentLocation ? (
                            <div className="bg-white px-4 py-2 rounded-full border border-slate-100 shadow-sm flex items-center gap-2 max-w-[90%]">
                                <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className="text-[10px] text-slate-600 truncate font-medium">
                                    {currentLocation.address || "Location captured"}
                                </span>
                            </div>
                        ) : (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-[10px] text-slate-400"
                                onClick={captureLocation}
                                disabled={isLoadingLocation}
                            >
                                {isLoadingLocation ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                )}
                                Auto-capturing location...
                            </Button>
                        )}
                    </div>
                </div>

                {/* Footer Action */}
                <div className="p-4 bg-white border-t mt-auto">
                    <Button
                        onClick={handleToggleBreak}
                        disabled={breakLoading}
                        className={cn(
                            "w-full h-14 text-lg font-bold shadow-lg transition-all active:scale-95",
                            isOnBreak
                                ? "bg-red-600 hover:bg-red-700 shadow-red-100"
                                : "bg-blue-600 hover:bg-blue-700 shadow-blue-100"
                        )}
                    >
                        {breakLoading ? (
                            <>
                                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                                Processing...
                            </>
                        ) : isOnBreak ? (
                            <>
                                <CheckCircle2 className="mr-2 h-6 w-6" />
                                Stop Break
                            </>
                        ) : (
                            <>
                                < Coffee className="mr-2 h-6 w-6" />
                                Start Break
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
