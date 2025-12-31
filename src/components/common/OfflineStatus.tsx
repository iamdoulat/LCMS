"use client";

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
// Import the animation JSON directly
import animationData from '../../../public/animations/no_internet_connection.json';

// Dynamic import for Lottie to disable SSR
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

export default function OfflineStatus() {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        // Handle hydration mismatch safely
        if (typeof window !== 'undefined') {
            setIsOnline(navigator.onLine);
        }

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Don't render anything if online
    if (isOnline) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center p-6 transition-all duration-300">
            <div className="w-full max-w-md aspect-square flex items-center justify-center">
                <Lottie
                    animationData={animationData}
                    loop={true}
                    autoplay={true}
                    style={{ width: '100%', height: '100%' }}
                />
            </div>
            <form className="mt-8 text-center" onSubmit={(e) => { e.preventDefault(); window.location.reload(); }}>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">No Internet</h2>
                <p className="text-slate-500 mb-6">Your device is disconnected from the internet.</p>
                <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium active:scale-95 transition-transform"
                >
                    Try Again
                </button>
            </form>
        </div>
    );
}
