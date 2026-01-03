"use client";

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        const handler = (e: Event) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later
            setDeferredPrompt(e);
            // Show custom install UI after a delay (don't be intrusive)
            setTimeout(() => {
                const hasSeenPrompt = localStorage.getItem('pwa_install_dismissed');
                if (!hasSeenPrompt) {
                    setShowPrompt(true);
                }
            }, 3000);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;

        // Clear the deferred prompt
        setDeferredPrompt(null);
        setShowPrompt(false);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('pwa_install_dismissed', 'true');
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-20 left-4 right-4 z-50 animate-slideUp">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-4 shadow-2xl">
                <button
                    onClick={handleDismiss}
                    className="absolute top-2 right-2 text-white/80 hover:text-white"
                    aria-label="Dismiss"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">📱</span>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-white font-bold text-base mb-1">
                            Install NextSew App
                        </h3>
                        <p className="text-white/90 text-sm">
                            Install to your home screen for quick access
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleInstall}
                    className="w-full bg-white text-blue-600 font-semibold py-2.5 px-4 rounded-lg hover:bg-blue-50 transition-colors active:scale-98"
                >
                    Install App
                </button>
            </div>
        </div>
    );
}
