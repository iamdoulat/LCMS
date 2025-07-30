import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {dotGoogleAI} from '@genkit-ai/googleai';

// Initialize the Google AI plugin with the API key from the environment.
// The API key is defined in the .env file.
export const ai = genkit({
  plugins: [googleAI({apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY})],
});
