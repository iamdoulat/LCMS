"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Loader2, History, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { UserRole } from '@/types';
import { Badge } from '@/components/ui/badge';


interface ActivityLog {
  id: string;
  timestamp: Date;
  userName: string;
  userEmail: string;
  userRole: UserRole[];
  activity: string;
}

const ITEMS_PER_PAGE = 50;

// Generate placeholder logs
const generatePlaceholderActivityLogs = (count: number): ActivityLog[] => {
  const logs: ActivityLog[] = [];
  const actions = ["User Login", "Created L/C", "Updated Profile", "Changed Settings", "Exported Report", "Added PI", "Deleted Item", "Updated Invoice"];
  const users = [
    { name: 'Doulat', email: 'mddoulat@gmail.com', role: ['Super Admin'] as UserRole[] },
    { name: 'Commercial Team', email: 'commercial@smartsolution-bd.com', role: ['Commercial'] as UserRole[] },
    { name: 'Service User', email: 'user@example.com', role: ['Service'] as UserRole[] },
    { name: 'Test Account', email: 'test@example.com', role: ['Accounts'] as UserRole[] }
  ];
  for (let i = 0; i < count; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    logs.push({
      id: `activity-${i + 1}`,
      timestamp: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 30), // Within last 30 days
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      activity: actions[Math.floor(Math.random() * actions.length)],
    });
  }
  return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};


export default function UserActivitiesPage() {
  const { userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const [allLogs, setAllLogs] = useState<ActivityLog[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const isSuperAdminOrAdmin = userRole?.some(role => ['Super Admin', 'Admin'].includes(role));

  useEffect(() => {
    if (!authLoading && !isSuperAdminOrAdmin) {
      Swal.fire({
        title: 'Access Denied',
        text: 'You do not have permission to view user activities.',
        icon: 'error',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        router.push('/dashboard');
      });
    } else if (!authLoading && isSuperAdminOrAdmin) {
      if (allLogs.length === 0) {
        setAllLogs(generatePlaceholderActivityLogs(250)); // Generate more logs
      }
    }
  }, [userRole, authLoading, router, allLogs.length, isSuperAdminOrAdmin]);

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


  if (authLoading || !isSuperAdminOrAdmin) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Verifying access...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-5">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <History className="h-7 w-7 text-primary" />
                User Activities
              </CardTitle>
              <CardDescription>
                A log of recent user activities across the application.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
           <Alert variant="default" className="mb-6 bg-blue-500/10 border-blue-500/30">
            <ShieldAlert className="h-5 w-5 text-blue-600" />
            <AlertTitle className="text-blue-700 font-semibold">Placeholder Data</AlertTitle>
            <AlertDescription className="text-blue-700/90">
              The activity logs shown here are for demonstration purposes. A full implementation would require backend services to capture and store these events securely.
            </AlertDescription>
          </Alert>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>User Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLogs.length > 0 ? (
                  paginatedLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{format(log.timestamp, 'PPP p')}</TableCell>
                      <TableCell className="font-medium">{log.userName}</TableCell>
                      <TableCell className="text-muted-foreground">{log.userEmail}</TableCell>
                       <TableCell>
                        <div className="flex flex-wrap gap-1">
                            {log.userRole.map(r => <Badge key={r} variant="secondary">{r}</Badge>)}
                        </div>
                      </TableCell>
                      <TableCell>{log.activity}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No activity logs to display.
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
                    key={`activity-log-page-${page}`}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                    className="w-9 h-9 p-0"
                  >
                    {page}
                  </Button>
                ) : (
                  <span key={`ellipsis-log-${index}`} className="px-2 py-1 text-sm">{page}</span>
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
