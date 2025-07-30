
import {genkit} from 'genkit';
import * as dotenv from 'dotenv';

dotenv.config();

// This file should only export the core genkit instance.
// Plugins are configured in the dev entrypoint (dev.ts).
export const ai = genkit();
