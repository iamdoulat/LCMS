"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { firestore } from '@/lib/firebase/config';
import { serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { Loader2, Camera, Upload, MapPin, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';
import { getValidOption } from '@/types';
import { getCurrentLocation, reverseGeocode, uploadCheckInOutImage, createCheckInOutRecord } from '@/lib/firebase/checkInOut';
import type { MultipleCheckInOutRecord, MultipleCheckInOutLocation } from '@/types/checkInOut';

// Dynamic import for map
const LocationMap = dynamic(() => import('@/components/ui/LocationMap'), {
    ssr: false,
    loading: () => <div className="h-[200px] w-full bg-slate-100 animate-pulse rounded-md" />
});

interface MobileCheckInOutModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    checkInOutType: 'Check In' | 'Check Out';
    initialCompanyName?: string;
}

export function MobileCheckInOutModal({ isOpen, onClose, onSuccess, checkInOutType, initialCompanyName }: MobileCheckInOutModalProps) {
    const { user, firestoreUser } = useAuth();
    const [companyName, setCompanyName] = useState(initialCompanyName || '');
    const [remarks, setRemarks] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<MultipleCheckInOutLocation | null>(null);
    const [address, setAddress] = useState<string>('');
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);

    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            setCompanyName(initialCompanyName || '');
            setRemarks('');
            setSelectedFile(null);
            setImagePreview('');
            setAddress('');
            updateLocation();
        }
    }, [isOpen, initialCompanyName]);

    const updateLocation = async () => {
        setIsLoadingLocation(true);
        try {
            const loc = await getCurrentLocation();
            setCurrentLocation(loc);

            // Get address
            if (loc) {
                const addr = await reverseGeocode(loc.latitude, loc.longitude);
                setAddress(addr);
            }
        } catch (error) {
            console.error("Error getting location:", error);
            // Optionally show error toast or alert
        } finally {
            setIsLoadingLocation(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        if (!user) return;

        // Validation
        if (!companyName.trim()) {
            Swal.fire("Error", "Company Name is required", "error");
            return;
        }

        if (!currentLocation) {
            Swal.fire("Error", "Location is required. Please enable GPS.", "error");
            return;
        }

        setIsSubmitting(true);

        try {
            // Fetch employee data for notification details
            const employeeDoc = await getDoc(doc(firestore, 'employees', user.uid));
            const employeeData = employeeDoc.exists() ? employeeDoc.data() : null;

            // Upload Image if present using shared helper
            let photoUrl = '';
            if (selectedFile) {
                photoUrl = await uploadCheckInOutImage(selectedFile, user.uid, checkInOutType);
            }

            // Create Record using shared helper
            await createCheckInOutRecord(
                user.uid,
                employeeData?.fullName || firestoreUser?.displayName || 'Unknown Employee',
                companyName,
                checkInOutType,
                {
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                    address: address || 'Address not found'
                },
                photoUrl,
                remarks
            );

            Swal.fire({
                title: "Success",
                text: `${checkInOutType} recorded successfully`,
                icon: "success",
                timer: 1500,
                showConfirmButton: false
            });

            // Trigger Notification
            const notificationType = checkInOutType === 'Check In' ? 'check_in' : 'check_out';
            fetch('/api/notify/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: notificationType,
                    employeeId: user.uid,
                    employeeName: employeeData?.fullName || firestoreUser?.displayName || 'Unknown Employee',
                    employeeCode: employeeData?.employeeCode || 'N/A',
                    employeeEmail: employeeData?.email || user.email,
                    employeePhone: employeeData?.phone || employeeData?.contactNumber,
                    time: new Date().toLocaleTimeString(),
                    date: new Date().toLocaleDateString(),
                    location: {
                        latitude: currentLocation.latitude,
                        longitude: currentLocation.longitude,
                        address: address || ''
                    },
                    companyName: companyName,
                    remarks: remarks,
                    photoUrl: photoUrl || undefined
                })
            }).catch(err => console.error('[ATTENDANCE NOTIFY] Notification error:', err));

            onSuccess();
            onClose();

        } catch (error: any) {
            console.error("Error submitting check in/out:", error);
            Swal.fire("Error", "Failed to submit. Please try again.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-slate-50 border-0 h-[90vh] sm:h-auto flex flex-col">
                <DialogHeader className="p-4 bg-white border-b sticky top-0 z-10">
                    <DialogTitle>{checkInOutType}</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Location Card */}
                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm relative">
                        {currentLocation ? (
                            <div className="h-[150px] rounded-lg overflow-hidden relative">
                                <LocationMap
                                    latitude={currentLocation.latitude}
                                    longitude={currentLocation.longitude}
                                    radius={0}
                                    readOnly={true}
                                    onLocationSelect={() => { }}
                                    onAddressFound={(addr) => setAddress(addr)}
                                    onRefresh={updateLocation}
                                />
                            </div>
                        ) : (
                            <div className="h-[150px] bg-slate-100 rounded-lg flex flex-col items-center justify-center text-slate-400">
                                {isLoadingLocation ? (
                                    <>
                                        <Loader2 className="h-8 w-8 animate-spin mb-2" />
                                        <span className="text-xs">Fetching Location...</span>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <MapPin className="h-8 w-8 mb-2" />
                                        <span className="text-xs">Location not captured</span>
                                        <Button variant="link" size="sm" onClick={updateLocation}>Retry</Button>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mt-3 flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-slate-400 mt-1 shrink-0" />
                            <p className="text-xs text-slate-600 sm:text-sm">
                                {address || "Fetching address..."}
                            </p>
                        </div>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="companyName">Company Name *</Label>
                            <Input
                                id="companyName"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                placeholder="Enter Client/Company Name"
                                className="bg-white"
                                disabled={checkInOutType === 'Check Out'}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="remarks">Remarks (Optional)</Label>
                            <Textarea
                                id="remarks"
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Meeting notes, purpose, etc."
                                className="resize-none bg-white min-h-[80px]"
                            />
                        </div>

                        {/* Image Upload */}
                        <div className="space-y-2">
                            <Label>Photo Evidence (Optional)</Label>
                            <div className="flex items-center gap-4">
                                <div
                                    className="h-20 w-20 bg-slate-100 rounded-lg flex items-center justify-center border border-dashed border-slate-300 cursor-pointer overflow-hidden relative hover:bg-slate-200 transition-colors"
                                    onClick={() => document.getElementById('photo-upload')?.click()}
                                >
                                    {imagePreview ? (
                                        <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                                    ) : (
                                        <Camera className="h-6 w-6 text-slate-400" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <input
                                        type="file"
                                        id="photo-upload"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleFileChange}
                                        capture="environment"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-xs"
                                        onClick={() => document.getElementById('photo-upload')?.click()}
                                    >
                                        <Upload className="h-3 w-3 mr-2" />
                                        {imagePreview ? 'Change Photo' : 'Take Photo'}
                                    </Button>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        Tap to capture/upload visit photo
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-4 bg-white border-t mt-auto">
                    <div className="flex gap-3 w-full">
                        <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            className={`flex-1 ${checkInOutType === 'Check In' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Submitting
                                </>
                            ) : (
                                `Submit ${checkInOutType}`
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
