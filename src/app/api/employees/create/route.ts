import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { sendEmail } from '@/lib/email/sender';
import * as fs from 'fs';
import * as path from 'path';

// Helper to generate random password
const generatePassword = (length = 10) => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let retVal = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
        retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    return retVal;
};

// Helper to log to file
const logToFile = (message: string) => {
    try {
        const logPath = path.join(process.cwd(), 'email-debug.log');
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
    } catch (e) {
        // Ignore logging errors
    }
};

export async function POST(request: Request) {
    try {
        // 1. Verify Admin SDK is initialized (it should be if env vars are correct)
        if (!admin.apps.length) {
            // Re-attempt init or fail
            // admin.ts handles init on import, so we assume it's done if env vars exist.
            // If not, we might fail here.
            const { admin: initializedAdmin } = await import('@/lib/firebase/admin');
            if (!initializedAdmin.apps.length) {
                return NextResponse.json({ error: 'Server misconfiguration: Admin SDK not initialized.' }, { status: 500 });
            }
        }

        const data = await request.json();
        const { email, firstName, lastName, photoURL, ...otherData } = data;

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // 2. Generate Password
        const password = generatePassword(8);
        const displayName = `${firstName} ${lastName}`.trim();

        // 3. Create Auth User
        let userRecord;
        try {
            userRecord = await admin.auth().createUser({
                email,
                password,
                displayName,
                photoURL: photoURL || undefined,
            });
        } catch (authError: any) {
            // Check for both error code and message content for robustness
            const isEmailInUse =
                authError.code === 'auth/email-already-in-use' ||
                (authError.message && authError.message.includes('already in use'));

            if (isEmailInUse) {

                try {
                    const existingUser = await admin.auth().getUserByEmail(email);
                    userRecord = existingUser;
                } catch (fetchError: any) {
                    // Check if user really doesn't exist (race condition or confusion)
                    console.error("Failed to fetch existing user:", fetchError);
                    return NextResponse.json({ error: `Auth Error: Email reported in use, but could not fetch user. ${fetchError.message}` }, { status: 400 });
                }
            } else {
                console.error("Error creating Auth user:", authError);
                // Log full error details
                logToFile(`AUTH ERROR for ${email}: Code=${authError.code} | Msg=${authError.message}`);
                return NextResponse.json({ error: `Auth Error: ${authError.message}` }, { status: 400 });
            }
        }

        const uid = userRecord.uid;

        // 4. Create Firestore Document
        // We use the same UID for the document ID
        try {
            const timestamp = admin.firestore.FieldValue.serverTimestamp();

            // 4a. Create Employee Document
            await admin.firestore().collection('employees').doc(uid).set({
                id: uid,
                uid: uid,
                email,
                firstName,
                lastName,
                photoURL,
                fullName: displayName,
                ...otherData,
                createdAt: timestamp,
                updatedAt: timestamp,
            });

            // 4b. Create User Document (Replication for Login)
            // Check if user doc exists first to avoid overwriting existing roles if we are in "repair" mode (auth exists)
            const userDocRef = admin.firestore().collection('users').doc(uid);
            const userDoc = await userDocRef.get();

            if (!userDoc.exists) {
                await userDocRef.set({
                    id: uid,
                    uid: uid,
                    displayName: displayName,
                    email: email,
                    photoURL: photoURL || null,
                    role: ['User'], // Default role for new employees
                    disabled: false,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                });

            } else {

            }

        } catch (dbError: any) {
            console.error("Error creating Firestore doc:", dbError);
            logToFile(`DB ERROR for ${email}: ${dbError.message}`);
            return NextResponse.json({ error: `Database Error: ${dbError.message}` }, { status: 500 });
        }

        // 5. Send Email
        let emailStatus = 'skipped';
        try {
            await sendEmail({
                to: email,
                templateSlug: 'account_creation_details',
                data: {
                    name: displayName,
                    user_name: email,
                    password: password,
                    login_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/mobile/dashboard`
                }
            });
            emailStatus = 'sent';
            logToFile(`SUCCESS: Email sent to ${email}`);
        } catch (emailError: any) {
            console.error("Error sending email:", emailError);
            emailStatus = `failed: ${emailError.message}`;
            logToFile(`ERROR sending email to ${email}: ${emailError.message} | Stack: ${emailError.stack}`);
        }

        // 6. Send WhatsApp
        let whatsappStatus = 'skipped';
        try {
            // We need the phone number. It should be in `otherData.phone`.
            // `create` endpoint receives `phone`.
            if ((otherData as any).phone) {
                const { sendWhatsApp } = await import('@/lib/whatsapp/sender');
                await sendWhatsApp({
                    to: (otherData as any).phone,
                    templateSlug: 'account_creation_details',
                    data: {
                        name: displayName,
                        user_name: email,
                        password: password,
                        login_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/mobile/dashboard`
                    }
                });
                whatsappStatus = 'sent';
                logToFile(`SUCCESS: WhatsApp sent to ${(otherData as any).phone}`);
            } else {
                console.warn("No phone number provided for WhatsApp notification.");
            }
        } catch (waError: any) {
            console.error("Error sending WhatsApp:", waError);
            whatsappStatus = `failed: ${waError.message}`;
            logToFile(`ERROR sending WhatsApp to ${email}: ${waError.message}`);
        }

        return NextResponse.json({
            success: true,
            userId: uid,
            message: 'Employee created successfully.',
            emailStatus,
            whatsappStatus
        });

    } catch (error: any) {
        console.error("API Error:", error);
        logToFile(`API CRITICAL ERROR: ${error.message}`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
