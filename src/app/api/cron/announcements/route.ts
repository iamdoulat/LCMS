import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { format } from 'date-fns';
import { sendEmail } from '@/lib/email/sender';
import { sendServerPushNotification } from '@/lib/services/notification-service';
import { getCompanyName } from '@/lib/settings/company';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');

        if (!process.env.CRON_SECRET) {
            console.error("CRON_SECRET is not defined.");
            return new NextResponse('Cron Secret Missing', { status: 500 });
        }

        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            console.warn("Unauthorized announcement cron attempt.");
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const db = admin.firestore();
        const companyName = await getCompanyName();
        const now = new Date();
        const nowIso = now.toISOString();

        let processedCount = 0;

        // 1. Process Holidays
        const holidaysSnap = await db.collection('holidays')
            .where('announcementDate', '<=', nowIso)
            .get();

        const { sendWhatsApp } = await import('@/lib/whatsapp/sender');

        for (const holidayDoc of holidaysSnap.docs) {
            const holiday = holidayDoc.data();
            if (holiday.emailSent) continue;

            try {
                // Fetch active employees
                const employeesSnap = await db.collection('employees')
                    .where('status', '==', 'Active')
                    .get();

                const employees = employeesSnap.docs.map(doc => ({
                    id: doc.id,
                    email: doc.data().email,
                    phone: doc.data().phone,
                    name: doc.data().firstName ? `${doc.data().firstName} ${doc.data().lastName || ''}` : 'Employee'
                })).filter(emp => emp.email || emp.phone);

                if (employees.length > 0) {
                    const formattedFromDate = format(new Date(holiday.fromDate), 'PPPP');
                    const formattedToDate = holiday.toDate ? format(new Date(holiday.toDate), 'PPPP') : formattedFromDate;

                    for (const employee of employees) {
                        // Email
                        if (employee.email) {
                            try {
                                await sendEmail({
                                    to: employee.email,
                                    templateSlug: 'holiday_announcement',
                                    data: {
                                        employee_name: employee.name,
                                        holiday_title: holiday.name,
                                        holiday_date: formattedFromDate,
                                        holiday_start_date: formattedFromDate,
                                        holiday_end_date: formattedToDate,
                                        holiday_type: holiday.type,
                                        holiday_description: holiday.message || 'No additional details provided.',
                                    }
                                });
                            } catch (e) { console.error(`Failed to send holiday email to ${employee.email}:`, e); }
                        }
                        // WhatsApp
                        if (employee.phone) {
                            try {
                                await sendWhatsApp({
                                    to: employee.phone,
                                    templateSlug: 'holiday_announcement',
                                    data: {
                                        employee_name: employee.name,
                                        holiday_title: holiday.name,
                                        holiday_date: formattedFromDate,
                                        holiday_start_date: formattedFromDate,
                                        holiday_end_date: formattedToDate,
                                        holiday_type: holiday.type,
                                        holiday_description: holiday.message || 'No additional details provided.',
                                    }
                                });
                            } catch (e) { console.error(`Failed to send holiday WA to ${employee.phone}:`, e); }
                        }
                    }
                }

                await holidayDoc.ref.update({
                    emailSent: true,
                    emailSentAt: admin.firestore.FieldValue.serverTimestamp()
                });
                processedCount++;
            } catch (err) {
                console.error(`Error processing scheduled holiday ${holidayDoc.id}:`, err);
            }
        }

        // 2. Process Scheduled Notices
        const siteSettingsSnap = await db.collection('site_settings').get();
        for (const noticeDoc of siteSettingsSnap.docs) {
            const notice = noticeDoc.data();

            // Check if it's a notice (must have title, announcementDate, and isEnabled)
            if (!notice.title || !notice.announcementDate || !notice.isEnabled || notice.emailSent) continue;

            const annDate = notice.announcementDate.toDate ? notice.announcementDate.toDate() : new Date(notice.announcementDate);

            if (annDate <= now) {
                try {
                    // Push Notification
                    await sendServerPushNotification({
                        title: `Announcement: ${notice.title}`,
                        body: 'A new important notice has been posted. Click to view.',
                        targetRoles: notice.targetRoles,
                        badgeCount: 1
                    });

                    // Email for Notices
                    if (notice.targetRoles && notice.targetRoles.length > 0) {
                        const usersSnap = await db.collection('users')
                            .where('role', 'array-contains-any', notice.targetRoles)
                            .get();

                        const userEmails = [...new Set(usersSnap.docs.map(d => d.data().email).filter(Boolean))];

                        if (userEmails.length > 0) {
                            for (const email of userEmails as string[]) {
                                try {
                                    await sendEmail({
                                        to: email,
                                        templateSlug: 'notice_announcement',
                                        data: {
                                            notice_title: notice.title,
                                            notice_content: notice.content,
                                            company_name: companyName
                                        }
                                    });
                                } catch (e) { }
                            }
                        }
                    }

                    await noticeDoc.ref.update({
                        emailSent: true,
                        emailSentAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    processedCount++;
                    console.log(`[Cron] Successfully processed notice: ${notice.title}`);
                } catch (err) {
                    console.error(`Error processing scheduled notice ${noticeDoc.id}:`, err);
                }
            }
        }

        // 3. Seed templates if missing
        await seedAnnouncementTemplates(db);

        return NextResponse.json({ success: true, processedCount });

    } catch (error: any) {
        console.error("Announcement Cron Overall Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

async function seedAnnouncementTemplates(db: any) {
    const noticeSlug = 'notice_announcement';
    const emailTemplates = db.collection('email_templates');
    const snap = await emailTemplates.where('slug', '==', noticeSlug).limit(1).get();

    if (snap.empty) {
        await emailTemplates.add({
            name: 'Notice Announcement',
            slug: noticeSlug,
            subject: 'New Notice: {{notice_title}}',
            body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #3b82f6; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Important Notice</h1>
    </div>
    <div style="padding: 30px; background-color: white;">
        <h2 style="color: #1e293b; margin-top: 0;">{{notice_title}}</h2>
        <div style="color: #475569; line-height: 1.6; margin-bottom: 25px;">
            {{notice_content}}
        </div>
        <div style="text-align: center;">
            <a href="https://nextsew.com/dashboard" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Details</a>
        </div>
    </div>
    <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        You are receiving this because you are part of {{company_name}}.
    </div>
</div>
            `,
            variables: ['notice_title', 'notice_content', 'company_name'],
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
}
