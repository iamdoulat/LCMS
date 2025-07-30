
'use server';
/**
 * @fileoverview A chatbot flow that responds to user queries.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { ChatRequest, ChatResponse } from '@/types'; // Import types from global types file

// Define Zod schemas for internal validation
const chatHistorySchema = z.array(
  z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
  })
);

const chatRequestSchema = z.object({
  history: chatHistorySchema,
  prompt: z.string(),
});

const chatResponseSchema = z.object({
  response: z.string(),
});

// Define the Genkit prompt, using the internal Zod schemas
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

// Define the main flow
const chatFlow = ai.defineFlow(
  {
    name: 'chatFlow',
    inputSchema: chatRequestSchema,
    outputSchema: chatResponseSchema,
  },
  async (request) => {
    const { output } = await chatPrompt(request);
    // Ensure there is always a valid response object to return.
    return { response: output?.response || "I'm sorry, I couldn't generate a response." };
  }
);

// This exported async wrapper function is the ONLY thing exported from this file.
export async function chat(request: ChatRequest): Promise<ChatResponse> {
  return await chatFlow(request);
}
