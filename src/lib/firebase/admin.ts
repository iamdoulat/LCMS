
import * as admin from 'firebase-admin';

// --- IMPORTANT ---
// For deployment on platforms like Vercel, you must set the Firebase Admin SDK
// environment variables in your project's settings. The build will succeed without them,
// but API routes using this file will fail at runtime if the variables are not configured.

const serviceAccount: admin.ServiceAccount = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  // Replace `\/` with `\` in the private key if you're copying from a JSON file
  privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error: any) {
    // We log the error during build if it happens, but don't throw an error.
    // This allows the build to complete. The app will throw a proper error at runtime if misconfigured.
    console.error("Firebase Admin SDK initialization error (this may be expected during build):", error.code);
  }
}

export const adminAuth = admin.auth();
export const adminFirestore = admin.firestore();
export { admin };
