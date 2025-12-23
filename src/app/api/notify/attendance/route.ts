import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/sender';
import { sendWhatsApp, getPhonesByRole } from '@/lib/whatsapp/sender';
import { sendTelegram } from '@/lib/telegram/sender';
import { reverseGeocode } from '@/lib/firebase/checkInOut';

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

        // Ensure we have a readable address (Server-side fallback)
        let finalAddress = location?.address || '';
        if (!finalAddress && location?.latitude && location?.longitude) {
            try {
                console.log(`[ATTENDANCE NOTIFY] Attempting server-side reverse geocoding for ${location.latitude}, ${location.longitude}`);
                finalAddress = await reverseGeocode(location.latitude, location.longitude);
            } catch (err) {
                console.warn('[ATTENDANCE NOTIFY] Server-side reverse geocoding failed:', err);
                finalAddress = `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
            }
        } else if (!finalAddress) {
            finalAddress = 'Location unavailable';
        }

        // Prepare notification data
        const notificationData: Record<string, string> = {
            employee_name: employeeName,
            employee_code: employeeCode || 'N/A',
            time: time,
            date: date || new Date().toLocaleDateString(),
            location: finalAddress,
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

        // Send notifications tracking
        const notifications: Record<string, { success: boolean; sent: boolean; skipped?: boolean }> = {
            employeeEmail: { success: false, sent: false, skipped: false },
            employeeWhatsApp: { success: false, sent: false, skipped: false },
            hrEmail: { success: false, sent: false, skipped: false },
            hrWhatsApp: { success: false, sent: false, skipped: false }
        };

        // 1. Send email to employee
        if (employeeEmail) {
            try {
                const result = await sendEmail({
                    to: employeeEmail,
                    templateSlug: templateSlug,
                    data: notificationData
                });
                notifications.employeeEmail = {
                    success: !!result?.success,
                    sent: result?.status !== 'skipped',
                    skipped: result?.status === 'skipped'
                };
            } catch (error: any) {
                console.error('Error sending email to employee:', error);
                notifications.employeeEmail = { success: false, sent: false };
            }
        }

        // 2. Send WhatsApp to employee
        if (employeePhone) {
            try {
                const result = await sendWhatsApp({
                    to: employeePhone,
                    templateSlug: templateSlug,
                    data: notificationData
                });
                notifications.employeeWhatsApp = {
                    success: !!result?.success,
                    sent: result?.status !== 'skipped',
                    skipped: result?.status === 'skipped'
                };
            } catch (error: any) {
                console.error('Error sending WhatsApp to employee:', error);
                notifications.employeeWhatsApp = { success: false, sent: false };
            }
        }

        // 3. Send email to HR/Admin
        if (hrAdminEmails.length > 0) {
            try {
                const result = await sendEmail({
                    to: hrAdminEmails,
                    templateSlug: templateSlug,
                    data: notificationData
                });
                notifications.hrEmail = {
                    success: !!result?.success,
                    sent: result?.status !== 'skipped',
                    skipped: result?.status === 'skipped'
                };
            } catch (error: any) {
                console.error('Error sending email to HR/Admin:', error);
                notifications.hrEmail = { success: false, sent: false };
            }
        }

        // 4. Send WhatsApp to HR/Admin
        if (hrAdminPhones.length > 0) {
            try {
                let anySent = false;
                let anySkipped = false;
                for (const phone of hrAdminPhones) {
                    const result = await sendWhatsApp({
                        to: phone,
                        templateSlug: templateSlug,
                        data: notificationData
                    });
                    if (result.success && result.status !== 'skipped') anySent = true;
                    if (result.status === 'skipped') anySkipped = true;
                }
                notifications.hrWhatsApp = {
                    success: anySent || anySkipped,
                    sent: anySent,
                    skipped: !anySent && anySkipped
                };
            } catch (error: any) {
                console.error('Error sending WhatsApp to HR/Admin:', error);
                notifications.hrWhatsApp = { success: false, sent: false };
            }
        }

        // Create Telegram notification
        let telegramMsg = '';
        const address = finalAddress;

        switch (type) {
            case 'in_time':
                telegramMsg = `🔵 <b>[IN TIME]</b> - ${employeeName} - ${employeeCode}\n`;
                telegramMsg += `- <b>Time:</b> ${time}\n`;
                telegramMsg += `- <b>Date:</b> ${date}\n`;
                telegramMsg += `- <b>Location:</b> ${address}\n`;
                if (remarks) telegramMsg += `- <b>Remarks:</b> ${remarks}`;
                break;
            case 'out_time':
                telegramMsg = `⚪ <b>[OUT TIME]</b> - ${employeeName} - ${employeeCode}\n`;
                telegramMsg += `- <b>Time:</b> ${time}\n`;
                telegramMsg += `- <b>Date:</b> ${date}\n`;
                telegramMsg += `- <b>Location:</b> ${address}\n`;
                if (remarks) telegramMsg += `- <b>Remarks:</b> ${remarks}`;
                break;
            case 'check_in':
                telegramMsg = `🔴 <b>[CHECK IN]</b> - ${employeeName} - ${employeeCode}\n`;
                telegramMsg += `- <b>Time:</b> ${time}\n`;
                telegramMsg += `- <b>Date:</b> ${date}\n`;
                telegramMsg += `- <b>Location:</b> ${address}\n`;
                if (companyName) telegramMsg += `- <b>Company:</b> ${companyName}\n`;
                if (remarks) telegramMsg += `- <b>Remarks:</b> ${remarks}`;
                break;
            case 'check_out':
                telegramMsg = `🟢 <b>[CHECK OUT]</b> - ${employeeName} - ${employeeCode}\n`;
                telegramMsg += `- <b>Time:</b> ${time}\n`;
                telegramMsg += `- <b>Date:</b> ${date}\n`;
                telegramMsg += `- <b>Location:</b> ${address}\n`;
                if (companyName) telegramMsg += `- <b>Company:</b> ${companyName}\n`;
                if (remarks) telegramMsg += `- <b>Remarks:</b> ${remarks}`;
                break;
        }

        // Fire and forget telegram to not slow down the main response
        if (telegramMsg) {
            sendTelegram({
                message: telegramMsg,
                photoUrl: (type === 'check_in' || type === 'check_out') ? photoUrl : undefined
            })
                .then(res => {
                    if (res.success) {
                        console.log(`[ATTENDANCE NOTIFY] Telegram sent successfully for ${type}`);
                    } else {
                        console.error(`[ATTENDANCE NOTIFY] Telegram sending failed for ${type}:`, res.error);
                    }
                })
                .catch(err => {
                    console.error(`[ATTENDANCE NOTIFY] Telegram background error for ${type}:`, err);
                });
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
