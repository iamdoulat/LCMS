
import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/sender';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, requestId, status, rejectionReason } = body;
        // type: 'new_request' | 'decision'

        if (!requestId || !type) {
            return NextResponse.json({ error: 'Request ID and Type are required' }, { status: 400 });
        }

        // 1. Fetch Advance Request Data
        const doc = await admin.firestore().collection('advance_salary').doc(requestId).get();
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

        // 3. Handle Notifications
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

            if (adminEmails.length > 0) {
                await sendEmail({
                    to: adminEmails,
                    templateSlug: 'admin_new_advance_salary_request',
                    data: {
                        employee_name: employeeName,
                        amount: data?.amount?.toString() || '0',
                        reason: data?.reason || 'N/A',
                        date: data?.date || new Date().toLocaleDateString(),
                        link: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/hr/payroll/advance-salary`
                    }
                });
            }

            if (adminPhones.length > 0) {
                // sendWhatsApp imported above
                for (const phone of adminPhones) {
                    await sendWhatsApp({
                        to: phone,
                        templateSlug: 'admin_new_advance_salary_request',
                        data: {
                            employee_name: employeeName,
                            amount: data?.amount?.toString() || '0',
                            reason: data?.reason || 'N/A',
                            date: data?.date || new Date().toLocaleDateString(),
                            link: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/hr/payroll/advance-salary`
                        }
                    });
                }
            }

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
            if (status === 'Approved') templateSlug = 'employee_advance_salary_approved';
            else if (status === 'Rejected') templateSlug = 'employee_advance_salary_rejected';
            else return NextResponse.json({ message: 'Status requires no email.' });

            await sendEmail({
                to: employeeEmail,
                templateSlug: templateSlug,
                data: {
                    employee_name: employeeName,
                    amount: data?.amount?.toString() || '0',
                    requested_amount: data?.advanceAmount?.toString() || data?.amount?.toString() || '0',
                    rejection_reason: rejectionReason || data?.remarks || 'No reason provided'
                }
            });

            if (employeePhone) {
                const { sendWhatsApp } = await import('@/lib/whatsapp/sender');
                await sendWhatsApp({
                    to: employeePhone,
                    templateSlug: templateSlug,
                    data: {
                        employee_name: employeeName,
                        amount: data?.amount?.toString() || '0',
                        requested_amount: data?.advanceAmount?.toString() || data?.amount?.toString() || '0',
                        rejection_reason: rejectionReason || data?.remarks || 'No reason provided'
                    }
                });
            }

            return NextResponse.json({ success: true, notified: 'employee' });
        }

        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

    } catch (error: any) {
        console.error("Error sending advance salary notification:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
