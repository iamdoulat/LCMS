"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2, MapPin, Camera, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CameraCapture } from '@/components/ui/CameraCapture';
import { getCurrentLocation, uploadCheckInOutImage, createCheckInOutRecord, getCheckInOutRecords } from '@/lib/firebase/checkInOut';
import type { CheckInOutType, MultipleCheckInOutLocation, MultipleCheckInOutRecord } from '@/types/checkInOut';
import { onSnapshot, doc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { MultipleCheckInOutConfiguration } from '@/types';
import Swal from 'sweetalert2';

import { useAuth } from '@/context/AuthContext';

interface MultipleCheckInOutFormProps {
    employeeId: string;
    employeeName: string;
    onSuccess?: () => void;
    onCancel?: () => void;
}

interface FormData {
    companyName: string;
    type: CheckInOutType;
    remarks: string;
}

export function MultipleCheckInOutForm({ employeeId, employeeName, onSuccess, onCancel }: MultipleCheckInOutFormProps) {
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [capturedImage, setCapturedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [location, setLocation] = useState<MultipleCheckInOutLocation | null>(null);
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);
    const [locationProgress, setLocationProgress] = useState<string>('');
    const [multiCheckConfig, setMultiCheckConfig] = useState<MultipleCheckInOutConfiguration | null>(null);
    const [lastRecord, setLastRecord] = useState<MultipleCheckInOutRecord | null>(null);

    // Fetch configuration
    React.useEffect(() => {
        const unsub = onSnapshot(doc(firestore, 'hrm_settings', 'multi_check_in_out'), (docSnap) => {
            if (docSnap.exists()) {
                setMultiCheckConfig(docSnap.data() as MultipleCheckInOutConfiguration);
            }
        });
        return () => unsub();
    }, []);

    // Fetch last record
    React.useEffect(() => {
        const fetchLast = async () => {
            if (employeeId) {
                const records = await getCheckInOutRecords({ employeeId });
                if (records.length > 0) {
                    setLastRecord(records[0]);
                }
            }
        };
        fetchLast();
    }, [employeeId]);

    const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<FormData>({
        defaultValues: {
            companyName: '',
            type: 'Check In',
            remarks: '',
        },
    });

    const selectedType = watch('type');

    // Auto-capture location on component mount
    React.useEffect(() => {
        captureLocation();
    }, []);

    const captureLocation = async () => {
        setIsLoadingLocation(true);
        setLocationProgress('Starting location capture...');
        try {
            const loc = await getCurrentLocation({
                onProgress: (msg) => setLocationProgress(msg)
            });
            setLocation(loc);
            setLocationProgress('');
            Swal.fire('Success', 'Location captured successfully', 'success');
        } catch (error: any) {
            console.error('Location error:', error);
            setLocationProgress('');
            Swal.fire('Error', error.message || 'Could not capture location. Please enable location services.', 'error');
        } finally {
            setIsLoadingLocation(false);
        }
    };

    const handleCameraCapture = (file: File) => {
        setCapturedImage(file);
        setImagePreview(URL.createObjectURL(file));
        setShowCamera(false);
        Swal.fire('Success', 'Photo captured successfully', 'success');
    };

    const onSubmit = async (data: FormData) => {
        if (!capturedImage) {
            Swal.fire('Error', 'Please capture a photo', 'error');
            return;
        }

        if (!location) {
            Swal.fire('Error', 'Location not available. Please try again.', 'error');
            return;
        }

        // Enrollment logic based on multiCheckConfig
        if (multiCheckConfig) {
            // 1. Mandatory Company Name (already handled by register but let's be double sure if settings changed)
            if (multiCheckConfig.isCompanyNameMandatory && !data.companyName.trim()) {
                Swal.fire('Validation Error', 'Visited company name is mandatory.', 'error');
                return;
            }

            // 2. Mandatory Images
            if (data.type === 'Check In' && multiCheckConfig.isCheckInImageMandatory && !capturedImage) {
                Swal.fire('Validation Error', 'Check-in image is mandatory.', 'error');
                return;
            }
            if (data.type === 'Check Out' && multiCheckConfig.isCheckOutImageMandatory && !capturedImage) {
                Swal.fire('Validation Error', 'Check-out image is mandatory.', 'error');
                return;
            }

            // 3. Logic: Multiple check-in without check-out
            if (data.type === 'Check In' && !multiCheckConfig.isMultipleCheckInAllowedWithoutCheckOut) {
                if (lastRecord && lastRecord.type === 'Check In') {
                    Swal.fire('Access Denied', 'You have an active check-in. Please check out before marking a new check-in.', 'warning');
                    return;
                }
            }

            // 4. Logic: Multiple check-out against single check-in
            if (data.type === 'Check Out' && !multiCheckConfig.isMultipleCheckOutAllowedAgainstSingleCheckIn) {
                if (!lastRecord || lastRecord.type === 'Check Out') {
                    Swal.fire('Access Denied', 'You must check-in before you can mark a check-out.', 'warning');
                    return;
                }
            }

            // 5. Max Hour Limit for Check Out
            if (data.type === 'Check Out' && lastRecord && lastRecord.type === 'Check In') {
                const checkInTime = new Date(lastRecord.timestamp).getTime();
                const nowTime = new Date().getTime();
                const diffHours = (nowTime - checkInTime) / (1000 * 60 * 60);

                if (diffHours > multiCheckConfig.maxHourLimitOfCheckOut) {
                    Swal.fire('Limit Exceeded', `Maximum allowed time between check-in and check-out is ${multiCheckConfig.maxHourLimitOfCheckOut} hours. Your current duration is ${diffHours.toFixed(1)} hours.`, 'error');
                    return;
                }
            }
        }

        setIsSubmitting(true);

        try {
            // Upload image to Firebase Storage
            const imageURL = await uploadCheckInOutImage(capturedImage, employeeId, data.type);

            // Create record in Firestore
            await createCheckInOutRecord(
                employeeId,
                employeeName,
                data.companyName,
                data.type,
                location,
                imageURL,
                data.remarks
            );

            // Send notifications (non-blocking)
            const now = new Date();
            // Try to get more employee details if we have them, otherwise just enough for the notification
            const triggerNotification = async () => {
                if (!user) return;
                try {
                    const token = await user.getIdToken();
                    fetch('/api/notify/attendance', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            type: data.type === 'Check In' ? 'check_in' : 'check_out',
                            employeeId: employeeId,
                            employeeName: employeeName,
                            time: new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).format(now),
                            date: new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).format(now),
                            location: location,
                            companyName: data.companyName,
                            remarks: data.remarks,
                            photoUrl: imageURL
                        })
                    });
                } catch (err) {
                    console.error('Failed to trigger notification:', err);
                }
            };
            triggerNotification();

            Swal.fire('Success', `${data.type} recorded successfully!`, 'success');
            onSuccess?.();
        } catch (error) {
            console.error('Submission error:', error);
            Swal.fire('Error', 'Failed to submit. Please try again.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (showCamera) {
        return (
            <CameraCapture
                onCapture={handleCameraCapture}
                onCancel={() => setShowCamera(false)}
            />
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Multiple Check In/Out</CardTitle>
                <CardDescription>Record your check-in or check-out with photo and location</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {/* Company Name */}
                    <div className="space-y-2">
                        <Label htmlFor="companyName">Company Name *</Label>
                        <Input
                            id="companyName"
                            {...register('companyName', { required: 'Company name is required' })}
                            placeholder="Enter company name"
                        />
                        {errors.companyName && (
                            <p className="text-sm text-destructive">{errors.companyName.message}</p>
                        )}
                    </div>

                    {/* Check In/Out Type */}
                    <div className="space-y-2">
                        <Label htmlFor="type">Type *</Label>
                        <Select
                            value={selectedType}
                            onValueChange={(value) => setValue('type', value as CheckInOutType)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Check In">Check In</SelectItem>
                                <SelectItem value="Check Out">Check Out</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Location Display */}
                    <div className="space-y-2">
                        <Label>Current Location</Label>
                        <div className="flex items-start gap-2 p-3 border rounded-md bg-muted/50">
                            <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                {isLoadingLocation ? (
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span className="text-sm">{locationProgress || 'Capturing location...'}</span>
                                    </div>
                                ) : location ? (
                                    <div className="text-sm space-y-1">
                                        <p className="font-medium">
                                            {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                        </p>
                                        {location.address && (
                                            <p className="text-muted-foreground text-xs">{location.address}</p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-destructive">Location not available</p>
                                )}
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={captureLocation}
                                disabled={isLoadingLocation}
                            >
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Photo Capture */}
                    <div className="space-y-2">
                        <Label>Photo *</Label>
                        {imagePreview ? (
                            <div className="space-y-2">
                                <div className="relative aspect-video rounded-lg overflow-hidden border">
                                    <img src={imagePreview} alt="Captured" className="w-full h-full object-cover" />
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowCamera(true)}
                                    className="w-full"
                                >
                                    <Camera className="mr-2 h-4 w-4" />
                                    Retake Photo
                                </Button>
                            </div>
                        ) : (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowCamera(true)}
                                className="w-full h-32 border-dashed"
                            >
                                <div className="flex flex-col items-center gap-2">
                                    <Camera className="h-8 w-8" />
                                    <span>Tap to Capture Photo</span>
                                    <span className="text-xs text-muted-foreground">(Camera only, no uploads)</span>
                                </div>
                            </Button>
                        )}
                    </div>

                    {/* Remarks */}
                    <div className="space-y-2">
                        <Label htmlFor="remarks">Remarks</Label>
                        <Textarea
                            id="remarks"
                            {...register('remarks')}
                            placeholder="Add any additional notes..."
                            rows={3}
                        />
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex gap-2 pt-4">
                        <Button
                            type="submit"
                            disabled={isSubmitting || !location || !capturedImage}
                            className="flex-1"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                `Submit ${selectedType}`
                            )}
                        </Button>
                        {onCancel && (
                            <Button type="button" variant="outline" onClick={onCancel}>
                                Cancel
                            </Button>
                        )}
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
