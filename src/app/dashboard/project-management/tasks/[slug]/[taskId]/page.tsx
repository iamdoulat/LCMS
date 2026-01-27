"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, getDoc, collection, addDoc, query, orderBy, serverTimestamp, where, getDocs } from 'firebase/firestore';
import { uploadFile } from '@/lib/storage/storage';
import { getAuth } from 'firebase/auth';
import { firestore } from '@/lib/firebase/config';
import { Task } from '@/types/projectManagement';
import { EmployeeDocument } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';
import { ArrowLeft, Calendar, User, Clock, CheckCircle2, FileText, MessageSquare, Paperclip, Activity, Send, Building2, Image as ImageIcon, File } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRef } from 'react';

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

export default function TaskDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { taskId } = params;
    const auth = getAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [task, setTask] = useState<Task | null>(null);
    const [loading, setLoading] = useState(true);
    const [clientName, setClientName] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [user, setUser] = useState(auth.currentUser);
    const [currentEmployee, setCurrentEmployee] = useState<EmployeeDocument | null>(null);
    const [employeeCache, setEmployeeCache] = useState<Record<string, { name: string, photoURL?: string }>>({});

    useEffect(() => {
        const unsubscribeAuth = auth.onAuthStateChanged((u) => {
            setUser(u);
        });
        return () => unsubscribeAuth();
    }, []);

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

                // Fetch Client Name if projectId exists
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
            } else {
                // Handle not found
            }
            setLoading(false);
        });

        // Fetch Messages
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
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (!task) {
        return <div className="p-8 text-center">Task not found</div>;
    }

    const formatPercentage = (val?: number) => val ? `${val}%` : '0%';

    return (
        <div className="p-6 pb-[120px] md:pb-6 bg-slate-50/50 min-h-screen space-y-6">
            {/* Header / Nav */}
            <div className="flex items-center gap-4 mb-4">
                <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{task.taskTitle}</h1>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Badge variant="outline" className="font-mono text-xs">{task.taskId || 'NO-ID'}</Badge>
                        <span>&bull;</span>
                        <span>{task.projectTitle}</span>
                    </div>
                </div>
            </div>

            {/* Status Bar */}
            <div className="bg-white rounded-lg border p-4 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <span className="font-medium flex items-center gap-2">
                        {task.completionPercentage === 100 ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : (
                            <Activity className="h-5 w-5 text-blue-500" />
                        )}
                        Completion Percentage : {formatPercentage(task.completionPercentage)}
                    </span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 transition-all duration-1000"
                        style={{ width: `${task.completionPercentage || 0}%` }}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
                    <div>
                        <span className="text-xs text-muted-foreground block mb-1">Users</span>
                        <div className="flex -space-x-2">
                            {task.assignedUsers?.map((u, i) => (
                                <Avatar key={i} className="h-8 w-8 border-2 border-white">
                                    <AvatarImage src={u.photoURL} />
                                    <AvatarFallback className="text-xs">{u.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                            ))}
                            {(!task.assignedUsers || task.assignedUsers.length === 0) && <span className="text-sm">-</span>}
                        </div>
                    </div>
                    <div>
                        <span className="text-xs text-muted-foreground block mb-1">Priority</span>
                        <Badge variant={task.priority === 'Urgency' ? 'destructive' : 'secondary'} className="capitalize">
                            {task.priority}
                        </Badge>
                    </div>
                    <div>
                        <span className="text-xs text-muted-foreground block mb-1">Status</span>
                        <Badge variant="outline" className="capitalize bg-slate-50">
                            {task.status}
                        </Badge>
                    </div>
                </div>
            </div>

            {/* Detailed Info Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Info */}
                <div className="lg:col-span-3 space-y-6">
                    <Card>
                        <CardHeader className="pb-3 border-b bg-slate-50/40 flex flex-row items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2 text-blue-600">
                                <FileText className="h-4 w-4" /> Project
                            </CardTitle>
                            {clientName && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-white px-3 py-1.5 rounded-full border shadow-sm">
                                    <Building2 className="h-3.5 w-3.5" />
                                    <span className="font-medium text-slate-700">{clientName}</span>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="pt-4">
                            <h3 className="text-lg font-semibold text-blue-600 mb-4">{task.projectTitle}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-emerald-500 shadow-sm">
                                        <Calendar className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Starts At</p>
                                        <p className="font-medium text-sm">{task.startDate ? format(new Date(task.startDate), 'dd-MM-yyyy') : 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-red-500 shadow-sm">
                                        <Calendar className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Ends At</p>
                                        <p className="font-medium text-sm">{task.dueDate ? format(new Date(task.dueDate), 'dd-MM-yyyy') : 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-blue-500 shadow-sm">
                                        <Clock className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Duration</p>
                                        <p className="font-medium text-sm">
                                            {task.startDate && task.dueDate
                                                ? Math.ceil((new Date(task.dueDate).getTime() - new Date(task.startDate).getTime()) / (1000 * 60 * 60 * 24)) + ' days'
                                                : '-'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6">
                                <h4 className="text-sm font-medium mb-2 text-slate-700">Description</h4>
                                <div className="text-sm text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-100 min-h-[100px]">
                                    {task.description || "No description provided."}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-0">
                            <Tabs defaultValue="discussions" className="w-full">
                                <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-12">
                                    <TabsTrigger value="discussions" className="h-full rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent">
                                        <MessageSquare className="h-4 w-4 mr-2" /> Discussions
                                    </TabsTrigger>
                                    <TabsTrigger value="media" className="h-full rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent">
                                        <Paperclip className="h-4 w-4 mr-2" /> Media
                                    </TabsTrigger>
                                    <TabsTrigger value="activity" className="h-full rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent">
                                        <Activity className="h-4 w-4 mr-2" /> Activity Log
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="discussions" className="p-0">
                                    <div className="flex flex-col h-[500px]">
                                        <ScrollArea className="flex-1 p-4">
                                            <div className="space-y-4">
                                                {messages.length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                                                        <MessageSquare className="h-10 w-10 mb-2 opacity-20" />
                                                        <p>No messages yet. Start the discussion!</p>
                                                    </div>
                                                ) : (
                                                    messages.map((msg) => {
                                                        const isMe = msg.senderId === user?.uid || msg.senderId === currentEmployee?.employeeCode;
                                                        return (
                                                            <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                                                <Avatar className="h-8 w-8 mt-1 border border-slate-200">
                                                                    <AvatarImage src={employeeCache[msg.senderId]?.photoURL || msg.senderPhoto} />
                                                                    <AvatarFallback>{(employeeCache[msg.senderId]?.name || msg.senderName)?.charAt(0)}</AvatarFallback>
                                                                </Avatar>
                                                                <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span className="text-xs font-semibold text-slate-700">{employeeCache[msg.senderId]?.name || msg.senderName}</span>
                                                                        <span className="text-[10px] text-muted-foreground">
                                                                            {msg.createdAt ? format(msg.createdAt.toDate(), 'p') : 'Sending...'}
                                                                        </span>
                                                                    </div>
                                                                    <div className={`p-3 rounded-2xl text-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none'}`}>
                                                                        {msg.content}
                                                                        {msg.attachmentUrl && (
                                                                            <div className="mt-2">
                                                                                {msg.attachmentType === 'image' ? (
                                                                                    <img src={msg.attachmentUrl} alt="Attachment" className="max-w-full rounded-lg border border-white/20" style={{ maxHeight: '200px' }} />
                                                                                ) : (
                                                                                    <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                                                                                        <File className="h-4 w-4" />
                                                                                        <span className="underline truncate max-w-[150px]">{msg.attachmentName || 'Attachment'}</span>
                                                                                    </a>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </ScrollArea>
                                        <div className="p-4 border-t bg-slate-50/30">
                                            {selectedFile && (
                                                <div className="mb-2 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs rounded-full flex items-center justify-between w-fit">
                                                    <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" /> {selectedFile.name}</span>
                                                    <button onClick={() => setSelectedFile(null)} className="ml-2 hover:text-blue-900">&times;</button>
                                                </div>
                                            )}
                                            <form onSubmit={handleSendMessage} className="flex gap-2">
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    className="hidden"
                                                    onChange={handleFileSelect}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="shrink-0"
                                                >
                                                    <Paperclip className="h-4 w-4 text-slate-500" />
                                                </Button>
                                                <Input
                                                    value={newMessage}
                                                    onChange={(e) => setNewMessage(e.target.value)}
                                                    placeholder="Type your message..."
                                                    className="flex-1 bg-white"
                                                />
                                                <Button type="submit" size="icon" disabled={(!newMessage.trim() && !selectedFile) || isUploading} className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white">
                                                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                                </Button>
                                            </form>
                                        </div>
                                    </div>
                                </TabsContent>
                                <TabsContent value="media" className="p-6">
                                    <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
                                        <Paperclip className="h-10 w-10 mb-2 opacity-20" />
                                        <p>No attachments found</p>
                                    </div>
                                </TabsContent>
                                <TabsContent value="activity" className="p-6">
                                    <div className="space-y-4">
                                        <div className="flex gap-3">
                                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">SY</div>
                                            <div>
                                                <p className="text-sm text-slate-800"><span className="font-semibold">System</span> created this task</p>
                                                <p className="text-xs text-muted-foreground">{task.createdAt ? format(task.createdAt.toDate(), "PPP p") : ''}</p>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
