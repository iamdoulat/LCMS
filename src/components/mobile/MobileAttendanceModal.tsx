"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, MapPin, Loader2, CheckCircle2, AlertCircle, Navigation, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import Swal from 'sweetalert2';
import dynamic from 'next/dynamic';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { reverseGeocode, hasActiveCheckIn } from '@/lib/firebase/checkInOut';
import { determineAttendanceFlag } from '@/lib/firebase/utils';
import { getActivePolicyForDate } from '@/lib/attendance';
import type { AttendancePolicyDocument, EmployeeDocument, DailyAttendancePolicy, MultipleCheckInOutConfiguration } from '@/types';

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
// Use dynamic import for GeofenceMap to avoid SSR issues
const GeofenceMap = dynamic(() => import('@/components/ui/GeofenceMap'), {
    loading: () => <div className="h-[250px] w-full bg-slate-100 animate-pulse rounded-md" />,
    ssr: false
});

export function MobileAttendanceModal({ isOpen, onClose, onSuccess, type }: MobileAttendanceModalProps) {
    const { user, userRole } = useAuth();
    const isPrivilegedRole = React.useMemo(() => {
        if (!userRole) return false;
        const privilegedRoles = ["Super Admin", "Admin", "HR", "Service", "DemoManager", "Accounts", "Commercial", "Viewer"];
        return userRole.some(role => privilegedRoles.includes(role));
    }, [userRole]);
    const [isCapturing, setIsCapturing] = useState(false);
    const [location, setLocation] = useState<LocationData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isOpenRef = useRef(isOpen);

    useEffect(() => {
        isOpenRef.current = isOpen;
    }, [isOpen]);
    const [address, setAddress] = useState<string | null>(null);
    const [remarks, setRemarks] = useState('');
    const [employeeBranch, setEmployeeBranch] = useState<any>(null);
    const [branchHotspots, setBranchHotspots] = useState<any[]>([]);
    const [isInsideGeofence, setIsInsideGeofence] = useState<boolean>(true);
    const [distanceFromBranch, setDistanceFromBranch] = useState<number>(0);
    const [isLoadingGeodata, setIsLoadingGeodata] = useState(false);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [employeeData, setEmployeeData] = useState<EmployeeDocument | null>(null);
    const [allPolicies, setAllPolicies] = useState<AttendancePolicyDocument[]>([]);

    // Stable ref for canonical employee doc ID (avoids re-fetch in handleSubmit)
    const canonicalDocRef = useRef<{ id: string; data: EmployeeDocument | null }>({ id: '', data: null });

    // Fetch branch, hotspots, and policies — parallelized for speed
    React.useEffect(() => {
        const fetchGeodata = async () => {
            if (!user || !isOpen) return;
            setIsLoadingGeodata(true);
            try {
                // Round 1: Fetch employee + policies in PARALLEL
                const [empResult, policySnap] = await Promise.all([
                    (async () => {
                        let empDoc = await getDoc(doc(firestore, 'employees', user.uid));
                        if (!empDoc.exists() && user.email) {
                            const q = query(collection(firestore, 'employees'), where('email', '==', user.email));
                            const snap = await getDocs(q);
                            if (!snap.empty) empDoc = snap.docs[0];
                        }
                        return empDoc;
                    })(),
                    getDocs(collection(firestore, 'hrm_settings', 'attendance_policies', 'items'))
                ]);

                // Process policies immediately
                const policies = policySnap.docs.map(d => ({ id: d.id, ...d.data() } as AttendancePolicyDocument));
                setAllPolicies(policies);

                let branchIdForHotspots = '';

                if (empResult.exists()) {
                    const empData = empResult.data() as EmployeeDocument;
                    setEmployeeData(empData);
                    canonicalDocRef.current = { id: empResult.id, data: empData };

                    // Round 2: Fetch branch + hotspots in PARALLEL
                    if (empData.branchId) {
                        branchIdForHotspots = empData.branchId;
                        const [branchDoc, hotspotsSnap] = await Promise.all([
                            getDoc(doc(firestore, 'branches', empData.branchId)),
                            getDocs(query(collection(firestore, 'hotspots'), where('branchId', '==', empData.branchId)))
                        ]);
                        if (branchDoc.exists()) {
                            setEmployeeBranch({ id: branchDoc.id, ...branchDoc.data() });
                        }
                        setBranchHotspots(hotspotsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                        return; // Done — skip fallbacks below
                    } else if (empData.branch) {
                        const branchQuery = query(collection(firestore, 'branches'), where('name', '==', empData.branch));
                        const branchSnap = await getDocs(branchQuery);
                        if (!branchSnap.empty) {
                            const bDoc = branchSnap.docs[0];
                            branchIdForHotspots = bDoc.id;
                            setEmployeeBranch({ id: bDoc.id, ...bDoc.data() });
                        }
                    }
                }

                // Fallback: If no branch found (Admin/HR), fetch Head Office
                if (!branchIdForHotspots) {
                    const branchesSnap = await getDocs(collection(firestore, 'branches'));
                    if (!branchesSnap.empty) {
                        const branches = branchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                        const headOffice = branches.find((b: any) => b.isHeadOffice);
                        const fallbackBranch = headOffice || branches[0];
                        branchIdForHotspots = fallbackBranch.id;
                        setEmployeeBranch(fallbackBranch);
                    }
                }

                // Fetch hotspots for determined branch
                const hotspotsQuery = branchIdForHotspots
                    ? query(collection(firestore, 'hotspots'), where('branchId', '==', branchIdForHotspots))
                    : query(collection(firestore, 'hotspots'));
                const hotspotsSnap = await getDocs(hotspotsQuery);
                setBranchHotspots(hotspotsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) {
                console.error("Error fetching geodata:", err);
            } finally {
                setIsLoadingGeodata(false);
            }
        };

        fetchGeodata();
    }, [isOpen, user]);

    // Update geofence status whenever location or geodata changes
    React.useEffect(() => {
        if (location && (employeeBranch || branchHotspots.length > 0)) {
            validateGeofence();
        }
    }, [location, employeeBranch, branchHotspots]);

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const validateGeofence = () => {
        if (!location) return;

        let inside = false;
        let minDistance = Infinity;

        // Check branch
        if (employeeBranch && employeeBranch.latitude && employeeBranch.longitude) {
            const dist = calculateDistance(
                location.latitude,
                location.longitude,
                Number(employeeBranch.latitude),
                Number(employeeBranch.longitude)
            );
            minDistance = dist;
            if (dist <= (employeeBranch.allowRadius || 100)) {
                inside = true;
            }
        }

        // Check hotspots
        branchHotspots.forEach(hotspot => {
            if (hotspot.latitude && hotspot.longitude) {
                const dist = calculateDistance(
                    location.latitude,
                    location.longitude,
                    Number(hotspot.latitude),
                    Number(hotspot.longitude)
                );
                if (dist < minDistance) minDistance = dist;
                if (dist <= (hotspot.allowRadius || 100)) {
                    inside = true;
                }
            }
        });

        setIsInsideGeofence(inside);
        setDistanceFromBranch(minDistance);
    };

    // Auto capture location on mount
    React.useEffect(() => {
        if (isOpen && !location && !isCapturing) {
            captureLocation();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const captureLocation = async (isRetry = false) => {
        setIsCapturing(true);
        setError(null);
        setAddress(null); // Clear previous address for feedback
        // Only clear location if it's the first time to show map
        if (!location) setLocation(null);
        let newLocation: LocationData | null = null;

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
                        maximumAge: 10000 // Allow 10s GPS cache to avoid slow satellite fixes
                    }
                );
            });

            newLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
            setLocation(newLocation);
        } catch (err: any) {
            console.error('Location capture error:', err);

            let errorMessage = 'Unable to capture location. Please enable location services and try again.';

            if (err.code === 1) {
                errorMessage = 'Location access denied. Please enable location permissions.';
            } else if (err.code === 2) {
                errorMessage = 'Location unavailable.';
            } else if (err.code === 3) {
                errorMessage = 'Location request timed out.';
            }

            setError(errorMessage);
        } finally {
            setIsCapturing(false);
        }

        // Attempt Reverse Geocoding for readable address
        if (newLocation) {
            setIsGeocoding(true);
            let finalAddress: string | null = null;
            try {
                finalAddress = await reverseGeocode(newLocation.latitude, newLocation.longitude);
                setAddress(finalAddress);
            } catch (err) {
                console.error('Reverse geocoding error:', err);
                finalAddress = `Coords: ${newLocation.latitude.toFixed(6)}, ${newLocation.longitude.toFixed(6)}`;
                setAddress(finalAddress);
            } finally {
                setIsGeocoding(false);
            }

            // Auto-retry if address is unavailable
            if ((!finalAddress || finalAddress.toLowerCase().includes('unavailable')) && isOpenRef.current) {
                console.log("[LOCATION] Address unavailable, retrying in 3s...");
                setTimeout(() => captureLocation(true), 3000);
            }
        } else if (isOpenRef.current) {
            // Even if location failed, retry after a delay
            console.log("[LOCATION] Location capture failed, retrying in 5s...");
            setTimeout(() => captureLocation(true), 5000);
        }
    };

    const handleSubmit = async () => {
        if (!user || !location) return;

        setIsSubmitting(true);
        setError(null);

        try {
            // Reuse employee data already fetched in fetchGeodata — avoid 3rd Firestore read
            const canonicalId = canonicalDocRef.current.id || user.uid;
            const empLocalData = canonicalDocRef.current.data || employeeData || {
                fullName: user.displayName || 'Unknown',
                employeeCode: `EMP-${user.uid.substring(0, 5).toUpperCase()}`,
                email: user.email || '',
                phone: ''
            } as any;

            const today = new Date();
            const dateKey = format(today, 'yyyy-MM-dd');
            const docId = `${canonicalId}_${dateKey}`;
            const currentTime = format(today, 'hh:mm a'); // Consistent with dashboard format

            // Get existing attendance record
            const attendanceDoc = await getDoc(doc(firestore, 'attendance', docId));

            if (type === 'in') {
                // Check-in logic
                if (attendanceDoc.exists() && attendanceDoc.data().inTime) {
                    throw new Error('You have already checked in for today');
                }

                // Geofence Validation (already calculated by validateGeofence and local state)
                let status: 'Approved' | 'Pending' = (isInsideGeofence || isPrivilegedRole) ? 'Approved' : 'Pending';

                // Determine attendance flag using policy
                const today = new Date();
                const employeeForPolicy = employeeData || empLocalData as EmployeeDocument || null;
                let activePolicy = employeeForPolicy ? getActivePolicyForDate(employeeForPolicy, today, allPolicies) : null;

                // Fallback to General policy if no policy assigned
                if (!activePolicy && allPolicies.length > 0) {
                    activePolicy = allPolicies.find(p => p.name === 'General') || allPolicies[0];
                }

                let dailyPolicy = null;
                if (activePolicy && activePolicy.dailyPolicies) {
                    const dayName = format(today, 'EEEE');
                    const foundDaily = activePolicy.dailyPolicies.find((dp: DailyAttendancePolicy) => dp.day?.trim() === dayName);

                    if (foundDaily) {
                        // Merge with global policy fallback for missing/zero values
                        dailyPolicy = {
                            ...foundDaily,
                            inTime: foundDaily.inTime || activePolicy.inTime,
                            delayBuffer: (foundDaily.delayBuffer !== undefined && foundDaily.delayBuffer !== 0)
                                ? foundDaily.delayBuffer
                                : activePolicy.delayBuffer
                        };
                    }
                }

                const flag = determineAttendanceFlag(currentTime, dailyPolicy || activePolicy || undefined);

                // Save attendance record
                const attendanceData = {
                    employeeId: canonicalId,
                    employeeName: (empLocalData as any).fullName || user.displayName || 'Unknown',
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
                    isInsideGeofence: isInsideGeofence,
                    distanceFromBranch: distanceFromBranch,
                    approvalStatus: status,
                    inTimeApprovalStatus: status,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                };

                await setDoc(doc(firestore, 'attendance', docId), attendanceData);

                await Swal.fire({
                    title: isInsideGeofence ? 'In Time Approved!' : 'In Time Pending Approval',
                    html: isInsideGeofence
                        ? `<div class="text-center">
                            <p class="text-sm mb-1">Check-in time: <strong>${currentTime}</strong></p>
                            <p class="text-xs text-green-600">✓ Inside office geofence - Auto-approved</p>
                          </div>`
                        : `<div class="text-center">
                            <p class="text-sm mb-1">Check-in time: <strong>${currentTime}</strong></p>
                            <p class="text-xs text-orange-600">⚠ Outside office geofence - Pending supervisor approval</p>
                          </div>`,
                    icon: isInsideGeofence ? 'success' : 'warning',
                    timer: 3000,
                    showConfirmButton: false
                });

                // Trigger Notification
                try {
                    const idToken = await user.getIdToken();
                    fetch('/api/notify/attendance', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${idToken}`
                        },
                        body: JSON.stringify({
                            type: 'in_time',
                            employeeId: user.uid,
                            employeeName: (empLocalData as any).fullName || user.displayName || 'Unknown',
                            employeeCode: (empLocalData as any).employeeCode,
                            employeeEmail: (empLocalData as any).email,
                            employeePhone: (empLocalData as any).phone,
                            time: currentTime,
                            date: format(today, 'PPP'),
                            flag: flag,
                            location: {
                                latitude: location.latitude,
                                longitude: location.longitude,
                                address: address || ''
                            },
                            remarks: remarks
                        })
                    }).catch(err => console.error('[ATTENDANCE NOTIFY] Notification error:', err));
                } catch (authErr) {
                    console.error('[ATTENDANCE NOTIFY] Failed to get ID token:', authErr);
                }

            } else {
                // Check-out logic
                if (!attendanceDoc.exists() || !attendanceDoc.data().inTime) {
                    throw new Error('Please check in first before checking out');
                }

                if (attendanceDoc.data().outTime) {
                    throw new Error('You have already checked out for today');
                }

                // Cross-system Validation: Check for active visits if restricted in settings
                try {
                    console.log(`[ClockOut Restriction] Checking active visits for ID: ${canonicalId}`);
                    const configSnap = await getDoc(doc(firestore, 'hrm_settings', 'multi_check_in_out'));
                    const config = configSnap.data() as MultipleCheckInOutConfiguration;
                    
                    if (config?.isClockOutRestrictedIfActiveCheckIn) {
                        const isActiveVisit = await hasActiveCheckIn(canonicalId, config);
                        console.log(`[ClockOut Restriction] Is check-out restricted: ${config?.isClockOutRestrictedIfActiveCheckIn}, Active visit found: ${isActiveVisit}`);
                        if (isActiveVisit) {
                            throw new Error('Please check out from Check In tab first.');
                        }
                    }
                } catch (err: any) {
                    if (err.message === 'Please check out from Check In tab first.') throw err;
                    console.error("Error checking multi-check config:", err);
                    // Re-throw if it's a Firestore error that prevents certain validation
                    if (err.code === 'failed-precondition' || err.code === 'permission-denied') {
                        throw new Error(`Validation Error: ${err.message}`);
                    }
                }

                // Update attendance record with check-out
                const outStatus = (isInsideGeofence || isPrivilegedRole) ? 'Approved' : 'Pending';

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
                    outTimeIsInsideGeofence: isInsideGeofence,
                    outTimeDistanceFromBranch: distanceFromBranch,
                    outTimeApprovalStatus: outStatus,
                    approvalStatus: outStatus === 'Pending' ? 'Pending' : attendanceDoc.data()?.approvalStatus,
                    updatedAt: Timestamp.now()
                }, { merge: true });

                await Swal.fire({
                    title: isInsideGeofence ? 'Out Time Approved!' : 'Out Time Pending Approval',
                    html: isInsideGeofence
                        ? `<div class="text-center">
                            <p class="text-sm mb-1">Check-out time: <strong>${currentTime}</strong></p>
                            <p class="text-xs text-green-600">✓ Inside office geofence - Auto-approved</p>
                          </div>`
                        : `<div class="text-center">
                            <p class="text-sm mb-1">Check-out time: <strong>${currentTime}</strong></p>
                            <p class="text-xs text-orange-600">⚠ Outside office geofence - Pending supervisor approval</p>
                          </div>`,
                    icon: isInsideGeofence ? 'success' : 'warning',
                    timer: 3000,
                    showConfirmButton: false
                });

                // Trigger Notification
                try {
                    const idToken = await user.getIdToken();
                    fetch('/api/notify/attendance', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${idToken}`
                        },
                        body: JSON.stringify({
                            type: 'out_time',
                            employeeId: user.uid,
                            employeeName: (empLocalData as any).fullName || user.displayName || 'Unknown',
                            employeeCode: (empLocalData as any).employeeCode,
                            employeeEmail: (empLocalData as any).email,
                            employeePhone: (empLocalData as any).phone,
                            time: currentTime,
                            date: format(today, 'PPP'),
                            location: {
                                latitude: location.latitude,
                                longitude: location.longitude,
                                address: address || ''
                            },
                            remarks: remarks
                        })
                    }).catch(err => console.error('[ATTENDANCE NOTIFY] Notification error:', err));
                } catch (authErr) {
                    console.error('[ATTENDANCE NOTIFY] Failed to get ID token:', authErr);
                }
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
                        {type === 'in' ? 'Mark In Time' : 'Mark Out Time'}
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
                        {/* Map or Capture Section */}
                        {location ? (
                            <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                                <div className="relative rounded-lg overflow-hidden h-[250px]">
                                    <GeofenceMap
                                        userLocation={location ? { lat: location.latitude, lng: location.longitude, address: address || '' } : null}
                                        branchLocation={employeeBranch ? {
                                            lat: Number(employeeBranch.latitude),
                                            lng: Number(employeeBranch.longitude),
                                            radius: Number(employeeBranch.allowRadius || 100),
                                            name: employeeBranch.name,
                                            address: employeeBranch.address
                                        } : null}
                                        hotspots={branchHotspots.map(h => ({
                                            lat: Number(h.latitude),
                                            lng: Number(h.longitude),
                                            radius: Number(h.allowRadius || 100),
                                            name: h.name,
                                            address: h.address
                                        }))}
                                        onRefresh={() => captureLocation()}
                                        isLoading={isCapturing || isGeocoding}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="py-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
                                <MapPin className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                                <p className="text-sm text-slate-500 mb-4 px-8">
                                    We need your location to mark attendance. Please allow location access.
                                </p>
                                <Button
                                    onClick={() => captureLocation()}
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

                        {/* Address Display - Always visible when something is captured or capturing */}
                        {(location || isCapturing) && (
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                <div className="flex items-start gap-2">
                                    <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                                    <div className="text-sm text-slate-600 flex flex-col items-start gap-1.5 min-h-[1.25rem]">
                                        <div className="flex items-center gap-1.5 font-medium">
                                            {isGeocoding ? (
                                                <span className="flex items-center gap-1.5 text-slate-400 italic">
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                    Locating address...
                                                </span>
                                            ) : (
                                                address || (isCapturing ? 'Capturing location...' : 'Address not found')
                                            )}
                                        </div>
                                        {!address && !isGeocoding && location && (
                                            <Button
                                                variant="link"
                                                size="sm"
                                                onClick={() => captureLocation()}
                                                className="text-blue-600 h-auto p-0 text-[11px] mt-0.5"
                                            >
                                                <RefreshCw className="h-3 w-3 mr-1" /> Retry Fetch Address
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Location Stats - Always Visible */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                <p className="text-xs text-slate-500 mb-1">Status</p>
                                {!location ? (
                                    <div className="flex items-center gap-1.5 text-slate-400 font-medium text-sm italic">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Scanning...
                                    </div>
                                ) : isInsideGeofence ? (
                                    <div className="flex items-center gap-1.5 text-emerald-600 font-medium text-sm">
                                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                        Inside Office
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 text-amber-600 font-medium text-sm">
                                        <div className="h-2 w-2 rounded-full bg-amber-500" />
                                        Outside ({Math.round(distanceFromBranch)}m)
                                    </div>
                                )}
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                <p className="text-xs text-slate-500 mb-1">Accuracy</p>
                                <div className="flex items-center gap-1.5 text-slate-700 font-medium text-sm">
                                    <Navigation className="h-3 w-3" />
                                    {location ? `±${Math.round(location.accuracy)}m` : '---'}
                                </div>
                            </div>
                        </div>

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
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !location || !address || isGeocoding || address.toLowerCase().includes('unavailable')}
                        className={`w-full h-12 text-base font-medium ${type === 'in'
                            ? 'bg-blue-600 hover:bg-blue-700'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                            } shadow-lg disabled:bg-slate-300 disabled:text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="mr-2 h-5 w-5" />
                                {type === 'in' ? 'Submit In Time' : 'Submit Out Time'}
                            </>
                        )}
                    </Button>

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
