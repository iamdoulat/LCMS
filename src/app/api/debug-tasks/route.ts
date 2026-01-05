import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const employeeCode = searchParams.get('code');

    if (!employeeCode) {
        return NextResponse.json({ error: 'Employee code is required' }, { status: 400 });
    }

    try {
        const db = admin.firestore();

        // 1. Find the employee by code (check both 'id' and 'employeeCode' field)
        let employeeId = '';
        let employeeName = '';

        const empQueryCode = await db.collection('employees').where('employeeCode', '==', employeeCode).limit(1).get();
        if (!empQueryCode.empty) {
            employeeId = empQueryCode.docs[0].id;
            employeeName = empQueryCode.docs[0].data().name;
        } else {
            // Check if input is the actual Firestore ID
            const empDoc = await db.collection('employees').doc(employeeCode).get();
            if (empDoc.exists) {
                employeeId = empDoc.id;
                employeeName = empDoc.data()?.name;
            }
        }

        if (!employeeId) {
            return NextResponse.json({ error: `Employee with code/id '${employeeCode}' not found.` }, { status: 404 });
        }

        // 2. Find tasks assigned to this employee
        // Tasks have 'assignedUserIds' (array) or 'assignedUsers' (array of objects)
        const identifiers = [employeeId];
        if (employeeCode && !identifiers.includes(employeeCode)) {
            identifiers.push(employeeCode);
        }

        const tasksQuery = await db.collection('project_tasks')
            .where('assignedUserIds', 'array-contains-any', identifiers)
            .get();

        const tasks = tasksQuery.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return NextResponse.json({
            employee: { id: employeeId, code: employeeCode, name: employeeName },
            count: tasks.length,
            tasks: tasks
        });

    } catch (error: any) {
        console.error('Error searching tasks:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
