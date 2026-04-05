import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { sendMonthlyReports } from '@/lib/services/report-service';
import moment from 'moment-timezone';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        // TODO: In a production environment, you should verify the user's session/role here.
        // For now, mirroring the pattern in other HR API routes.

        if (!admin.apps.length) {
            throw new Error("Firebase Admin SDK not initialized");
        }

        // Determine the report month (Previous month in Dhaka)
        const dhakaNow = moment().tz("Asia/Dhaka");
        const lastMonthDate = dhakaNow.clone().subtract(1, 'month').toDate();
        const monthYear = format(lastMonthDate, 'yyyy-MM'); // e.g. "2026-03"

        console.log(`[Manual Trigger] Starting monthly attendance reports for ${monthYear}`);

        const result = await sendMonthlyReports({
            type: 'attendance',
            monthYear: monthYear
        });

        if (!result.success) {
            return NextResponse.json({ 
                success: false, 
                message: result.message || 'Report generation failed' 
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            reportMonth: monthYear,
            sentCount: result.count,
            message: `Successfully initiated sending ${result.count} reports for ${monthYear}.`
        });

    } catch (error: any) {
        console.error("Manual Report Trigger Error:", error);
        return NextResponse.json({ 
            success: false, 
            error: error.message || 'Internal server error' 
        }, { status: 500 });
    }
}
