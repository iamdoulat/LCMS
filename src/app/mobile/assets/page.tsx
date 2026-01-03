"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, CreditCard, Check, X, Building2, Calendar, FileText, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AssetDistributionModal } from '@/components/assets/AssetDistributionModal';

import { useAuth } from '@/context/AuthContext';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, orderBy, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { AssetDistributionDocument, AssetRequisitionDocument } from '@/types';
import Swal from 'sweetalert2';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function AssetsPage() {
    const router = useRouter();
    const { user, userRole, firestoreUser } = useAuth();
    const [activeTab, setActiveTab] = useState<'assigned' | 'requested' | 'requisition'>('assigned');
    const [startX, setStartX] = useState(0);
    const [currentX, setCurrentX] = useState(0);
    const [isDistributionModalOpen, setIsDistributionModalOpen] = useState(false);


    const isAdminOrHR = userRole?.some(role => ['Admin', 'Super Admin', 'HR'].includes(role));

    // -- Queries --

    // 1. Assigned Assets (Distributions) for current user
    const { data: assignedAssets, isLoading: isLoadingAssigned, refetch: refetchAssigned } = useFirestoreQuery<AssetDistributionDocument[]>(
        query(
            collection(firestore, "asset_distributions"),
            where("employeeId", "==", user?.uid || 'dummy')
        ),
        { enabled: !!user?.uid },
        ['my_assigned_assets']
    );

    // 2. My Requested Assets (Requisitions)
    const { data: myRequestsRaw, isLoading: isLoadingRequests, refetch: refetchRequests } = useFirestoreQuery<AssetRequisitionDocument[]>(
        query(
            collection(firestore, "asset_requisitions"),
            where("employeeId", "==", user?.uid || 'dummy')
        ),
        { enabled: !!user?.uid },
        ['my_asset_requests']
    );

    // Debug logging
    React.useEffect(() => {
        console.log('DEBUG: Current user UID:', user?.uid);
        console.log('DEBUG: Fetched requests raw length:', myRequestsRaw?.length);
        console.log('DEBUG: Fetched requests raw data:', myRequestsRaw);
        console.log('DEBUG: Fetched assigned length:', assignedAssets?.length);
        console.log('DEBUG: Is loading requests:', isLoadingRequests);
    }, [user?.uid, myRequestsRaw, assignedAssets, isLoadingRequests]);

    // Sort client-side to avoid composite index requirement
    const myRequests = React.useMemo(() => {
        const sorted = myRequestsRaw?.slice().sort((a, b) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
        }) || [];
        console.log('Sorted requests:', sorted);
        return sorted;
    }, [myRequestsRaw]);

    // 3. Pending Requisitions (For Admin/HR)
    const { data: pendingRequisitions, isLoading: isLoadingPending, refetch: refetchPending } = useFirestoreQuery<AssetRequisitionDocument[]>(
        query(
            collection(firestore, "asset_requisitions"),
            where("status", "==", "Pending")
        ),
        { enabled: !!user?.uid && !!isAdminOrHR },
        ['pending_asset_requisitions']
    );

    const sortedPendingRequisitions = React.useMemo(() => {
        return pendingRequisitions?.slice().sort((a, b) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
        }) || [];
    }, [pendingRequisitions]);

    // -- Actions --

    // Assigned Tab Actions
    const handleAcceptAsset = async (distribution: AssetDistributionDocument) => {
        try {
            await updateDoc(doc(firestore, "asset_distributions", distribution.id), {
                status: 'Occupied'
            });
            refetchAssigned();
            Swal.fire({
                icon: 'success',
                title: 'Accepted',
                text: 'You have accepted the asset.',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            console.error("Error accepting asset:", error);
            Swal.fire('Error', 'Failed to accept asset.', 'error');
        }
    };

    const handleRejectAsset = async (distribution: AssetDistributionDocument) => {
        Swal.fire({
            title: 'Reject Asset?',
            text: "Are you sure you want to reject this asset assignment?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, reject it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    // Delete distribution and free up the asset
                    await deleteDoc(doc(firestore, "asset_distributions", distribution.id));

                    // Update asset status back to Available
                    await updateDoc(doc(firestore, "assets", distribution.assetId), {
                        status: 'Available',
                        updatedAt: new Date()
                    });

                    refetchAssigned();
                    Swal.fire('Rejected!', 'Asset assignment has been rejected.', 'success');
                } catch (error) {
                    console.error("Error rejecting asset:", error);
                    Swal.fire('Error', 'Failed to reject asset.', 'error');
                }
            }
        });
    };

    // Requisition Tab Actions (Admin/HR)
    const handleApproveRequisition = async (req: AssetRequisitionDocument) => {
        try {
            await updateDoc(doc(firestore, "asset_requisitions", req.id), { status: 'Approved' });
            refetchPending();
            Swal.fire({
                icon: 'success',
                title: 'Approved',
                text: 'Requisition approved successfully.',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            console.error("Error approving requisition:", error);
            Swal.fire('Error', 'Failed to approve requisition.', 'error');
        }
    };

    const handleRejectRequisition = async (req: AssetRequisitionDocument) => {
        Swal.fire({
            title: 'Reject Request?',
            text: "Are you sure you want to reject this requisition?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, reject it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await updateDoc(doc(firestore, "asset_requisitions", req.id), { status: 'Rejected' });
                    refetchPending();
                    Swal.fire('Rejected', 'Requisition has been rejected.', 'success');
                } catch (error) {
                    console.error("Error rejecting requisition:", error);
                    Swal.fire('Error', 'Failed to reject requisition.', 'error');
                }
            }
        });
    };

    // Swipe logic
    const handleTouchStart = (e: React.TouchEvent) => {
        setStartX(e.touches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        setCurrentX(e.touches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (currentX === 0) return; // Prevent tap from triggering swipe

        const diff = startX - currentX;
        const threshold = 50;

        if (Math.abs(diff) > threshold) {
            if (diff > 0) {
                // Swipe Left -> Next Tab
                if (activeTab === 'assigned') setActiveTab('requested');
                else if (activeTab === 'requested') setActiveTab('requisition');
            } else {
                // Swipe Right -> Prev Tab
                if (activeTab === 'requisition') setActiveTab('requested');
                else if (activeTab === 'requested') setActiveTab('assigned');
            }
        }
        setStartX(0);
        setCurrentX(0);
    };

    return (
        <div className="flex flex-col h-[100dvh] bg-[#0a1e60]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-6 sticky top-0 z-50 bg-[#0a1e60]">
                <button
                    onClick={() => router.back()}
                    className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors z-10"
                >
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <h1 className="text-lg font-bold text-white absolute inset-0 flex items-center justify-center pointer-events-none pt-4 pb-5">Assets</h1>
                <div className="w-10"></div>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-[#f8fafc] rounded-t-[2rem] overflow-hidden flex flex-col relative w-full">
                {/* Tabs */}
                <div className="flex items-center justify-evenly pt-6 pb-2 border-b border-slate-100 bg-white rounded-t-[2rem]">
                    {(['assigned', 'requested', 'requisition'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={cn(
                                "pb-3 relative text-sm font-semibold transition-colors capitalize px-4 border-b-2",
                                activeTab === tab ? "text-blue-600 border-blue-600" : "text-blue-200 border-transparent"
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div
                    className="flex-1 p-5 overflow-y-auto pb-24"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    {activeTab === 'assigned' && (
                        <div className="space-y-4">
                            {isLoadingAssigned ? (
                                <p className="text-center text-slate-400 text-sm mt-10">Loading assets...</p>
                            ) : assignedAssets && assignedAssets.length > 0 ? (
                                assignedAssets.slice().sort((a, b) => {
                                    const dateA = a.createdAt?.seconds || 0;
                                    const dateB = b.createdAt?.seconds || 0;
                                    return dateB - dateA;
                                }).map((dist) => (
                                    <div key={dist.id}>
                                        <Card className="relative p-0 rounded-2xl border-none shadow-[0_2px_8px_rgba(0,0,0,0.08)] bg-white overflow-hidden">
                                            <div className={cn(
                                                "absolute left-0 top-3 bottom-3 w-1 rounded-r-full",
                                                dist.status === 'Occupied' ? "bg-green-500" : "bg-[#6C5DD3]"
                                            )} />
                                            <div className="p-4 pl-5 space-y-3">
                                                <div className="flex justify-between items-start">
                                                    <div className={cn(
                                                        "inline-flex px-2.5 py-1 text-[10px] font-bold rounded-lg border",
                                                        dist.status === 'Occupied'
                                                            ? "bg-green-50 text-green-600 border-green-200"
                                                            : "bg-[#F3F0FF] text-[#6C5DD3] border-[#E5DEFF]"
                                                    )}>
                                                        {dist.status === 'Pending For Acknowledgement' ? 'Pending Acknowledgement' : dist.status}
                                                    </div>

                                                    {(dist.status === 'Pending For Acknowledgement') && (
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleAcceptAsset(dist)}
                                                                className="h-7 px-2.5 bg-green-500 hover:bg-green-600 text-white text-[10px] rounded-lg"
                                                            >
                                                                Accept
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleRejectAsset(dist)}
                                                                className="h-7 px-2.5 border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 text-[10px] rounded-lg"
                                                            >
                                                                Reject
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>

                                                <div>
                                                    <h3 className="text-slate-700 font-bold text-base">{dist.assetName}</h3>
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
                                                    <span className="text-[#6C5DD3]">{dist.startDate}</span>
                                                    {dist.endDate && (
                                                        <>
                                                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                            <span>To {dist.endDate}</span>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="pt-2">
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-lg text-xs font-bold text-slate-600">
                                                        <CreditCard className="h-3.5 w-3.5 text-yellow-600" />
                                                        Asset
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center pt-10 opacity-60">
                                    <Building2 className="h-12 w-12 text-slate-300 mb-2" />
                                    <p className="text-slate-500 text-sm">No assigned assets found</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'requested' && (
                        <div className="h-full relative min-h-[50vh]">
                            {isLoadingRequests ? (
                                <p className="text-center text-slate-400 text-sm mt-10">Loading requests...</p>
                            ) : myRequests && myRequests.length > 0 ? (
                                <div className="space-y-4 pb-20">
                                    {myRequests.map(req => (
                                        <Card key={req.id} className="p-4 rounded-2xl border-none shadow-sm bg-white">
                                            <div className="flex justify-between items-start mb-2">
                                                <Badge variant="outline" className={cn(
                                                    "border-0",
                                                    req.status === 'Approved' ? "bg-green-100 text-green-700" :
                                                        req.status === 'Rejected' ? "bg-red-100 text-red-700" :
                                                            "bg-orange-100 text-orange-700"
                                                )}>
                                                    {req.status}
                                                </Badge>
                                                <span className="text-[10px] text-slate-400 font-medium">
                                                    {req.createdAt?.seconds ? format(new Date(req.createdAt.seconds * 1000), 'MMM dd, yyyy') : 'Just now'}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-slate-700 text-sm mb-1">{req.assetCategoryName}</h3>
                                            <p className="text-xs text-slate-500 line-clamp-2 mb-3">{req.details}</p>

                                            <div className="flex items-center gap-4 text-xs text-slate-400 font-medium bg-slate-50 p-2 rounded-lg">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="h-3 w-3" />
                                                    <span>{req.fromDate}</span>
                                                </div>
                                                <span className="mx-auto">→</span>
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="h-3 w-3" />
                                                    <span>{req.toDate}</span>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center -mt-20">
                                    <FileText className="h-12 w-12 text-slate-300 mb-3" />
                                    <p className="text-slate-500 text-sm">No asset requests found</p>
                                </div>
                            )}

                            {/* FAB for Asset Distribution */}
                            <Button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsDistributionModalOpen(true);
                                }}
                                className="h-12 w-12 rounded-full bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-200 fixed right-5 bottom-24 z-50 p-0 flex items-center justify-center transform transition-transform active:scale-95"
                            >
                                <Plus className="h-6 w-6 text-white" />
                            </Button>

                        </div>
                    )}

                    {activeTab === 'requisition' && (
                        <div className="h-full">
                            {!isAdminOrHR ? (
                                <div className="h-full flex flex-col items-center justify-center pt-20">
                                    <User className="h-12 w-12 text-slate-300 mb-3" />
                                    <p className="text-slate-500 text-sm">Access Restricted</p>
                                    <p className="text-slate-400 text-xs mt-1">Admin/HR Only</p>
                                </div>
                            ) : isLoadingPending ? (
                                <p className="text-center text-slate-400 text-sm mt-10">Loading requisitions...</p>
                            ) : sortedPendingRequisitions && sortedPendingRequisitions.length > 0 ? (
                                <div className="space-y-4 pb-20">
                                    {sortedPendingRequisitions.map(req => (
                                        <Card key={req.id} className="p-4 rounded-2xl border-none shadow-sm bg-white overflow-hidden">
                                            <div className="flex items-center gap-3 mb-3 border-b border-slate-50 pb-3">
                                                <Avatar className="h-10 w-10 border border-slate-100">
                                                    <AvatarImage src={req.employeePhotoUrl} />
                                                    <AvatarFallback className="bg-blue-50 text-blue-600 font-bold">{req.employeeName?.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <h4 className="text-sm font-bold text-slate-700">{req.employeeName}</h4>
                                                    <p className="text-[10px] text-slate-400 font-medium">{req.employeeDesignation}</p>
                                                </div>
                                            </div>

                                            <div className="mb-3">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-xs font-bold text-[#0A1E60] bg-blue-50 px-2 py-0.5 rounded">{req.assetCategoryName}</span>
                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                        {req.createdAt?.seconds ? format(new Date(req.createdAt.seconds * 1000), 'MMM dd') : ''}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-2 bg-slate-50/50 p-2 rounded-lg italic">"{req.details}"</p>
                                            </div>

                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="flex-1 px-3 py-2 bg-slate-50 rounded-lg flex items-center justify-between text-xs">
                                                    <span className="text-slate-400 font-medium">Period</span>
                                                    <div className="font-bold text-slate-600">
                                                        {req.fromDate} <span className="text-slate-300 mx-1">-</span> {req.toDate}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex gap-3">
                                                <Button
                                                    className="flex-1 bg-green-500 hover:bg-green-600 text-white h-10 rounded-xl font-bold text-xs shadow-sm"
                                                    onClick={() => handleApproveRequisition(req)}
                                                >
                                                    <Check className="h-4 w-4 mr-1.5" /> Accept
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="flex-1 border-red-100 text-red-500 hover:bg-red-50 hover:text-red-600 h-10 rounded-xl font-bold text-xs"
                                                    onClick={() => handleRejectRequisition(req)}
                                                >
                                                    <X className="h-4 w-4 mr-1.5" /> Reject
                                                </Button>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center pt-20">
                                    <Check className="h-12 w-12 text-slate-200 mb-3" />
                                    <p className="text-slate-500 text-sm">No pending requisitions</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>


                <AssetDistributionModal
                    isOpen={isDistributionModalOpen}
                    onClose={() => setIsDistributionModalOpen(false)}
                    onSuccess={() => {
                        refetchAssigned();
                        refetchRequests();
                    }}
                    variant="requisition"
                />
            </div>
        </div>
    );
}
