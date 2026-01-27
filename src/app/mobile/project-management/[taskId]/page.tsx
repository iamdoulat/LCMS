"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, getDoc, collection, addDoc, query, orderBy, serverTimestamp, getDocs } from 'firebase/firestore';
import { uploadFile } from '@/lib/storage/storage';
import { firestore } from '@/lib/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { Task } from '@/types/projectManagement';
import { EmployeeDocument } from '@/types';
import { format } from 'date-fns';
import {
    ArrowLeft,
    Calendar,
    Clock,
    CheckCircle2,
    FileText,
    MessageSquare,
    Paperclip,
    Activity,
    Send,
    Building2,
    File,
    Loader2,
    MoreVertical,
    CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
    id: string;
    content: string;
    senderId: string;
    senderName: string;
    senderPhoto?: string;
    createdAt: any;
    attachmentUrl?: string;
    attachmentType?: 'image' | 'file';
    attachmentName?: string;
}

const TABS = [
    { id: 'discussions', label: 'Discussions', icon: MessageSquare },
    { id: 'media', label: 'Media', icon: Paperclip },
    { id: 'activity', label: 'Activity', icon: Activity },
];

export default function MobileTaskDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { taskId } = params;
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const [task, setTask] = useState<Task | null>(null);
    const [loading, setLoading] = useState(true);
    const [clientName, setClientName] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [currentEmployee, setCurrentEmployee] = useState<EmployeeDocument | null>(null);
    const [employeeCache, setEmployeeCache] = useState<Record<string, { name: string, photoURL?: string }>>({});
    const [activeTab, setActiveTab] = useState('discussions');

    useEffect(() => {
        if (!user?.uid) return;
        const fetchEmployees = async () => {
            try {
                const snap = await getDocs(collection(firestore, 'employees'));
                const cache: Record<string, any> = {};
                let current: EmployeeDocument | null = null;

                snap.docs.forEach(doc => {
                    const data = doc.data();
                    const fullName = data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown';
                    const code = data.employeeCode || doc.id;
                    const profile = {
                        name: fullName,
                        photoURL: data.photoURL || data.param?.photoURL
                    };
                    cache[code] = profile;
                    if (doc.id !== code) {
                        cache[doc.id] = profile;
                    }
                    if (data.uid === user.uid) {
                        current = { id: doc.id, ...data } as EmployeeDocument;
                    }
                });

                setEmployeeCache(cache);
                if (current) {
                    setCurrentEmployee(current);
                }
            } catch (error) {
                console.error("Error fetching employees:", error);
            }
        };
        fetchEmployees();
    }, [user?.uid]);

    useEffect(() => {
        if (!taskId) return;

        const unsubscribe = onSnapshot(doc(firestore, 'project_tasks', taskId as string), async (docSnap) => {
            if (docSnap.exists()) {
                const taskData = { id: docSnap.id, ...docSnap.data() } as Task;
                setTask(taskData);

                if (taskData.projectId) {
                    try {
                        const projectDoc = await getDoc(doc(firestore, 'projects', taskData.projectId));
                        if (projectDoc.exists()) {
                            setClientName(projectDoc.data().clientName || 'Unknown Client');
                        }
                    } catch (error) {
                        console.error("Error fetching client:", error);
                    }
                }
            }
            setLoading(false);
        });

        const q = query(collection(firestore, 'project_tasks', taskId as string, 'messages'), orderBy('createdAt', 'asc'));
        const unsubscribeMessages = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            setMessages(msgs);
        });

        return () => {
            unsubscribe();
            unsubscribeMessages();
        };
    }, [taskId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, activeTab]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!newMessage.trim() && !selectedFile) || !user || !taskId) return;

        setIsUploading(true);
        try {
            let attachmentUrl = '';
            let attachmentType: 'image' | 'file' | undefined;
            let attachmentName = '';

            if (selectedFile) {
                const path = `tasks/${taskId}/attachments/${Date.now()}_${selectedFile.name}`;
                attachmentUrl = await uploadFile(selectedFile, path);
                attachmentType = selectedFile.type.startsWith('image/') ? 'image' : 'file';
                attachmentName = selectedFile.name;
            }

            await addDoc(collection(firestore, 'project_tasks', taskId as string, 'messages'), {
                content: newMessage,
                senderId: currentEmployee?.employeeCode || user.uid,
                senderName: currentEmployee?.fullName || user.displayName || 'User',
                senderPhoto: currentEmployee?.photoURL || user.photoURL,
                createdAt: serverTimestamp(),
                ...(attachmentUrl && { attachmentUrl, attachmentType, attachmentName })
            });

            setNewMessage('');
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setIsUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col h-screen bg-[#0a1e60] items-center justify-center">
                <Loader2 className="h-8 w-8 text-white animate-spin mb-4" />
                <p className="text-white font-medium italic opacity-80">Loading task details...</p>
            </div>
        );
    }

    if (!task) {
        return (
            <div className="flex flex-col h-screen bg-[#0a1e60] items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-4">
                    <FileText className="h-10 w-10 text-white/50" />
                </div>
                <h2 className="text-white text-xl font-bold mb-2">Task Not Found</h2>
                <button
                    onClick={() => router.back()}
                    className="px-6 py-2 bg-white text-[#0a1e60] rounded-full font-bold"
                >
                    Go Back
                </button>
            </div>
        );
    }

    const priorityStyles = (priority: string) => {
        switch (priority) {
            case 'Urgency': return "bg-rose-500/10 text-rose-500 border-rose-500/20";
            case 'High': return "bg-orange-500/10 text-orange-500 border-orange-500/20";
            case 'Medium': return "bg-blue-500/10 text-blue-500 border-blue-500/20";
            default: return "bg-slate-500/10 text-slate-500 border-slate-500/20";
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-2 pb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => router.back()}
                        className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-white leading-tight line-clamp-1">{task.taskTitle}</h1>
                        <p className="text-white/60 text-xs font-medium">{task.taskId || 'NO-ID'}</p>
                    </div>
                </div>
                <button className="p-2 text-white/70 hover:text-white rounded-full">
                    <MoreVertical className="h-5 w-5" />
                </button>
            </div>

            {/* Main Content Card */}
            <div className="flex-1 bg-white rounded-t-[2.5rem] flex flex-col overflow-hidden shadow-2xl">
                <div className="overflow-y-auto no-scrollbar" ref={scrollRef}>
                    {/* Status & Progress Section */}
                    <div className="p-6 space-y-4">
                        <div className="flex flex-wrap gap-2">
                            <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border", priorityStyles(task.priority))}>
                                {task.priority}
                            </span>
                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-slate-100 text-slate-600 border-slate-200">
                                {task.status}
                            </span>
                            {task.completionPercentage === 100 && (
                                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-emerald-50 text-emerald-600 border-emerald-100 flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3" /> Completed
                                </span>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-xs font-bold text-slate-500">Task Completion</span>
                                <span className="text-xs font-black text-[#0a1e60]">{task.completionPercentage || 0}%</span>
                            </div>
                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${task.completionPercentage || 0}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className="h-full bg-emerald-500 rounded-full relative"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20" />
                                </motion.div>
                            </div>
                        </div>

                        {/* Quick Info Grid */}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Start Date</p>
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-3.5 w-3.5 text-blue-500" />
                                    <span className="text-xs font-black text-slate-700">
                                        {task.startDate ? format(new Date(task.startDate), 'dd MMM, yy') : 'N/A'}
                                    </span>
                                </div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Due Date</p>
                                <div className="flex items-center gap-2">
                                    <Clock className="h-3.5 w-3.5 text-rose-500" />
                                    <span className="text-xs font-black text-slate-700">
                                        {task.dueDate ? format(new Date(task.dueDate), 'dd MMM, yy') : 'N/A'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Project Info */}
                        <div className="p-4 bg-[#0a1e60]/5 rounded-[2rem] border border-[#0a1e60]/10 flex items-center gap-4">
                            <div className="h-12 w-12 bg-white rounded-2xl shadow-sm flex items-center justify-center">
                                <Building2 className="h-6 w-6 text-[#0a1e60]" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-[#0a1e60]/60 uppercase tracking-tighter">Client: {clientName || 'N/A'}</p>
                                <h3 className="text-sm font-black text-[#0a1e60] truncate">{task.projectTitle}</h3>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-black text-slate-800 px-1 flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5 text-blue-500" /> Description
                            </h4>
                            <div className="p-4 bg-slate-50 rounded-[1.5rem] border border-slate-100">
                                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                    {task.description || "No description provided."}
                                </p>
                            </div>
                        </div>

                        {/* Assigned Team */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-black text-slate-800 px-1">Assigned Team</h4>
                            <div className="flex -space-x-2 px-1">
                                {task.assignedUsers?.map((u, i) => (
                                    <div
                                        key={i}
                                        className="h-10 w-10 rounded-full border-4 border-white bg-slate-100 overflow-hidden shadow-sm"
                                        title={u.name}
                                    >
                                        {u.photoURL ? (
                                            <img src={u.photoURL} alt={u.name} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center text-xs font-black text-slate-400 uppercase">
                                                {u.name?.charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {(!task.assignedUsers || task.assignedUsers.length === 0) && (
                                    <p className="text-xs text-slate-400 font-bold italic">No users assigned</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tabs Section */}
                    <div className="sticky top-0 bg-white z-10 border-b border-slate-100">
                        <div className="flex px-6 pt-2">
                            {TABS.map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={cn(
                                            "flex-1 flex flex-col items-center gap-1.5 pb-3 transition-all relative",
                                            activeTab === tab.id ? "text-[#0a1e60]" : "text-slate-300"
                                        )}
                                    >
                                        <Icon className={cn("h-5 w-5", activeTab === tab.id ? "animate-bounce" : "")} />
                                        <span className="text-[10px] font-black uppercase tracking-tighter">{tab.label}</span>
                                        {activeTab === tab.id && (
                                            <motion.div
                                                layoutId="activeTabMobile"
                                                className="absolute bottom-0 left-2 right-2 h-1 bg-[#0a1e60] rounded-t-full"
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 bg-slate-50/50 min-h-[400px]">
                        {activeTab === 'discussions' && (
                            <div className="p-6 space-y-4 pb-32">
                                {messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                                        <div className="h-16 w-16 bg-white rounded-[2rem] shadow-sm flex items-center justify-center text-slate-200">
                                            <MessageSquare className="h-8 w-8" />
                                        </div>
                                        <div>
                                            <p className="text-slate-400 font-bold text-sm">No messages yet</p>
                                            <p className="text-slate-300 text-[10px]">Start a conversation about this task.</p>
                                        </div>
                                    </div>
                                ) : (
                                    messages.map((msg, idx) => {
                                        const isMe = msg.senderId === user?.uid || msg.senderId === currentEmployee?.employeeCode;
                                        return (
                                            <div key={msg.id} className={cn("flex gap-3", isMe ? "flex-row-reverse" : "flex-row")}>
                                                <div className="h-8 w-8 shrink-0 rounded-full bg-white border-2 border-slate-100 overflow-hidden shadow-sm">
                                                    <img
                                                        src={employeeCache[msg.senderId]?.photoURL || msg.senderPhoto}
                                                        alt=""
                                                        className="h-full w-full object-cover"
                                                        onError={(e) => (e.currentTarget.src = 'https://ui-avatars.com/api/?name=' + (employeeCache[msg.senderId]?.name || msg.senderName))}
                                                    />
                                                </div>
                                                <div className={cn("flex flex-col max-w-[75%]", isMe ? "items-end" : "items-start")}>
                                                    {!isMe && (
                                                        <span className="text-[10px] font-black text-slate-400 mb-1 ml-1">
                                                            {employeeCache[msg.senderId]?.name || msg.senderName}
                                                        </span>
                                                    )}
                                                    <div className={cn(
                                                        "p-3 rounded-2xl shadow-sm relative",
                                                        isMe
                                                            ? "bg-[#0a1e60] text-white rounded-tr-none"
                                                            : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"
                                                    )}>
                                                        <p className="text-xs font-bold leading-relaxed">{msg.content}</p>
                                                        {msg.attachmentUrl && (
                                                            <div className="mt-2 overflow-hidden rounded-xl border border-black/5 bg-black/5">
                                                                {msg.attachmentType === 'image' ? (
                                                                    <img src={msg.attachmentUrl} alt="Attachment" className="max-w-full h-auto" />
                                                                ) : (
                                                                    <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 hover:bg-black/5">
                                                                        <File className="h-4 w-4" />
                                                                        <span className="text-[10px] font-black underline truncate">{msg.attachmentName}</span>
                                                                    </a>
                                                                )}
                                                            </div>
                                                        )}
                                                        <p className={cn("text-[8px] font-bold mt-1 opacity-50 text-right uppercase tracking-widest")}>
                                                            {msg.createdAt ? format(msg.createdAt.toDate(), 'hh:mm a') : '...'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {activeTab === 'media' && (
                            <div className="p-6 grid grid-cols-3 gap-3 pb-32">
                                {messages.filter(m => m.attachmentUrl).length > 0 ? (
                                    messages.filter(m => m.attachmentUrl).map((msg) => (
                                        <div key={msg.id} className="aspect-square bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm shadow-black/[0.02]">
                                            {msg.attachmentType === 'image' ? (
                                                <img src={msg.attachmentUrl} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="h-full w-full flex flex-col items-center justify-center p-2 text-center gap-1">
                                                    <File className="h-6 w-6 text-blue-500" />
                                                    <span className="text-[8px] font-black text-slate-400 truncate w-full">{msg.attachmentName}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-3 flex flex-col items-center justify-center py-20 text-center space-y-3">
                                        <div className="h-16 w-16 bg-white rounded-[2rem] shadow-sm flex items-center justify-center text-slate-200">
                                            <Paperclip className="h-8 w-8" />
                                        </div>
                                        <p className="text-slate-400 font-bold text-sm">No media found</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'activity' && (
                            <div className="p-6 space-y-6 pb-32">
                                <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                                    <div className="relative">
                                        <div className="absolute -left-[23px] top-1.5 h-3.5 w-3.5 rounded-full bg-blue-500 border-4 border-white ring-1 ring-slate-100" />
                                        <div>
                                            <p className="text-xs font-bold text-slate-700">Task Created</p>
                                            <p className="text-[10px] font-medium text-slate-400 italic">
                                                {task.createdAt ? format(task.createdAt.toDate(), 'PPP hh:mm a') : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Message Input - Only for Discussions Tab */}
                {activeTab === 'discussions' && (
                    <div className="p-4 bg-white border-t border-slate-100 safe-area-bottom">
                        {selectedFile && (
                            <div className="mb-3 p-2 bg-blue-50 rounded-2xl flex items-center justify-between border border-blue-100 animate-in slide-in-from-bottom-2">
                                <div className="flex items-center gap-2 px-1">
                                    <div className="h-8 w-8 bg-blue-500 rounded-xl flex items-center justify-center text-white shrink-0">
                                        <Paperclip className="h-4 w-4" />
                                    </div>
                                    <span className="text-xs font-black text-blue-700 truncate max-w-[200px]">{selectedFile.name}</span>
                                </div>
                                <button
                                    onClick={() => setSelectedFile(null)}
                                    className="h-8 w-8 flex items-center justify-center text-blue-400 hover:text-blue-600 font-black text-lg"
                                >
                                    &times;
                                </button>
                            </div>
                        )}
                        <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="h-12 w-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 active:scale-90 transition-transform"
                            >
                                <Paperclip className="h-5 w-5" />
                            </button>
                            <div className="flex-1 bg-slate-50 border border-slate-100 rounded-[1.5rem] px-4 py-3 min-h-[48px] max-h-32 overflow-y-auto">
                                <textarea
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Text your message..."
                                    rows={1}
                                    className="w-full bg-transparent border-none focus:ring-0 text-base font-bold text-slate-700 placeholder:text-slate-300 resize-none no-scrollbar"
                                    onInput={(e) => {
                                        const target = e.target as HTMLTextAreaElement;
                                        target.style.height = 'auto';
                                        target.style.height = target.scrollHeight + 'px';
                                    }}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={(!newMessage.trim() && !selectedFile) || isUploading}
                                className={cn(
                                    "h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200 transition-all active:scale-90",
                                    (!newMessage.trim() && !selectedFile) || isUploading
                                        ? "bg-slate-200 shadow-none pointer-events-none"
                                        : "bg-blue-600"
                                )}
                            >
                                {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                            </button>
                        </form>
                    </div>
                )}
            </div>

            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .safe-area-bottom {
                    padding-bottom: calc(1rem + env(safe-area-inset-bottom));
                    margin-bottom: 100px;
                }
            `}</style>
        </div>
    );
}
