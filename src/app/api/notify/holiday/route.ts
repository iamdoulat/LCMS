
import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/sender';
import { format } from 'date-fns';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { holidayId, holidayData } = body;

        if (!holidayId || !holidayData) {
            return NextResponse.json({ error: 'Holiday ID and Data are required' }, { status: 400 });
        }

        // 1. Check if email already sent
        const holidayRef = admin.firestore().collection('holidays').doc(holidayId);
        const holidayDoc = await holidayRef.get();
        if (holidayDoc.exists && holidayDoc.data()?.emailSent) {
            return NextResponse.json({ message: 'Email already sent for this holiday' });
        }

        // 2. Fetch all active employees
        const employeesSnapshot = await admin.firestore().collection('employees')
            .where('status', '==', 'Active')
            .get();

        const employees = employeesSnapshot.docs.map(doc => ({
            id: doc.id,
            email: doc.data().email,
            name: doc.data().name || 'Employee'
        })).filter(emp => emp.email);

        if (employees.length === 0) {
            return NextResponse.json({ message: 'No active employees with emails found' });
        }

        // 3. Send emails
        const holidayFromDate = new Date(holidayData.fromDate);
        const formattedFromDate = format(holidayFromDate, 'PPPP');

        let formattedToDate = 'N/A';
        if (holidayData.toDate) {
            const holidayToDate = new Date(holidayData.toDate);
            formattedToDate = format(holidayToDate, 'PPPP');
        }

        let successCount = 0;
        const sendPromises = employees.map(employee =>
            sendEmail({
                to: employee.email,
                templateSlug: 'holiday_announcement', // Fixed: underscore instead of hyphen
                data: {
                    employee_name: employee.name,
                    holiday_title: holidayData.title,
                    holiday_date: formattedFromDate, // Keep for backward compatibility
                    holiday_start_date: formattedFromDate,
                    holiday_end_date: formattedToDate,
                    holiday_type: holidayData.type,
                    holiday_description: holidayData.description || 'No additional details provided.',
                }
            }).then(() => {
                successCount++;
                return true;
            }).catch(err => {
                console.error(`Failed to send holiday email to ${employee.email}:`, err);
                return null;
            })
        );

        await Promise.all(sendPromises);

        // 4. Update holiday record only if at least one email was attempted successfully
        // Note: If successCount is 0, it might be a template or provider issue.
        if (successCount === 0 && employees.length > 0) {
            throw new Error('All email sending attempts failed. Please check SMTP/Resend configuration and template slug.');
        }

        await holidayRef.update({
            emailSent: true,
            emailSentAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return NextResponse.json({
            success: true,
            notifiedCount: employees.length
        });

    } catch (error: any) {
        console.error("Error sending holiday notification:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
