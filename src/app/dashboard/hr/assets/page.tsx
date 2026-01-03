"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Package, Search, Plus, MoreHorizontal, FileEdit, Trash2, Filter, CheckCircle2, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, orderBy, deleteDoc, doc, updateDoc, getDoc, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { AssetCategoryDocument, AssetDocument, AssetDistributionDocument, AssetRequisitionDocument } from '@/types';
import { AssetCategoryModal } from '@/components/assets/AssetCategoryModal';
import { AssetModal } from '@/components/assets/AssetModal';
import { AssetDistributionModal } from '@/components/assets/AssetDistributionModal';
import { AssetHistorySheet } from '@/components/assets/AssetHistorySheet';
import { AssetDistributionHistoryModal } from '@/components/assets/AssetDistributionHistoryModal';
import { History } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Swal from 'sweetalert2';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from '@/lib/utils';

export default function AssetsPage() {
  const { userRole } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');

  // -- Asset Categories State --
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AssetCategoryDocument | null>(null);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');

  // -- Assets State --
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetDocument | null>(null);
  const [assetSearchTerm, setAssetSearchTerm] = useState('');

  // -- Asset History State --
  const [historyAssetId, setHistoryAssetId] = useState<string | null>(null);
  const [historyAssetName, setHistoryAssetName] = useState('');
  const [isHistorySheetOpen, setIsHistorySheetOpen] = useState(false);

  // -- Asset Distribution State --
  const [isDistributionModalOpen, setIsDistributionModalOpen] = useState(false);
  const [editingDistribution, setEditingDistribution] = useState<AssetDistributionDocument | null>(null);

  const [distributionSearchTerm, setDistributionSearchTerm] = useState('');
  const [isDistributionHistoryModalOpen, setIsDistributionHistoryModalOpen] = useState(false);
  const [distributionHistoryAssetId, setDistributionHistoryAssetId] = useState<string | null>(null);
  const [distributionHistoryAssetName, setDistributionHistoryAssetName] = useState('');

  // -- Asset Requisition State --
  const [requisitionSearchTerm, setRequisitionSearchTerm] = useState('');
  const [requisitionPage, setRequisitionPage] = useState(1);
  const requisitionRowsPerPage = 5;

  // -- Pagination States --
  const [categoryPage, setCategoryPage] = useState(1);
  const [distributionPage, setDistributionPage] = useState(1);
  const [assetPage, setAssetPage] = useState(1);
  const rowsPerPage = 5;


  // -- Queries --
  const { data: requisitionsRaw, isLoading: isLoadingRequisitions, refetch: refetchRequisitions } = useFirestoreQuery<AssetRequisitionDocument[]>(
    query(collection(firestore, "asset_requisitions"), orderBy("createdAt", "desc")),
    undefined,
    ['asset_requisitions']
  );

  // Sort client-side to avoid composite index requirement
  const requisitions = React.useMemo(() => {
    return requisitionsRaw?.slice().sort((a, b) => {
      const dateA = a.createdAt?.seconds || 0;
      const dateB = b.createdAt?.seconds || 0;
      return dateB - dateA;
    }) || [];
  }, [requisitionsRaw]);

  const { data: categories, isLoading: isLoadingCategories, refetch: refetchCategories } = useFirestoreQuery<AssetCategoryDocument[]>(
    query(collection(firestore, "asset_categories"), orderBy("createdAt", "desc")),
    undefined,
    ['asset_categories']
  );

  const { data: assets, isLoading: isLoadingAssets, refetch: refetchAssets } = useFirestoreQuery<AssetDocument[]>(
    query(collection(firestore, "assets"), orderBy("createdAt", "desc")),
    undefined,
    ['assets']
  );

  const { data: distributions, isLoading: isLoadingDistributions, refetch: refetchDistributions } = useFirestoreQuery<AssetDistributionDocument[]>(
    query(collection(firestore, "asset_distributions"), orderBy("createdAt", "desc")),
    undefined,
    ['asset_distributions']
  );


  // -- Requisition Handlers --
  const filteredRequisitions = React.useMemo(() => {
    if (!requisitions) return [];
    const lowerSearch = requisitionSearchTerm.toLowerCase();
    return requisitions.filter(req =>
      req.employeeName.toLowerCase().includes(lowerSearch) ||
      req.employeeCode.toLowerCase().includes(lowerSearch) ||
      req.assetCategoryName.toLowerCase().includes(lowerSearch)
    );
  }, [requisitions, requisitionSearchTerm]);

  const paginatedRequisitions = React.useMemo(() => {
    const startIndex = (requisitionPage - 1) * requisitionRowsPerPage;
    return filteredRequisitions.slice(startIndex, startIndex + requisitionRowsPerPage);
  }, [filteredRequisitions, requisitionPage]);

  const requisitionTotalPages = Math.ceil(filteredRequisitions.length / requisitionRowsPerPage);

  const handleApproveRequisition = async (id: string) => {
    if (isReadOnly) return;

    try {
      // Get the requisition details first
      const reqDoc = await getDoc(doc(firestore, "asset_requisitions", id));
      if (!reqDoc.exists()) {
        Swal.fire('Error', 'Requisition not found.', 'error');
        return;
      }

      const requisition = { id: reqDoc.id, ...reqDoc.data() } as AssetRequisitionDocument;

      // If a preferred asset was selected, assign it
      if (requisition.preferredAssetId) {
        // Get the asset to verify it's still available
        const assetDoc = await getDoc(doc(firestore, "assets", requisition.preferredAssetId));

        if (!assetDoc.exists()) {
          Swal.fire('Error', 'Selected asset no longer exists.', 'error');
          return;
        }

        const asset = { id: assetDoc.id, ...assetDoc.data() } as AssetDocument;

        if (asset.status !== 'Available') {
          Swal.fire('Warning', `Asset "${asset.title}" is no longer available. Please assign a different asset.`, 'warning');
          return;
        }

        // Create asset distribution
        await addDoc(collection(firestore, "asset_distributions"), {
          assetId: requisition.preferredAssetId,
          assetName: requisition.preferredAssetName || asset.title,
          employeeId: requisition.employeeId,
          employeeCode: requisition.employeeCode || 'N/A',
          employeeName: requisition.employeeName,
          employeePhotoUrl: requisition.employeePhotoUrl || '',
          employeeDesignation: requisition.employeeDesignation || '',
          startDate: requisition.fromDate,
          endDate: requisition.toDate,
          status: 'Pending For Acknowledgement',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Update asset status to Assigned
        await updateDoc(doc(firestore, "assets", requisition.preferredAssetId), {
          status: 'Assigned',
          updatedAt: serverTimestamp(),
        });

        refetchAssets();
      }

      // Update requisition status to Approved
      await updateDoc(doc(firestore, "asset_requisitions", id), {
        status: 'Approved',
        updatedAt: serverTimestamp(),
      });

      refetchRequisitions();
      Swal.fire('Approved', requisition.preferredAssetId ? 'Requisition approved and asset assigned successfully.' : 'Requisition has been approved.', 'success');
    } catch (error) {
      console.error("Error approving requisition:", error);
      Swal.fire('Error', 'Failed to approve requisition.', 'error');
    }
  };

  const handleRejectRequisition = async (id: string) => {
    if (isReadOnly) return;
    Swal.fire({
      title: 'Reject Requisition?',
      text: "Are you sure you want to reject this request?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      confirmButtonText: 'Yes, reject it!',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await updateDoc(doc(firestore, "asset_requisitions", id), { status: 'Rejected' });
          refetchRequisitions();
          Swal.fire('Rejected', 'Requisition has been rejected.', 'success');
        } catch (error) {
          console.error("Error rejecting requisition:", error);
          Swal.fire('Error', 'Failed to reject requisition.', 'error');
        }
      }
    });
  };

  const handleDeleteRequisition = async (id: string) => {
    if (isReadOnly) return;
    Swal.fire({
      title: 'Delete Requisition?',
      text: "Are you sure you want to delete this requisition permanently?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      confirmButtonText: 'Yes, delete it!',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "asset_requisitions", id));
          refetchRequisitions();
          Swal.fire('Deleted', 'Requisition has been deleted.', 'success');
        } catch (error) {
          console.error("Error deleting requisition:", error);
          Swal.fire('Error', 'Failed to delete requisition.', 'error');
        }
      }
    });
  };


  // -- Category Handlers --
  const filteredCategories = React.useMemo(() => {
    if (!categories) return [];
    return categories.filter(cat => cat.name.toLowerCase().includes(categorySearchTerm.toLowerCase()));
  }, [categories, categorySearchTerm]);

  const paginatedCategories = React.useMemo(() => {
    const startIndex = (categoryPage - 1) * rowsPerPage;
    return filteredCategories.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredCategories, categoryPage]);

  const categoryTotalPages = Math.ceil(filteredCategories.length / rowsPerPage);

  const handleAddCategoryClick = () => {
    setEditingCategory(null);
    setIsCategoryModalOpen(true);
  };

  const handleEditCategoryClick = (category: AssetCategoryDocument) => {
    setEditingCategory(category);
    setIsCategoryModalOpen(true);
  };

  const handleDeleteCategoryClick = async (id: string, name: string) => {
    if (isReadOnly) return;
    Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to delete "${name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      confirmButtonText: 'Yes, delete it!',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "asset_categories", id));
          refetchCategories();
          Swal.fire('Deleted!', 'Category has been deleted.', 'success');
        } catch (error) {
          console.error("Error deleting category:", error);
          Swal.fire('Error', 'Failed to delete category.', 'error');
        }
      }
    });
  };

  // -- Asset Handlers --
  const filteredAssets = React.useMemo(() => {
    if (!assets) return [];
    const lowerSearch = assetSearchTerm.toLowerCase();
    return assets.filter(asset =>
      asset.title.toLowerCase().includes(lowerSearch) ||
      asset.code.toLowerCase().includes(lowerSearch) ||
      (asset.supplier && asset.supplier.toLowerCase().includes(lowerSearch))
    );
  }, [assets, assetSearchTerm]);

  const paginatedAssets = React.useMemo(() => {
    const startIndex = (assetPage - 1) * rowsPerPage;
    return filteredAssets.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredAssets, assetPage]);

  const assetTotalPages = Math.ceil(filteredAssets.length / rowsPerPage);

  const handleAddAssetClick = () => {
    setEditingAsset(null);
    setIsAssetModalOpen(true);
  };

  const handleEditAssetClick = (asset: AssetDocument) => {
    setEditingAsset(asset);
    setIsAssetModalOpen(true);
  };

  const handleHistoryClick = (asset: AssetDocument) => {
    setHistoryAssetId(asset.id!);
    setHistoryAssetName(asset.title);
    setIsHistorySheetOpen(true);
  };

  const handleDeleteAssetClick = async (id: string, title: string) => {
    if (isReadOnly) return;
    Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to delete asset "${title}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      confirmButtonText: 'Yes, delete it!',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "assets", id));
          refetchAssets();
          Swal.fire('Deleted!', 'Asset has been deleted.', 'success');
        } catch (error) {
          console.error("Error deleting asset:", error);
          Swal.fire('Error', 'Failed to delete asset.', 'error');
        }
      }
    });
  };

  // -- Asset Distribution Handlers --
  const filteredDistributions = React.useMemo(() => {
    if (!distributions) return [];
    const lowerSearch = distributionSearchTerm.toLowerCase();
    return distributions.filter(d =>
      d.assetName.toLowerCase().includes(lowerSearch) ||
      d.employeeName.toLowerCase().includes(lowerSearch)
    );
  }, [distributions, distributionSearchTerm]);

  const paginatedDistributions = React.useMemo(() => {
    const startIndex = (distributionPage - 1) * rowsPerPage;
    return filteredDistributions.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredDistributions, distributionPage]);

  const distributionTotalPages = Math.ceil(filteredDistributions.length / rowsPerPage);

  const handleAddDistributionClick = () => {
    setEditingDistribution(null);
    setIsDistributionModalOpen(true);
  };

  const handleEditDistributionClick = (distribution: AssetDistributionDocument) => {
    setEditingDistribution(distribution);
    setIsDistributionModalOpen(true);
  };

  const handleDeleteDistributionClick = async (distribution: AssetDistributionDocument) => {
    if (isReadOnly) return;
    Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "asset_distributions", distribution.id));

          // Also update asset status to Available if it was occupied
          if (distribution.status === 'Occupied' || distribution.status === 'Pending For Acknowledgement') {
            await updateDoc(doc(firestore, "assets", distribution.assetId), {
              status: 'Available',
              updatedAt: new Date()
            });
            refetchAssets();
          }

          Swal.fire(
            'Deleted!',
            'Distribution record has been deleted.',
            'success'
          );
          refetchDistributions();
        } catch (error) {
          console.error("Error deleting distribution:", error);
          Swal.fire(
            'Error!',
            'Failed to delete distribution.',
            'error'
          );
        }
      }
    });
  };

  const handleDistributionHistoryClick = (dist: AssetDistributionDocument) => {
    setDistributionHistoryAssetId(dist.assetId);
    setDistributionHistoryAssetName(dist.assetName);
    setIsDistributionHistoryModalOpen(true);
  };


  return (
    <div className="py-8 px-5 w-full">
      <Card className="shadow-xl mb-8">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out">
                <Package className="h-7 w-7 text-primary" />
                Assets Management
              </CardTitle>
              <CardDescription>
                Manage your organization's assets and requisitions.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 1. Pending Asset Requisition Section */}
      <Card className="shadow-md mb-8">
        <CardHeader className="bg-primary/5 pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-xl text-primary font-bold">All Asset Requisitions</CardTitle>
              <CardDescription>History of all asset requisitions</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-8 bg-white"
                  value={requisitionSearchTerm}
                  onChange={(e) => setRequisitionSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          <div className="rounded-md border-t min-w-[1000px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Employee Code</TableHead>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Job Status</TableHead>
                  <TableHead>Asset Category</TableHead>
                  <TableHead>Requisition Status</TableHead>
                  <TableHead>Requisition Details</TableHead>
                  <TableHead>From Date</TableHead>
                  <TableHead>To Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingRequisitions ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : paginatedRequisitions.length > 0 ? (
                  paginatedRequisitions.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="align-middle">{req.employeeCode}</TableCell>
                      <TableCell className="align-middle">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={req.employeePhotoUrl} />
                            <AvatarFallback>{req.employeeName.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{req.employeeName}</div>
                            <div className="text-xs text-muted-foreground">Dhaka</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">{req.employeeDesignation}</TableCell>
                      <TableCell className="align-middle">{req.jobStatus || 'Active'}</TableCell>
                      <TableCell className="align-middle">{req.assetCategoryName}</TableCell>
                      <TableCell className="align-middle">
                        <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">
                          {req.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-middle max-w-[250px]">{req.details}</TableCell>
                      <TableCell className="align-middle">{req.fromDate ? format(parseISO(req.fromDate), 'dd-MM-yyyy') : '-'}</TableCell>
                      <TableCell className="align-middle">{req.toDate ? format(parseISO(req.toDate), 'dd-MM-yyyy') : '-'}</TableCell>
                      <TableCell className="text-right align-middle">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleApproveRequisition(req.id)} disabled={isReadOnly || req.status === 'Approved'}>
                              <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                              Accept
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRejectRequisition(req.id)} disabled={isReadOnly || req.status === 'Rejected'}>
                              <XCircle className="mr-2 h-4 w-4 text-orange-600" />
                              Reject
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteRequisition(req.id)} disabled={isReadOnly} className="text-destructive focus:text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center">
                      No pending requisitions found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-end space-x-2 py-4 px-4">
            <div className="text-sm text-muted-foreground mr-auto">
              Showing {filteredRequisitions.length === 0 ? 0 : (requisitionPage - 1) * requisitionRowsPerPage + 1} to {Math.min(requisitionPage * requisitionRowsPerPage, filteredRequisitions.length)} of {filteredRequisitions.length} results
            </div>
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled={requisitionPage === 1}
                onClick={() => setRequisitionPage(p => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-primary text-primary-foreground"
              >
                {requisitionPage}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={requisitionPage >= requisitionTotalPages}
                onClick={() => setRequisitionPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* 2. Manage Asset Distribution Section */}
      <Card className="shadow-md mb-8">
        <CardHeader className="bg-primary/5 pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-xl text-primary font-bold">Manage Asset Distribution</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-8 bg-white"
                  value={distributionSearchTerm}
                  onChange={(e) => setDistributionSearchTerm(e.target.value)}
                />
              </div>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleAddDistributionClick} disabled={isReadOnly}>
                <Plus className="mr-2 h-4 w-4" /> Add New
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          <div className="rounded-md border-t min-w-[800px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Asset Name</TableHead>
                  <TableHead>Employee Code</TableHead>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingDistributions ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-8" /></TableCell>
                    </TableRow>
                  ))
                ) : paginatedDistributions.length > 0 ? (
                  paginatedDistributions.map((dist) => (
                    <TableRow key={dist.id}>
                      <TableCell className="font-medium align-middle">{dist.assetName}</TableCell>
                      <TableCell className="align-middle">{dist.employeeCode || 'N/A'}</TableCell>
                      <TableCell className="align-middle">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={dist.employeePhotoUrl} />
                            <AvatarFallback>{dist.employeeName.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{dist.employeeName}</div>
                            <div className="text-xs text-muted-foreground">{dist.employeeDesignation}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">{dist.startDate}</TableCell>
                      <TableCell className="align-middle">{dist.endDate || 'N/A'}</TableCell>
                      <TableCell className="align-middle">{dist.status}</TableCell>
                      <TableCell className="text-right align-middle">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditDistributionClick(dist)} disabled={isReadOnly}>
                              <FileEdit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDistributionHistoryClick(dist)}>
                              <History className="mr-2 h-4 w-4" />
                              History
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteDistributionClick(dist)} className="text-destructive focus:text-destructive" disabled={isReadOnly}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No asset distributions found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-end space-x-2 py-4 px-4">
            <div className="text-sm text-muted-foreground mr-auto">
              Showing {filteredDistributions.length === 0 ? 0 : (distributionPage - 1) * rowsPerPage + 1} to {Math.min(distributionPage * rowsPerPage, filteredDistributions.length)} of {filteredDistributions.length} results
            </div>
            <div className="space-x-2">
              <Button variant="outline" size="sm" disabled={distributionPage === 1} onClick={() => setDistributionPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">{distributionPage}</Button>
              <Button variant="outline" size="sm" disabled={distributionPage >= distributionTotalPages} onClick={() => setDistributionPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Asset Management Section */}
      <Card className="shadow-md mb-8">
        <CardHeader className="bg-primary/5 pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-xl text-primary font-bold">Asset Management</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-8 bg-white"
                  value={assetSearchTerm}
                  onChange={(e) => setAssetSearchTerm(e.target.value)}
                />
              </div>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleAddAssetClick} disabled={isReadOnly}>
                <Plus className="mr-2 h-4 w-4" /> Add New
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          <div className="rounded-md border-t min-w-[1000px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Purchase Date</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Serial Info</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>Warranty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingAssets ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                    </TableRow>
                  ))
                ) : paginatedAssets.length > 0 ? (
                  paginatedAssets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium align-top">
                        <div>
                          <div>{asset.title}</div>
                          <div className="text-xs text-muted-foreground">{asset.code}</div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">{asset.categoryName}</TableCell>
                      <TableCell className="align-top max-w-[150px] truncate" title={asset.description}>{asset.description || '-'}</TableCell>
                      <TableCell className="align-top">{asset.purchaseDate ? asset.purchaseDate : '-'}</TableCell>
                      <TableCell className="align-top">{asset.code}</TableCell>
                      <TableCell className="align-top">{asset.serialNumber || '-'}</TableCell>
                      <TableCell className="align-top">{asset.supplier || '-'}</TableCell>
                      <TableCell className="align-top">{asset.manufacturer || '-'}</TableCell>
                      <TableCell className="align-top">{asset.warrantyPeriod || '-'}</TableCell>
                      <TableCell className="align-top">
                        <Badge variant={asset.status === 'Available' ? 'outline' : 'secondary'} className={cn(asset.status === 'Available' && 'bg-green-50 text-green-700 border-green-200')}>
                          {asset.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditAssetClick(asset)} disabled={isReadOnly}>
                              <FileEdit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleHistoryClick(asset)}>
                              <History className="mr-2 h-4 w-4" />
                              History
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteAssetClick(asset.id, asset.title)} className="text-destructive focus:text-destructive" disabled={isReadOnly}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={11} className="h-24 text-center">
                      No assets found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-end space-x-2 py-4 px-4 sticky left-0">
            <div className="text-sm text-muted-foreground mr-auto">
              Showing {filteredAssets.length === 0 ? 0 : (assetPage - 1) * rowsPerPage + 1} to {Math.min(assetPage * rowsPerPage, filteredAssets.length)} of {filteredAssets.length} results
            </div>
            <div className="space-x-2">
              <Button variant="outline" size="sm" disabled={assetPage === 1} onClick={() => setAssetPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">{assetPage}</Button>
              <Button variant="outline" size="sm" disabled={assetPage >= assetTotalPages} onClick={() => setAssetPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Manage Asset Category Section (Moved to Bottom) */}
      <Card className="shadow-md mb-8">
        <CardHeader className="bg-primary/5 pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-xl text-primary font-bold">Manage Asset Category</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-8 bg-white"
                  value={categorySearchTerm}
                  onChange={(e) => setCategorySearchTerm(e.target.value)}
                />
              </div>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleAddCategoryClick} disabled={isReadOnly}>
                <Plus className="mr-2 h-4 w-4" /> Add New
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-md border-t">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[100px]">Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingCategories ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : paginatedCategories.length > 0 ? (
                  paginatedCategories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>
                        <div className="relative h-10 w-10 overflow-hidden rounded-full border bg-muted">
                          {category.documentUrl ? (
                            <Image
                              src={category.documentUrl}
                              alt={category.name}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gray-100">
                              <Package className="h-5 w-5 text-gray-400" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditCategoryClick(category)} disabled={isReadOnly}>
                              <FileEdit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteCategoryClick(category.id, category.name)} className="text-destructive focus:text-destructive" disabled={isReadOnly}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
                      No asset categories found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-end space-x-2 py-4 px-4">
            <div className="text-sm text-muted-foreground mr-auto">
              Showing {filteredCategories.length === 0 ? 0 : (categoryPage - 1) * rowsPerPage + 1} to {Math.min(categoryPage * rowsPerPage, filteredCategories.length)} of {filteredCategories.length} results
            </div>
            <div className="space-x-2">
              <Button variant="outline" size="sm" disabled={categoryPage === 1} onClick={() => setCategoryPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">{categoryPage}</Button>
              <Button variant="outline" size="sm" disabled={categoryPage >= categoryTotalPages} onClick={() => setCategoryPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Modal */}
      <AssetCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categoryToEdit={editingCategory}
        onSuccess={refetchCategories}
      />

      {/* Asset Modal */}
      <AssetModal
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        assetToEdit={editingAsset}
        onSuccess={refetchAssets}
      />

      {/* Asset History Sheet */}
      <AssetHistorySheet
        isOpen={isHistorySheetOpen}
        onClose={() => setIsHistorySheetOpen(false)}
        assetId={historyAssetId}
        assetName={historyAssetName}
      />

      {/* Asset Distribution Modal */}
      <AssetDistributionModal
        isOpen={isDistributionModalOpen}
        onClose={() => setIsDistributionModalOpen(false)}
        distributionToEdit={editingDistribution}
        onSuccess={() => {
          refetchDistributions();
          refetchAssets();
        }}
      />

      {/* Asset Distribution History Modal */}
      <AssetDistributionHistoryModal
        isOpen={isDistributionHistoryModalOpen}
        onClose={() => setIsDistributionHistoryModalOpen(false)}
        assetId={distributionHistoryAssetId}
        assetName={distributionHistoryAssetName}
      />
    </div>
  );
}

