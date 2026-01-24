import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/sender';
import { sendTelegram } from '@/lib/telegram/sender';
import { getCompanyName } from '@/lib/settings/company';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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
        const today = new Date();
        const currentMonth = today.getMonth() + 1; // 1-12
        const currentDay = today.getDate(); // 1-31
        const companyName = await getCompanyName();

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

        // 3. Fetch Active Employees
        const snapshot = await db.collection('employees').where('isActive', '==', true).get();
        const employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

        let sentCount = 0;

        // 4. Check for Birthdays
        for (const emp of employees) {
            if (!emp.dateOfBirth) continue;

            let dobDate: Date | null = null;
            if (emp.dateOfBirth.toDate) {
                dobDate = emp.dateOfBirth.toDate();
            } else if (typeof emp.dateOfBirth === 'string') {
                // Handle different string formats (YYYY-MM-DD or DD-MM-YYYY)
                const parts = emp.dateOfBirth.split(/[-/]/);
                if (parts.length === 3) {
                    if (parts[0].length === 4) { // YYYY-MM-DD
                        dobDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    } else if (parts[2].length === 4) { // DD-MM-YYYY
                        dobDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                    }
                }
                if (!dobDate || isNaN(dobDate.getTime())) {
                    dobDate = new Date(emp.dateOfBirth);
                }
            }

            if (dobDate && !isNaN(dobDate.getTime())) {
                const dobMonth = dobDate.getMonth() + 1;
                const dobDay = dobDate.getDate();

                if (dobMonth === currentMonth && dobDay === currentDay) {
                    const employeeName = emp.fullName || emp.name || 'Employee';
                    const data = { employee_name: employeeName, company_name: companyName };

                    // Send Email
                    if (emp.email) {
                        try {
                            await sendEmail({ to: emp.email, templateSlug, data });
                        } catch (e) { console.error(`Failed to send Birthday Email to ${emp.id}`, e); }
                    }

                    // Send WhatsApp
                    if (emp.phone) {
                        try {
                            const { sendWhatsApp } = await import('@/lib/whatsapp/sender');
                            await sendWhatsApp({ to: emp.phone, templateSlug, data });
                        } catch (e) { console.error(`Failed to send Birthday WA to ${emp.id}`, e); }
                    }

                    // Send Telegram
                    try {
                        await sendTelegram({ templateSlug, data });
                    } catch (e) { console.error(`Failed to send Birthday Telegram for ${emp.id}`, e); }

                    // Send FCM Push Notification
                    try {
                        if (emp.uid) {
                            const { sendServerPushNotification } = await import('@/lib/services/notification-service');
                            await sendServerPushNotification({
                                title: 'Happy Birthday! 🎉',
                                body: `Wishing you a fantastic day, ${employeeName}! 🎂`,
                                userIds: [emp.uid],
                                url: '/mobile/dashboard'
                            });
                        }
                    } catch (e) { console.error(`Failed to send Birthday Push for ${emp.id}`, e); }

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
