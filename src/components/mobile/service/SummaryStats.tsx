"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Wrench, Laptop, ShieldCheck, ShieldOff, AlertCircle, CheckCircle2, Factory, Clock, Box, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid, getYear, addDays, isBefore, startOfDay } from 'date-fns';

interface SummaryStatsProps {
    type: 'warranty' | 'demo';
}

export function SummaryStats({ type }: SummaryStatsProps) {
    const { userRole } = useAuth();
    const [selectedYear, setSelectedYear] = useState<string>("All Years");
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);

    const allowedRoles = ['Super Admin', 'Admin', 'Service', 'DemoManager', 'Supervisor'];
    const hasAccess = useMemo(() => {
        if (!userRole) return false;
        return userRole.some(role => allowedRoles.includes(role));
    }, [userRole]);

    const years = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const yearList = Array.from({ length: 11 }, (_, i) => (currentYear - 5 + i).toString());
        return ["All Years", ...yearList];
    }, []);

    useEffect(() => {
        if (!hasAccess) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const isAllYears = selectedYear === "All Years";
                const numericYear = parseInt(selectedYear);
                const today = startOfDay(new Date());

                if (type === 'warranty') {
                    const reportsRef = collection(firestore, 'installation_reports');
                    const claimsRef = collection(firestore, 'claim_reports');

                    const [reportsSnap, claimsSnap] = await Promise.all([
                        getDocs(reportsRef),
                        getDocs(claimsRef)
                    ]);

                    let totalLc = 0;
                    let totalInstalled = 0;
                    let underWarranty = 0;
                    let outOfWarranty = 0;

                    reportsSnap.docs.forEach(doc => {
                        const data = doc.data();
                        const reportDate = data.commercialInvoiceDate
                            ? (data.commercialInvoiceDate instanceof Timestamp ? data.commercialInvoiceDate.toDate() : parseISO(data.commercialInvoiceDate))
                            : (data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null);

                        const inYear = isAllYears || (reportDate && isValid(reportDate) && getYear(reportDate) === numericYear);

                        if (inYear) {
                            totalLc += Number(data.totalMachineQtyFromLC || 0);
                            totalInstalled += Number(data.totalInstalledQty || 0);

                            data.installationDetails?.forEach((detail: any) => {
                                if (detail.installDate) {
                                    const instDate = detail.installDate instanceof Timestamp ? detail.installDate.toDate() : parseISO(detail.installDate);
                                    if (isValid(instDate)) {
                                        const expiry = addDays(instDate, 365);
                                        if (isBefore(expiry, today)) {
                                            outOfWarranty++;
                                        } else {
                                            underWarranty++;
                                        }
                                    }
                                }
                            });
                        }
                    });

                    const claims = claimsSnap.docs.map(d => d.data());
                    const filteredClaims = claims.filter(c => {
                        const cDate = c.claimDate ? (c.claimDate instanceof Timestamp ? c.claimDate.toDate() : parseISO(c.claimDate)) : null;
                        return isAllYears || (cDate && isValid(cDate) && getYear(cDate) === numericYear);
                    });

                    setStats({
                        totalLc,
                        totalInstalled,
                        totalPending: totalLc - totalInstalled,
                        underWarranty,
                        outOfWarranty,
                        totalClaims: filteredClaims.length,
                        pendingClaims: filteredClaims.filter(c => c.status === 'Pending').length
                    });
                } else {
                    const machinesRef = collection(firestore, 'demo_machines');
                    const machinesSnap = await getDocs(machinesRef);

                    let total = 0;
                    let available = 0;
                    let inUse = 0;
                    let maintenance = 0;

                    machinesSnap.docs.forEach(doc => {
                        const data = doc.data();
                        const createdDate = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : (data.createdAt ? parseISO(data.createdAt) : null);

                        if (isAllYears || (createdDate && isValid(createdDate) && getYear(createdDate) === numericYear)) {
                            total++;
                            if (data.currentStatus === 'Available') available++;
                            else if (data.currentStatus === 'Allocated') inUse++;
                            else if (data.currentStatus === 'Under Maintenance') maintenance++;
                        }
                    });

                    setStats({ total, available, inUse, maintenance });
                }
            } catch (error) {
                console.error("Error fetching stats:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [selectedYear, type, hasAccess]);

    if (!hasAccess) return null;

    const StatCard = ({ title, value, subValue, icon: Icon, gradientClass }: any) => (
        <Card className={cn("border-none shadow-md rounded-[2rem] overflow-hidden mb-[30px] text-white transition-all duration-300 hover:scale-[1.02] w-full", gradientClass)}>
            <CardContent className="p-6">
                <div className="flex justify-between items-center text-white">
                    <div className="flex-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/80 mb-1">{title}</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-4xl font-black tracking-tight">{value}</h3>
                            {subValue && (
                                <span className="text-[10px] font-bold text-white bg-white/20 px-2.5 py-1 rounded-full backdrop-blur-md border border-white/10 shrink-0">
                                    {subValue}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/20 backdrop-blur-md border border-white/10 shadow-inner">
                        <Icon className="h-8 w-8 text-white drop-shadow-sm" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="px-1 w-full max-w-sm mx-auto">
            <div className="flex justify-between items-center mb-8 pr-1">
                <div className="flex flex-col">
                    <h2 className="text-lg font-black text-[#0a1e60] uppercase tracking-tight flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                        {type === 'warranty' ? 'Warranty' : 'Demo M/C'} Stats
                    </h2>
                    <span className="text-[10px] font-bold text-slate-400 ml-3.5 uppercase tracking-widest -mt-0.5">Yearly Overview</span>
                </div>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-[115px] h-9 rounded-xl border border-blue-200 bg-white shadow-md font-bold text-[10px] text-blue-600 focus:ring-2 focus:ring-blue-500/20 flex items-center gap-2 px-3 transition-all">
                        <Calendar className="h-3.5 w-3.5" />
                        <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl p-1 z-[60]">
                        {years.map(y => (
                            <SelectItem key={y} value={y} className="text-[10px] font-bold py-2.5 rounded-xl focus:bg-blue-50 focus:text-blue-600">
                                {y}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600 opacity-20" />
                </div>
            ) : stats ? (
                <div className="flex flex-col">
                    {type === 'warranty' ? (
                        <>
                            <StatCard
                                title="Total L/C Machineries"
                                value={stats.totalLc}
                                icon={Factory}
                                gradientClass="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800"
                            />
                            <StatCard
                                title="Total Installed Machines"
                                value={stats.totalInstalled}
                                icon={CheckCircle2}
                                gradientClass="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700"
                            />
                            <StatCard
                                title="Total Pending Machines"
                                value={stats.totalPending}
                                icon={Clock}
                                gradientClass="bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500"
                            />
                            <StatCard
                                title="Machines Under Warranty"
                                value={stats.underWarranty}
                                icon={ShieldCheck}
                                gradientClass="bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600"
                            />
                            <StatCard
                                title="Machines Out Of Warranty"
                                value={stats.outOfWarranty}
                                icon={ShieldOff}
                                gradientClass="bg-gradient-to-br from-rose-500 via-pink-600 to-purple-700"
                            />
                            <StatCard
                                title="Total Claims Overall"
                                value={stats.totalClaims}
                                subValue={`${stats.pendingClaims} Pending`}
                                icon={AlertCircle}
                                gradientClass="bg-gradient-to-br from-slate-600 via-slate-700 to-slate-900"
                            />
                        </>
                    ) : (
                        <>
                            <StatCard
                                title="Total Demo Machines"
                                value={stats.total}
                                icon={Laptop}
                                gradientClass="bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700"
                            />
                            <StatCard
                                title="Available Machines"
                                value={stats.available}
                                icon={CheckCircle2}
                                gradientClass="bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600"
                            />
                            <StatCard
                                title="Machines In Use (Allocated)"
                                value={stats.inUse}
                                icon={Box}
                                gradientClass="bg-gradient-to-br from-amber-400 via-orange-500 to-orange-600"
                            />
                            <StatCard
                                title="Machines Under Maintenance"
                                value={stats.maintenance}
                                icon={Wrench}
                                gradientClass="bg-gradient-to-br from-rose-500 via-rose-600 to-pink-700"
                            />
                        </>
                    )}
                </div>
            ) : null}
        </div>
    );
}
