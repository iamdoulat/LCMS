"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import Image from 'next/image';

interface MobileSplashScreenProps {
    message?: string;
}

export function MobileSplashScreen({ message = "Loading..." }: MobileSplashScreenProps) {
    const [branding, setBranding] = useState<{ name: string; logo: string }>({
        name: 'NextSew',
        logo: '/icons/icon-192x192.png'
    });

    useEffect(() => {
        const loadBranding = async () => {
            // 1. Try localStorage first (fastest)
            if (typeof window !== 'undefined') {
                const cachedName = localStorage.getItem('appCompanyName');
                const cachedLogo = localStorage.getItem('appCompanyLogoUrl');
                if (cachedName && cachedLogo) {
                    setBranding({ name: cachedName, logo: cachedLogo });
                    return;
                }
            }

            // 2. Fallback to Firestore
            try {
                const docRef = doc(firestore, 'financial_settings', 'main_settings');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const newBranding = {
                        name: data.companyName || 'NextSew',
                        logo: data.companyLogoUrl || '/icons/icon-192x192.png'
                    };
                    setBranding(newBranding);

                    // Cache for next time
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('appCompanyName', newBranding.name);
                        localStorage.setItem('appCompanyLogoUrl', newBranding.logo);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch branding in splash screen:", err);
            }
        };

        loadBranding();
    }, []);

    return (
        <div className="fixed inset-0 z-[9999] bg-[#0a1e60] flex flex-col items-center justify-center p-6 select-none touch-none">
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                    duration: 0.8,
                    ease: [0, 0.71, 0.2, 1.01]
                }}
                className="flex flex-col items-center gap-8"
            >
                {/* Logo Container */}
                <div className="relative w-32 h-32 rounded-3xl bg-white/10 backdrop-blur-md p-6 shadow-2xl overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50" />
                    <div className="relative w-full h-full">
                        <Image
                            src={branding.logo}
                            alt="Logo"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>
                </div>

                {/* Text Branding */}
                <div className="text-center space-y-2">
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.6 }}
                        className="text-3xl font-bold text-white tracking-tight"
                    >
                        {branding.name}
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5, duration: 0.6 }}
                        className="text-blue-200/60 text-sm font-medium uppercase tracking-widest"
                    >
                        Indent & LC Management
                    </motion.p>
                </div>

                {/* Loading Indicator */}
                <div className="mt-12 flex flex-col items-center gap-4">
                    <div className="flex gap-2">
                        {[0, 1, 2].map((i) => (
                            <motion.div
                                key={i}
                                animate={{
                                    scale: [1, 1.5, 1],
                                    opacity: [0.3, 1, 0.3]
                                }}
                                transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                    delay: i * 0.2
                                }}
                                className="w-2.5 h-2.5 bg-blue-400 rounded-full"
                            />
                        ))}
                    </div>
                    <span className="text-blue-200/40 text-[10px] font-bold uppercase tracking-wider">{message}</span>
                </div>
            </motion.div>

            {/* Subtle background decoration */}
            <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>
    );
}
