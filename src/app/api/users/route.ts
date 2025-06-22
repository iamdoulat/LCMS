
import { NextResponse } from 'next/server';
// Import 'admin' from our central config file
import { adminAuth, adminFirestore, admin } from '@/lib/firebase/admin';
import type { UserRole } from '@/types';

export async function POST(request: Request) {
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
      // You can add photoURL here if available: photoURL: '...'
    });

    // --- Set Custom Claims for Role-Based Access (Optional but Recommended) ---
    // This allows you to secure backend resources and Firestore rules based on roles.
    await adminAuth.setCustomUserClaims(userRecord.uid, { role });

    // --- Create Firestore user profile document ---
    const userDocRef = adminFirestore.collection("users").doc(userRecord.uid);
    await userDocRef.set({
      uid: userRecord.uid,
      displayName: displayName,
      email: email,
      role: role,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      // Add any other profile fields here
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
      statusCode = 409; // Conflict
    } else if (error.code === 'auth/invalid-password') {
      errorMessage = "The password must be a string with at least 6 characters.";
      statusCode = 400; // Bad Request
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
