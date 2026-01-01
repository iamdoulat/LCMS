"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Settings,
    List,
    Factory,
    Cpu,
    FileSpreadsheet,
    History,
    Check,
    X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

interface Module {
    id: string;
    label: string;
    icon: any;
    color: string;
    bgColor: string;
    description: string;
    href: string;
}

const ALL_MODULES: Module[] = [
    {
        id: 'demo_list',
        label: 'Demo List',
        icon: List,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        description: 'View all demo machines',
        href: '/mobile/service/demo-list'
    },
    {
        id: 'factories_list',
        label: 'Factories List',
        icon: Factory,
        color: 'text-rose-600',
        bgColor: 'bg-rose-50',
        description: 'Factory directory for demos',
        href: '/mobile/service/factories-list'
    },
    {
        id: 'machine_program',
        label: 'Machine Program',
        icon: Cpu,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        description: 'Track machine programming',
        href: '/mobile/service/machine-program'
    },
    {
        id: 'demo_challan',
        label: 'Demo Challan',
        icon: FileSpreadsheet,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        description: 'Manage demo challans',
        href: '/mobile/service/demo-challan'
    },
];

const STORAGE_KEY = 'demo_modules_visibility';

export function DemoModules() {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [visibleModules, setVisibleModules] = useState<string[]>(ALL_MODULES.map(m => m.id));
    const [isLoaded, setIsLoaded] = useState(false);

    // Load visibility settings from localStorage
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setVisibleModules(JSON.parse(stored));
            } catch (e) {
                console.error("Error parsing demo module visibility:", e);
            }
        }
        setIsLoaded(true);
    }, []);

    // Save visibility settings to localStorage
    const toggleModule = (id: string) => {
        const next = visibleModules.includes(id)
            ? visibleModules.filter(m => m !== id)
            : [...visibleModules, id];

        setVisibleModules(next);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    };

    const modulesToShow = ALL_MODULES.filter(m => visibleModules.includes(m.id));

    if (!isLoaded) return null;

    return (
        <div className="w-full mt-4">
            <div className="flex justify-between items-center px-2 mb-4">
                <div className="flex flex-col">
                    <h2 className="text-lg font-black text-[#0a1e60] uppercase tracking-tight flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                        Demo M/C Modules
                    </h2>
                </div>
                <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-2 bg-blue-50 text-blue-600 rounded-xl active:scale-95 transition-all"
                >
                    <Settings className="h-5 w-5" />
                </button>
            </div>

            {/* Horizontal Scroll Area */}
            <div className="overflow-x-auto pb-4 scrollbar-hide px-2 touch-pan-x">
                <div className="flex gap-4 min-w-max">
                    <AnimatePresence mode="popLayout">
                        {modulesToShow.map((module) => (
                            <Link key={module.id} href={module.href}>
                                <motion.div
                                    layout
                                    initial={{ opacity: 0, scale: 0.8, x: 20 }}
                                    animate={{ opacity: 1, scale: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.8, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                    className={cn(
                                        "w-[140px] h-[160px] p-4 rounded-[2.5rem] flex flex-col justify-between shadow-sm border border-slate-100/50 relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 active:scale-95 cursor-pointer",
                                        module.bgColor
                                    )}
                                >
                                    {/* Glow Effect */}
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-white/40 rounded-full -mr-8 -mt-8 blur-xl" />

                                    <div className="z-10 bg-white p-5 rounded-[2rem] w-fit shadow-[0_12px_24px_rgb(0,0,0,0.1)] border border-white/50 self-center mt-2">
                                        <module.icon className={cn("h-10 w-10", module.color)} />
                                    </div>

                                    <div className="z-10 w-full text-center">
                                        <h3 className="font-bold text-slate-700 text-xs leading-tight mb-2">
                                            {module.label}
                                        </h3>
                                    </div>
                                </motion.div>
                            </Link>
                        ))}
                    </AnimatePresence>

                    {modulesToShow.length === 0 && (
                        <div className="w-full py-10 flex flex-col items-center justify-center text-slate-400 gap-2 italic">
                            <p className="text-sm px-10 text-center">No modules selected. Use the gear icon to enable them.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Settings Sheet */}
            <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <SheetContent side="bottom" className="rounded-t-[2.5rem] p-8 max-h-[80vh] overflow-y-auto">
                    <SheetHeader className="mb-6 text-left">
                        <SheetTitle className="text-xl font-bold flex items-center gap-2">
                            Demo Module Settings
                        </SheetTitle>
                        <p className="text-sm text-slate-500 mt-1">Select which demo modules to display.</p>
                    </SheetHeader>

                    <div className="space-y-4">
                        {ALL_MODULES.map((module) => (
                            <div key={module.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex items-center gap-4">
                                    <div className={cn("p-2.5 rounded-xl", module.bgColor)}>
                                        <module.icon className={cn("h-5 w-5", module.color)} />
                                    </div>
                                    <div>
                                        <Label className="text-sm font-bold block mb-0.5">{module.label}</Label>
                                        <p className="text-[10px] text-slate-500 font-medium">{module.description}</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={visibleModules.includes(module.id)}
                                    onCheckedChange={() => toggleModule(module.id)}
                                />
                            </div>
                        ))}
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
