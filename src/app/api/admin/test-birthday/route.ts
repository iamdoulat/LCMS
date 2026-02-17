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
        const currentHour = todayBD.hour();

        const debugInfo: any = {
            timezone: tz,
            currentDate: todayBD.format('YYYY-MM-DD HH:mm:ss'),
            currentHour: currentHour,
            is9AMWindow: currentHour === 9,
            currentMonthDay: currentMonthDay,
            companyName: companyName,
            employeesWithBirthdayToday: []
        };

        const empSnapshot = await db.collection('employees')
            .where('status', 'in', ['Active', 'On Leave']).get();

        const allEmployees = empSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        debugInfo.totalActiveEmployees = allEmployees.length;

        for (const emp of allEmployees) {
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
                    debugInfo.employeesWithBirthdayToday.push({
                        id: emp.id,
                        name: emp.fullName || emp.name || 'N/A',
                        email: emp.email || 'NOT SET',
                        phone: emp.phone || 'NOT SET',
                        dateOfBirth: emp.dateOfBirth,
                        parsedDob: dobMoment.toISOString(),
                        dobMonthDay: empDob,
                        status: emp.status
                    });
                }
            }
        }

        debugInfo.birthdayCount = debugInfo.employeesWithBirthdayToday.length;

        return NextResponse.json(debugInfo, { status: 200 });

    } catch (error: any) {
        console.error('Birthday Debug Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
