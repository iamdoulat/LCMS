
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
    const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    console.log("Admin SDK: Attempting to initialize...");
    console.log("Admin SDK: Project ID present?", !!process.env.FIREBASE_ADMIN_PROJECT_ID);
    console.log("Admin SDK: Client Email present?", !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL);
    console.log("Admin SDK: Private Key length:", privateKey.length);
    console.log("Admin SDK: Private Key starts with:", privateKey.substring(0, 20));

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: (process.env.FIREBASE_ADMIN_PROJECT_ID || '').trim(),
        clientEmail: (process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '').trim(),
        privateKey: privateKey,
      }),
    });
    console.log("Admin SDK: Initialization successful.");
  } catch (error) {
    console.error('Firebase Admin SDK Initialization Error:', error);
  }
} else if (!admin.apps.length) {
  // This will log if the credentials are not found in the environment.
  console.warn("Firebase Admin credentials not found in environment. SDK not initialized.");
  console.warn("Missing vars:", {
    projectId: !process.env.FIREBASE_ADMIN_PROJECT_ID,
    email: !process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    key: !process.env.FIREBASE_ADMIN_PRIVATE_KEY
  });
}


export { admin };
