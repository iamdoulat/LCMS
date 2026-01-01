"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Laptop, Search, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { SummaryStats } from '@/components/mobile/service/SummaryStats';

export default function ServicePage() {
    const router = useRouter();
    const [searchType, setSearchType] = React.useState<'warranty' | 'demo'>('warranty');
    const [searchTerm, setSearchTerm] = React.useState('');
    const [direction, setDirection] = React.useState(0);

    const handleTypeChange = (newType: 'warranty' | 'demo') => {
        if (newType === searchType) return;
        setDirection(newType === 'demo' ? 1 : -1);
        setSearchType(newType);
        setSearchTerm('');
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm.trim()) return;
        const targetPath = searchType === 'demo' ? '/mobile/service/demo-results' : '/mobile/service/warranty-results';
        router.push(`${targetPath}?q=${encodeURIComponent(searchTerm.trim())}&type=${searchType}`);
    };

    const variants = {
        enter: (dir: number) => ({
            x: dir > 0 ? 300 : -300,
            opacity: 0,
            scale: 0.95
        }),
        center: {
            x: 0,
            opacity: 1,
            scale: 1
        },
        exit: (dir: number) => ({
            x: dir > 0 ? -300 : 300,
            opacity: 0,
            scale: 0.95
        })
    };

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
                    <h1 className="text-xl font-bold text-white ml-2">Service Engine</h1>
                </div>
            </div>

            {/* Content Container */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto overscroll-contain flex flex-col items-center px-4 py-8 pb-[150px]">

                {/* Animated Search Engine Section */}
                <div className="w-full max-w-sm relative min-h-[600px]">
                    <AnimatePresence initial={false} custom={direction}>
                        <motion.div
                            key={searchType}
                            custom={direction}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{
                                x: { type: "spring", stiffness: 300, damping: 30 },
                                opacity: { duration: 0.2 }
                            }}
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={0.4}
                            onDragEnd={(_, info) => {
                                if (info.offset.x > 100 && searchType === 'demo') {
                                    handleTypeChange('warranty');
                                } else if (info.offset.x < -100 && searchType === 'warranty') {
                                    handleTypeChange('demo');
                                }
                            }}
                            className="absolute top-0 left-0 right-0 h-full"
                        >
                            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm flex flex-col items-center text-center w-full border border-slate-100 active:cursor-grabbing relative overflow-hidden">

                                {/* Refined Small Toggle - Positioned within the card top right */}
                                <div className="absolute top-6 right-6 flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-100">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleTypeChange('warranty'); }}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-[10px] font-black transition-all duration-300 pointer-events-auto",
                                            searchType === 'warranty'
                                                ? "bg-blue-600 text-white shadow-sm"
                                                : "text-slate-500 hover:bg-slate-200/50"
                                        )}
                                    >
                                        Warranty
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleTypeChange('demo'); }}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-[10px] font-black transition-all duration-300 pointer-events-auto",
                                            searchType === 'demo'
                                                ? "bg-blue-600 text-white shadow-sm"
                                                : "text-slate-500 hover:bg-slate-200/50"
                                        )}
                                    >
                                        Demo M/C
                                    </button>
                                </div>

                                <div className="flex items-center justify-center gap-4 mb-6 mt-10">
                                    {searchType === 'warranty' ? (
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
                                                <Wrench className="h-6 w-6" />
                                            </div>
                                            <div className="text-2xl font-black bg-gradient-to-r from-blue-600 to-emerald-500 text-transparent bg-clip-text">
                                                Warranty Search
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
                                                <Laptop className="h-6 w-6" />
                                            </div>
                                            <div className="text-2xl font-black bg-gradient-to-r from-blue-600 to-emerald-500 text-transparent bg-clip-text">
                                                Demo M/C Search
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <p className="text-slate-500 text-sm font-medium mb-8">
                                    {searchType === 'warranty'
                                        ? "Search for warranty information for all years."
                                        : "Search for demo machine information."}
                                </p>

                                <form onSubmit={handleSearch} className="w-full space-y-3">
                                    <div className="relative group">
                                        <Input
                                            placeholder={searchType === 'warranty'
                                                ? "Model, Serial, L/C No, Applicant..."
                                                : "Model, Serial, Brand, Owner, Status..."}
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-4 pr-14 py-7 rounded-[1.25rem] border-slate-200 focus:ring-blue-500 transition-all text-base font-medium shadow-none bg-slate-50/50"
                                        />
                                        <button
                                            type="submit"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-200 active:scale-90 transition-all"
                                        >
                                            <Search className="h-5 w-5" />
                                        </button>
                                    </div>
                                </form>

                                {/* Animation/Illustration Placeholder */}
                                <div className="mt-12 mb-6 select-none pointer-events-none">
                                    <iframe
                                        src="https://lottie.host/embed/1b954d50-dbd6-4e85-a947-9c8fc4fa093c/Jkw6b9BbW1.lottie"
                                        style={{ border: 'none', width: '200px', height: '200px' }}
                                    ></iframe>
                                </div>

                                <p className="text-slate-400 text-xs px-6 font-medium leading-relaxed">
                                    {searchType === 'warranty'
                                        ? "Enter terms above to search warranty-related machine information."
                                        : "Enter terms above to search demo machine details recorded in LCMS."}
                                </p>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Yearly Statistics Section */}
                <div className="w-full max-w-sm mt-10">
                    <SummaryStats type={searchType} />
                </div>

                {/* Bottom Spacer */}
                <div className="h-[120px]" />
            </div>
        </div>
    );
}
