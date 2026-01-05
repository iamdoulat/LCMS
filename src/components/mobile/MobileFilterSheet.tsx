import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Filter, X, Calendar as CalendarIcon, Check } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface FilterState {
    dateRange?: DateRange;
    status?: string | string[]; // Single status or array for multi-select
    year?: string;
    month?: string;
    priority?: 'Low' | 'Medium' | 'High' | 'Urgency';
    project?: string;
}

interface MobileFilterSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onApply: (filters: FilterState) => void;
    onReset: () => void;
    showDateRange?: boolean;
    showStatus?: boolean;
    statusOptions?: string[];
    currentFilters?: FilterState;
    title?: string;
    // Optional extras
    children?: React.ReactNode;
}

export function MobileFilterSheet({
    open,
    onOpenChange,
    onApply,
    onReset,
    showDateRange = false,
    showStatus = false,
    statusOptions = ['Pending', 'Approved', 'Rejected'],
    currentFilters,
    title = 'Filters',
    children
}: MobileFilterSheetProps) {
    const [tempFilters, setTempFilters] = useState<FilterState>(currentFilters || {});

    // Sync temp state when sheet opens
    useEffect(() => {
        if (open && currentFilters) {
            setTempFilters(currentFilters);
        }
    }, [open, currentFilters]);

    const handleApply = () => {
        onApply(tempFilters);
        onOpenChange(false);
    };

    const handleReset = () => {
        onReset();
        setTempFilters({});
        // We don't close automatically on reset usually, or maybe we do?
        // Let's keep it open so user can see it's cleared or re-select.
    };

    const toggleStatus = (status: string) => {
        // Assuming single select for now if status is string, or multi if array
        // Based on use case, simple single select is often easier, but let's support single for now as per common requirements
        setTempFilters(prev => ({
            ...prev,
            status: prev.status === status ? undefined : status
        }));
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="rounded-t-[2rem] p-0 max-h-[90vh] overflow-hidden flex flex-col bg-slate-50">
                <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 shrink-0">
                    <SheetTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Filter className="w-5 h-5 text-blue-600" />
                        {title}
                    </SheetTitle>
                    <Button variant="ghost" size="sm" onClick={handleReset} className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 h-8 px-3 rounded-full text-xs font-bold uppercase tracking-wider">
                        Reset
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Status Section */}
                    {showStatus && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Status</h4>
                            <div className="flex flex-wrap gap-2">
                                {statusOptions.map(status => {
                                    const isSelected = tempFilters.status === status;
                                    return (
                                        <button
                                            key={status}
                                            onClick={() => toggleStatus(status)}
                                            className={cn(
                                                "px-4 py-2 rounded-full text-sm font-bold transition-all border-2",
                                                isSelected
                                                    ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200"
                                                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                                            )}
                                        >
                                            <span className="flex items-center gap-2">
                                                {isSelected && <Check className="w-3.5 h-3.5" />}
                                                {status}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Date Range Section */}
                    {showDateRange && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Date Range</h4>
                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden p-1">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={tempFilters.dateRange?.from}
                                    selected={tempFilters.dateRange}
                                    onSelect={(range) => setTempFilters(prev => ({ ...prev, dateRange: range }))}
                                    numberOfMonths={1}
                                    className="rounded-xl"
                                />
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-white p-3 rounded-xl border border-slate-200">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">From</p>
                                    <p className="text-sm font-bold text-slate-700">
                                        {tempFilters.dateRange?.from ? format(tempFilters.dateRange.from, 'dd MMM yyyy') : '-'}
                                    </p>
                                </div>
                                <div className="flex-1 bg-white p-3 rounded-xl border border-slate-200">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">To</p>
                                    <p className="text-sm font-bold text-slate-700">
                                        {tempFilters.dateRange?.to ? format(tempFilters.dateRange.to, 'dd MMM yyyy') : '-'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {children}
                </div>

                <div className="p-6 bg-white border-t border-slate-100 shrink-0 shadow-lg z-10">
                    <Button onClick={handleApply} className="w-full h-12 rounded-xl text-base font-bold bg-blue-600 hover:bg-blue-700 shadow-blue-200 shadow-lg">
                        Apply Filters
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}

// Helper to check if filters are active
export function hasActiveFilters(filters: FilterState): boolean {
    return !!(filters.status || filters.dateRange?.from || filters.year || filters.month);
}
