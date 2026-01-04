"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Construction, Rocket, Sparkles, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ProjectManagementComingSoon() {
    const router = useRouter();

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden relative">
            {/* Animated Background Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[100px] animate-pulse [animation-delay:1s]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.05)_0%,transparent_70%)]" />

            {/* Header */}
            <div className="p-4 flex items-center gap-4 relative z-10">
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/10 rounded-full h-12 w-12"
                    onClick={() => router.back()}
                >
                    <ChevronLeft className="h-6 w-6" />
                </Button>
                <h1 className="text-xl font-bold text-white">Project Management</h1>
            </div>

            {/* Main Content */}
            <div className="flex-1 bg-white rounded-t-[2.5rem] mt-2 relative z-10 p-8 flex flex-col items-center justify-center text-center">
                <div className="relative mb-12">
                    {/* Animated Icon Container */}
                    <div className="relative z-20 bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[2.5rem] shadow-2xl shadow-blue-200 animate-bounce [animation-duration:3s]">
                        <Construction className="h-20 w-20 text-white" />

                        {/* Floating elements */}
                        <div className="absolute -top-4 -right-4 bg-amber-400 p-3 rounded-2xl shadow-lg border-4 border-white animate-spin-slow">
                            <Sparkles className="h-6 w-6 text-white" />
                        </div>
                        <div className="absolute -bottom-2 -left-6 bg-emerald-500 p-3 rounded-2xl shadow-lg border-4 border-white animate-bounce [animation-duration:2s]">
                            <Rocket className="h-6 w-6 text-white" />
                        </div>
                    </div>

                    {/* Orbiting Ring */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-dashed border-blue-100 rounded-full animate-spin-slow" />
                </div>

                <div className="space-y-6 max-w-sm">
                    <div className="space-y-2">
                        <h2 className="text-3xl font-black text-[#0a1e60] tracking-tight">
                            Coming <span className="text-blue-600">Soon!</span>
                        </h2>
                        <p className="text-slate-500 font-medium text-lg leading-relaxed">
                            Something <span className="text-blue-600 font-bold">Amazing</span> is in the works. We're building the future of project tracking.
                        </p>
                    </div>

                    {/* Progress indicator */}
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden relative group">
                        <div className="absolute inset-0 bg-blue-600 w-2/3 rounded-full animate-pulse transition-all duration-1000 group-hover:w-3/4" />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-2/3 animate-[shimmer_2s_infinite]" />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
                        <Timer className="h-4 w-4" /> Implementation in Progress
                    </p>
                </div>

                <div className="absolute bottom-12 w-full px-8 flex flex-col gap-4">
                    <Button
                        className="w-full h-15 rounded-2xl bg-[#0a1e60] hover:bg-[#0a1e60]/90 text-white font-bold text-lg shadow-xl shadow-blue-900/10 transition-transform active:scale-95"
                        onClick={() => router.back()}
                    >
                        Go Back to Dashboard
                    </Button>
                </div>
            </div>

            <style jsx global>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .animate-spin-slow {
                    animation: spin 8s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slower {
                    animation: spin 12s linear infinite;
                }
            `}</style>
        </div>
    );
}
