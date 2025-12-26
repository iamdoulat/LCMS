"use client";

import React, { useState } from 'react';
import { X, MapPin, Loader2, CheckCircle2, AlertCircle, Navigation, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import Swal from 'sweetalert2';
import dynamic from 'next/dynamic';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface MobileAttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    type: 'in' | 'out';
}

interface LocationData {
    latitude: number;
    longitude: number;
    accuracy: number;
}

// Use dynamic import for LocationMap to avoid SSR issues
const LocationMap = dynamic(() => import('@/components/ui/LocationMap'), {
    loading: () => <div className="h-[300px] w-full bg-slate-100 animate-pulse rounded-md" />,
    ssr: false
});

export function MobileAttendanceModal({ isOpen, onClose, onSuccess, type }: MobileAttendanceModalProps) {
    const { user } = useAuth();
    const [isCapturing, setIsCapturing] = useState(false);
    const [location, setLocation] = useState<LocationData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [address, setAddress] = useState<string | null>(null);
    const [remarks, setRemarks] = useState('');
    const [geofenceRadius, setGeofenceRadius] = useState<number>(100);
    const [insideGeofence, setInsideGeofence] = useState<boolean>(true); // Default true until checked

    if (!isOpen) return null;

    const captureLocation = async () => {
        setIsCapturing(true);
        setError(null);

        try {
            if (!navigator.geolocation) {
                throw new Error('Geolocation is not supported by your device');
            }

            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    resolve,
                    reject,
                    {
                        enableHighAccuracy: true,
                        timeout: 15000,
                        maximumAge: 0
                    }
                );
            });

            setLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            });
        } catch (err: any) {
            console.error('Location capture error:', err);

            let errorMessage = 'Unable to capture location. Please enable location services and try again.';

            if (err.code === 1) {
                errorMessage = 'Location access denied. Please enable location permissions in your device settings.';
            } else if (err.code === 2) {
                errorMessage = 'Location unavailable. Please turn on your phone\'s location services.';
            } else if (err.code === 3) {
                errorMessage = 'Location request timed out. Please try again.';
            }

            await Swal.fire({
                title: 'Location Error',
                text: errorMessage,
                icon: 'error',
                confirmButtonText: 'OK'
            });
        } finally {
            setIsCapturing(false);
        }
    };

    const handleSubmit = async () => {
        if (!user || !location) return;

        setIsSubmitting(true);
        setError(null);

        try {
            // Fetch employee data
            const employeeDoc = await getDoc(doc(firestore, 'employees', user.uid));
            if (!employeeDoc.exists()) {
                throw new Error('Employee record not found');
            }

            const employeeData = employeeDoc.data();
            const today = new Date();
            const dateKey = format(today, 'yyyy-MM-dd');
            const docId = `${user.uid}_${dateKey}`;
            const currentTime = format(today, 'HH:mm');

            // Get existing attendance record
            const attendanceDoc = await getDoc(doc(firestore, 'attendance', docId));

            if (type === 'in') {
                // Check-in logic
                if (attendanceDoc.exists() && attendanceDoc.data().inTime) {
                    throw new Error('You have already checked in for today');
                }

                // Fetch geofence settings
                let insideGeofence = true;
                let needsApproval = false;

                try {
                    const geofenceDoc = await getDoc(doc(firestore, 'hrm_settings', 'geofence'));
                    if (geofenceDoc.exists()) {
                        const geofenceData = geofenceDoc.data();
                        const centerLat = geofenceData.latitude;
                        const centerLng = geofenceData.longitude;
                        const radius = geofenceData.radius || 100; // meters
                        setGeofenceRadius(radius);

                        // Calculate distance using Haversine formula
                        const R = 6371e3;
                        const φ1 = (centerLat * Math.PI) / 180;
                        const φ2 = (location.latitude * Math.PI) / 180;
                        const Δφ = ((location.latitude - centerLat) * Math.PI) / 180;
                        const Δλ = ((location.longitude - centerLng) * Math.PI) / 180;

                        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                            Math.cos(φ1) * Math.cos(φ2) *
                            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        const distance = R * c;

                        insideGeofence = distance <= radius;
                        setInsideGeofence(insideGeofence);
                        needsApproval = !insideGeofence;
                    }
                } catch (geoErr) {
                    console.error('Geofence check error:', geoErr);
                }

                // Determine attendance flag
                let flag: 'P' | 'D' = 'P';
                if (currentTime > '09:30') {
                    flag = 'D';
                }
                if (needsApproval) {
                    flag = 'P'; // Temporary
                }

                // Save attendance record
                const attendanceData = {
                    employeeId: user.uid,
                    employeeName: employeeData.fullName || user.displayName || 'Unknown',
                    date: format(today, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
                    inTime: currentTime,
                    flag: flag,
                    inTimeLocation: {
                        latitude: location.latitude,
                        longitude: location.longitude,
                        accuracy: location.accuracy,
                        timestamp: Timestamp.now()
                    },
                    inTimeAddress: address || '',
                    inTimeRemarks: remarks || '',
                    insideGeofence: insideGeofence,
                    needsApproval: needsApproval,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                };

                await setDoc(doc(firestore, 'attendance', docId), attendanceData);

                await Swal.fire({
                    title: 'Check-In Successful!',
                    text: insideGeofence
                        ? `Check-in time: ${currentTime}`
                        : 'Check-in recorded. Location outside geofence - pending HR approval.',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });

            } else {
                // Check-out logic
                if (!attendanceDoc.exists() || !attendanceDoc.data().inTime) {
                    throw new Error('Please check in first before checking out');
                }

                if (attendanceDoc.data().outTime) {
                    throw new Error('You have already checked out for today');
                }

                // Update attendance record with check-out
                await setDoc(doc(firestore, 'attendance', docId), {
                    outTime: currentTime,
                    outTimeLocation: {
                        latitude: location.latitude,
                        longitude: location.longitude,
                        accuracy: location.accuracy,
                        timestamp: Timestamp.now()
                    },
                    outTimeAddress: address || '',
                    outTimeRemarks: remarks || '',
                    updatedAt: Timestamp.now()
                }, { merge: true });

                await Swal.fire({
                    title: 'Check-Out Successful!',
                    text: `Check-out time: ${currentTime}`,
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
            }

            // Play success sound
            try {
                const audio = new Audio('/sounds/water-drop.mp3');
                audio.volume = 0.5;
                audio.play().catch(() => { });
            } catch { }

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Attendance submission error:', err);
            setError(err.message || 'Failed to submit attendance. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-slate-50 border-0 h-[90vh] sm:h-auto flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-white border-b sticky top-0 z-10">
                    <h2 className="text-lg font-bold text-slate-800">
                        {type === 'in' ? 'Mark Check-In' : 'Mark Check-Out'}
                    </h2>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-8 w-8 rounded-full hover:bg-slate-100"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <div className="p-4 space-y-4">
                        {/* Map Section */}
                        {location ? (
                            <div className="space-y-3">
                                <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                                    <div className="relative rounded-lg overflow-hidden">
                                        <LocationMap
                                            latitude={location.latitude}
                                            longitude={location.longitude}
                                            radius={geofenceRadius}
                                            onLocationSelect={(lat, lng) => {
                                                // Optional: Allow manual adjustment if needed
                                            }}
                                            onAddressFound={(addr) => setAddress(addr)}
                                        />

                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="absolute top-2 right-2 bg-white/90 hover:bg-white shadow-sm h-8 w-8 p-0"
                                            onClick={captureLocation}
                                        >
                                            <RefreshCw className={`h-4 w-4 ${isCapturing ? 'animate-spin' : ''}`} />
                                        </Button>
                                    </div>

                                    {/* Address Display */}
                                    <div className="mt-3 px-1">
                                        <div className="flex items-start gap-2">
                                            <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                                            <p className="text-sm text-slate-600 break-words leading-snug">
                                                {address || 'Fetching address...'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Location Stats */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                        <p className="text-xs text-slate-500 mb-1">Status</p>
                                        {insideGeofence ? (
                                            <div className="flex items-center gap-1.5 text-emerald-600 font-medium text-sm">
                                                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                                Inside Office
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-amber-600 font-medium text-sm">
                                                <div className="h-2 w-2 rounded-full bg-amber-500" />
                                                Outside
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                        <p className="text-xs text-slate-500 mb-1">Accuracy</p>
                                        <div className="flex items-center gap-1.5 text-slate-700 font-medium text-sm">
                                            <Navigation className="h-3 w-3" />
                                            ±{Math.round(location.accuracy)}m
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="py-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
                                <MapPin className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                                <p className="text-sm text-slate-500 mb-4 px-8">
                                    We need your location to mark attendance. Please allow location access.
                                </p>
                                <Button
                                    onClick={captureLocation}
                                    variant="outline"
                                    className="border-slate-300 text-slate-600"
                                    disabled={isCapturing}
                                >
                                    {isCapturing ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Detecting...
                                        </>
                                    ) : (
                                        'Enable Location'
                                    )}
                                </Button>
                            </div>
                        )}

                        {/* Remarks Section */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 pl-1">
                                {type === 'in' ? 'Arrival Note' : 'Completion Note'} <span className="text-slate-400 font-normal">(Optional)</span>
                            </label>
                            <Textarea
                                placeholder={type === 'in' ? "E.g., Traffic delay, straight for meeting..." : "E.g., Daily tasks completed..."}
                                value={remarks}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRemarks(e.target.value)}
                                className="resize-none bg-white border-slate-200 focus:border-blue-500 min-h-[80px]"
                            />
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t space-y-3 mt-auto">
                    {location && (
                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className={`w-full h-12 text-base font-medium ${type === 'in'
                                ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'
                                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
                                } shadow-lg`}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="mr-2 h-5 w-5" />
                                    {type === 'in' ? 'Submit Check-In' : 'Submit Check-Out'}
                                </>
                            )}
                        </Button>
                    )}

                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="w-full h-12 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    >
                        Cancel
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
