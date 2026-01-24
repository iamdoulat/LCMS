import { NextResponse } from 'next/server';
import { format, subMonths } from 'date-fns';
import { sendMonthlyReports } from '@/lib/services/report-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // Authenticate Cron Job
        const authHeader = request.headers.get('authorization');

        if (!process.env.CRON_SECRET) {
            console.error("CRON_SECRET is not defined in environment variables.");
            return new NextResponse('Cron Secret Missing', { status: 500 });
        }

        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            console.warn(`Unauthorized cron attempt from ${request.headers.get('host')}. Auth header: ${authHeader ? 'Present' : 'Missing'}`);
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Determine Last Month
        const lastMonth = subMonths(new Date(), 1);
        const monthYear = format(lastMonth, 'yyyy-MM'); // e.g., '2023-10'

        // Call the service directly
        const result = await sendMonthlyReports({
            type: 'attendance',
            monthYear: monthYear
        });

        if (!result.success) {
            throw new Error(`Report service failed: ${result.message}`);
        }

        return NextResponse.json({
            success: true,
            month: monthYear,
            sentCount: result.count
        });

    } catch (error: any) {
        console.error("Monthly Reports Cron Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
