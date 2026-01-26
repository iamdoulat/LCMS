import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/sender';
import { sendWhatsApp, getPhonesByRole } from '@/lib/whatsapp/sender';
import { sendTelegram } from '@/lib/telegram/sender';
import { reverseGeocode } from '@/lib/firebase/checkInOut';
import { getCompanyName } from '@/lib/settings/company';

import { verifyAuth } from '@/lib/api/apiAuth';

export async function POST(request: Request) {
    try {
        // 1. Verify Authorization (Any authenticated user can trigger for now)
        const { user, error } = await verifyAuth(request);
        if (error) return error;

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
            remarks,
            photoUrl
        }: {
            type: string;
            employeeId: string;
            employeeName: string;
            employeeCode?: string;
            employeeEmail?: string;
            employeePhone?: string;
            time: string;
            date?: string;
            flag?: string;
            location?: { address?: string; latitude?: number; longitude?: number };
            companyName?: string;
            remarks?: string;
            photoUrl?: string;
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

        // 1. Ensure we have a readable address (Server-side fallback)
        let finalAddress = location?.address || '';
        if (!finalAddress && location?.latitude && location?.longitude) {
            try {
                finalAddress = await reverseGeocode(location.latitude, location.longitude);
            } catch (err) {
                finalAddress = `Coords: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
            }
        } else if (!finalAddress) {
            finalAddress = 'Location unavailable';
        }

        // 2. TRIGGER TELEGRAM NOTIFICATION (Template-driven with fallback)
        try {
            const address = finalAddress;
            let fallbackMsg = '';

            switch (type) {
                case 'in_time':
                    fallbackMsg = `🔵 <b>[IN TIME]</b> - ${employeeName} - ${employeeCode || 'N/A'}\n- <b>Time:</b> ${time}\n- <b>Date:</b> ${date || new Date().toLocaleDateString()}\n- <b>Location:</b> ${address}\n${remarks ? `- <b>Remarks:</b> ${remarks}` : ''}`;
                    break;
                case 'out_time':
                    fallbackMsg = `⚪ <b>[OUT TIME]</b> - ${employeeName} - ${employeeCode || 'N/A'}\n- <b>Time:</b> ${time}\n- <b>Date:</b> ${date || new Date().toLocaleDateString()}\n- <b>Location:</b> ${address}\n${remarks ? `- <b>Remarks:</b> ${remarks}` : ''}`;
                    break;
                case 'check_in':
                    fallbackMsg = `🔴 <b>[CHECK IN]</b> - ${employeeName} - ${employeeCode || 'N/A'}\n- <b>Time:</b> ${time}\n- <b>Date:</b> ${date || new Date().toLocaleDateString()}\n- <b>Location:</b> ${address}\n${companyName ? `- <b>Company:</b> ${companyName}\n` : ''}${remarks ? `- <b>Remarks:</b> ${remarks}` : ''}`;
                    break;
                case 'check_out':
                    fallbackMsg = `🟢 <b>[CHECK OUT]</b> - ${employeeName} - ${employeeCode || 'N/A'}\n- <b>Time:</b> ${time}\n- <b>Date:</b> ${date || new Date().toLocaleDateString()}\n- <b>Location:</b> ${address}\n${companyName ? `- <b>Company:</b> ${companyName}\n` : ''}${remarks ? `- <b>Remarks:</b> ${remarks}` : ''}`;
                    break;
            }

            // Prepare data for template
            const templateData = {
                employee_name: employeeName,
                employee_code: employeeCode || 'N/A',
                time: time,
                date: date || new Date().toLocaleDateString(),
                location: address,
                location_company_name: companyName || '',
                remarks: remarks || 'No remarks provided',
                company_name: await getCompanyName()
            };

            // Fire and forget telegram
            sendTelegram({
                templateSlug,
                data: templateData,
                message: fallbackMsg, // Fallback if template is not found
                photoUrl: (type === 'check_in' || type === 'check_out') ? photoUrl : undefined
            }).catch(err => console.error('[ATTENDANCE NOTIFY] Telegram background error:', err));

        } catch (teleError) {
            console.error('[ATTENDANCE NOTIFY] Error preparing Telegram message:', teleError);
        }

        // 3. Prepare data for Email/WhatsApp templates
        const notificationData: Record<string, string> = {
            employee_name: employeeName,
            employee_code: employeeCode || 'N/A',
            time: time,
            date: date || new Date().toLocaleDateString(),
            location: finalAddress,
        };

        if (type === 'in_time' && flag) notificationData.flag = flag;
        if ((type === 'check_in' || type === 'check_out') && companyName) notificationData.location_company_name = companyName;
        notificationData.remarks = remarks || 'No remarks provided';

        // 4. Get HR/Admin contacts
        const hrAdminEmails: string[] = [];
        const hrAdminPhones: string[] = [];

        try {
            const adminsSnapshot = await admin.firestore().collection('users')
                .where('role', 'array-contains-any', ['Admin', 'HR', 'Super Admin'])
                .get();

            adminsSnapshot.docs.forEach(doc => {
                const email = doc.data().email;
                if (email) hrAdminEmails.push(email);
            });

            const phones = await getPhonesByRole(['Admin', 'HR', 'Super Admin']);
            hrAdminPhones.push(...phones);
        } catch (error) {
            console.error('Error fetching HR/Admin contacts:', error);
        }

        const notifications: Record<string, { success: boolean; sent: boolean; skipped?: boolean }> = {
            employeeEmail: { success: false, sent: false, skipped: false },
            employeeWhatsApp: { success: false, sent: false, skipped: false },
            hrEmail: { success: false, sent: false, skipped: false },
            hrWhatsApp: { success: false, sent: false, skipped: false }
        };

        // 5. Send Email/WhatsApp (Template Controlled)
        const pushTitle = `${type.replace('_', ' ').toUpperCase()} Alert`;
        const pushBody = `${employeeName} - ${time} - ${finalAddress}`;

        // Employee Push
        try {
            const { getUidFromEmployeeId } = await import('@/lib/notifications');
            const uid = await getUidFromEmployeeId(employeeId);
            if (uid) {
                const { sendServerPushNotification } = await import('@/lib/services/notification-service');
                await sendServerPushNotification({
                    title: pushTitle,
                    body: pushBody,
                    userIds: [uid],
                    url: '/mobile/dashboard'
                });
            }
        } catch (err) { console.error('Error sending push to employee:', err); }

        // HR/Admin Push
        try {
            const { sendServerPushNotification } = await import('@/lib/services/notification-service');
            await sendServerPushNotification({
                title: `Team Attendance: ${pushTitle}`,
                body: pushBody,
                targetRoles: ['Admin', 'HR', 'Super Admin'],
                url: '/dashboard/hr/attendance-reconciliation'
            });
        } catch (err) { console.error('Error sending push to HR/Admin:', err); }

        // Employee Email
        if (employeeEmail) {
            try {
                const result = await sendEmail({ to: employeeEmail, templateSlug, data: notificationData });
                notifications.employeeEmail = { success: !!result?.success, sent: result?.status !== 'skipped', skipped: result?.status === 'skipped' };
            } catch (err) { console.error('Error sending email to employee:', err); }
        }

        // Employee WhatsApp
        if (employeePhone) {
            try {
                const result = await sendWhatsApp({ to: employeePhone, templateSlug, data: notificationData });
                notifications.employeeWhatsApp = { success: !!result?.success, sent: result?.status !== 'skipped', skipped: result?.status === 'skipped' };
            } catch (err) { console.error('Error sending WhatsApp to employee:', err); }
        }

        // HR/Admin Email (Using separate template)
        if (hrAdminEmails.length > 0) {
            try {
                const adminTemplateSlug = `admin_attendance_${type}`;
                const result = await sendEmail({ to: hrAdminEmails, templateSlug: adminTemplateSlug, data: notificationData });
                notifications.hrEmail = { success: !!result?.success, sent: result?.status !== 'skipped', skipped: result?.status === 'skipped' };
            } catch (err) { console.error('Error sending email to HR/Admin:', err); }
        }

        // HR/Admin WhatsApp (Using separate template)
        if (hrAdminPhones.length > 0) {
            try {
                const adminTemplateSlug = `admin_attendance_${type}`;
                let anySent = false;
                let anySkipped = false;
                for (const phone of hrAdminPhones) {
                    const result = await sendWhatsApp({ to: phone, templateSlug: adminTemplateSlug, data: notificationData });
                    if (result.success && result.status !== 'skipped') anySent = true;
                    if (result.status === 'skipped') anySkipped = true;
                }
                notifications.hrWhatsApp = { success: anySent || anySkipped, sent: anySent, skipped: !anySent && anySkipped };
            } catch (err) { console.error('Error sending WhatsApp to HR/Admin:', err); }
        }

        return NextResponse.json({
            success: true,
            message: 'Notifications processed',
            type: type,
            notifications: notifications
        });

    } catch (error: any) {
        console.error('Error in attendance notification:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
