
import * as admin from 'firebase-admin';

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
    console.error('Firebase Admin SDK initialization error (this may be expected during build):', error.code);
  }
}

// Export only the admin object. The consumer will be responsible for calling .auth(), .firestore(), etc.
// This avoids calling admin.auth() at the module's top level, which causes build failures on Vercel.
export { admin };
