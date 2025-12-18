
import * as admin from 'firebase-admin';

// This file is evaluated once when the server starts.
// It's crucial that environment variables are available at this time.
const hasCredentials =
  process.env.FIREBASE_ADMIN_PROJECT_ID &&
  process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
  process.env.FIREBASE_ADMIN_PRIVATE_KEY;

// Initialize the app only if it hasn't been initialized yet
// and if all the necessary credentials are present.
if (!admin.apps.length && hasCredentials) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        // The private key must be parsed correctly from the env var
        privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Firebase Admin SDK Initialization Error:', error);
  }
} else if (!admin.apps.length) {
    // This will log if the credentials are not found in the environment.
    console.warn("Firebase Admin credentials not found in environment. SDK not initialized.");
}


export { admin };
