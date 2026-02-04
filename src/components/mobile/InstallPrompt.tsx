"use client";

import { useState, useEffect, useCallback } from 'react';
import { X, Share, PlusSquare, ArrowUp, LayoutGrid } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function InstallPrompt() {
    const { companyName } = useAuth();
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [platform, setPlatform] = useState<'ios' | 'android' | 'other' | null>(null);
    const [isStandalone, setIsStandalone] = useState(false);

    const checkInstallation = useCallback(() => {
        if (typeof window === 'undefined') return false;

        const isStandaloneMatch = window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as any).standalone
            || document.referrer.includes('android-app://');

        console.log("[PWA] Standalone Check:", isStandaloneMatch);
        setIsStandalone(isStandaloneMatch);
        return isStandaloneMatch;
    }, []);

    const shouldShowPrompt = useCallback(() => {
        if (checkInstallation()) {
            console.log("[PWA] Suppression: Already installed/standalone.");
            return false;
        }

        // "Immediate" logic: If haven't shown this session, show immediately
        const sessionShown = sessionStorage.getItem('pwa_install_session_shown');
        if (!sessionShown) {
            console.log("[PWA] Session priority: Allowing immediate show");
            return true;
        }

        const lastShown = localStorage.getItem('pwa_install_last_shown');
        if (!lastShown) return true;

        const now = Date.now();
        const tenMinutes = 10 * 60 * 1000;
        const timeSinceLast = now - parseInt(lastShown);

        if (timeSinceLast < tenMinutes) {
            console.log(`[PWA] Suppression: Recurring limit. Next show in ${Math.ceil((tenMinutes - timeSinceLast) / 1000)}s.`);
            return false;
        }

        return true;
    }, [checkInstallation]);

    const triggerPrompt = useCallback(() => {
        if (shouldShowPrompt()) {
            console.log("[PWA] Prompt UI triggered");
            setShowPrompt(true);
            sessionStorage.setItem('pwa_install_session_shown', 'true');
            localStorage.setItem('pwa_install_last_shown', Date.now().toString());
        }
    }, [shouldShowPrompt]);

    // Handle initial setup and event listeners
    useEffect(() => {
        const ua = window.navigator.userAgent;
        const isIOSMatch = /iPhone|iPad|iPod/.test(ua) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isAndroidMatch = /Android/i.test(ua);

        setPlatform(isIOSMatch ? 'ios' : (isAndroidMatch ? 'android' : 'other'));
        console.log("[PWA] Browser Platform:", isAndroidMatch ? 'Android' : (isIOSMatch ? 'iOS' : 'Other'));

        const handler = (e: any) => {
            console.log("[PWA] beforeinstallprompt event fired!");
            e.preventDefault();
            setDeferredPrompt(e);
            // standardized trigger to handle session/localStorage flags
            triggerPrompt();
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Initial check for all platforms
        const timer = setTimeout(() => {
            triggerPrompt();
        }, 1200);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            clearTimeout(timer);
        };
    }, [triggerPrompt]);

    // Background interval for 10-minute recurrence
    useEffect(() => {
        const interval = setInterval(() => {
            if (!showPrompt && !isStandalone) {
                console.log("[PWA] Interval check for recurrence...");
                triggerPrompt();
            }
        }, 30000); // 30s interval for better responsiveness

        return () => clearInterval(interval);
    }, [showPrompt, isStandalone, triggerPrompt]);

    const handleInstall = async () => {
        console.log("[PWA] handleInstall clicked, platform:", platform, "hasDeferredPrompt:", !!deferredPrompt);

        if (platform === 'android' || platform === 'other') {
            if (deferredPrompt) {
                // Show the install prompt
                deferredPrompt.prompt();
                // Wait for the user to respond to the prompt
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`[PWA] User response to the install prompt: ${outcome}`);
                if (outcome === 'accepted') {
                    setDeferredPrompt(null);
                    setShowPrompt(false);
                }
            } else {
                console.warn("[PWA] No deferredPrompt available for Android install");
                // Optional: Show a message to user that the browser/device doesn't support direct install
                // or tell them to look for "Install app" in browser menu
            }
        } else if (platform === 'ios') {
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: companyName || 'LCMS',
                        text: `Install ${companyName || 'LCMS'} App to your home screen`,
                        url: window.location.origin,
                    });
                } catch (err) {
                    console.log('[PWA] Share failed or cancelled', err);
                }
            }
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        // We still keep the timestamp to ensure the 10-minute interval
    };

    if (!showPrompt || isStandalone) return null;

    return (
        <div className="fixed inset-x-4 bottom-24 z-[100] animate-in slide-in-from-bottom-8 duration-500">
            <div className="bg-[#1a2b6d] border border-white/10 rounded-2xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
                {/* Background Decoration */}
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl text-white" />

                <button
                    onClick={handleDismiss}
                    className="absolute top-3 right-3 p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    aria-label="Dismiss"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3">
                        <LayoutGrid className="text-white w-8 h-8" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-white font-bold text-lg leading-tight uppercase tracking-tight">
                            Install {companyName || 'LCMS'} APP
                        </h3>
                        <p className="text-blue-100/70 text-xs font-medium uppercase tracking-widest mt-0.5">
                            Native App Experience
                        </p>
                    </div>
                </div>

                {platform === 'ios' ? (
                    <div className="space-y-4">
                        <p className="text-sm text-blue-50/90 leading-relaxed font-medium">
                            To install as an app on your iPhone:
                        </p>
                        <div className="bg-white/5 rounded-xl p-4 space-y-3 border border-white/5">
                            <div className="flex items-center gap-3 text-sm text-white">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                    <Share className="w-4 h-4 text-blue-400" />
                                </div>
                                <span>Tap the <strong className="text-blue-400">Share</strong> button below</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-white">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                    <PlusSquare className="w-4 h-4 text-blue-400" />
                                </div>
                                <span>Select <strong className="text-blue-400 cursor-pointer underline" onClick={handleInstall}>Add to Home Screen</strong></span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            <button
                                onClick={handleInstall}
                                className="w-full bg-white text-blue-900 font-bold py-3.5 px-6 rounded-xl shadow-xl hover:bg-blue-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                <Share className="w-5 h-5 text-blue-600" />
                                Add to Home Screen
                            </button>
                        </div>

                        <div className="flex justify-center pt-1">
                            <div className="animate-bounce">
                                <ArrowUp className="w-6 h-6 text-blue-400" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-sm text-blue-50/90 leading-relaxed font-medium">
                            Experience faster access, and native notifications.
                        </p>
                        <button
                            onClick={handleInstall}
                            className="w-full bg-white text-blue-900 font-bold py-3.5 px-6 rounded-xl shadow-xl hover:bg-blue-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <PlusSquare className="w-5 h-5 text-blue-600" />
                            Install Now
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
