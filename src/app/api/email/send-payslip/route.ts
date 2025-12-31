
import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/sender';
import { z } from 'zod';

const schema = z.object({
    pdfBase64: z.string(),
    employeeEmail: z.string().email(),
    employeeName: z.string(),
    payPeriod: z.string(),
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const result = schema.safeParse(body);

        if (!result.success) {
            return NextResponse.json({ error: 'Invalid request data', details: result.error.format() }, { status: 400 });
        }

        const { pdfBase64, employeeEmail, employeeName, payPeriod } = result.data;

        // Remove data:image/png;base64, prefix if present (though usually html2canvas -> jsPDF -> output is pure data or needs cleaning)
        // jsPDF .output('datauristring') gives prefix. .output('datauristring').split(',')[1] is safe.
        // The client will initiate this.

        const cleanBase64 = pdfBase64.includes('base64,') ? pdfBase64.split('base64,')[1] : pdfBase64;

        const emailBody = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>Payslip for ${payPeriod}</h2>
        <p>Dear ${employeeName},</p>
        <p>Please find attached your payslip for the period of <strong>${payPeriod}</strong>.</p>
        <p>If you have any questions, please contact the HR department.</p>
        <br/>
        <p>Best regards,</p>
        <p><strong>${process.env.NEXT_PUBLIC_APP_NAME || 'Nextsew'} Team</strong></p>
      </div>
    `;

        await sendEmail({
            to: employeeEmail,
            subject: `Payslip - ${payPeriod}`,
            body: emailBody,
            attachments: [
                {
                    filename: `Payslip_${employeeName.replace(/\s+/g, '_')}_${payPeriod}.pdf`,
                    content: cleanBase64,
                    encoding: 'base64'
                }
            ]
        });

        return NextResponse.json({ success: true, message: 'Email sent successfully' });

    } catch (error: any) {
        console.error('Error sending payslip email:', error);
        return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 });
    }
}
