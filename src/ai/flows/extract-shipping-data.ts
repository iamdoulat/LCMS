
// src/ai/flows/extract-shipping-data.ts
'use server';
/**
 * @fileOverview Extracts key information from shipping documents (PI, etc.) such as ETD, ETA, and item descriptions.
 *
 * - extractShippingData - A function that handles the extraction of shipping data from documents.
 */

import {ai} from '@/ai/genkit';
import {
  ExtractShippingDataInput,
  ExtractShippingDataInputSchema,
  ExtractShippingDataOutput,
  ExtractShippingDataOutputSchema,
} from '@/types';

export async function extractShippingData(input: ExtractShippingDataInput): Promise<ExtractShippingDataOutput> {
  return extractShippingDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractShippingDataPrompt',
  input: {schema: ExtractShippingDataInputSchema},
  output: {schema: ExtractShippingDataOutputSchema},
  prompt: `You are an expert logistics assistant. Your job is to extract key information from shipping documents like Proforma Invoices.

  Specifically, you must extract the ETD (Estimated Time of Departure), ETA (Estimated Time of Arrival), and a concise description of the items being shipped.

  Here is the shipping document:

  {{media url=documentDataUri}}
  `,
});

const extractShippingDataFlow = ai.defineFlow(
  {
    name: 'extractShippingDataFlow',
    inputSchema: ExtractShippingDataInputSchema,
    outputSchema: ExtractShippingDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
