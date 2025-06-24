
import * as admin from 'firebase-admin';
import { config } from 'dotenv';

// Explicitly load environment variables from .env file
config();

const hasCredentials =
  process.env.FIREBASE_ADMIN_PROJECT_ID &&
  process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
  process.env.FIREBASE_ADMIN_PRIVATE_KEY;

if (!admin.apps.length) {
  if (hasCredentials) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        }),
      });
    } catch (error: any) {
      // Initialization might fail during build if env vars are not present.
      // This is expected, so we can ignore the error here.
    }
  } else {
    // Try to initialize with Application Default Credentials for cloud environments.
    try {
      admin.initializeApp();
    } catch (error: any) {
      // This can fail in local dev environments without ADC setup.
      // The API route will handle the case where initialization fails.
    }
  }
}

export { admin };
