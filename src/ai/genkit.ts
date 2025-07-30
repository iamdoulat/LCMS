
'use server';

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import * as dotenv from 'dotenv';

dotenv.config();

// This file should only export the core genkit instance.
// Plugins are configured here.
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    }),
  ],
});

// Import flows to be registered with the development server.
import '@/ai/flows/extract-shipping-data.ts';
