// src/ai/flows/extract-shipping-data.ts
'use server';
/**
 * @fileOverview Extracts key information from shipping documents (PI, etc.) such as ETD, ETA, and item descriptions.
 *
 * - extractShippingData - A function that handles the extraction of shipping data from documents.
 * - ExtractShippingDataInput - The input type for the extractShippingData function.
 * - ExtractShippingDataOutput - The return type for the extractShippingData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractShippingDataInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "A shipping document (PI, etc.) as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractShippingDataInput = z.infer<typeof ExtractShippingDataInputSchema>;

const ExtractShippingDataOutputSchema = z.object({
  etd: z.string().describe('The Estimated Time of Departure.'),
  eta: z.string().describe('The Estimated Time of Arrival.'),
  itemDescriptions: z.string().describe('A description of the items being shipped.'),
});
export type ExtractShippingDataOutput = z.infer<typeof ExtractShippingDataOutputSchema>;

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
