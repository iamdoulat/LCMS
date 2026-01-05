import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/sender';
import { sendWhatsApp } from '@/lib/whatsapp/sender';
import { sendTelegram } from '@/lib/telegram/sender';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            type,
            taskId,
            targetUserIds,
        }: {
            type: 'task_assigned' | 'task_update';
            taskId: string;
            targetUserIds: string[];
        } = body;

        // Validation
        if (!type || !taskId || !targetUserIds || targetUserIds.length === 0) {
            return NextResponse.json(
                { error: 'Missing required fields: type, taskId, targetUserIds' },
                { status: 400 }
            );
        }

        // 1. Fetch Task Details from Firestore
        const taskDoc = await admin.firestore().collection('project_tasks').doc(taskId).get();
        if (!taskDoc.exists) {
            // It might be using the Custom ID but the tool usually passes doc ID from frontend.
            // Let's also check by taskId field if not found by doc ID.
            const taskQuery = await admin.firestore().collection('project_tasks').where('taskId', '==', taskId).limit(1).get();
            if (taskQuery.empty) {
                return NextResponse.json({ error: 'Task not found' }, { status: 404 });
            }
            return processTask(taskQuery.docs[0], targetUserIds, type);
        }

        return processTask(taskDoc, targetUserIds, type);

    } catch (error: any) {
        console.error('Error in task notification:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

async function processTask(taskDoc: any, targetUserIds: string[], type: string) {
    const taskData = taskDoc.data();
    const taskTitle = taskData.taskTitle || 'Untitled Task';
    const projectTitle = taskData.projectTitle || 'General Project';
    const priority = taskData.priority || 'Medium';
    const dueDate = taskData.dueDate ? new Date(taskData.dueDate).toLocaleDateString() : 'No due date';
    const taskIdDisplay = taskData.taskId || taskDoc.id;

    const templateSlug = type === 'task_assigned' ? 'task_assigned' : 'task_update';

    // 2. Fetch Employee Details for Target Users
    const employeeDocs: any[] = [];

    // Search by employeeCode
    const codesSnapshot = await admin.firestore().collection('employees')
        .where('employeeCode', 'in', targetUserIds)
        .get();
    codesSnapshot.docs.forEach(doc => employeeDocs.push(doc));

    // Search by documentId for backward compatibility
    const idsSnapshot = await admin.firestore().collection('employees')
        .where(admin.firestore.FieldPath.documentId(), 'in', targetUserIds)
        .get();
    idsSnapshot.docs.forEach(doc => {
        if (!employeeDocs.some(ed => ed.id === doc.id)) {
            employeeDocs.push(doc);
        }
    });

    const employeeContacts = employeeDocs.map(doc => ({
        id: doc.id,
        name: doc.data().fullName || `${doc.data().firstName || ''} ${doc.data().lastName || ''}`.trim() || 'Employee',
        email: doc.data().email,
        phone: doc.data().phone,
    }));

    const notifications: Record<string, any> = {};

    // 3. Prepare data for Templates
    const notificationData: Record<string, string> = {
        task_id: taskIdDisplay,
        task_title: taskTitle,
        project_title: projectTitle,
        priority: priority,
        due_date: dueDate,
        link: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/account-details`
    };

    // 4. Send Notifications to each assigned employee
    for (const employee of employeeContacts) {
        notifications[employee.id] = { email: {}, whatsapp: {} };
        const employeeData = { ...notificationData, employee_name: employee.name };

        // Email
        if (employee.email) {
            try {
                const result = await sendEmail({ to: employee.email, templateSlug, data: employeeData });
                notifications[employee.id].email = { success: !!result?.success, status: result?.status };
            } catch (err) { console.error(`Error sending email to ${employee.email}:`, err); }
        }

        // WhatsApp
        if (employee.phone) {
            try {
                const result = await sendWhatsApp({ to: employee.phone, templateSlug, data: employeeData });
                notifications[employee.id].whatsapp = { success: !!result?.success, status: result?.status };
            } catch (err) { console.error(`Error sending WhatsApp to ${employee.phone}:`, err); }
        }
    }

    // 5. Trigger Telegram Notification (Single group notification)
    try {
        const telegramMsg = `🔔 <b>New Task Assigned</b>\n\n` +
            `📌 <b>Task:</b> ${taskTitle} (${taskIdDisplay})\n` +
            `📁 <b>Project:</b> ${projectTitle}\n` +
            `⚠️ <b>Priority:</b> ${priority}\n` +
            `📅 <b>Due Date:</b> ${dueDate}\n` +
            `👤 <b>Assigned to:</b> ${employeeContacts.map(e => e.name).join(', ')}\n\n` +
            `🔗 <a href="${notificationData.link}">View Dashboard</a>`;

        await sendTelegram({
            templateSlug,
            data: notificationData,
            message: telegramMsg
        }).catch(err => console.error('[TASK NOTIFY] Telegram background error:', err));
    } catch (teleError) {
        console.error('[TASK NOTIFY] Error preparing Telegram message:', teleError);
    }

    return NextResponse.json({
        success: true,
        message: 'Task notifications processed',
        type: type,
        notifications: notifications
    });
}
