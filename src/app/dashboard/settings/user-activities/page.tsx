
"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  MessageSquare,
  Mail,
  AlertCircle,
  RefreshCcw,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Send
} from 'lucide-react';
import { LogEntry, LogStatus, LogType } from '@/lib/logger';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

interface SystemLog extends LogEntry {
  id: string;
  createdAt: string; // ISO string from API
}

export default function ActivityLogsPage() {
  const { userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<LogType | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const logsPerPage = 20;
  const isSuperAdminOrAdmin = userRole?.some(role => ['Super Admin', 'Admin'].includes(role));

  useEffect(() => {
    if (!authLoading && !isSuperAdminOrAdmin) {
      Swal.fire({
        title: 'Access Denied',
        text: 'You do not have permission to view system logs.',
        icon: 'error',
        timer: 1000,
        showConfirmButton: false,
      }).then(() => router.push('/dashboard'));
    } else if (!authLoading && isSuperAdminOrAdmin) {
      fetchLogs();
    }
  }, [userRole, authLoading, router, isSuperAdminOrAdmin, currentPage]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * logsPerPage;
      const res = await fetch(`/api/logs?limit=${logsPerPage}&offset=${offset}`);
      if (!res.ok) throw new Error("Failed to fetch logs");
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalLogs(data.total || 0);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllLogs = async () => {
    const result = await Swal.fire({
      title: 'Delete All Logs?',
      text: 'This will permanently delete all system logs. This action cannot be undone!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete all logs!',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    setDeleting(true);
    try {
      const res = await fetch('/api/logs', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete logs');

      await Swal.fire({
        title: 'Deleted!',
        text: 'All logs have been deleted successfully.',
        icon: 'success',
        timer: 1000,
        showConfirmButton: false
      });

      setCurrentPage(1);
      fetchLogs();
    } catch (error: any) {
      console.error('Error deleting logs:', error);
      Swal.fire('Error', error.message || 'Failed to delete logs', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Analytics
  const stats = {
    total: logs.length,
    whatsapp: logs.filter(l => l.type === 'whatsapp').length,
    email: logs.filter(l => l.type === 'email').length,
    telegram: logs.filter(l => l.type === 'telegram').length,
    errors: logs.filter(l => l.status === 'failed').length
  };

  // Filtered Logs
  const filteredLogs = logs.filter(log => {
    const matchesType = filterType === 'all' || log.type === filterType;
    const matchesSearch = searchTerm === '' ||
      (log.message || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.recipient || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.action || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const getTypeIcon = (type: LogType) => {
    switch (type) {
      case 'whatsapp': return <MessageSquare className="h-4 w-4 text-green-500" />;
      case 'email': return <Mail className="h-4 w-4 text-blue-500" />;
      case 'telegram': return <Send className="h-4 w-4 text-sky-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'user_activity': return <Activity className="h-4 w-4 text-orange-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: LogStatus) => {
    switch (status) {
      case 'success': return <Badge variant="default" className="bg-green-600">Success</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      case 'pending': return <Badge variant="secondary">Pending</Badge>;
      case 'warning': return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Warning</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (authLoading || !isSuperAdminOrAdmin) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-none mx-[25px] py-8 px-0">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Activity Logs</h1>
          <p className="text-muted-foreground">Monitor WhatsApp, Email, Telegram, and User activities.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchLogs} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button variant="destructive" onClick={handleDeleteAllLogs} disabled={deleting || totalLogs === 0}>
            <Trash2 className="mr-2 h-4 w-4" /> {deleting ? 'Deleting...' : 'Delete All Logs'}
          </Button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div><p className="text-xs text-muted-foreground">Recent events</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WhatsApp Sent</CardTitle>
            <MessageSquare className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.whatsapp}</div><p className="text-xs text-muted-foreground">Attempted messages</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
            <Mail className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.email}</div><p className="text-xs text-muted-foreground">Attempted emails</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Telegram Sent</CardTitle>
            <Send className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.telegram}</div><p className="text-xs text-muted-foreground">Sent notifications</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failures</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.errors}</div><p className="text-xs text-muted-foreground">Failed actions</p></CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Activity Log</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  className="pl-8 w-[250px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-1 bg-muted p-1 rounded-md">
                <Button variant={filterType === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterType('all')}>All</Button>
                <Button variant={filterType === 'whatsapp' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterType('whatsapp')}><MessageSquare className="h-4 w-4 mr-1" /> WA</Button>
                <Button variant={filterType === 'email' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterType('email')}><Mail className="h-4 w-4 mr-1" /> Email</Button>
                <Button variant={filterType === 'telegram' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterType('telegram')}><Send className="h-4 w-4 mr-1" /> Telegram</Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Recipient / User</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">Loading logs...</TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">No logs found.</TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/50">
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {log.createdAt ? format(new Date(log.createdAt), 'MMM dd, HH:mm:ss') : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(log.type)}
                          <span className="capitalize text-xs">{log.type}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-sm">{log.action}</TableCell>
                      <TableCell className="text-sm">{log.recipient || log.userId || '-'}</TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm" title={log.message}>
                        {log.message}
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {!loading && filteredLogs.length > 0 && (
            <div className="flex items-center justify-between px-2 py-4">
              <div className="text-sm text-muted-foreground">
                Showing page {currentPage} of {Math.ceil(totalLogs / logsPerPage)} ({totalLogs} total logs)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={currentPage >= Math.ceil(totalLogs / logsPerPage)}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
