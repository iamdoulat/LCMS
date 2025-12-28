"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, QrCode } from 'lucide-react';

export default function QRCodePage() {
    const router = useRouter();

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center px-4 pt-1 pb-6">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full active:bg-white/10 transition-colors text-white"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold text-white ml-2">QR Code</h1>
                </div>
            </div>

            {/* Content Container */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto overscroll-contain flex flex-col items-center justify-center px-6">
                <div className="bg-white p-8 rounded-[2rem] shadow-sm flex flex-col items-center text-center max-w-sm w-full">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                        <QrCode className="h-10 w-10 text-blue-600 animate-pulse" />
                    </div>

                    <h2 className="text-2xl font-bold text-[#0a1e60] mb-3">
                        Coming Soon
                    </h2>

                    <p className="text-slate-500 leading-relaxed">
                        We are working hard to bring the QR Code features to your mobile device. Stay tuned!
                    </p>

                    <div className="mt-8 flex gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                </div>

                {/* Bottom Spacer */}
                <div className="h-24" />
            </div>
        </div>
    );
}
