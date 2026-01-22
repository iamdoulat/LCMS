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

import { verifyAuth } from '@/lib/api/apiAuth';

export async function POST(request: Request) {
    try {
        // 1. Verify Authorization
        const { user, error } = await verifyAuth(request, ['Super Admin', 'Admin', 'HR']);
        if (error) return error;

        // Verify Admin SDK is initialized
        if (!admin.apps.length) {
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
            const isEmailInUse =
                authError.code === 'auth/email-already-in-use' ||
                (authError.message && authError.message.includes('already in use'));

            if (isEmailInUse) {
                try {
                    const existingUser = await admin.auth().getUserByEmail(email);
                    userRecord = existingUser;
                } catch (fetchError: any) {
                    console.error("Failed to fetch existing user:", fetchError);
                    return NextResponse.json({ error: `Auth Error: Email reported in use, but could not fetch user. ${fetchError.message}` }, { status: 400 });
                }
            } else {
                console.error("Error creating Auth user:", authError);
                return NextResponse.json({ error: `Auth Error: ${authError.message}` }, { status: 400 });
            }
        }

        const uid = userRecord.uid;

        // 4. Create Firestore Document
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
            }
        } catch (dbError: any) {
            console.error("Error creating Firestore doc:", dbError);
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
        } catch (emailError: any) {
            console.error("Error sending email:", emailError);
            emailStatus = `failed: ${emailError.message}`;
        }

        // 6. Send WhatsApp
        let whatsappStatus = 'skipped';
        try {
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
            }
        } catch (waError: any) {
            console.error("Error sending WhatsApp:", waError);
            whatsappStatus = `failed: ${waError.message}`;
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
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
