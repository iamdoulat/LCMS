
import * as admin from 'firebase-admin';

// Ensure you have the necessary environment variables set up
const serviceAccount: admin.ServiceAccount = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
  // Replace `\/` with `\` in the private key if you're copying from a JSON file
  privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error: any) {
    console.error("Firebase Admin SDK initialization error: ", error.stack);
  }
}

export const adminAuth = admin.auth();
export const adminFirestore = admin.firestore();
export const adminApp = admin.apps[0];
// Export the admin namespace itself
export { admin };
