import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/sender';
import { admin } from '@/lib/firebase/admin'; // Use Admin SDK
import type { Employee } from '@/types';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
    try {
        // TODO: Add proper authentication check here
        // For now, we'll trust the client-side check
        // In production, verify the user's role from session/token

        // Ensure Admin SDK is initialized
        if (!admin.apps.length) {
            throw new Error("Firebase Admin SDK not initialized");
        }

        const body = await request.json();
        const { employeeIds, subject, body: emailBody, attachmentUrls } = body;

        // Validate input
        if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
            return NextResponse.json({ error: 'No employees selected' }, { status: 400 });
        }

        if (!subject || !emailBody) {
            return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 });
        }

        // Fetch employee details using Admin SDK
        const db = admin.firestore();
        const employeePromises = employeeIds.map(async (id) => {
            const employeeDoc = await db.collection('employees').doc(id).get();
            if (employeeDoc.exists) {
                return { id: employeeDoc.id, ...employeeDoc.data() } as Employee & { id: string };
            }
            return null;
        });

        const employees = (await Promise.all(employeePromises)).filter(emp => emp !== null) as (Employee & { id: string })[];

        // Prepare attachment HTML if any
        let attachmentHtml = '';
        if (attachmentUrls && attachmentUrls.length > 0) {
            attachmentHtml = `
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <h4 style="color: #333; font-size: 14px; margin-bottom: 10px;">Attachments:</h4>
          <ul style="list-style: none; padding: 0;">
            ${attachmentUrls.map((att: { name: string; url: string }) => `
              <li style="margin: 5px 0;">
                <a href="${att.url}" target="_blank" style="color: #0066cc; text-decoration: none;">
                  📎 ${att.name}
                </a>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
        }

        // Send emails to each employee
        let sentCount = 0;
        const errors: string[] = [];

        for (const employee of employees) {
            try {
                // Replace variables with employee-specific data
                const personalizedSubject = subject
                    .replace(/{{employee_name}}/g, employee.fullName || 'Employee')
                    .replace(/{{name}}/g, employee.fullName || 'Employee') // Alias
                    .replace(/{{employee_id}}/g, employee.employeeCode || '')
                    .replace(/{{department}}/g, employee.department || '')
                    .replace(/{{designation}}/g, employee.designation || '');

                const personalizedBody = emailBody
                    .replace(/{{employee_name}}/g, employee.fullName || 'Employee')
                    .replace(/{{name}}/g, employee.fullName || 'Employee') // Alias
                    .replace(/{{employee_id}}/g, employee.employeeCode || '')
                    .replace(/{{department}}/g, employee.department || '')
                    .replace(/{{designation}}/g, employee.designation || '');

                // Add attachments to body
                const finalBody = personalizedBody + attachmentHtml;

                // Match sendEmail signature
                await sendEmail({
                    to: employee.email!,
                    subject: personalizedSubject,
                    body: finalBody,
                    data: {
                        // company_name and date are handled by default in sender.ts if not provided here
                        // but we can pass explicit overrides if needed
                        company_name: process.env.NEXT_PUBLIC_APP_NAME || 'Nextsew',
                    }
                });

                sentCount++;
            } catch (error: any) {
                console.error(`Error sending email to ${employee.email}:`, error);
                errors.push(`${employee.fullName}: ${error.message}`);
            }
        }

        if (sentCount === 0) {
            return NextResponse.json(
                { error: 'Failed to send emails', details: errors },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            sentCount,
            totalCount: employees.length,
            errors: errors.length > 0 ? errors : undefined,
        });

    } catch (error: any) {
        console.error('Send email API error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
