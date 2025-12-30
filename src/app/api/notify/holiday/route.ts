
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
            phone: doc.data().phone, // Added phone
            name: doc.data().name || 'Employee'
        })).filter(emp => emp.email || emp.phone); // Filter if either contact exists

        if (employees.length === 0) {
            return NextResponse.json({ message: 'No active employees with emails or phones found' });
        }

        // 3. Prepare dates for notification
        const formattedFromDate = holidayData.fromDate;

        // If toDate is missing, use fromDate as fallback to avoid "N/A"
        let formattedToDate = holidayData.toDate || formattedFromDate;

        // Dynamically import to avoid top-level issues if any
        const { sendWhatsApp } = await import('@/lib/whatsapp/sender');

        let successCount = 0;
        const sendPromises = employees.map(async (employee) => {
            let emailSent = false;
            let waSent = false;

            // Send Email
            if (employee.email) {
                try {
                    await sendEmail({
                        to: employee.email,
                        templateSlug: 'holiday_announcement',
                        data: {
                            employee_name: employee.name,
                            holiday_title: holidayData.title,
                            holiday_date: formattedFromDate,
                            holiday_start_date: formattedFromDate,
                            holiday_end_date: formattedToDate,
                            holiday_type: holidayData.type,
                            holiday_description: holidayData.description || 'No additional details provided.',
                        }
                    });
                    emailSent = true;
                } catch (err) {
                    console.error(`Failed to send holiday email to ${employee.email}:`, err);
                }
            }

            // Send WhatsApp
            if (employee.phone) {
                try {
                    await sendWhatsApp({
                        to: employee.phone,
                        templateSlug: 'holiday_announcement', // Same slug
                        data: {
                            employee_name: employee.name,
                            holiday_title: holidayData.title,
                            holiday_date: formattedFromDate,
                            holiday_start_date: formattedFromDate,
                            holiday_end_date: formattedToDate,
                            holiday_type: holidayData.type,
                            holiday_description: holidayData.description || 'No additional details provided.',
                        }
                    });
                    waSent = true;
                } catch (err) {
                    console.error(`Failed to send holiday WA to ${employee.phone}:`, err);
                }
            }

            if (emailSent || waSent) successCount++;
            return true;
        });

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
