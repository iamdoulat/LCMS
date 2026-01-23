import { NextResponse } from 'next/server';
import { format } from 'date-fns';
import { sendMonthlyReports } from '@/lib/services/report-service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, monthYear, targetEmail } = body;

        if (!type || !monthYear) {
            return NextResponse.json({ error: 'Type and MonthYear are required' }, { status: 400 });
        }

        const result = await sendMonthlyReports({ type, monthYear, targetEmail });

        if (!result.success) {
            return NextResponse.json({ error: result.message }, { status: result.message === 'No matching employees found' ? 404 : 500 });
        }

        return NextResponse.json({ success: true, count: result.count });

    } catch (error: any) {
        console.error("Error sending monthly reports:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
