
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
  Search
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
  const isSuperAdminOrAdmin = userRole?.some(role => ['Super Admin', 'Admin'].includes(role));

  useEffect(() => {
    if (!authLoading && !isSuperAdminOrAdmin) {
      Swal.fire({
        title: 'Access Denied',
        text: 'You do not have permission to view system logs.',
        icon: 'error',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => router.push('/dashboard'));
    } else if (!authLoading && isSuperAdminOrAdmin) {
      fetchLogs();
    }
  }, [userRole, authLoading, router, isSuperAdminOrAdmin]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/logs');
      if (!res.ok) throw new Error("Failed to fetch logs");
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error("Error fetching logs:", error);
      // toast.error("Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  // Analytics
  const stats = {
    total: logs.length,
    whatsapp: logs.filter(l => l.type === 'whatsapp').length,
    email: logs.filter(l => l.type === 'email').length,
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Activity Logs</h1>
          <p className="text-muted-foreground">Monitor WhatsApp, Email, and User activities.</p>
        </div>
        <Button variant="outline" onClick={fetchLogs}>
          <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Analytics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
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
        </CardContent>
      </Card>
    </div>
  );
}
