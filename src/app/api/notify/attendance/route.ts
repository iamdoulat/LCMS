import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/sender';
import { sendWhatsApp, getPhonesByRole } from '@/lib/whatsapp/sender';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            type,
            employeeId,
            employeeName,
            employeeCode,
            employeeEmail,
            employeePhone,
            time,
            date,
            flag,
            location,
            companyName,
            remarks
        } = body;

        // Validation
        if (!type || !employeeId || !employeeName || !time) {
            return NextResponse.json(
                { error: 'Missing required fields: type, employeeId, employeeName, time' },
                { status: 400 }
            );
        }

        // Validate type
        const validTypes = ['in_time', 'out_time', 'check_in', 'check_out'];
        if (!validTypes.includes(type)) {
            return NextResponse.json(
                { error: 'Invalid type. Must be one of: in_time, out_time, check_in, check_out' },
                { status: 400 }
            );
        }

        // Determine template slug based on type
        const templateSlug = `attendance_${type}`;

        // Prepare notification data
        const notificationData: Record<string, string> = {
            employee_name: employeeName,
            employee_code: employeeCode || 'N/A',
            time: time,
            date: date || new Date().toLocaleDateString(),
            location: location?.address || `${location?.latitude?.toFixed(6)}, ${location?.longitude?.toFixed(6)}` || 'Location unavailable',
        };

        // Add type-specific data
        if (type === 'in_time' && flag) {
            notificationData.flag = flag;
        }

        if ((type === 'check_in' || type === 'check_out') && companyName) {
            notificationData.location_company_name = companyName;
        }

        if (remarks) {
            notificationData.remarks = remarks;
        } else {
            notificationData.remarks = 'No remarks provided';
        }

        // Get HR/Admin contacts
        const hrAdminEmails: string[] = [];
        const hrAdminPhones: string[] = [];

        try {
            // Fetch HR/Admin emails
            const adminsSnapshot = await admin.firestore().collection('users')
                .where('role', 'array-contains-any', ['Admin', 'HR', 'Super Admin'])
                .get();

            adminsSnapshot.docs.forEach(doc => {
                const email = doc.data().email;
                if (email) hrAdminEmails.push(email);
            });

            // Fetch HR/Admin phones
            const phones = await getPhonesByRole(['Admin', 'HR', 'Super Admin']);
            hrAdminPhones.push(...phones);
        } catch (error) {
            console.error('Error fetching HR/Admin contacts:', error);
        }

        // Send notifications
        const notifications = {
            employeeEmail: { success: false, sent: false },
            employeeWhatsApp: { success: false, sent: false },
            hrEmail: { success: false, sent: false },
            hrWhatsApp: { success: false, sent: false }
        };

        // 1. Send email to employee
        if (employeeEmail) {
            try {
                await sendEmail({
                    to: employeeEmail,
                    templateSlug: templateSlug,
                    data: notificationData
                });
                notifications.employeeEmail = { success: true, sent: true };
            } catch (error: any) {
                console.error('Error sending email to employee:', error);
                notifications.employeeEmail = { success: false, sent: true };
            }
        }

        // 2. Send WhatsApp to employee
        if (employeePhone) {
            try {
                await sendWhatsApp({
                    to: employeePhone,
                    templateSlug: templateSlug,
                    data: notificationData
                });
                notifications.employeeWhatsApp = { success: true, sent: true };
            } catch (error: any) {
                console.error('Error sending WhatsApp to employee:', error);
                notifications.employeeWhatsApp = { success: false, sent: true };
            }
        }

        // 3. Send email to HR/Admin
        if (hrAdminEmails.length > 0) {
            try {
                await sendEmail({
                    to: hrAdminEmails,
                    templateSlug: templateSlug,
                    data: notificationData
                });
                notifications.hrEmail = { success: true, sent: true };
            } catch (error: any) {
                console.error('Error sending email to HR/Admin:', error);
                notifications.hrEmail = { success: false, sent: true };
            }
        }

        // 4. Send WhatsApp to HR/Admin
        if (hrAdminPhones.length > 0) {
            try {
                for (const phone of hrAdminPhones) {
                    await sendWhatsApp({
                        to: phone,
                        templateSlug: templateSlug,
                        data: notificationData
                    });
                }
                notifications.hrWhatsApp = { success: true, sent: true };
            } catch (error: any) {
                console.error('Error sending WhatsApp to HR/Admin:', error);
                notifications.hrWhatsApp = { success: false, sent: true };
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Notifications processed',
            type: type,
            notifications: notifications
        });

    } catch (error: any) {
        console.error('Error in attendance notification:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
