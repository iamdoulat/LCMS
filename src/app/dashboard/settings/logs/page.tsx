
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Loader2, History, Trash2, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AppLog {
  id: string;
  timestamp: Date;
  user: string;
  action: string;
  details: string;
}

const ITEMS_PER_PAGE = 15;

// Generate placeholder logs
const generatePlaceholderLogs = (count: number): AppLog[] => {
  const logs: AppLog[] = [];
  const actions = ["User Login", "LC Created", "Profile Updated", "Settings Changed", "Data Exported", "PI Added"];
  const users = ["mddoulat@gmail.com", "commercial@smartsolution-bd.com", "user@example.com", "test@example.com"];
  for (let i = 0; i < count; i++) {
    logs.push({
      id: `log-${i + 1}`,
      timestamp: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 7), // Within last 7 days
      user: users[Math.floor(Math.random() * users.length)],
      action: actions[Math.floor(Math.random() * actions.length)],
      details: `Performed action with ID ${Math.random().toString(36).substring(2, 8)}. Additional details go here to provide context.`,
    });
  }
  return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

export default function LogsPage() {
  const { userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const [allLogs, setAllLogs] = useState<AppLog[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const isReadOnly = userRole?.includes('Viewer');
  const isSuperAdmin = userRole?.includes('Super Admin');

  useEffect(() => {
    // Redirect non-super admins and non-viewers
    if (!authLoading && !isSuperAdmin && !isReadOnly) {
      Swal.fire({
        title: 'Access Denied',
        text: 'You do not have permission to view this page.',
        icon: 'error',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        router.push('/dashboard');
      });
    } else if (!authLoading && (isSuperAdmin || isReadOnly)) {
      // Generate logs only for authorized roles
      if (allLogs.length === 0) {
        setAllLogs(generatePlaceholderLogs(100));
      }
    }
  }, [userRole, authLoading, router, allLogs.length, isReadOnly, isSuperAdmin]); 

  const handleClearCache = () => {
    Swal.fire({
      title: 'Clear App Cache & Displayed Logs?',
      html: "This will clear application-specific data from your browser's local storage (e.g., notification states, cached company profile) and clear the placeholder logs currently displayed on this page. <br/><br/> It <strong>will not</strong> clear your general browser history, cookies from other sites, or server-side data. You might be logged out if session persistence relies on local storage.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, clear displayed logs & cache!',
      reverseButtons: true,
    }).then((result) => {
      if (result.isConfirmed) {
        try {
          localStorage.removeItem('appNotificationsList');
          localStorage.removeItem('appNotificationsAllRead');
          localStorage.removeItem('appCompanyName');
          localStorage.removeItem('appCompanyLogoUrl');
          // Add any other app-specific keys you use in localStorage here

          setAllLogs([]); // Clear the displayed placeholder logs
          setCurrentPage(1); // Reset pagination

          Swal.fire(
            'Cache & Logs Cleared!',
            'Application-specific local storage and displayed placeholder logs have been cleared.',
            'success'
          );
        } catch (error) {
          console.error("Error clearing cache: ", error);
          Swal.fire("Error", "Could not clear cache. See console for details.", "error");
        }
      }
    });
  };

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return allLogs.slice(startIndex, endIndex);
  }, [allLogs, currentPage]);

  const totalPages = Math.ceil(allLogs.length / ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5;
    const halfPagesToShow = Math.floor(maxPagesToShow / 2);

    if (totalPages <= maxPagesToShow + 2) {
      for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
    } else {
      pageNumbers.push(1);
      let startPage = Math.max(2, currentPage - halfPagesToShow);
      let endPage = Math.min(totalPages - 1, currentPage + halfPagesToShow);
      if (currentPage <= halfPagesToShow + 1) endPage = Math.min(totalPages - 1, maxPagesToShow);
      if (currentPage >= totalPages - halfPagesToShow) startPage = Math.max(2, totalPages - maxPagesToShow + 1);
      if (startPage > 2) pageNumbers.push("...");
      for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
      if (endPage < totalPages - 1) pageNumbers.push("...");
      pageNumbers.push(totalPages);
    }
    return pageNumbers;
  };


  if (authLoading || (!isSuperAdmin && !isReadOnly)) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Verifying access...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <History className="h-7 w-7 text-primary" />
                Application Activity Logs
              </CardTitle>
              <CardDescription>
                View the latest 100 placeholder activity logs, sorted newest first. Actual logging requires backend integration.
              </CardDescription>
            </div>
            <Button onClick={handleClearCache} variant="outline" disabled={!isSuperAdmin}>
              <Trash2 className="mr-2 h-4 w-4" />
              Clear App Cache & Displayed Logs
            </Button>
          </div>
        </CardHeader>
        <CardContent>
           <Alert variant="default" className="mb-6 bg-blue-500/10 border-blue-500/30">
            <ShieldAlert className="h-5 w-5 text-blue-600" />
            <AlertTitle className="text-blue-700 font-semibold">Placeholder Data</AlertTitle>
            <AlertDescription className="text-blue-700/90">
              The logs displayed below are for demonstration purposes only. A comprehensive logging system would typically involve a backend service to record and retrieve actual application activities. Clearing logs here only affects this placeholder display.
            </AlertDescription>
          </Alert>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLogs.length > 0 ? (
                  paginatedLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{format(log.timestamp, 'PPP p')}</TableCell>
                      <TableCell className="truncate max-w-xs">{log.user}</TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-md">{log.details}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      No logs to display.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption>
                Showing {paginatedLogs.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}-
                {Math.min(currentPage * ITEMS_PER_PAGE, allLogs.length)} of {allLogs.length} log entries.
              </TableCaption>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 py-4 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              {getPageNumbers().map((page, index) =>
                typeof page === 'number' ? (
                  <Button
                    key={`log-page-${page}`}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                    className="w-9 h-9 p-0"
                  >
                    {page}
                  </Button>
                ) : (
                  <span key={`ellipsis-log-${index}`} className="px-2 py-1 text-sm">
                    {page}
                  </span>
                )
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
