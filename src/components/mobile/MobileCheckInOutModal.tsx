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
import { serverTimestamp, doc, getDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { Loader2, Camera, Upload, MapPin, RefreshCw, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { getValidOption } from '@/types';
import { getCurrentLocation, reverseGeocode, uploadCheckInOutImage, createCheckInOutRecord } from '@/lib/firebase/checkInOut';
import type { MultipleCheckInOutRecord, MultipleCheckInOutLocation } from '@/types/checkInOut';
import { compressImage } from '@/lib/image-utils';

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
    const { user, userRole, firestoreUser } = useAuth();
    const isPrivilegedRole = React.useMemo(() => {
        if (!userRole) return false;
        const privilegedRoles = ["Super Admin", "Admin", "HR", "Service", "DemoManager", "Accounts", "Commercial", "Viewer"];
        return userRole.some(role => privilegedRoles.includes(role));
    }, [userRole]);
    const [companyName, setCompanyName] = useState(initialCompanyName || '');
    const [remarks, setRemarks] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<MultipleCheckInOutLocation | null>(null);
    const [address, setAddress] = useState<string>('');
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);
    const [locationProgress, setLocationProgress] = useState<string>('');
    const [locationError, setLocationError] = useState<string | null>(null);

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

    const updateLocation = async (force: boolean = false) => {
        setIsLoadingLocation(true);
        setLocationError(null);
        setLocationProgress('Initializing geolocation...');
        try {
            const loc = await getCurrentLocation({
                forceRefresh: force,
                onProgress: (msg) => setLocationProgress(msg)
            });
            setCurrentLocation(loc);

            // Get address
            if (loc) {
                setLocationProgress('Fetching address...');
                const addr = await reverseGeocode(loc.latitude, loc.longitude);
                setAddress(addr);
            }
            setLocationProgress('');
        } catch (error: any) {
            console.error("Error getting location:", error);
            setLocationError(error.message || "Failed to capture location.");
            setLocationProgress('');
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
            // First try to fetch by UID
            let employeeDoc = await getDoc(doc(firestore, 'employees', user.uid));

            // If not found by UID, try by email
            if (!employeeDoc.exists() && user.email) {
                const q = query(collection(firestore, 'employees'), where('email', '==', user.email));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    employeeDoc = snap.docs[0];
                }
            }

            const canonicalId = employeeDoc.exists() ? employeeDoc.id : user.uid;
            const employeeData = employeeDoc.exists() ? employeeDoc.data() : null;

            // 1. Create Record Immediately (Optimistic UI)
            // We set imageURL to empty initially, update it later if image exists.
            const recordId = await createCheckInOutRecord(
                canonicalId,
                employeeData?.fullName || firestoreUser?.displayName || 'Unknown Employee',
                companyName,
                checkInOutType,
                {
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                    address: address || 'Address not found'
                },
                '', // Empty initially, updated in background
                remarks,
                {
                    status: 'Approved',
                    approvalStatus: 'Approved'
                }
            );

            // 2. Start Background Upload Process
            if (selectedFile) {
                // Non-blocking async process
                (async () => {
                    try {
                        console.log('Starting background image optimization and upload...');
                        // Aggressive compression for speed (800px, 0.5 quality)
                        const compressedFile = await compressImage(selectedFile, 800, 0.5);

                        // Upload
                        const photoUrl = await uploadCheckInOutImage(compressedFile, canonicalId, checkInOutType);

                        // Update Record
                        const { updateDoc } = await import('firebase/firestore');
                        await updateDoc(doc(firestore, 'multiple_check_inout', recordId), {
                            imageURL: photoUrl
                        });
                        console.log('Background upload completed for record:', recordId);
                    } catch (err) {
                        console.error("Background upload failed:", err);
                        // Optional: Update record to indicate upload failed? 
                        // For now we just log it as the critical part (the check-in) is saved.
                    }
                })();
            }

            // 3. Immediate Success Feedback
            Swal.fire({
                title: "Success",
                text: `${checkInOutType} recorded! Photo uploading in background...`,
                icon: "success",
                timer: 1500,
                showConfirmButton: false
            });

            // Trigger Notification (Async, don't await)
            const notificationType = checkInOutType === 'Check In' ? 'check_in' : 'check_out';
            const idTokenPromise = user.getIdToken();

            idTokenPromise.then(idToken => {
                fetch('/api/notify/attendance', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    },
                    body: JSON.stringify({
                        type: notificationType,
                        employeeId: canonicalId,
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
                        // photoUrl might not be ready, so we omit or send empty
                    })
                }).catch(err => console.error('[ATTENDANCE NOTIFY] Notification error:', err));
            }).catch(authErr => console.error('[ATTENDANCE NOTIFY] Failed to get ID token:', authErr));

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
                            <div className="h-[150px] bg-slate-100 rounded-lg flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                                {isLoadingLocation ? (
                                    <>
                                        <Loader2 className="h-8 w-8 animate-spin mb-2" />
                                        <span className="text-xs font-medium">{locationProgress || 'Fetching Location...'}</span>
                                    </>
                                ) : locationError ? (
                                    <div className="flex flex-col items-center">
                                        <X className="h-8 w-8 mb-2 text-red-400" />
                                        <span className="text-[10px] leading-tight text-red-500 mb-2">{locationError}</span>
                                        <Button variant="link" size="sm" onClick={() => updateLocation(true)} className="text-blue-600 h-auto p-0">
                                            <RefreshCw className="h-3 w-3 mr-1" /> Try Again
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center text-slate-400">
                                        <MapPin className="h-8 w-8 mb-2" />
                                        <span className="text-xs">Location not captured</span>
                                        <Button variant="link" size="sm" onClick={() => updateLocation()} className="text-blue-600 h-auto p-0 mt-1">
                                            Capture Location
                                        </Button>
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
