
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Calendar, Loader2, FileBarChart, DollarSign } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, subMonths } from 'date-fns';
import Swal from 'sweetalert2';

export default function EmailReportsPage() {
    const [selectedMonth, setSelectedMonth] = React.useState<string>(format(new Date(), 'yyyy-MM'));
    const [sendingType, setSendingType] = React.useState<string | null>(null);

    const handleSend = async (type: 'attendance' | 'payslip') => {
        setSendingType(type);
        try {
            const res = await fetch('/api/notify/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, monthYear: selectedMonth })
            });
            const data = await res.json();

            if (res.ok) {
                Swal.fire("Success", `Emails sent successfully to ${data.count} employees.`, "success");
            } else {
                throw new Error(data.error || 'Failed to send');
            }
        } catch (error: any) {
            Swal.fire("Error", error.message, "error");
        } finally {
            setSendingType(null);
        }
    };

    // Generate last 12 months options
    const monthOptions = Array.from({ length: 12 }).map((_, i) => {
        const d = subMonths(new Date(), i);
        return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') };
    });

    return (
        <div className="p-8">
            <Card className="max-w-2xl mx-auto shadow-xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Mail className="h-6 w-6 text-primary" /> Monthly Email Reports</CardTitle>
                    <CardDescription>Manually trigger monthly reports sent to all employees via email.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Select Month</label>
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {monthOptions.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                        <Button
                            variant="outline"
                            className="h-32 flex flex-col items-center justify-center gap-3 hover:border-primary hover:bg-primary/5 transition-all"
                            onClick={() => handleSend('attendance')}
                            disabled={!!sendingType}
                        >
                            {sendingType === 'attendance' ? <Loader2 className="h-8 w-8 animate-spin" /> : <FileBarChart className="h-10 w-10 text-blue-500" />}
                            <div className="text-center">
                                <div className="font-semibold">Attendance Report</div>
                                <div className="text-xs text-muted-foreground">Send table chart to all employees</div>
                            </div>
                        </Button>

                        <Button
                            variant="outline"
                            className="h-32 flex flex-col items-center justify-center gap-3 hover:border-primary hover:bg-primary/5 transition-all"
                            onClick={() => handleSend('payslip')}
                            disabled={!!sendingType}
                        >
                            {sendingType === 'payslip' ? <Loader2 className="h-8 w-8 animate-spin" /> : <DollarSign className="h-10 w-10 text-green-500" />}
                            <div className="text-center">
                                <div className="font-semibold">Payslip Summary</div>
                                <div className="text-xs text-muted-foreground">Send summary to all employees</div>
                            </div>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
