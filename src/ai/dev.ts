
import { googleAI } from '@genkit-ai/googleai';
import { genkit } from 'genkit';
import * as dotenv from 'dotenv';

dotenv.config();

// Configure Genkit with the Google AI plugin for local development.
// This is the entrypoint for the 'genkit:dev' script.
genkit({
  plugins: [
    googleAI({
      apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    }),
  ],
  enableTracingAndMetrics: true,
});

// Import flows to be registered with the development server.
import '@/ai/flows/extract-shipping-data.ts';
