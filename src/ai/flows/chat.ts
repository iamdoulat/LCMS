
'use server';
/**
 * @fileoverview A chatbot flow that responds to user queries.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const chatHistorySchema = z.array(
  z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
  })
);

export const chatRequestSchema = z.object({
  history: chatHistorySchema,
  prompt: z.string(),
});

export const chatResponseSchema = z.object({
  response: z.string(),
});

const chatPrompt = ai.definePrompt({
  name: 'chatPrompt',
  input: { schema: chatRequestSchema },
  output: { schema: chatResponseSchema },
  prompt: `You are a helpful assistant for the LCMS application.
  
  This application helps manage Letters of Credit (L/C), Telegraphic Transfers (T/T), inventory, customers, and suppliers.
  
  Your role is to answer user questions about the app's functionality or data. Be concise and helpful.
  
  Here is the conversation history:
  {{#each history}}
  {{role}}: {{content}}
  {{/each}}

  Here is the user's new prompt:
  
  {{prompt}}
  `,
});

export const chat = ai.defineFlow(
  {
    name: 'chatFlow',
    inputSchema: chatRequestSchema,
    outputSchema: chatResponseSchema,
  },
  async (request) => {
    const { output } = await chatPrompt(request);
    return { response: output?.response || "I'm sorry, I couldn't generate a response." };
  }
);
