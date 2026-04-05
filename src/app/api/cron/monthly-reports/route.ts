import { NextResponse } from 'next/server';
import { format, subMonths } from 'date-fns';
import { sendMonthlyReports } from '@/lib/services/report-service';
import { admin } from '@/lib/firebase/admin';
import moment from 'moment-timezone';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // Authenticate Cron Job
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret) {
            console.error("CRON_SECRET is not defined in environment variables.");
            return new NextResponse('Cron Secret Missing', { status: 500 });
        }

        if (authHeader !== `Bearer ${cronSecret}`) {
            console.warn(`Unauthorized cron attempt. Auth header: ${authHeader ? 'Present' : 'Missing'}`);
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // 1. Fetch Configuration from Firestore
        const db = admin.firestore();
        const configSnap = await db.collection('hrm_settings').doc('attendance_reconciliation').get();
        const config = configSnap.data();
        
        const reportSendingDay = config?.reportSendingDay || 1;
        const reportSendingTime = config?.reportSendingTime || "10:00"; 

        // 2. Get Current Time in Asia/Dhaka using moment-timezone
        const dhakaNow = moment().tz("Asia/Dhaka");
        const dhakaDay = dhakaNow.date();
        const dhakaHour = dhakaNow.hour();
        const dhakaMinute = dhakaNow.minute();
        const currentMonthYear = dhakaNow.format('yyyy-MM'); // e.g. "2026-04"

        // 3. Check if today is the reporting day
        if (dhakaDay !== reportSendingDay) {
            return NextResponse.json({ 
                success: false, 
                message: `Today is Day ${dhakaDay}, but sending is scheduled for Day ${reportSendingDay}. Skipping.` 
            });
        }

        // 4. Time Check (Ensure we reached the target hour)
        const [targetHour, targetMinute] = reportSendingTime.split(':').map(Number);
        if (dhakaHour < targetHour || (dhakaHour === targetHour && dhakaMinute < targetMinute)) {
             return NextResponse.json({ 
                success: false, 
                message: `Current Dhaka time is ${dhakaNow.format('HH:mm')}, but reporting is scheduled for ${reportSendingTime}. Skipping.` 
            });
        }

        // 5. Prevent Duplicate Sends in the same month
        if (config?.lastMonthlyReportSent === currentMonthYear) {
             return NextResponse.json({ 
                success: false, 
                message: `Monthly reports for month ${currentMonthYear} have already been processed. Skipping.` 
            });
        }

        // 6. Determine Report Month (Previous month relative to current Dhaka date)
        const lastMonthDate = dhakaNow.clone().subtract(1, 'month').toDate();
        const monthYear = format(lastMonthDate, 'yyyy-MM'); // e.g. "2026-03"

        // 7. Trigger the report service
        const result = await sendMonthlyReports({
            type: 'attendance',
            monthYear: monthYear
        });

        if (!result.success) {
            throw new Error(`Report service failed: ${result.message}`);
        }

        // 8. Log completion so we don't send again today/this month
        await db.collection('hrm_settings').doc('attendance_reconciliation').update({
            lastMonthlyReportSent: currentMonthYear,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return NextResponse.json({
            success: true,
            reportMonth: monthYear,
            dhakaTime: dhakaNow.format('YYYY-MM-DD HH:mm'),
            sentCount: result.count
        });

    } catch (error: any) {
        console.error("Monthly Reports Cron Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
