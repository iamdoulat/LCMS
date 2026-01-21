import { NextResponse } from 'next/server';
import { format, subMonths } from 'date-fns';

export async function GET(request: Request) {
    try {
        // Authenticate Cron Job (Secure with Header check if strictly needed, or trust Vercel's protection)
        // const authHeader = request.headers.get('authorization');
        // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        //     return new NextResponse('Unauthorized', { status: 401 });
        // }

        // Determine Last Month
        const lastMonth = subMonths(new Date(), 1);
        const monthYear = format(lastMonth, 'yyyy-MM'); // e.g., '2023-10'

        // Call the internal Report API
        // We can use fetch to call own API - but ensure URL is correct.
        // Or better, import the logic. But the logic is in a route handler designated as POST.
        // Simplest: Fetch itself using localhost or absolute URL

        const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        const response = await fetch(`${apiUrl}/api/notify/reports`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'attendance',
                monthYear: monthYear
                // targetEmail: undefined -> To All
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Report API failed: ${err}`);
        }

        const data = await response.json();
        return NextResponse.json({ success: true, month: monthYear, details: data });

    } catch (error: any) {
        console.error("Cron Job Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
