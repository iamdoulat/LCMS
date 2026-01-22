import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/sender';
import { format } from 'date-fns';

export async function GET(request: Request) {
    try {
        // Authenticate Cron Job (Optional header check)
        // const authHeader = request.headers.get('authorization');
        // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) { ... }

        const db = admin.firestore();
        const today = new Date();
        const currentMonth = today.getMonth() + 1; // 1-12
        const currentDay = today.getDate(); // 1-31

        // 1. Auto-Seed Template if missing
        const templateSlug = 'employee_birthday_wish';
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

        // 1.1 Auto-Seed WhatsApp Template if missing
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

        // 2. Fetch Active Employees
        const snapshot = await db.collection('employees').where('isActive', '==', true).get();
        const employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

        let sentCount = 0;

        // 3. Check for Birthdays
        for (const emp of employees) {
            if (!emp.dateOfBirth) continue;

            // Handle dateOfBirth: could be Timestamp or String (YYYY-MM-DD)
            let dobDate: Date | null = null;
            if (emp.dateOfBirth.toDate) {
                dobDate = emp.dateOfBirth.toDate();
            } else if (typeof emp.dateOfBirth === 'string') {
                dobDate = new Date(emp.dateOfBirth);
            }

            if (dobDate) {
                const dobMonth = dobDate.getMonth() + 1;
                const dobDay = dobDate.getDate();

                if (dobMonth === currentMonth && dobDay === currentDay) {
                    // It's their birthday!

                    // Send Email
                    if (emp.email) {
                        try {
                            await sendEmail({
                                to: emp.email,
                                templateSlug: templateSlug,
                                data: {
                                    employee_name: emp.fullName || emp.name || 'Employee'
                                }
                            });
                            sentCount++;
                        } catch (e) { console.error(`Failed to send Birthday Email to ${emp.id}`, e); }
                    }

                    // Send WhatsApp
                    if (emp.phone) {
                        try {
                            const { sendWhatsApp } = await import('@/lib/whatsapp/sender');
                            await sendWhatsApp({
                                to: emp.phone,
                                templateSlug: templateSlug, // Assuming WA sender handles this slug mapping or uses default text
                                data: {
                                    employee_name: emp.fullName || emp.name || 'Employee'
                                }
                            });
                        } catch (e) {
                            // Try importing WA sender dynamically, might fail if not set up, ignore silently for cron robustness
                            console.error(`Failed to send Birthday WA to ${emp.id}`, e);
                        }
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: `Checked ${employees.length} employees. Sent ${sentCount} birthday wishes.`,
            sentCount
        });

    } catch (error: any) {
        console.error("Birthday Cron Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
