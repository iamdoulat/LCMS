import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import moment from 'moment-timezone';
import { getCompanyName, getCompanyTimezone } from '@/lib/settings/company';

export const dynamic = 'force-dynamic';

/**
 * Debug/Test Endpoint for Birthday Wishes
 * Access with: GET /api/admin/test-birthday
 * Authorization: Bearer [CRON_SECRET]
 */
export async function GET(request: Request) {
    try {
        // Authenticate
        const authHeader = request.headers.get('authorization');
        if (!process.env.CRON_SECRET) {
            return new NextResponse('Cron Secret Missing', { status: 500 });
        }
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const db = admin.firestore();
        const companyName = await getCompanyName();
        const tz = await getCompanyTimezone();
        const todayBD = moment().tz(tz);
        const currentMonthDay = todayBD.format('MM-DD');

        const debugInfo: any = {
            timezone: tz,
            currentDate: todayBD.format('YYYY-MM-DD HH:mm:ss'),
            currentMonthDay: currentMonthDay,
            companyName: companyName,
            employeesWithBirthdayToday: [],
            templates: {},
            gateways: {},
            errors: []
        };

        // 1. Check Templates
        const emailTemplateSnap = await db.collection('email_templates')
            .where('slug', '==', 'employee_birthday_wish').get();
        debugInfo.templates.email = {
            exists: !emailTemplateSnap.empty,
            isActive: emailTemplateSnap.empty ? null : emailTemplateSnap.docs[0].data()?.isActive,
            data: emailTemplateSnap.empty ? null : emailTemplateSnap.docs[0].data()
        };

        const waTemplateSnap = await db.collection('whatsapp_templates')
            .where('slug', '==', 'employee_birthday_wish').get();
        debugInfo.templates.whatsapp = {
            exists: !waTemplateSnap.empty,
            isActive: waTemplateSnap.empty ? null : waTemplateSnap.docs[0].data()?.isActive,
            data: waTemplateSnap.empty ? null : waTemplateSnap.docs[0].data()
        };

        const teleTemplateSnap = await db.collection('telegram_templates')
            .where('slug', '==', 'employee_birthday_wish').get();
        debugInfo.templates.telegram = {
            exists: !teleTemplateSnap.empty,
            isActive: teleTemplateSnap.empty ? null : teleTemplateSnap.docs[0].data()?.isActive,
            data: teleTemplateSnap.empty ? null : teleTemplateSnap.docs[0].data()
        };

        // 2. Check Gateways
        const smtpSnap = await db.collection('smtp_settings').where('isActive', '==', true).get();
        debugInfo.gateways.email = {
            configured: !smtpSnap.empty,
            count: smtpSnap.size,
            data: smtpSnap.empty ? null : smtpSnap.docs.map(d => ({
                id: d.id,
                serviceProvider: d.data()?.serviceProvider,
                fromEmail: d.data()?.fromEmail,
                host: d.data()?.host
            }))
        };

        const whatsappSnap = await db.collection('whatsapp_gateways').where('isActive', '==', true).get();
        debugInfo.gateways.whatsapp = {
            configured: !whatsappSnap.empty,
            count: whatsappSnap.size,
            data: whatsappSnap.empty ? null : whatsappSnap.docs.map(d => ({
                id: d.id,
                accountUniqueId: d.data()?.accountUniqueId
            }))
        };

        // 3. Check Employees
        const empSnapshot = await db.collection('employees')
            .where('status', 'in', ['Active', 'On Leave']).get();

        const allEmployees = empSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        debugInfo.totalActiveEmployees = allEmployees.length;

        for (const emp of allEmployees) {
            if (!emp.dateOfBirth) continue;

            let dobDate: Date | null = null;
            if (emp.dateOfBirth.toDate) {
                dobDate = emp.dateOfBirth.toDate();
            } else if (typeof emp.dateOfBirth === 'string') {
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
                const empDob = moment(dobDate).format('MM-DD');

                if (empDob === currentMonthDay) {
                    debugInfo.employeesWithBirthdayToday.push({
                        id: emp.id,
                        name: emp.fullName || emp.name || 'N/A',
                        email: emp.email || 'NOT SET',
                        phone: emp.phone || 'NOT SET',
                        dateOfBirth: emp.dateOfBirth,
                        parsedDob: dobDate.toISOString(),
                        dobMonthDay: empDob,
                        status: emp.status
                    });
                }
            }
        }

        debugInfo.birthdayCount = debugInfo.employeesWithBirthdayToday.length;

        // 4. Check Recent Cron Logs
        const cronLogsSnap = await db.collection('cron_logs')
            .where('job', '==', 'daily-birthdays')
            .orderBy('executedAt', 'desc')
            .limit(5)
            .get();

        debugInfo.recentCronLogs = cronLogsSnap.docs.map(d => ({
            ...d.data(),
            executedAt: d.data().executedAt?.toDate ? d.data().executedAt.toDate().toISOString() : null
        }));

        // 5. Check Recent Activity Logs
        const activityLogsSnap = await db.collection('activity_logs')
            .where('type', 'in', ['email', 'whatsapp'])
            .orderBy('timestamp', 'desc')
            .limit(10)
            .get();

        debugInfo.recentActivityLogs = activityLogsSnap.docs.map(d => d.data());

        return NextResponse.json(debugInfo, { status: 200 });

    } catch (error: any) {
        console.error('Birthday Debug Error:', error);
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
