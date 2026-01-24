import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/sender';
import { differenceInDays, parseISO, format } from 'date-fns';

const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    try {
        return format(parseISO(dateString), 'dd MMM yyyy');
    } catch (e) {
        return dateString; // Return original if parsing fails
    }
};

const calculateDays = (start: string | undefined, end: string | undefined): string => {
    if (!start || !end) return '1 day';
    try {
        const startDate = new Date(start);
        const endDate = new Date(end);
        // Calculate difference in milliseconds
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        // Calculate difference in days (add 1 to include both start and end dates)
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } catch (e) {
        return '1 day';
    }
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, requestId, status, rejectionReason } = body;

        if (!requestId || !type) {
            return NextResponse.json({ error: 'Request ID and Type are required' }, { status: 400 });
        }

        // 1. Fetch Visit Data
        const doc = await admin.firestore().collection('visit_applications').doc(requestId).get();
        if (!doc.exists) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }
        const data = doc.data();

        // 2. Fetch Employee Data
        let employeeEmail = '';
        let employeeName = data?.employeeName || 'Employee';
        if (data?.employeeId) {
            const empDoc = await admin.firestore().collection('employees').doc(data.employeeId).get();
            if (empDoc.exists) {
                const empData = empDoc.data();
                employeeEmail = empData?.email;
                if (!employeeName && empData?.name) employeeName = empData.name;
            }
        }

        // 3. Handle Notification
        if (type === 'new_request') {
            // Notify Admin/HR
            const adminsSnapshot = await admin.firestore().collection('users')
                .where('role', 'array-contains-any', ['Admin', 'HR', 'Super Admin'])
                .get();

            const adminEmails = adminsSnapshot.docs
                .map(doc => doc.data().email)
                .filter(email => email);



            const { sendWhatsApp, getPhonesByRole } = await import('@/lib/whatsapp/sender');
            const adminPhones = await getPhonesByRole(['Admin', 'HR', 'Super Admin']);

            const templateData = {
                employee_name: employeeName,
                customer_name: data?.customerName || 'N/A',
                location: data?.location || 'N/A',
                visit_date_start: formatDate(data?.fromDate || data?.visitDate),
                visit_date_end: formatDate(data?.toDate || data?.visitDate),
                visit_purpose: data?.reason || 'N/A',
                days: calculateDays(data?.fromDate || data?.visitDate, data?.toDate || data?.visitDate),
                day_count: data?.day || calculateDays(data?.fromDate || data?.visitDate, data?.toDate || data?.visitDate).split(' ')[0],
                link: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/hr/visit-applications`
            };

            if (adminEmails.length > 0) {
                await sendEmail({
                    to: adminEmails,
                    templateSlug: 'admin_new_visit_application',
                    data: templateData
                });
            }

            if (adminPhones.length > 0) {
                // sendWhatsApp imported above
                for (const phone of adminPhones) {
                    await sendWhatsApp({
                        to: phone,
                        templateSlug: 'admin_new_visit_application',
                        data: templateData
                    });
                }
            }

            // Push Notification to Admins
            try {
                const { sendServerPushNotification } = await import('@/lib/services/notification-service');
                await sendServerPushNotification({
                    title: 'New Visit Request 📍',
                    body: `${employeeName} requested a visit to ${data?.customerName || 'Customer'}.`,
                    targetRoles: ['Admin', 'HR', 'Super Admin'],
                    url: '/dashboard/hr/visit-applications'
                });
            } catch (err) { console.error('Error sending push to admins:', err); }

            return NextResponse.json({ success: true, notified: 'admins' });

        } else if (type === 'decision') {
            // Notify Employee
            let employeePhone = '';
            if (data?.employeeId) {
                const empDoc = await admin.firestore().collection('employees').doc(data.employeeId).get();
                if (empDoc.exists) {
                    employeePhone = empDoc.data()?.phone;
                }
            }

            if (!employeeEmail) {
                return NextResponse.json({ message: 'Employee email not found' });
            }

            let templateSlug = '';
            let pushTitle = '';
            if (status === 'Approved') {
                templateSlug = 'employee_visit_application_approved';
                pushTitle = 'Visit Approved ✅';
            } else if (status === 'Rejected') {
                templateSlug = 'employee_visit_application_rejected';
                pushTitle = 'Visit Rejected ❌';
            } else return NextResponse.json({ message: 'Status requires no email.' });

            await sendEmail({
                to: employeeEmail,
                templateSlug: templateSlug,
                data: {
                    employee_name: employeeName,
                    customer_name: data?.customerName || 'N/A',
                    visit_date_start: formatDate(data?.fromDate || data?.visitDate),
                    visit_date_end: formatDate(data?.toDate || data?.visitDate),
                    rejection_reason: rejectionReason || data?.rejectionReason || 'No reason provided'
                }
            });

            if (employeePhone) {
                const { sendWhatsApp } = await import('@/lib/whatsapp/sender');
                await sendWhatsApp({
                    to: employeePhone,
                    templateSlug: templateSlug,
                    data: {
                        employee_name: employeeName,
                        customer_name: data?.customerName || 'N/A',
                        visit_date_start: formatDate(data?.fromDate || data?.visitDate),
                        visit_date_end: formatDate(data?.toDate || data?.visitDate),
                        rejection_reason: rejectionReason || data?.rejectionReason || 'No reason provided'
                    }
                });
            }

            // Push Notification to Employee
            try {
                const { getUidFromEmployeeId } = await import('@/lib/notifications');
                const uid = await getUidFromEmployeeId(data?.employeeId);
                if (uid) {
                    const { sendServerPushNotification } = await import('@/lib/services/notification-service');
                    await sendServerPushNotification({
                        title: pushTitle,
                        body: `Your visit request to ${data?.customerName || 'Customer'} has been ${status.toLowerCase()}.`,
                        userIds: [uid],
                        url: '/mobile/dashboard'
                    });
                }
            } catch (err) { console.error('Error sending push to employee:', err); }

            return NextResponse.json({ success: true, notified: 'employee' });
        }

        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

    } catch (error: any) {
        console.error("Error sending visit notification:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
