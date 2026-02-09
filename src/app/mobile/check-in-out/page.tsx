"use client";

import React, { useState, useEffect, useRef } from 'react';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { Button } from '@/components/ui/button';
import { Plus, ArrowLeft, Filter, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { MobileCheckInOutModal } from '@/components/mobile/MobileCheckInOutModal';
import type { MultipleCheckInOutConfiguration } from '@/types';
import { type MultipleCheckInOutRecord } from '@/types/checkInOut';
import { useRouter } from 'next/navigation';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, X, Search, MapPin, ArrowRight, RefreshCw } from 'lucide-react';
import { startOfDay, endOfDay } from 'date-fns';
import { DynamicStorageImage } from '@/components/ui/DynamicStorageImage';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';


interface GroupedRecords {
    date: string;
    visits: VisitGroup[];
}

interface VisitGroup {
    id: string; // Combined ID or Check-In ID
    checkIn: MultipleCheckInOutRecord;
    checkOut?: MultipleCheckInOutRecord;
    employeeId: string;
    employeeName: string;
    companyName: string;
}


export default function MobileCheckInOutPage() {
    const { user, userRole } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'Check Ins' | 'Completed' | 'Supervision'>('Check Ins');
    const [records, setRecords] = useState<MultipleCheckInOutRecord[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [checkInOutType, setCheckInOutType] = useState<'Check In' | 'Check Out'>('Check In');
    const [lastRecord, setLastRecord] = useState<MultipleCheckInOutRecord | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUserEmployeeId, setCurrentUserEmployeeId] = useState<string | null>(null);

    // Supervision & Filtering
    const { isSupervisor, supervisedEmployees, supervisedEmployeeIds, explicitSubordinates } = useSupervisorCheck(user?.email);

    const isSuperAdminOrAdmin = React.useMemo(() => {
        if (!userRole) return false;
        return userRole.includes('Super Admin') || userRole.includes('Admin');
    }, [userRole]);

    const effectiveSupervisedEmployees = React.useMemo(() => {
        if (isSuperAdminOrAdmin) return supervisedEmployees;
        return explicitSubordinates;
    }, [isSuperAdminOrAdmin, supervisedEmployees, explicitSubordinates]);

    const effectiveSupervisedEmployeeIds = React.useMemo(() => {
        return effectiveSupervisedEmployees.map(e => e.id);
    }, [effectiveSupervisedEmployees]);

    const showSupervisionTab = isSuperAdminOrAdmin || explicitSubordinates.length > 0;

    const [supervisionRecords, setSupervisionRecords] = useState<MultipleCheckInOutRecord[]>([]);
    const [filteredSupervisionRecords, setFilteredSupervisionRecords] = useState<MultipleCheckInOutRecord[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filterEmployeeName, setFilterEmployeeName] = useState('');
    const [filterFromDate, setFilterFromDate] = useState('');
    const [filterToDate, setFilterToDate] = useState('');
    const [selectedRecordForAction, setSelectedRecordForAction] = useState<MultipleCheckInOutRecord | null>(null);

    // Full-screen image modal
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

    // Privileged role records
    const [privilegedRoleRecords, setPrivilegedRoleRecords] = useState<MultipleCheckInOutRecord[]>([]);

    // Extra profiles for avatars not in supervisedEmployees
    const [extraProfiles, setExtraProfiles] = useState<{ [id: string]: any }>({});

    // Multiple check in/out configuration
    const [multiCheckConfig, setMultiCheckConfig] = useState<MultipleCheckInOutConfiguration | null>(null);

    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [touchStartY, setTouchStartY] = useState<number | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const refreshData = () => {
        setIsRefreshing(true);
        setRefreshTrigger(prev => prev + 1);
    };

    // Fetch multiple check in/out configuration
    useEffect(() => {
        const unsub = onSnapshot(doc(firestore, 'hrm_settings', 'multi_check_in_out'), (docSnap) => {
            if (docSnap.exists()) {
                setMultiCheckConfig(docSnap.data() as MultipleCheckInOutConfiguration);
            }
        });
        return () => unsub();
    }, []);

    // Fetch Records
    useEffect(() => {
        if (!user) return;

        let unsubscribe: (() => void) | null = null;

        const setupPersonalRecords = async () => {
            try {
                // Determine canonical ID (matching MobileCheckInOutModal logic)
                let canonicalId = user.uid;

                // Try to find employee doc by UID
                const empDocRef = doc(firestore, 'employees', user.uid);
                const empDocSnap = await getDoc(empDocRef);

                if (empDocSnap.exists()) {
                    canonicalId = empDocSnap.id;
                } else if (user.email) {
                    // Try to find by email
                    const q = query(collection(firestore, 'employees'), where('email', '==', user.email));
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                        canonicalId = snap.docs[0].id;
                    }
                }

                setCurrentUserEmployeeId(canonicalId);

                // Setup listener using canonicalId
                const qValues = query(
                    collection(firestore, 'multiple_check_inout'),
                    where('employeeId', '==', canonicalId)
                );

                unsubscribe = onSnapshot(qValues, (snapshot) => {
                    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MultipleCheckInOutRecord));
                    // Sort client-side by timestamp desc
                    data.sort((a, b) => {
                        const tA = new Date(a.timestamp).getTime();
                        const tB = new Date(b.timestamp).getTime();
                        return tB - tA;
                    });
                    setRecords(data);
                    if (data.length > 0) {
                        setLastRecord(data[0]);
                    } else {
                        setLastRecord(null);
                    }
                    setIsLoading(false);
                });
            } catch (err) {
                console.error("Error setting up personal records listener:", err);
                setIsLoading(false);
            }
        };

        setupPersonalRecords();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [user]);

    // Fetch Supervision Records
    useEffect(() => {
        const fetchSupervisionData = async () => {
            if (!isSupervisor || effectiveSupervisedEmployeeIds.length === 0 || activeTab !== 'Supervision') return;

            try {
                const chunks: string[][] = [];
                for (let i = 0; i < effectiveSupervisedEmployeeIds.length; i += 10) {
                    chunks.push(effectiveSupervisedEmployeeIds.slice(i, i + 10));
                }

                let allSupRecords: MultipleCheckInOutRecord[] = [];
                for (const chunk of chunks) {
                    const q = query(
                        collection(firestore, 'multiple_check_inout'),
                        where('employeeId', 'in', chunk)
                    );
                    const snap = await getDocs(q);
                    snap.docs.forEach(doc => allSupRecords.push({ id: doc.id, ...doc.data() } as MultipleCheckInOutRecord));
                }

                allSupRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                setSupervisionRecords(allSupRecords);
                setFilteredSupervisionRecords(allSupRecords);
            } catch (err) {
                console.error("Error fetching supervision records:", err);
            } finally {
                setIsRefreshing(false);
            }
        };

        fetchSupervisionData();
    }, [isSupervisor, effectiveSupervisedEmployeeIds, activeTab, refreshTrigger]);

    // Fetch Privileged Role Check-Ins
    useEffect(() => {
        const fetchPrivilegedRoleCheckIns = async () => {
            if (!user?.email || activeTab !== 'Check Ins') return;

            try {
                // Check if current user has privileged role
                const privilegedRoles = ['Super Admin', 'Admin', 'HR', 'Commercial', 'Service', 'DemoManager'];
                const hasPrivilegedRole = userRole?.some(role => privilegedRoles.includes(role));

                if (!hasPrivilegedRole) {
                    setPrivilegedRoleRecords([]);
                    return;
                }

                // Optimized fetch: Only get users with privileged roles
                const usersQuery = query(
                    collection(firestore, 'users'),
                    where('role', 'array-contains-any', privilegedRoles)
                );
                const usersSnap = await getDocs(usersQuery);

                const privilegedUserIds: string[] = [];
                usersSnap.docs.forEach(doc => {
                    if (doc.id !== user.uid) {
                        privilegedUserIds.push(doc.id);
                    }
                });

                if (privilegedUserIds.length === 0) {
                    setPrivilegedRoleRecords([]);
                    return;
                }

                // Fetch check-ins from privileged users in chunks
                const chunks: string[][] = [];
                for (let i = 0; i < privilegedUserIds.length; i += 10) {
                    chunks.push(privilegedUserIds.slice(i, i + 10));
                }

                let allPrivRecords: MultipleCheckInOutRecord[] = [];
                for (const chunk of chunks) {
                    const q = query(
                        collection(firestore, 'multiple_check_inout'),
                        where('employeeId', 'in', chunk)
                    );
                    const snap = await getDocs(q);
                    snap.docs.forEach(doc => allPrivRecords.push({ id: doc.id, ...doc.data() } as MultipleCheckInOutRecord));
                }

                allPrivRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                setPrivilegedRoleRecords(allPrivRecords);
            } catch (err) {
                console.error("Error fetching privileged role records:", err);
            } finally {
                setIsRefreshing(false);
            }
        };

        fetchPrivilegedRoleCheckIns();
    }, [user, userRole, activeTab, refreshTrigger]);

    // Fetch missing profiles for avatars

    const applyFilters = () => {
        let filtered = [...supervisionRecords];

        if (filterEmployeeName) {
            const lowerName = filterEmployeeName.toLowerCase();
            filtered = filtered.filter(r =>
                (r.employeeName?.toLowerCase().includes(lowerName))
            );
        }


        if (filterFromDate) {
            const from = startOfDay(new Date(filterFromDate)).getTime();
            filtered = filtered.filter(r => new Date(r.timestamp).getTime() >= from);
        }

        if (filterToDate) {
            const to = endOfDay(new Date(filterToDate)).getTime();
            filtered = filtered.filter(r => new Date(r.timestamp).getTime() <= to);
        }

        setFilteredSupervisionRecords(filtered);
        setIsFilterOpen(false);
    };


    const handleAddClick = () => {
        // Enforce single active check-in logic
        const activeCheckIn = records.find(r => {
            const isCheckIn = r.type === 'Check In';
            const isUserRecord = r.employeeId === currentUserEmployeeId;
            const hasNoCheckOut = !records.find(out => out.type === 'Check Out' && out.companyName === r.companyName && new Date(out.timestamp).getTime() > new Date(r.timestamp).getTime());

            // Check if it's within the 8 hour auto-done window
            const checkInTime = new Date(r.timestamp).getTime();
            const now = new Date().getTime();
            const isWithinWindow = (now - checkInTime) / (1000 * 60 * 60) <= 8;

            return isCheckIn && isUserRecord && hasNoCheckOut && isWithinWindow;
        });

        if (activeCheckIn) {
            Swal.fire({
                title: "Multiple Check Ins Not Allowed",
                text: "First Check Out Then Check In again",
                icon: "error",
                confirmButtonColor: "#0a1e60"
            });
            return;
        }

        setCheckInOutType('Check In');
        setSelectedRecordForAction(null);
        setIsModalOpen(true);
    };

    const handleCheckOutClick = (record: MultipleCheckInOutRecord) => {
        // Enforce minimum 10-minute stay logic
        const checkInTime = new Date(record.timestamp).getTime();
        const now = new Date().getTime();
        const diffMinutes = (now - checkInTime) / (1000 * 60);

        if (diffMinutes < 10) {
            Swal.fire({
                title: "Stay Too Short",
                text: "Minimum 10 minutes required before Check Out.",
                icon: "warning",
                confirmButtonColor: "#0a1e60"
            });
            return;
        }

        setCheckInOutType('Check Out');
        setSelectedRecordForAction(record);
        setIsModalOpen(true);
    };


    const groupRecordsByDate = (records: MultipleCheckInOutRecord[]): GroupedRecords[] => {
        // First group by visit (pairs of In and Out)
        const visits: VisitGroup[] = [];
        const recordsByEmployeeCompany = new Map<string, MultipleCheckInOutRecord[]>();

        // Sort records by timestamp (ASC) to pair them chronologically
        const sortedRecords = [...records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        sortedRecords.forEach(record => {
            const key = `${record.employeeId}_${record.companyName}`;
            if (!recordsByEmployeeCompany.has(key)) recordsByEmployeeCompany.set(key, []);
            const employeeCompanyRecords = recordsByEmployeeCompany.get(key)!;

            if (record.type === 'Check In') {
                employeeCompanyRecords.push(record);
            } else if (record.type === 'Check Out') {
                // Find the latest Check In for this company that doesn't have a check out yet
                const lastCheckInIndex = employeeCompanyRecords.findLastIndex(r => r.type === 'Check In');
                if (lastCheckInIndex !== -1) {
                    const checkIn = employeeCompanyRecords.splice(lastCheckInIndex, 1)[0];
                    visits.push({
                        id: `${checkIn.id}_${record.id}`,
                        checkIn,
                        checkOut: record,
                        employeeId: record.employeeId,
                        employeeName: record.employeeName,
                        companyName: record.companyName
                    });
                } else {
                    // Orphaned Check Out
                    visits.push({
                        id: record.id,
                        checkIn: record, // Using itself for metadata, but type will show mismatch
                        checkOut: record,
                        employeeId: record.employeeId,
                        employeeName: record.employeeName,
                        companyName: record.companyName
                    });
                }
            }
        });

        // Add remaining orphaned Check Ins and handle Check Outs that were already processed
        recordsByEmployeeCompany.forEach((remainingRecords) => {
            remainingRecords.forEach(record => {
                // If it's a Check out and we already paired it, don't add it as an orphan
                // (This part is tricky because the original logic was a bit scattered)
                visits.push({
                    id: record.id,
                    checkIn: record,
                    employeeId: record.employeeId,
                    employeeName: record.employeeName,
                    companyName: record.companyName
                });
            });
        });

        // Sort visits DESC by check-in timestamp
        visits.sort((a, b) => new Date(b.checkIn.timestamp).getTime() - new Date(a.checkIn.timestamp).getTime());

        // Group visits by date
        const groups: { [key: string]: VisitGroup[] } = {};
        visits.forEach(visit => {
            const dateStr = format(new Date(visit.checkIn.timestamp), 'dd-MM-yyyy');
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(visit);
        });

        return Object.keys(groups).sort((a, b) => {
            const [d1, m1, y1] = a.split('-');
            const [d2, m2, y2] = b.split('-');
            return new Date(`${y2}-${m2}-${d2}`).getTime() - new Date(`${y1}-${m1}-${d1}`).getTime();
        }).map(date => ({
            date,
            visits: groups[date]
        }));
    };


    // Swipe Handling
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
        setTouchStartY(e.targetTouches[0].clientY);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);

        // Vertical swipe for Pull-to-refresh
        if (touchStartY !== null && scrollContainerRef.current?.scrollTop === 0) {
            const currentY = e.targetTouches[0].clientY;
            const diffY = currentY - touchStartY;
            if (diffY > 0) {
                // Apply a resistance factor for the smooth "elastic" feel
                const pulls = Math.min(diffY * 0.4, 120);
                setPullDistance(pulls);
            }
        }
    };

    const onTouchEnd = () => {
        if (pullDistance > 70) {
            refreshData();
        }
        setPullDistance(0);
        setTouchStartY(null);

        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe || isRightSwipe) {
            const tabs: ('Check Ins' | 'Completed' | 'Supervision')[] = ['Check Ins', 'Completed', 'Supervision'];
            const availableTabs = tabs.filter(tab => tab !== 'Supervision' || showSupervisionTab);
            const currentIndex = availableTabs.indexOf(activeTab);

            if (isLeftSwipe && currentIndex < availableTabs.length - 1) {
                setActiveTab(availableTabs[currentIndex + 1]);
            }
            if (isRightSwipe && currentIndex > 0) {
                setActiveTab(availableTabs[currentIndex - 1]);
            }
        }
    };


    // Memoized record processing
    const filteredGroupedRecords = React.useMemo(() => {
        // Deduplicate using a Map
        const uniqueRecordsMap = new Map();
        [...records, ...privilegedRoleRecords, ...supervisionRecords].forEach(r => {
            if (!uniqueRecordsMap.has(r.id)) {
                uniqueRecordsMap.set(r.id, r);
            }
        });
        const uniqueRecords = Array.from(uniqueRecordsMap.values());

        const grouped = groupRecordsByDate(uniqueRecords);

        // Filter visits based on active tab
        return grouped.map(group => {
            const filteredVisits = group.visits.filter(visit => {
                const isUserRecord = visit.employeeId === currentUserEmployeeId;
                const isDone = !!visit.checkOut;

                // Auto check-out logic: if more than configured max hours passed since check-in
                const checkInTime = new Date(visit.checkIn.timestamp).getTime();
                const now = new Date().getTime();
                const diffHours = (now - checkInTime) / (1000 * 60 * 60);
                const maxHours = multiCheckConfig?.maxHourLimitOfCheckOut || 8;
                const isAutoDone = !isDone && diffHours > maxHours && (multiCheckConfig?.isMaxHourLimitEnabled ?? true);

                if (activeTab === 'Check Ins') {
                    // Show only User's pending visits that are NOT older than 8 hours
                    return !isDone && !isAutoDone && isUserRecord;
                }
                if (activeTab === 'Completed') {
                    // Show User's completed visits OR visits that are auto-done (maxHours+)
                    return (isDone || isAutoDone) && isUserRecord;
                }
                // Supervision tab shows everything
                return true;
            });
            return { ...group, visits: filteredVisits };
        }).filter(group => group.visits.length > 0);
    }, [records, privilegedRoleRecords, supervisionRecords, activeTab, currentUserEmployeeId]);

    // Fetch missing profiles for avatars
    useEffect(() => {
        const fetchMissingProfiles = async () => {
            const allVisitEmployeeIds = new Set<string>();
            filteredGroupedRecords.forEach(group => {
                group.visits.forEach(visit => {
                    if (visit.employeeId) {
                        allVisitEmployeeIds.add(visit.employeeId);
                    }
                });
            });

            const missingIds = Array.from(allVisitEmployeeIds).filter(id =>
                !effectiveSupervisedEmployees.find(emp => emp.id === id) &&
                !extraProfiles[id]
            );

            if (missingIds.length === 0) return;

            try {
                const chunks: string[][] = [];
                for (let i = 0; i < missingIds.length; i += 10) {
                    chunks.push(missingIds.slice(i, i + 10));
                }

                const newProfiles: { [id: string]: any } = {};
                for (const chunk of chunks) {
                    const q = query(collection(firestore, 'employees'), where('__name__', 'in', chunk));
                    const snap = await getDocs(q);
                    snap.docs.forEach(doc => {
                        newProfiles[doc.id] = { id: doc.id, ...doc.data() };
                    });
                }

                if (Object.keys(newProfiles).length > 0) {
                    setExtraProfiles(prev => ({ ...prev, ...newProfiles }));
                }
            } catch (err) {
                console.error("Error fetching missing employee profiles:", err);
            }
        };

        if (filteredGroupedRecords.length > 0) {
            fetchMissingProfiles();
        }
    }, [filteredGroupedRecords, effectiveSupervisedEmployees]);

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400">
                    <Loader2 className="h-8 w-8 animate-spin mb-2" />
                    <p>Loading records...</p>
                </div>
            );
        }

        if (filteredGroupedRecords.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400">
                    <p>No data to show</p>
                </div>
            );
        }

        return (
            <div className="px-[5px] py-4 space-y-6 pb-24">
                {filteredGroupedRecords.map((group) => (
                    <div key={group.date}>
                        <h3 className="text-[#0a1e60] font-bold text-base mb-6">{group.date}</h3>
                        <div className="relative">
                            {group.visits.map((visit) => {
                                const checkInTime = format(new Date(visit.checkIn.timestamp), 'hh:mm a');
                                const checkOutTime = visit.checkOut ? format(new Date(visit.checkOut.timestamp), 'hh:mm a') : null;
                                const isDone = !!visit.checkOut;
                                const isUserRecord = visit.employeeId === currentUserEmployeeId;
                                const checkInDate = format(new Date(visit.checkIn.timestamp), 'dd MMM');
                                const checkOutDate = visit.checkOut ? format(new Date(visit.checkOut.timestamp), 'dd MMM') : null;

                                // Auto check-out indicator
                                const checkInTimestamp = new Date(visit.checkIn.timestamp).getTime();
                                const now = new Date().getTime();
                                const maxHours = multiCheckConfig?.maxHourLimitOfCheckOut || 8;
                                const isAutoDone = !isDone && (now - checkInTimestamp) / (1000 * 60 * 60) > maxHours && (multiCheckConfig?.isMaxHourLimitEnabled ?? true);

                                // Calculate duration if both times exist
                                let duration = '';
                                if (visit.checkIn && visit.checkOut) {
                                    const diff = new Date(visit.checkOut.timestamp).getTime() - new Date(visit.checkIn.timestamp).getTime();
                                    const hours = Math.floor(diff / 3600000);
                                    const minutes = Math.floor((diff % 3600000) / 60000);
                                    duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                                } else if (isAutoDone && multiCheckConfig && multiCheckConfig.isMaxHourLimitEnabled) {
                                    // For auto-done cases, calculate duration as the configured max hours limit
                                    // Only if the feature is enabled
                                    const maxHours = multiCheckConfig.maxHourLimitOfCheckOut || 8;
                                    const maxDurationMs = maxHours * 60 * 60 * 1000;
                                    const hours = Math.floor(maxDurationMs / 3600000);
                                    const minutes = Math.floor((maxDurationMs % 3600000) / 60000);
                                    duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                                }

                                // Find employee profile for Supervision/Team view
                                const employeeProfile = effectiveSupervisedEmployees.find(emp => emp.id === visit.employeeId) || extraProfiles[visit.employeeId];
                                const photoURL = employeeProfile?.photoURL;

                                return (
                                    <div key={visit.id} className={`mb-4 last:mb-0 relative ${(isDone || isAutoDone) ? 'bg-slate-50/50 p-4 rounded-3xl border border-slate-200 shadow-md' : ''}`}>
                                        {/* Timeline Connection Line (only for paired cards) */}
                                        {(visit.checkOut || isAutoDone) && (
                                            <>
                                                {/* Vertical Track */}
                                                <div className="absolute left-[calc(1.25rem+2.5rem)] top-[5rem] bottom-[5rem] w-px border-l border-dashed border-slate-300 z-0"></div>

                                                {/* Top Branch (to Check Out card) */}
                                                <div className="absolute left-[calc(1.25rem+2.5rem)] top-[4.5rem] w-4 border-t border-dashed border-slate-300 z-0"></div>

                                                {/* Bottom Branch (to Check In card) */}
                                                <div className="absolute left-[calc(1.25rem+2.5rem)] bottom-[4.5rem] w-4 border-t border-dashed border-slate-300 z-0"></div>

                                                {/* Total Duration Label on Track */}
                                                {duration && (
                                                    <div className="absolute left-[calc(1.25rem+2.5rem-24px)] top-[35%] -translate-y-1/2 z-20 flex flex-col items-center">
                                                        <div className="bg-white px-1.5 py-0.5 rounded-full border border-slate-200 shadow-sm text-[9px] font-bold text-slate-500 whitespace-nowrap">
                                                            {duration}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        <div className="space-y-6 relative z-10">
                                            {/* Check Out Card OR Auto-Closed Indicator */}
                                            {(visit.checkOut || isAutoDone) && (
                                                <div className="flex gap-4 relative">
                                                    <div className="w-20 pt-1 flex flex-col items-center shrink-0">
                                                        <span className="text-xs font-semibold text-[#0a1e60] mb-0.5">{isAutoDone ? `${maxHours}h+` : checkOutTime}</span>
                                                        <span className="text-[10px] text-slate-400 mb-1">{isAutoDone ? checkInDate : checkOutDate}</span>
                                                        <span className={`text-[8px] font-bold px-1 py-0.5 rounded border mb-2 leading-none ${isAutoDone ? 'text-amber-600 border-amber-100 bg-amber-50' : 'text-green-600 border-green-100 bg-green-50'}`}>
                                                            {isAutoDone ? 'AUTO' : 'OUT'}
                                                        </span>
                                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                                                    </div>

                                                    <div className={`flex-1 ${isAutoDone ? 'bg-amber-50/30' : 'bg-white'} p-3 rounded-2xl shadow-sm border ${isAutoDone ? 'border-amber-100' : 'border-slate-100'} flex gap-3 relative overflow-hidden`}>
                                                        {isAutoDone ? (
                                                            <div className="flex-1 py-1">
                                                                <div className="flex items-center gap-2 text-amber-600 mb-1">
                                                                    <RefreshCw className="h-3 w-3 animate-spin-slow" />
                                                                    <span className="text-[10px] font-bold uppercase tracking-wider">System Auto-Closed</span>
                                                                </div>
                                                                <p className="text-[11px] text-slate-500 italic">Check-in session exceeded {maxHours} hours limit. Automatically marked as completed.</p>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    onClick={() => {
                                                                        if (visit.checkOut?.imageURL) {
                                                                            setSelectedImageUrl(visit.checkOut.imageURL);
                                                                            setIsImageModalOpen(true);
                                                                        }
                                                                    }}
                                                                    className="h-12 w-12 rounded-xl bg-slate-100 shrink-0 overflow-hidden relative cursor-pointer hover:opacity-80 transition-opacity"
                                                                    disabled={!visit.checkOut?.imageURL}
                                                                >
                                                                    {visit.checkOut?.imageURL ? (
                                                                        <DynamicStorageImage
                                                                            path={visit.checkOut.imageURL}
                                                                            alt="Visit Out"
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <div className="h-full w-full flex items-center justify-center text-slate-400">
                                                                            <MapPin className="h-5 w-5" />
                                                                        </div>
                                                                    )}
                                                                </button>

                                                                <div className="flex-1 min-w-0 py-0.5">
                                                                    <div className="flex justify-between items-start">
                                                                        <h4 className="font-bold text-[#0a1e60] text-sm pr-2">{visit.companyName}</h4>
                                                                    </div>
                                                                    <p className="text-xs text-slate-500 mb-3">{visit.checkOut?.remarks || 'No remarks'}</p>

                                                                    <div className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 space-y-1">
                                                                        <div className="flex items-start gap-1.5">
                                                                            <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-blue-500" />
                                                                            <span className="leading-normal">{visit.checkOut?.location?.address || 'Address not captured'}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Check In Card */}
                                            <div className="flex gap-4 relative">
                                                <div className="w-20 pt-1 flex flex-col items-center shrink-0">
                                                    <span className="text-xs font-semibold text-[#0a1e60] mb-0.5">{checkInTime}</span>
                                                    <span className="text-[10px] text-slate-400 mb-1">{checkInDate}</span>
                                                    <span className={`text-[8px] font-bold px-1 py-0.5 rounded border mb-2 leading-none ${!isDone ? 'text-blue-600 border-blue-100 bg-blue-50' : 'text-slate-400 border-slate-100 bg-slate-50'}`}>
                                                        IN
                                                    </span>
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                                                </div>

                                                <div className="flex-1 bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex gap-3 relative overflow-hidden">
                                                    <button
                                                        onClick={() => {
                                                            if (visit.checkIn.imageURL) {
                                                                setSelectedImageUrl(visit.checkIn.imageURL);
                                                                setIsImageModalOpen(true);
                                                            }
                                                        }}
                                                        className="h-12 w-12 rounded-xl bg-slate-100 shrink-0 overflow-hidden relative cursor-pointer hover:opacity-80 transition-opacity"
                                                        disabled={!visit.checkIn.imageURL}
                                                    >
                                                        {visit.checkIn.imageURL ? (
                                                            <DynamicStorageImage
                                                                path={visit.checkIn.imageURL}
                                                                alt="Visit In"
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="h-full w-full flex items-center justify-center text-slate-400">
                                                                <MapPin className="h-5 w-5" />
                                                            </div>
                                                        )}
                                                    </button>

                                                    <div className="flex-1 min-w-0 py-0.5">
                                                        <div className="flex justify-between items-start">
                                                            <h4 className="font-bold text-[#0a1e60] text-sm pr-2">{visit.companyName}</h4>
                                                        </div>
                                                        <p className="text-xs text-slate-500 mb-3">{visit.checkIn.remarks || 'No remarks'}</p>

                                                        <div className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 space-y-1">
                                                            <div className="flex items-start gap-1.5">
                                                                <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-blue-500" />
                                                                <span className="leading-normal">{visit.checkIn.location?.address || 'Address not captured'}</span>
                                                            </div>
                                                        </div>

                                                        {(activeTab === 'Supervision' || (activeTab === 'Check Ins' && !isUserRecord)) && (
                                                            <div className="mt-3 pt-2 border-t border-slate-50 flex items-center gap-2">
                                                                <div className="h-8 w-8 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center text-[10px] font-bold text-slate-500 relative shrink-0">
                                                                    {photoURL ? (
                                                                        <DynamicStorageImage
                                                                            path={photoURL}
                                                                            alt={visit.employeeName}
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        visit.employeeName?.substring(0, 2).toUpperCase()
                                                                    )}
                                                                </div>
                                                                <span className="text-[11px] font-semibold text-slate-700 truncate">{visit.employeeName}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {activeTab === 'Check Ins' && isUserRecord && !isDone && (
                                                    <div className="flex flex-col justify-center pl-3">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCheckOutClick(visit.checkIn);
                                                            }}
                                                            className="h-12 w-12 bg-blue-50 hover:bg-blue-100 rounded-full flex items-center justify-center text-blue-600 transition-all shadow-[0_4px_12px_rgba(37,99,235,0.15)] active:scale-90"
                                                        >
                                                            <LogOut className="h-6 w-6" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Header matching My Attendance */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-6">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold text-white">Check In/Out</h1>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => refreshData()}
                            disabled={isLoading || isRefreshing}
                            className="p-2 text-white hover:bg-white/10 rounded-full transition-all shadow-[0_4px_12px_rgba(0,0,0,0.4)] active:scale-95 bg-[#1a2b6d] disabled:opacity-50"
                        >
                            <RefreshCw className={`h-5 w-5 ${(isLoading || isRefreshing) ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={() => setIsFilterOpen(true)}
                            className={`p-2 text-white hover:bg-white/10 rounded-full transition-all shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d] active:scale-95 ${activeTab !== 'Supervision' ? 'opacity-0 pointer-events-none' : ''}`}
                        >
                            <Filter className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>

            <div
                className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-hidden flex flex-col relative transition-transform duration-200 ease-out"
                style={{ transform: `translateY(${pullDistance}px)` }}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {/* Pull-to-refresh indicator */}
                <div
                    className="absolute -top-12 left-0 right-0 flex justify-center items-center h-12"
                    style={{ opacity: Math.min(pullDistance / 60, 1) }}
                >
                    <RefreshCw className={cn("text-blue-600 transition-all", pullDistance > 70 ? "animate-spin scale-110" : "scale-100")} />
                </div>

                {/* Tabs Section */}
                <div className="bg-white px-6 pt-6 pb-2 rounded-t-[2rem] shadow-sm z-10 shrink-0">
                    <div className="flex items-center justify-between p-1 bg-slate-50 rounded-full mb-4">
                        {['Check Ins', 'Completed', 'Supervision'].filter(tab => tab !== 'Supervision' || showSupervisionTab).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`flex-1 py-3 text-[10px] sm:text-xs font-bold rounded-full transition-all duration-200 ${activeTab === tab
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                <span className="flex items-center justify-center gap-1">
                                    <span className={`w-1.5 h-1.5 rounded-full ${activeTab === tab ? 'bg-amber-400' : 'bg-transparent'}`}></span>
                                    {tab}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content List */}
                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto px-[5px] py-4 space-y-8 pb-24 overscroll-contain"
                >
                    {renderContent()}
                </div>

                {/* Floating Action Button - Moved to 99px layout (79 + 20) */}
                {activeTab === 'Check Ins' && (
                    <Button
                        className="absolute bottom-[99px] right-6 h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-xl flex items-center justify-center z-50 transition-transform active:scale-95"
                        onClick={handleAddClick}
                    >
                        <Plus className="h-8 w-8 text-white" />
                    </Button>
                )}
            </div>

            <MobileCheckInOutModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => {
                    refreshData();
                }}
                checkInOutType={checkInOutType}
                initialCompanyName={checkInOutType === 'Check Out' ? (selectedRecordForAction?.companyName || lastRecord?.companyName) : ''}
            />

            {/* Filter Popup */}
            < Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen} >
                <DialogContent className="sm:max-w-md p-6 rounded-3xl w-[90%] mx-auto bg-white border-none shadow-2xl">
                    <div className="flex items-center gap-2 mb-6 text-blue-600">
                        <Filter className="h-5 w-5" />
                        <h2 className="text-lg font-bold">Filter</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Find Employee</Label>
                            <Input
                                placeholder="Search by name or Code"
                                className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:ring-2 focus:ring-blue-500"
                                value={filterEmployeeName}
                                onChange={(e) => setFilterEmployeeName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">From Date*</Label>
                            <Input
                                type="date"
                                className="h-12 rounded-xl bg-slate-50 border-slate-200"
                                value={filterFromDate}
                                onChange={(e) => setFilterFromDate(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">To Date*</Label>
                            <Input
                                type="date"
                                className="h-12 rounded-xl bg-slate-50 border-slate-200"
                                value={filterToDate}
                                onChange={(e) => setFilterToDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 mt-8">
                        <Button
                            variant="outline"
                            className="flex-1 h-12 rounded-xl border-blue-600 text-blue-600 hover:bg-blue-50"
                            onClick={() => setIsFilterOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="flex-1 h-12 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                            onClick={applyFilters}
                        >
                            Apply
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Full-Screen Image Modal */}
            <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
                <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 bg-black/95 border-none">
                    <button
                        onClick={() => setIsImageModalOpen(false)}
                        className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                    {selectedImageUrl && (
                        <div className="relative w-full h-full flex items-center justify-center p-4">
                            <DynamicStorageImage
                                path={selectedImageUrl}
                                alt="Check-in/out"
                                className="max-w-full max-h-[90vh] object-contain rounded-lg"
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>

        </div >
    );
}
