import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';

export async function GET() {
    try {
        const db = admin.firestore();
        
        // 1. Email Template
        const emailTemplate = {
            slug: 'claim-approved',
            name: 'Claim Approved Notification',
            subject: 'Claim Approved: {{claimNo}}',
            body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Claim Approval Notification - {{EmployeeName}}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f6f8;
      margin: 0;
      padding: 0;
    }

    .container {
      max-width: 600px;
      margin: 20px auto;
      padding: 0;
    }

    .header {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }

    .header h1 {
      margin: 0;
      font-size: 28px;
    }

    .content {
      background: #f9fafb;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }

    .info-box {
      background: #ffffff;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 4px solid #2563eb;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      padding: 12px 0;
      border-bottom: 1px solid #e5e7eb;
    }

    .info-row:last-child {
      border-bottom: none;
    }

    .label {
      font-weight: bold;
      color: #6b7280;
    }

    .value {
      color: #1f2937;
      text-align: right;
    }

    .highlight {
      font-size: 18px;
      font-weight: bold;
      color: #1d4ed8;
    }

    .footer {
      text-align: center;
      margin-top: 30px;
      color: #6b7280;
      font-size: 12px;
    }

    @media only screen and (max-width: 600px) {
      .content,
      .header {
        padding: 20px;
      }

      .header h1 {
        font-size: 22px;
      }

      .info-row {
        flex-direction: column;
        gap: 5px;
      }

      .value {
        text-align: left;
      }
    }
  </style>
</head>

<body>

  <div class="container">

    <div class="header">
      <h1>✓ Claim Approved</h1>
    </div>

    <div class="content">

      <p style="font-size: 16px; margin-top: 0;">
        Dear <strong>{{EmployeeName}}</strong>,
      </p>

      <p>
        Your claim <strong>#{{claimNo}}</strong> for
        <span class="highlight">৳{{Amount}}</span>
        has been approved successfully.
      </p>

      <div class="info-box">

        <div class="info-row">
          <span class="label">Claim Number</span>
          <span class="value">#{{claimNo}}</span>
        </div>

        <div class="info-row">
          <span class="label">Approved Amount</span>
          <span class="value">৳{{Amount}}</span>
        </div>

        <div class="info-row">
          <span class="label">Supervisor's Comment</span>
          <span class="value">{{SupervisorComment}}</span>
        </div>

      </div>

      <p>
        Please contact the
        <strong>Accounts Department</strong>
        to receive your disbursed amount.
      </p>

      <p style="margin-top: 30px;">
        Regards,<br />
        <strong>{{company_name}} Team</strong>
      </p>

    </div>

    <div class="footer">
      <p>© {{year}} {{company_name}}. All rights reserved.</p>
    </div>

  </div>

</body>
</html>`,
            variables: ['EmployeeName', 'claimNo', 'Amount', 'SupervisorComment', 'company_name', 'year'],
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('email_templates').doc('claim-approved').set(emailTemplate, { merge: true });

        // 2. WhatsApp Template
        const whatsappTemplate = {
            slug: 'claim-approved-whatsapp',
            name: 'Claim Approved Notification (WhatsApp)',
            body: 'Hello *{{EmployeeName}}*, Your claim *{{claimNo}}* for *৳{{Amount}}* has been approved.\n\n*Comment:* {{SupervisorComment}}\n\nPlease contact Accounts for your disbursed payment. Thanks!',
            variables: ['EmployeeName', 'claimNo', 'Amount', 'SupervisorComment'],
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('whatsapp_templates').doc('claim-approved-whatsapp').set(whatsappTemplate, { merge: true });

        // 3. Disbursed Email Template
        const disbursedEmailTemplate = {
            slug: 'claim-disbursed',
            name: 'Claim Disbursed Notification',
            subject: 'Claim Disbursed: {{claimNo}}',
            body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Claim Disbursement Notification - {{EmployeeName}}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f6f8;
      margin: 0;
      padding: 0;
    }

    .container {
      max-width: 600px;
      margin: 20px auto;
      padding: 0;
    }

    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }

    .header h1 {
      margin: 0;
      font-size: 28px;
    }

    .content {
      background: #f9fafb;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }

    .info-box {
      background: #ffffff;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 4px solid #10b981;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      padding: 12px 0;
      border-bottom: 1px solid #e5e7eb;
    }

    .info-row:last-child {
      border-bottom: none;
    }

    .label {
      font-weight: bold;
      color: #6b7280;
    }

    .value {
      color: #1f2937;
      text-align: right;
    }

    .highlight {
      font-size: 18px;
      font-weight: bold;
      color: #059669;
    }

    .footer {
      text-align: center;
      margin-top: 30px;
      color: #6b7280;
      font-size: 12px;
    }

    @media only screen and (max-width: 600px) {
      .content,
      .header {
        padding: 20px;
      }

      .header h1 {
        font-size: 22px;
      }

      .info-row {
        flex-direction: column;
        gap: 5px;
      }

      .value {
        text-align: left;
      }
    }
  </style>
</head>

<body>

  <div class="container">

    <div class="header">
      <h1>✓ Claim Disbursed</h1>
    </div>

    <div class="content">

      <p style="font-size: 16px; margin-top: 0;">
        Dear <strong>{{EmployeeName}}</strong>,
      </p>

      <p>
        Your claim <strong>#{{claimNo}}</strong> for
        <span class="highlight">৳{{Amount}}</span>
        has been successfully disbursed.
      </p>

      <div class="info-box">

        <div class="info-row">
          <span class="label">Claim Number</span>
          <span class="value">#{{claimNo}}</span>
        </div>

        <div class="info-row">
          <span class="label">Claim Amount</span>
          <span class="value">৳{{Amount}}</span>
        </div>

        <div class="info-row">
          <span class="label">Approved Amount</span>
          <span class="value">৳{{ApprovedAmount}}</span>
        </div>

        <div class="info-row">
          <span class="label">Due Amount</span>
          <span class="value">৳{{DueAmount}}</span>
        </div>

        <div class="info-row">
          <span class="label">Supervisor's Comment</span>
          <span class="value">{{SupervisorComment}}</span>
        </div>

      </div>

      <p>
        Please check your account or contact the
        <strong>Accounts Department</strong>
        for confirmation.
      </p>

      <p style="margin-top: 30px;">
        Regards,<br />
        <strong>{{company_name}} Team</strong>
      </p>

    </div>

    <div class="footer">
      <p>© {{year}} {{company_name}}. All rights reserved.</p>
    </div>

  </div>

</body>
</html>`,
            variables: ['EmployeeName', 'claimNo', 'Amount', 'ApprovedAmount', 'DueAmount', 'SupervisorComment', 'company_name', 'year'],
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('email_templates').doc('claim-disbursed').set(disbursedEmailTemplate, { merge: true });

        // 4. Disbursed WhatsApp Template
        const disbursedWhatsappTemplate = {
            slug: 'claim-disbursed-whatsapp',
            name: 'Claim Disbursed Notification (WhatsApp)',
            body: 'Hello *{{EmployeeName}}*, Your claim *{{claimNo}}* for *৳{{Amount}}* has been disbursed. Approved: *৳{{ApprovedAmount}}*, Due: *৳{{DueAmount}}*.\n\n*Comment:* {{SupervisorComment}}\n\nPlease check with Accounts for confirmation. Thanks!',
            variables: ['EmployeeName', 'claimNo', 'Amount', 'ApprovedAmount', 'DueAmount', 'SupervisorComment'],
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('whatsapp_templates').doc('claim-disbursed-whatsapp').set(disbursedWhatsappTemplate, { merge: true });

        // 5. Reverted Email Template
        const revertedEmailTemplate = {
            slug: 'claim-reverted',
            name: 'Claim Reverted Notification',
            subject: 'Action Required: Claim #{{claimNo}} Updated',
            body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Claim Update Notification - {{EmployeeName}}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f6f8;
      margin: 0;
      padding: 0;
    }

    .container {
      max-width: 600px;
      margin: 20px auto;
      padding: 0;
    }

    .header {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: #ffffff;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }

    .header h1 {
      margin: 0;
      font-size: 28px;
    }

    .content {
      background: #f9fafb;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }

    .info-box {
      background: #ffffff;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 4px solid #4f46e5;
    }

    .info-row {
      padding: 12px 0;
      border-bottom: 1px solid #e5e7eb;
    }

    .info-row:last-child {
      border-bottom: none;
    }

    .label {
      font-weight: bold;
      color: #6b7280;
      display: block;
      margin-bottom: 5px;
    }

    .value {
      color: #1f2937;
    }

    .button {
      display: inline-block;
      margin-top: 20px;
      background-color: #4f46e5;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-weight: bold;
    }

    .footer {
      text-align: center;
      margin-top: 30px;
      color: #6b7280;
      font-size: 12px;
    }

    @media only screen and (max-width: 600px) {
      .content,
      .header {
        padding: 20px;
      }

      .header h1 {
        font-size: 22px;
      }
    }
  </style>
</head>

<body>
  <div class="container">

    <div class="header">
      <h1>Claim Update Notification</h1>
    </div>

    <div class="content">

      <p style="font-size: 16px; margin-top: 0;">
        Dear <strong>{{EmployeeName}}</strong>,
      </p>

      <p>
        Your claim <strong>#{{claimNo}}</strong> has been updated or reverted by your supervisor for further review.
      </p>

      <div class="info-box">

        <div class="info-row">
          <span class="label">Claim Number</span>
          <span class="value">#{{claimNo}}</span>
        </div>

        <div class="info-row">
          <span class="label">Supervisor's Comment</span>
          <span class="value">{{SupervisorComment}}</span>
        </div>

      </div>

      <p>
        Please log in to the mobile application to make any necessary corrections.
      </p>

      <!-- Optional Button -->
      <!--
      <a href="{{app_link}}" class="button">
        Open Application
      </a>
      -->

      <p style="margin-top: 30px;">
        Regards,<br />
        <strong>{{company_name}} Team</strong>
      </p>

    </div>

    <div class="footer">
      <p>© {{year}} {{company_name}}. All rights reserved.</p>
    </div>

  </div>
</body>
</html>`,
            variables: ['EmployeeName', 'claimNo', 'SupervisorComment', 'company_name', 'year', 'app_link'],
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('email_templates').doc('claim-reverted').set(revertedEmailTemplate, { merge: true });

        // 6. Reverted WhatsApp Template
        const revertedWhatsappTemplate = {
            slug: 'claim-reverted-whatsapp',
            name: 'Claim Reverted Notification (WhatsApp)',
            body: 'Hello *{{EmployeeName}}*, your claim *{{claimNo}}* has been updated by your supervisor.\n\n*Comment:* {{SupervisorComment}}\n\nPlease review and re-submit if necessary. Thanks!',
            variables: ['EmployeeName', 'claimNo', 'SupervisorComment'],
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('whatsapp_templates').doc('claim-reverted-whatsapp').set(revertedWhatsappTemplate, { merge: true });

        return NextResponse.json({ 
            success: true, 
            message: 'Claim approval, disbursement, and revert templates seeded successfully',
            templates: ['claim-approved', 'claim-approved-whatsapp', 'claim-disbursed', 'claim-disbursed-whatsapp', 'claim-reverted', 'claim-reverted-whatsapp']
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
