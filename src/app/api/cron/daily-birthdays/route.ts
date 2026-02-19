import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/sender';
import { sendTelegram } from '@/lib/telegram/sender';
import { getCompanyName, getCompanyTimezone } from '@/lib/settings/company';
import moment from 'moment-timezone';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    /**
     * CRON JOB TIMEZONE NOTES:
     * 
     * This cron job is triggered via external scheduler (e.g., cron-job.org).
     * The schedule should be configured in the external service's dashboard.
     * 
     * To ensure security, this route requires an 'Authorization' header:
     * Bearer [CRON_SECRET]
     * 
     * Timezone Management:
     * - Configure the external job to run at the desired UTC or local time.
     * - The logic below uses the company timezone setting for birthday comparison.
     */
    try {
        // 1. Authenticate Cron Job
        const authHeader = request.headers.get('authorization');

        if (!process.env.CRON_SECRET) {
            console.error("CRON_SECRET is not defined in environment variables.");
            return new NextResponse('Cron Secret Missing', { status: 500 });
        }

        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            console.warn(`Unauthorized cron attempt from ${request.headers.get('host')}. Auth header: ${authHeader ? 'Present' : 'Missing'}`);
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const db = admin.firestore();
        const companyName = await getCompanyName();

        // Use dynamic company timezone for date comparisons
        const tz = await getCompanyTimezone();
        const todayBD = moment().tz(tz);
        const currentMonthDay = todayBD.format('MM-DD');
        const currentHour = todayBD.hour();

        console.log(`Birthday Cron execution attempt at: ${todayBD.format('YYYY-MM-DD HH:mm:ss')} (${tz})`);

        // Check if it's 9 AM (Alternative Smart Method)
        // This allows the cron to be triggered every hour but only execute logic at 9 AM
        if (currentHour !== 9) {
            console.log(`- Skipping: Current hour is ${currentHour}, execution window is 9 AM.`);
            return NextResponse.json({
                success: true,
                message: `Skipping: Current hour ${currentHour} is outside the 9 AM window.`
            });
        }

        // Check for duplicate execution today
        const startOfToday = todayBD.clone().startOf('day').toDate();
        const duplicateCheck = await db.collection('cron_logs')
            .where('executedAt', '>=', startOfToday)
            .get();

        const alreadyRan = duplicateCheck.docs.some(doc => {
            const data = doc.data();
            return data.job === 'daily-birthdays' && data.status === 'success';
        });

        if (alreadyRan) {
            console.log(`- Skipping: Birthday wishes already successfully sent today.`);
            return NextResponse.json({
                success: true,
                message: "Skipping: Birthday wishes already sent today."
            });
        }

        console.log(`- Execution Window OK (9 AM). Checking for birthdays on: ${currentMonthDay}`);

        // 2. Auto-Seed Templates if missing
        const templateSlug = 'employee_birthday_wish';

        // Email Template
        const templateRef = db.collection('email_templates').where('slug', '==', templateSlug).limit(1);
        const templateSnap = await templateRef.get();
        if (templateSnap.empty) {
            await db.collection('email_templates').add({
                name: 'Employee Birthday Wish',
                slug: templateSlug,
                subject: 'Happy Birthday, {{employee_name}}! 🎂',
                body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center; background-color: #fffaf0; border-radius: 10px; border: 2px solid #fbbf24;">
    <h1 style="color: #d97706; margin-bottom: 10px;">Happy Birthday! 🎉</h1>
    <p style="font-size: 18px; color: #4b5563;">Dear <strong>{{employee_name}}</strong>,</p>
    <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">
        On this special day, we want to wish you a day filled with happiness, laughter, and joy. <br/>
        We are so lucky to have you as part of our team!
    </p>
    <div style="margin: 30px 0;">
        <span style="font-size: 60px;">🎂</span>
    </div>
    <p style="font-size: 16px; color: #4b5563;">
        Wishing you a fantastic year ahead!
    </p>
    <hr style="border: 0; height: 1px; background: #fbbf24; margin: 30px 0;" />
    <p style="font-size: 14px; color: #9ca3af;">Best Wishes,<br/><strong>{{company_name}} Team</strong></p>
</div>
                `,
                variables: ['employee_name', 'company_name'],
                isActive: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        // WhatsApp Template
        const waTemplateRef = db.collection('whatsapp_templates').where('slug', '==', templateSlug).limit(1);
        const waTemplateSnap = await waTemplateRef.get();
        if (waTemplateSnap.empty) {
            await db.collection('whatsapp_templates').add({
                name: 'Employee Birthday Wish',
                slug: templateSlug,
                subject: 'Happy Birthday! 🎂',
                body: `Dear *{{employee_name}}*,

Happy Birthday! 🎈
Wishing you a day filled with happiness and a fantastic year ahead!

Best Wishes,
*{{company_name}}*`,
                variables: ['employee_name', 'company_name'],
                isActive: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        // Telegram Template
        const teleTemplateRef = db.collection('telegram_templates').where('slug', '==', templateSlug).limit(1);
        const teleTemplateSnap = await teleTemplateRef.get();
        if (teleTemplateSnap.empty) {
            await db.collection('telegram_templates').add({
                name: 'Employee Birthday Wish',
                slug: templateSlug,
                body: `🎂 <b>Happy Birthday, {{employee_name}}!</b> 🎉\n\nOn this special day, we wish you a day filled with happiness and joy. We are lucky to have you in our team!\n\nBest Wishes,\n<b>{{company_name}}</b>`,
                variables: ['employee_name', 'company_name'],
                isActive: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        // 3. Fetch Non-Terminated Employees
        const snapshot = await db.collection('employees').where('status', 'in', ['Active', 'On Leave']).get();
        const employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

        let sentCount = 0;

        // 4. Check for Birthdays
        for (const emp of employees) {
            let dobMoment: moment.Moment | null = null;
            const rawDob = emp.dateOfBirth;

            if (rawDob) {
                if (rawDob.toDate) {
                    dobMoment = moment(rawDob.toDate()).tz(tz);
                } else if (typeof rawDob === 'string') {
                    const isoMoment = moment(rawDob);
                    if (isoMoment.isValid() && rawDob.includes('T')) {
                        dobMoment = isoMoment.tz(tz);
                    } else {
                        const formats = ["YYYY-MM-DD", "DD-MM-YYYY", "MM-DD-YYYY", "DD/MM/YYYY", "MM/DD/YYYY"];
                        const m = moment.tz(rawDob, formats, tz);
                        if (m.isValid()) {
                            dobMoment = m;
                        }
                    }
                }
            }

            if (dobMoment && dobMoment.isValid()) {
                const empDob = dobMoment.format('MM-DD');

                if (empDob === currentMonthDay) {
                    const employeeName = emp.fullName || emp.name || 'Employee';
                    const data = { employee_name: employeeName, company_name: companyName };

                    console.log(`🎂 Birthday Match Found: ${employeeName} (ID: ${emp.id})`);
                    console.log(`   - Email: ${emp.email || 'NOT SET'}`);
                    console.log(`   - Phone: ${emp.phone || 'NOT SET'}`);
                    console.log(`   - DOB: ${emp.dateOfBirth} → ${empDob}`);

                    // Send Email
                    if (emp.email) {
                        try {
                            console.log(`   → Attempting to send Birthday Email to ${emp.email}...`);
                            const emailResult = await sendEmail({ to: emp.email, templateSlug, data });
                            console.log(`   ✓ Email sent successfully:`, emailResult);
                        } catch (e: any) {
                            console.error(`   ✗ Failed to send Birthday Email to ${emp.id}:`, e.message);
                        }
                    }

                    // Send WhatsApp
                    if (emp.phone) {
                        try {
                            console.log(`   → Attempting to send Birthday WhatsApp to ${emp.phone}...`);
                            const { sendWhatsApp } = await import('@/lib/whatsapp/sender');
                            const waResult = await sendWhatsApp({ to: emp.phone, templateSlug, data });
                            console.log(`   ✓ WhatsApp sent successfully:`, waResult);
                        } catch (e: any) {
                            console.error(`   ✗ Failed to send Birthday WA to ${emp.id}:`, e.message);
                        }
                    }

                    // Send Telegram
                    try {
                        console.log(`   → Attempting to send Birthday Telegram...`);
                        const teleResult = await sendTelegram({ templateSlug, data });
                        console.log(`   ✓ Telegram sent successfully:`, teleResult);
                    } catch (e: any) {
                        console.error(`   ✗ Failed to send Birthday Telegram for ${emp.id}:`, e.message);
                    }

                    // Send FCM Push Notification
                    try {
                        if (emp.uid) {
                            console.log(`   → Attempting to send Birthday Push to ${emp.uid}...`);
                            const { sendServerPushNotification } = await import('@/lib/services/notification-service');
                            await sendServerPushNotification({
                                title: 'Happy Birthday! 🎉',
                                body: `Wishing you a fantastic day, ${employeeName}! 🎂`,
                                userIds: [emp.uid],
                                url: '/mobile/dashboard'
                            });
                            console.log(`   ✓ Push notification sent successfully`);
                        }
                    } catch (e: any) {
                        console.error(`   ✗ Failed to send Birthday Push for ${emp.id}:`, e.message);
                    }

                    sentCount++;
                }
            }
        }

        // 5. Log Execution to Firestore
        await db.collection('cron_logs').add({
            job: 'daily-birthdays',
            status: 'success',
            checkedCount: employees.length,
            sentCount: sentCount,
            executedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return NextResponse.json({
            success: true,
            message: `Checked ${employees.length} employees. Sent ${sentCount} birthday wishes.`,
            sentCount
        });

    } catch (error: any) {
        console.error("Birthday Cron Error:", error);
        // Log failure
        try {
            await admin.firestore().collection('cron_logs').add({
                job: 'daily-birthdays',
                status: 'error',
                error: error.message,
                executedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (logErr) { }

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
