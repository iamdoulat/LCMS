
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Loader2, Bell, FileEdit, Trash2, PlusCircle, MoreHorizontal, Eye } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import type { NoticeBoardSettings } from '@/types';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import DOMPurify from 'dompurify';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

interface Notice extends NoticeBoardSettings {
  id: string;
}

const formatDisplayDate = (timestamp: any): string => {
  if (timestamp instanceof Timestamp) {
    return format(timestamp.toDate(), 'PPP p');
  }
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return format(date, 'PPP p');
    }
  }
  return 'N/A';
};


export default function ManageNoticesPage() {
  const { userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const isSuperAdmin = userRole?.includes('Super Admin');
  const isReadOnly = userRole?.includes('Viewer');
  const [viewingNotice, setViewingNotice] = React.useState<Notice | null>(null);

  useEffect(() => {
    const canView = userRole?.some(role => ['Super Admin', 'Admin', 'HR', 'Viewer'].includes(role));
    if (!authLoading && !canView) {
      Swal.fire({
        title: 'Access Denied',
        text: 'You do not have permission to view this page.',
        icon: 'error',
        timer: 1000,
        showConfirmButton: false,
      }).then(() => {
        router.push('/dashboard');
      });
      return;
    }

    if (!authLoading && canView) {
      const fetchNotices = async () => {
        setIsLoading(true);
        setFetchError(null);
        try {
          const noticesRef = collection(firestore, "site_settings");
          const q = query(noticesRef, orderBy("updatedAt", "desc"));
          const querySnapshot = await getDocs(q);
          const fetchedNotices = querySnapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          } as Notice));
          setNotices(fetchedNotices);
        } catch (error: any) {
          setFetchError(`Failed to fetch notices: ${error.message}`);
          Swal.fire("Error", `Failed to fetch notices. Check console and Firestore rules.`, "error");
        } finally {
          setIsLoading(false);
        }
      };
      fetchNotices();
    }
  }, [userRole, authLoading, router]);

  const handleDeleteNotice = (noticeId: string, noticeTitle: string) => {
    Swal.fire({
      title: 'Are you absolutely sure?',
      text: `This will permanently delete the notice "${noticeTitle}". This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      confirmButtonText: 'Yes, delete it!',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "site_settings", noticeId));
          setNotices(prev => prev.filter(n => n.id !== noticeId));
          Swal.fire('Deleted!', 'The notice has been removed.', 'success');
        } catch (error: any) {
          Swal.fire('Error!', `Could not delete notice: ${error.message}`, 'error');
        }
      }
    });
  };

  if (authLoading || (!userRole && !fetchError)) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Verifying access...</p>
      </div>
    );
  }

  const createMarkup = (htmlContent: string | undefined) => {
    // Ensure this only runs on the client where DOMPurify is available
    if (typeof window === 'undefined' || !htmlContent) {
      return { __html: '' };
    }
    // Sanitize the HTML content before rendering
    return { __html: DOMPurify.sanitize(htmlContent) };
  };

  return (
    <div className="container mx-auto py-8 px-5">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <Bell className="h-7 w-7 text-primary" />
                Manage Notices
              </CardTitle>
              <CardDescription>
                View, edit, and manage all site-wide notices.
              </CardDescription>
            </div>
            <Link href="/dashboard/hr/notice/add" passHref>
              <Button disabled={isReadOnly || !isSuperAdmin}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Notice
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {fetchError && (
            <div className="my-4 text-center text-destructive bg-destructive/10 p-4 rounded-md">{fetchError}</div>
          )}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Notice Content*</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Target Roles</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin inline-block mr-2" />Loading notices...</TableCell></TableRow>
                ) : notices.length === 0 && !fetchError ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center">No notices found.</TableCell></TableRow>
                ) : (
                  notices.map(notice => (
                    <TableRow key={notice.id}>
                      <TableCell className="font-medium">{notice.title || '(No Title)'}</TableCell>
                      <TableCell className="max-w-[300px] text-sm text-muted-foreground whitespace-pre-wrap" title={notice.content}>
                        <div dangerouslySetInnerHTML={{ __html: notice.content ? DOMPurify.sanitize(notice.content.substring(0, 100) + (notice.content.length > 100 ? '...' : '')) : '' }} />
                      </TableCell>
                      <TableCell>
                        <Badge variant={notice.isEnabled ? 'default' : 'outline'} className={cn(notice.isEnabled && "bg-green-600 hover:bg-green-700")}>
                          {notice.isEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <Badge variant={notice.isPopupEnabled ? 'secondary' : 'outline'} className="ml-2">
                          {notice.isPopupEnabled ? 'Pop-up' : 'No Pop-up'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {notice.targetRoles?.map(role => <Badge key={role} variant="secondary" className="text-xs">{role}</Badge>) || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>{formatDisplayDate(notice.updatedAt)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={!isSuperAdmin && !isReadOnly}>
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onSelect={() => setViewingNotice(notice)}>
                              <Eye className="mr-2 h-4 w-4" />
                              <span>View</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/hr/notice/edit/${notice.id}`}>
                                <FileEdit className="mr-2 h-4 w-4" />
                                <span>{isReadOnly ? 'View Details' : 'Edit'}</span>
                              </Link>
                            </DropdownMenuItem>
                            {isSuperAdmin && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onSelect={() => handleDeleteNotice(notice.id, notice.title)}
                                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                  disabled={isReadOnly}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  <span>Delete</span>
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              <TableCaption>A list of all site notices.</TableCaption>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!viewingNotice} onOpenChange={(isOpen) => !isOpen && setViewingNotice(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{viewingNotice?.title || "Notice Preview"}</DialogTitle>
            <DialogDescription>
              This is a preview of how the notice will appear to users.
            </DialogDescription>
          </DialogHeader>
          {viewingNotice?.content && (
            <div
              className="prose prose-sm dark:prose-invert max-h-[60vh] overflow-y-auto p-1 mt-2 border-t pt-4"
              dangerouslySetInnerHTML={createMarkup(viewingNotice.content)}
            />
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
