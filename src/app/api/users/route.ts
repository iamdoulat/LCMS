
import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import type { UserRole } from '@/types';

export async function POST(request: Request) {
  try {
    const { email, password, displayName, role } = (await request.json()) as {
      email?: string;
      password?: string;
      displayName?: string;
      role?: UserRole;
    };

    if (!email || !password || !displayName || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, displayName, role.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    // Create user in Firebase Authentication using the Admin SDK
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
    });

    // Create user profile in Firestore
    const userDocRef = admin.firestore().collection('users').doc(userRecord.uid);
    await userDocRef.set({
      uid: userRecord.uid,
      displayName,
      email,
      role,
      photoURL: userRecord.photoURL || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      message: 'User created successfully.',
      uid: userRecord.uid,
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    let errorMessage = 'An unexpected error occurred.';
    if (error.code === 'auth/email-already-exists') {
      errorMessage = 'The email address is already in use by another account.';
    } else if (error.code === 'auth/invalid-password') {
        errorMessage = 'The password must be a string with at least six characters.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
