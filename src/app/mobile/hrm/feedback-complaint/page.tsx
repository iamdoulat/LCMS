"use client";

import React, { useState, useEffect } from 'react';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, Send, MessageSquare, AlertCircle, CheckCircle2, Plus, Calendar, Clock, ChevronRight, MessageSquareText, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import Swal from 'sweetalert2';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface Reply {
    message: string;
    senderName: string;
    senderId: string;
    senderRole: string;
    createdAt: any;
}

interface FeedbackComplaint {
    id: string;
    type: 'Feedback' | 'Complaint';
    rating: number;
    message: string;
    status: 'Pending' | 'Resolved';
    createdAt: Timestamp;
    replies?: Reply[];
}

export default function MobileFeedbackComplaintPage() {
    const { user } = useAuth();
    const [submissions, setSubmissions] = useState<FeedbackComplaint[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Form State
    const [type, setType] = useState<'Feedback' | 'Complaint'>('Feedback');
    const [rating, setRating] = useState(5);
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!user?.uid) return;

        const q = query(
            collection(firestore, 'feedback_complaints'),
            where('employeeId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );

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
    }, [user?.uid]);

    const handleSubmit = async () => {
        if (!message.trim()) {
            Swal.fire({
                icon: 'error',
                title: 'Required',
                text: 'Please enter your message',
                timer: 2000,
                showConfirmButton: false
            });
            return;
        }

        setIsSubmitting(true);
        try {
            await addDoc(collection(firestore, 'feedback_complaints'), {
                employeeId: user?.uid || 'unknown',
                employeeName: user?.displayName || user?.email || 'Anonymous',
                type,
                rating: type === 'Feedback' ? rating : 0,
                message: message.trim(),
                status: 'Pending',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            setIsDialogOpen(false);
            setMessage('');
            setRating(5);

            Swal.fire({
                icon: 'success',
                title: 'Submitted!',
                text: 'Thank you for your valuable input.',
                timer: 2000,
                showConfirmButton: false
            });

        } catch (error) {
            console.error("Error submitting feedback:", error);
            Swal.fire({
                icon: 'error',
                title: 'Failed',
                text: 'Could not submit. Please try again.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderCard = (item: FeedbackComplaint) => (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={item.id}
        >
            <Card className="p-4 rounded-2xl border-none shadow-lg bg-white mb-3 relative overflow-hidden group active:scale-[0.98] transition-transform">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "p-2 rounded-xl",
                            item.type === 'Feedback' ? "bg-blue-50 text-blue-600" : "bg-rose-50 text-rose-600"
                        )}>
                            {item.type === 'Feedback' ? <MessageSquare className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.type}</span>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                <Calendar className="h-3 w-3" />
                                {item.createdAt ? format(item.createdAt.toDate(), 'PPP') : 'Just now'}
                            </div>
                        </div>
                    </div>
                    <Badge className={cn(
                        "rounded-full px-2 py-0 text-[10px] uppercase font-bold",
                        item.status === 'Resolved' ? "bg-emerald-500" : "bg-amber-500"
                    )}>
                        {item.status}
                    </Badge>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        {item.type === 'Feedback' && (
                            <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <Star
                                        key={star}
                                        className={cn(
                                            "h-3 w-3",
                                            star <= item.rating ? "fill-amber-400 text-amber-400" : "text-slate-100"
                                        )}
                                    />
                                ))}
                            </div>
                        )}
                        <p className="text-sm text-slate-600 leading-relaxed italic px-1">
                            "{item.message}"
                        </p>
                    </div>

                    {/* Chat-style Replies */}
                    {item.replies && item.replies.length > 0 && (
                        <div className="space-y-4 pt-4 border-t border-slate-50">
                            {item.replies.map((reply, idx) => (
                                <div key={idx} className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex items-center gap-2 px-1">
                                        <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center">
                                            <User className="h-2.5 w-2.5 text-blue-600" />
                                        </div>
                                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1">
                                            {reply.senderRole} Reply
                                            <span className="h-1 w-1 rounded-full bg-blue-300" />
                                            {reply.createdAt?.toDate ? format(reply.createdAt.toDate(), 'p') : 'Just now'}
                                        </span>
                                    </div>
                                    <div className="bg-[#f0f4ff] p-3.5 rounded-2xl rounded-tl-none border border-blue-100/30 relative">
                                        <div className="absolute top-0 -left-1 w-2 h-2 bg-[#f0f4ff] border-l border-t border-blue-100/30 rotate-45 transform -translate-x-1/2" />
                                        <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                                            {reply.message}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Card>
        </motion.div>
    );

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60]">
            <MobileHeader />

            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] mt-2 overflow-hidden flex flex-col pt-8">
                <div className="px-6 mb-6">
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                        Feedback & Complaints
                    </h1>
                    <p className="text-slate-400 text-xs mt-1 font-medium">View and manage your submissions.</p>
                </div>

                <Tabs defaultValue="Feedback" className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 mb-4">
                        <TabsList className="w-full bg-slate-200/50 p-1 rounded-xl h-12">
                            <TabsTrigger
                                value="Feedback"
                                className="flex-1 rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all"
                            >
                                Feedback
                            </TabsTrigger>
                            <TabsTrigger
                                value="Complaint"
                                className="flex-1 rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-rose-500 data-[state=active]:shadow-sm transition-all"
                            >
                                Complaints
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 pb-[100px]">
                        <TabsContent value="Feedback" className="mt-0">
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-2xl mb-3" />)
                            ) : submissions.filter(s => s.type === 'Feedback').length > 0 ? (
                                submissions.filter(s => s.type === 'Feedback').map(renderCard)
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                                    <MessageSquareText className="h-12 w-12 mb-3 opacity-20" />
                                    <p className="text-sm font-medium">No feedback submitted yet.</p>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="Complaint" className="mt-0">
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-2xl mb-3" />)
                            ) : submissions.filter(s => s.type === 'Complaint').length > 0 ? (
                                submissions.filter(s => s.type === 'Complaint').map(renderCard)
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                                    <AlertCircle className="h-12 w-12 mb-3 opacity-20" />
                                    <p className="text-sm font-medium">No complaints submitted yet.</p>
                                </div>
                            )}
                        </TabsContent>
                    </div>
                </Tabs>
            </div>

            {/* Floating Action Button */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <Button
                        className="fixed bottom-24 right-6 h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-2xl active:scale-95 transition-all z-50 p-0"
                    >
                        <Plus className="h-7 w-7 text-white" />
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] rounded-[2.5rem] border-none p-0 overflow-hidden bg-slate-50">
                    <div className="p-8 space-y-6">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-black text-slate-800 text-center">New Submission</DialogTitle>
                        </DialogHeader>

                        {/* Type Toggle in Dialog */}
                        <div className="bg-slate-200/50 p-1.5 rounded-2xl flex gap-2">
                            <button
                                onClick={() => setType('Feedback')}
                                className={cn(
                                    "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                                    type === 'Feedback'
                                        ? "bg-white text-blue-600 shadow-md"
                                        : "text-slate-500"
                                )}
                            >
                                Feedback
                            </button>
                            <button
                                onClick={() => setType('Complaint')}
                                className={cn(
                                    "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                                    type === 'Complaint'
                                        ? "bg-white text-rose-500 shadow-md"
                                        : "text-slate-500"
                                )}
                            >
                                Complain
                            </button>
                        </div>

                        {/* Rating (Only for Feedback) */}
                        {type === 'Feedback' && (
                            <div className="text-center space-y-3">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rate our system</label>
                                <div className="flex justify-center gap-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <motion.button
                                            key={star}
                                            whileTap={{ scale: 0.8 }}
                                            onClick={() => setRating(star)}
                                        >
                                            <Star
                                                className={cn(
                                                    "h-8 w-8 transition-colors",
                                                    star <= rating
                                                        ? "fill-amber-400 text-amber-400"
                                                        : "text-slate-200"
                                                )}
                                            />
                                        </motion.button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {type === 'Feedback' ? 'Your Feedback' : 'Your Complaint'}
                            </label>
                            <Textarea
                                placeholder={type === 'Feedback' ? "Tell us what you think..." : "Describe the issue..."}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="min-h-[120px] rounded-2xl bg-white border-none shadow-inner p-4 focus:ring-0"
                            />
                        </div>

                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className={cn(
                                "w-full h-14 rounded-2xl font-bold text-base shadow-lg transition-all",
                                type === 'Feedback' ? "bg-blue-600 hover:bg-blue-700" : "bg-rose-500 hover:bg-rose-600"
                            )}
                        >
                            {isSubmitting ? "Submitting..." : `Submit ${type}`}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
