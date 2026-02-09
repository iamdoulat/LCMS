"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquareText, Filter, CheckCircle2, History, Star, User, Calendar, MessageSquare, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { cn } from '@/lib/utils';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableCaption,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { firestore } from '@/lib/firebase/config';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import Swal from 'sweetalert2';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { arrayUnion } from 'firebase/firestore';

interface Reply {
    message: string;
    senderName: string;
    senderId: string;
    senderRole: string;
    createdAt: any;
}

interface FeedbackComplaint {
    id: string;
    employeeId: string;
    employeeName: string;
    type: 'Feedback' | 'Complaint';
    rating: number;
    message: string;
    status: 'Pending' | 'Resolved';
    createdAt: Timestamp;
    updatedAt: Timestamp;
    replies?: Reply[];
}

const TableSkeleton = () => (
    <>
        {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-8 w-24" /></TableCell>
            </TableRow>
        ))}
    </>
);

const AnimatedStatCard = ({
    title,
    value,
    subtitle,
    icon: Icon,
    gradientClasses,
    shadowClasses
}: {
    title: string;
    value: number | string;
    subtitle?: string;
    icon: any;
    gradientClasses: string;
    shadowClasses: string;
}) => (
    <motion.div
        whileHover={{ scale: 1.02, translateY: -5 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={cn(
            "relative overflow-hidden rounded-2xl p-6 min-h-[140px] flex flex-col justify-between",
            gradientClasses,
            shadowClasses
        )}
    >
        {/* Shimmer / Glow Effect */}
        <motion.div
            animate={{
                opacity: [0.1, 0.3, 0.1],
                scale: [1, 1.2, 1],
            }}
            transition={{
                duration: 6,
                repeat: Infinity,
                ease: "linear"
            }}
            className="absolute -top-1/2 -right-1/4 w-full h-full bg-white/20 blur-[80px] rounded-full pointer-events-none"
        />

        <div className="relative z-10 flex justify-between items-start">
            <div className="space-y-2">
                <p className="text-[10px] font-black text-white/80 uppercase tracking-widest leading-none">{title}</p>
                <motion.h3
                    key={value}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-3xl font-black text-white tracking-tighter"
                >
                    {value}
                </motion.h3>
                <p className="text-[10px] font-medium text-white/70 leading-none">{subtitle}</p>
            </div>

            <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-xl">
                <Icon className="h-6 w-6 text-white" strokeWidth={2.5} />
            </div>
        </div>
    </motion.div>
);


export default function FeedbackComplaintManagementPage() {
    const { userRole, user } = useAuth();
    const [submissions, setSubmissions] = React.useState<FeedbackComplaint[]>([]);
    const [filteredSubmissions, setFilteredSubmissions] = React.useState<FeedbackComplaint[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [typeFilter, setTypeFilter] = React.useState<string>('all');
    const [statusFilter, setStatusFilter] = React.useState<string>('all');

    const isHROrAdmin = userRole?.some(role => ['Super Admin', 'Admin', 'HR'].includes(role));

    React.useEffect(() => {
        const q = query(collection(firestore, 'feedback_complaints'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as FeedbackComplaint));
            setSubmissions(data);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching submissions:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        let filtered = [...submissions];
        if (typeFilter !== 'all') {
            filtered = filtered.filter(s => s.type === typeFilter);
        }
        if (statusFilter !== 'all') {
            filtered = filtered.filter(s => s.status === statusFilter);
        }
        setFilteredSubmissions(filtered);
    }, [submissions, typeFilter, statusFilter]);

    const [selectedSub, setSelectedSub] = React.useState<FeedbackComplaint | null>(null);
    const [replyMessage, setReplyMessage] = React.useState('');
    const [replyStatus, setReplyStatus] = React.useState<'Pending' | 'Resolved'>('Pending');
    const [isUpdating, setIsUpdating] = React.useState(false);

    const handleReply = async () => {
        if (!selectedSub || !replyMessage.trim()) return;

        setIsUpdating(true);
        try {
            const newReply: Reply = {
                message: replyMessage.trim(),
                senderName: user?.displayName || 'Admin',
                senderId: user?.uid || 'admin',
                senderRole: 'HR',
                createdAt: new Date(),
            };

            await updateDoc(doc(firestore, 'feedback_complaints', selectedSub.id), {
                replies: arrayUnion(newReply),
                status: replyStatus,
                updatedAt: serverTimestamp()
            });

            setSelectedSub(null);
            setReplyMessage('');
            Swal.fire({
                icon: 'success',
                title: 'Replied!',
                text: 'Your reply has been sent to the employee.',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error("Error replying:", error);
            Swal.fire('Error', 'Failed to send reply.', 'error');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleResolve = async (id: string) => {
        Swal.fire({
            title: 'Mark as Resolved?',
            text: "This will update the status to Resolved.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, resolve it!',
            confirmButtonColor: 'hsl(var(--primary))',
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await updateDoc(doc(firestore, 'feedback_complaints', id), {
                        status: 'Resolved',
                        updatedAt: serverTimestamp()
                    });
                    Swal.fire('Success', 'Marked as resolved.', 'success');
                } catch (error) {
                    console.error("Error updating status:", error);
                    Swal.fire('Error', 'Failed to update status.', 'error');
                }
            }
        });
    };

    const renderRating = (rating: number) => {
        return (
            <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map(star => (
                    <Star
                        key={star}
                        className={cn(
                            "h-3.5 w-3.5",
                            star <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"
                        )}
                    />
                ))}
            </div>
        );
    };

    if (!isHROrAdmin) {
        return <div className="p-8 text-center">You do not have permission to view this page.</div>;
    }

    return (
        <div className="py-8 px-5 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className={cn(
                        "font-black text-3xl lg:text-4xl flex items-center gap-2",
                        "bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 text-transparent bg-clip-text"
                    )}>
                        <MessageSquareText className="h-8 w-8 text-blue-600" />
                        Feedback & Complaints
                    </h1>
                    <p className="text-slate-500 mt-1">Manage employee feedback and address concerns.</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <AnimatedStatCard
                    title="Total Submissions"
                    value={submissions.length}
                    subtitle={`${submissions.filter(s => {
                        const now = new Date();
                        const subDate = s.createdAt?.toDate();
                        return subDate && subDate.getMonth() === now.getMonth() && subDate.getFullYear() === now.getFullYear();
                    }).length} this month`}
                    icon={MessageSquare}
                    gradientClasses="bg-gradient-to-br from-blue-600 via-indigo-500 to-indigo-700"
                    shadowClasses="shadow-[0_20px_40px_rgba(37,99,235,0.3)]"
                />
                <AnimatedStatCard
                    title="Pending Submissions"
                    value={submissions.filter(s => s.status === 'Pending').length}
                    subtitle="Requires attention"
                    icon={AlertCircle}
                    gradientClasses="bg-gradient-to-br from-rose-500 via-pink-600 to-purple-600"
                    shadowClasses="shadow-[0_20px_40px_rgba(225,29,72,0.3)]"
                />
                <AnimatedStatCard
                    title="Resolved Items"
                    value={submissions.filter(s => s.status === 'Resolved').length}
                    subtitle="Successfully closed"
                    icon={CheckCircle2}
                    gradientClasses="bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600"
                    shadowClasses="shadow-[0_20px_40px_rgba(16,185,129,0.3)]"
                />
            </div>


            {/* Filters & Table */}
            <Card className="border-none shadow-xl bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6">
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="flex items-center gap-2 flex-grow">
                            <Filter className="h-4 w-4 text-slate-400" />
                            <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">Filters</span>
                        </div>
                        <div className="flex gap-3 w-full md:w-auto">
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="w-full md:w-[150px] bg-white border-slate-200">
                                    <SelectValue placeholder="All Types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="Feedback">Feedback</SelectItem>
                                    <SelectItem value="Complaint">Complaint</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full md:w-[150px] bg-white border-slate-200">
                                    <SelectValue placeholder="All Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="Pending">Pending</SelectItem>
                                    <SelectItem value="Resolved">Resolved</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                                <TableHead className="w-[180px] font-bold text-slate-700">Date</TableHead>
                                <TableHead className="font-bold text-slate-700">Employee</TableHead>
                                <TableHead className="font-bold text-slate-700">Type</TableHead>
                                <TableHead className="font-bold text-slate-700">Rating</TableHead>
                                <TableHead className="font-bold text-slate-700">Message</TableHead>
                                <TableHead className="font-bold text-slate-700">Status</TableHead>
                                <TableHead className="text-right font-bold text-slate-700">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableSkeleton />
                            ) : filteredSubmissions.length > 0 ? (
                                filteredSubmissions.map((sub) => (
                                    <TableRow key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                                        <TableCell className="text-slate-500 text-xs">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-3.5 w-3.5" />
                                                {sub.createdAt ? format(sub.createdAt.toDate(), 'PPP p') : 'Just now'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                                                    <User className="h-4 w-4 text-slate-500" />
                                                </div>
                                                <span className="font-semibold text-slate-900 text-sm">{sub.employeeName}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn(
                                                "font-bold px-3 py-1",
                                                sub.type === 'Feedback'
                                                    ? "bg-blue-50 text-blue-600 border-blue-200"
                                                    : "bg-rose-50 text-rose-600 border-rose-200"
                                            )}>
                                                {sub.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {sub.type === 'Feedback' ? renderRating(sub.rating) : <span className="text-slate-300">-</span>}
                                        </TableCell>
                                        <TableCell className="max-w-[300px]">
                                            <p className="text-slate-600 text-sm line-clamp-2" title={sub.message}>
                                                {sub.message}
                                            </p>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={cn(
                                                "rounded-full px-3",
                                                sub.status === 'Resolved' ? "bg-emerald-500" : "bg-amber-500"
                                            )}>
                                                {sub.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold"
                                                onClick={() => {
                                                    setSelectedSub(sub);
                                                    setReplyStatus(sub.status);
                                                }}
                                            >
                                                <MessageSquare className="h-4 w-4 mr-2" />
                                                Reply & Manage
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-32 text-center text-slate-400">
                                        No submissions found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Reply Dialog */}
            <Dialog open={!!selectedSub} onOpenChange={(open) => !open && setSelectedSub(null)}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-blue-600" />
                            Reply to {selectedSub?.employeeName}
                        </DialogTitle>
                        <DialogDescription>
                            Review the message and send a reply. You can also update the status.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 italic text-slate-600 text-sm">
                            "{selectedSub?.message}"
                        </div>

                        {/* Existing Replies */}
                        {selectedSub?.replies && selectedSub.replies.length > 0 && (
                            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Previous Replies</p>
                                {selectedSub.replies.map((r, i) => (
                                    <div key={i} className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-bold text-blue-600">{r.senderName} ({r.senderRole})</span>
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed">{r.message}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-700">Your Reply</label>
                            <Textarea
                                placeholder="Type your response here..."
                                value={replyMessage}
                                onChange={(e) => setReplyMessage(e.target.value)}
                                className="min-h-[100px] rounded-xl"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-700">Update Status</label>
                            <Select
                                value={replyStatus}
                                onValueChange={(v: any) => setReplyStatus(v)}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Pending">Pending</SelectItem>
                                    <SelectItem value="Resolved">Resolved</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedSub(null)}>Cancel</Button>
                        <Button
                            onClick={handleReply}
                            disabled={!replyMessage.trim() || isUpdating}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {isUpdating ? "Sending..." : "Send Reply"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
