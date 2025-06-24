
import 'dotenv/config';
import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import type { UserRole } from '@/types';

export async function POST(request: Request) {
  // Add a guard clause at the very beginning.
  // This check ensures that the Firebase Admin SDK has been initialized.
  if (!admin.apps.length) {
    console.error("Firebase Admin SDK not initialized. Ensure environment variables are set in your .env file and the server is restarted.");
    return NextResponse.json(
      { error: "Server not configured. Firebase Admin SDK failed to initialize." },
      { status: 500 }
    );
  }
  
  // Get auth and firestore instances inside the function to defer execution
  const adminAuth = admin.auth();
  const adminFirestore = admin.firestore();

  try {
    const { email, password, displayName, role } = await request.json() as {
      email?: string;
      password?: string;
      displayName?: string;
      role?: UserRole;
    };

    if (!email || !password || !displayName || !role) {
      return NextResponse.json({ error: "Missing required fields: email, password, displayName, role." }, { status: 400 });
    }

    // --- Create Firebase Auth user ---
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName,
    });

    // --- Create Firestore user profile document ---
    const userDocRef = adminFirestore.collection("users").doc(userRecord.uid);
    await userDocRef.set({
      uid: userRecord.uid,
      displayName: displayName,
      email: email,
      role: role,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: `User ${displayName} created successfully.`,
      uid: userRecord.uid
    });

  } catch (error: any) {
    console.error("Error creating user:", error);
    let errorMessage = "An unexpected error occurred.";
    let statusCode = 500;

    if (error.code === 'auth/email-already-exists') {
      errorMessage = "The email address is already in use by another account.";
      statusCode = 409;
    } else if (error.code === 'auth/invalid-password') {
      errorMessage = "The password must be a string with at least 6 characters.";
      statusCode = 400;
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
