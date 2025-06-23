
import * as admin from 'firebase-admin';

// --- IMPORTANT ---
// For deployment on platforms like Vercel, you must set the Firebase Admin SDK
// environment variables in your project's settings.

// Check if the required environment variables are set.
// This prevents initialization attempts during the Vercel build process.
const hasCredentials =
  process.env.FIREBASE_ADMIN_PROJECT_ID &&
  process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
  process.env.FIREBASE_ADMIN_PRIVATE_KEY;

if (!admin.apps.length && hasCredentials) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
  } catch (error: any) {
    console.error('Firebase Admin SDK initialization error:', error.code);
  }
}

// These functions will now throw an error at runtime if used without proper initialization,
// which is the correct behavior. During build, they are just references and not executed.
export const adminAuth = admin.auth();
export const adminFirestore = admin.firestore();
export { admin };
