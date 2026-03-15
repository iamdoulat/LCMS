
import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/sender';
import { format } from 'date-fns';
import moment from 'moment-timezone';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { holidayId, holidayData } = body;

        if (!holidayId || !holidayData) {
            return NextResponse.json({ error: 'Holiday ID and Data are required' }, { status: 400 });
        }

        // 1. Seed templates if missing
        await seedHolidayTemplates(admin.firestore());

        // 2. Check if email already sent
        const holidayRef = admin.firestore().collection('holidays').doc(holidayId);
        const holidayDoc = await holidayRef.get();
        if (holidayDoc.exists && holidayDoc.data()?.emailSent && !holidayData.forceSend) {
            return NextResponse.json({ message: 'Email already sent for this holiday' });
        }

        // 3. Fetch all active employees
        const employeesSnapshot = await admin.firestore().collection('employees')
            .where('status', '==', 'Active')
            .get();

        const employees = employeesSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                email: data.email,
                phone: data.phone,
                name: data.fullName || (data.firstName ? `${data.firstName} ${data.lastName || ''}` : 'Employee')
            };
        }).filter(emp => emp.email || emp.phone); // Filter if either contact exists

        if (employees.length === 0) {
            return NextResponse.json({ message: 'No active employees with emails or phones found' });
        }

        // 3. Prepare dates for notification
        const formattedFromDate = moment.tz(holidayData.originalFromDate || holidayData.fromDate, 'Asia/Dhaka').format('dddd, MMMM D, YYYY');

        // If toDate is missing, use fromDate as fallback to avoid "N/A"
        let formattedToDate = (holidayData.originalToDate || holidayData.toDate) 
            ? moment.tz(holidayData.originalToDate || holidayData.toDate, 'Asia/Dhaka').format('dddd, MMMM D, YYYY') 
            : formattedFromDate;

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
            whatsappSent: true,
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

async function seedHolidayTemplates(db: any) {
    const emailTemplates = db.collection('email_templates');
    const waTemplates = db.collection('whatsapp_templates');

    // Email Template
    const emailSnap = await emailTemplates.where('slug', '==', 'holiday_announcement').limit(1).get();
    if (emailSnap.empty) {
        await emailTemplates.add({
            name: 'Holiday Announcement',
            slug: 'holiday_announcement',
            subject: 'Holiday Notice: {{holiday_title}}',
            body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #f43f5e; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Holiday Announcement</h1>
    </div>
    <div style="padding: 30px; background-color: white;">
        <p>Dear {{employee_name}},</p>
        <p>We are pleased to announce a holiday for <strong>{{holiday_title}}</strong>.</p>
        <div style="background-color: #fff1f2; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Date(s):</strong> {{holiday_start_date}} to {{holiday_end_date}}</p>
            <p style="margin: 5px 0;"><strong>Type:</strong> {{holiday_type}}</p>
        </div>
        <p style="color: #475569; line-height: 1.6;">{{holiday_description}}</p>
        <p>Enjoy your break!</p>
        <p>Best Regards,<br>{{company_name}}</p>
    </div>
</div>
            `,
            variables: ['employee_name', 'holiday_title', 'holiday_start_date', 'holiday_end_date', 'holiday_type', 'holiday_description', 'company_name'],
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    // WhatsApp Template
    const waSnap = await waTemplates.where('slug', '==', 'holiday_announcement').limit(1).get();
    if (waSnap.empty) {
        await waTemplates.add({
            name: 'Holiday Announcement',
            slug: 'holiday_announcement',
            subject: 'Holiday Notice',
            body: `Dear *{{employee_name}}*, 

We are pleased to announce a holiday for *{{holiday_title}}*.

📅 *Dates:* {{holiday_start_date}} - {{holiday_end_date}}
✨ *Type:* {{holiday_type}}

{{holiday_description}}

Enjoy your break!

Best Regards,
*{{company_name}}*`,
            variables: ['employee_name', 'holiday_title', 'holiday_start_date', 'holiday_end_date', 'holiday_type', 'holiday_description', 'company_name'],
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
}
