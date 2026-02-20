"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Lock, Unlock, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// 5 minutes by default
const TIMEOUT_MS = 5 * 60 * 1000;
const PIN_KEY = "sec_app_pin";

interface BinaryLockContextType {
    isLocked: boolean;
    lockApp: () => void;
    unlockApp: (pin: string) => boolean;
    setPin: (pin: string) => void;
    hasPin: boolean;
}

const BinaryLockContext = createContext<BinaryLockContextType | undefined>(undefined);

export const useBinaryLock = () => {
    const context = useContext(BinaryLockContext);
    if (!context) throw new Error("useBinaryLock must be used within BinaryLockProvider");
    return context;
};

export const BinaryLockProvider = ({ children }: { children: ReactNode }) => {
    const [isLocked, setIsLocked] = useState(false);
    const [hasPin, setHasPin] = useState(false);
    const [pinInput, setPinInput] = useState("");
    const pathname = usePathname();

    // Exclude login/public routes
    const isPublicRoute = pathname?.startsWith("/login") || pathname === "/";

    const checkPinStatus = useCallback(() => {
        if (typeof window !== "undefined") {
            const storedPin = localStorage.getItem(PIN_KEY);
            setHasPin(!!storedPin);
            return !!storedPin;
        }
        return false;
    }, []);

    const lockApp = useCallback(() => {
        if (checkPinStatus()) {
            setIsLocked(true);
            setPinInput(""); // Clear any previous input
        }
    }, [checkPinStatus]);

    const unlockApp = (pin: string) => {
        const storedPin = localStorage.getItem(PIN_KEY);
        if (storedPin && storedPin === pin) {
            setIsLocked(false);
            return true;
        }
        return false;
    };

    const setPin = (pin: string) => {
        localStorage.setItem(PIN_KEY, pin);
        setHasPin(true);
    };

    useEffect(() => {
        checkPinStatus();
    }, [checkPinStatus]);

    // Inactivity Timer
    useEffect(() => {
        if (isPublicRoute || isLocked || !hasPin) return;

        let timeoutId: NodeJS.Timeout;

        const resetTimer = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                lockApp();
            }, TIMEOUT_MS);
        };

        const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
        events.forEach((event) => document.addEventListener(event, resetTimer));

        resetTimer(); // Initialize

        return () => {
            clearTimeout(timeoutId);
            events.forEach((event) => document.removeEventListener(event, resetTimer));
        };
    }, [isPublicRoute, isLocked, hasPin, lockApp]);


    const handleUnlock = (e: React.FormEvent) => {
        e.preventDefault();
        if (!unlockApp(pinInput)) {
            alert("Incorrect PIN");
        }
    };

    if (isLocked && !isPublicRoute) {
        return (
            <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md">
                <div className="w-full max-w-sm p-8 space-y-6 bg-card rounded-xl shadow-2xl border">
                    <div className="flex flex-col items-center space-y-2">
                        <div className="p-4 bg-primary/10 rounded-full">
                            <Lock className="w-10 h-10 text-primary" />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight">App Locked</h2>
                        <p className="text-sm text-muted-foreground text-center">
                            Please enter your PIN to continue.
                        </p>
                    </div>

                    <form onSubmit={handleUnlock} className="space-y-4">
                        <div className="space-y-2">
                            <Input
                                type="password"
                                placeholder="Enter PIN"
                                value={pinInput}
                                onChange={(e) => setPinInput(e.target.value)}
                                className="text-center text-lg tracking-[0.5em] h-12"
                                maxLength={6}
                                autoFocus
                            />
                        </div>
                        <Button type="submit" className="w-full h-12 text-lg">
                            <Unlock className="w-5 h-5 mr-2" />
                            Unlock
                        </Button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <BinaryLockContext.Provider value={{ isLocked, lockApp, unlockApp, setPin, hasPin }}>
            {children}
        </BinaryLockContext.Provider>
    );
};
