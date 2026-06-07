import { action, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { api } from './_generated/api';
import { resolveOpenRouterModelWithSource } from './openrouterModel';

// Types matching the Express backend
type MessageContent = 
  | string 
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >;

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: MessageContent;
}

interface OpenRouterRequest {
  message?: string;
  messages?: OpenRouterMessage[];
  model: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string | string[];
  stream?: boolean;
}

interface OpenRouterResponse {
  success: boolean;
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
  id: string;
  messages?: OpenRouterMessage[];
}

interface OpenRouterAPIRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
}

interface OpenRouterAPIResponse {
  id: string;
  model: string;
  created: number;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function sendToOpenRouter(
  options: OpenRouterRequest
): Promise<OpenRouterResponse> {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const OPENROUTER_HTTP_REFERER = process.env.OPENROUTER_HTTP_REFERER || '';
  const OPENROUTER_X_TITLE = process.env.OPENROUTER_X_TITLE || 'Shard';

  // Check API Key
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set in environment variables');
  }

  // Build messages array
  let messages: OpenRouterMessage[] = [];

  // If conversation history is provided, use it
  if (options.messages && options.messages.length > 0) {
    // Convert messages to proper format (handle both string and multimodal content)
    messages = options.messages.map(msg => ({
      role: msg.role,
      content: msg.content // Can be string or array for multimodal
    }));
    
    // Add system instruction if provided and not already present
    if (options.systemInstruction) {
      const hasSystemMessage = messages.some(msg => msg.role === 'system');
      if (!hasSystemMessage) {
        messages.unshift({
          role: 'system',
          content: options.systemInstruction,
        });
      }
    }

    // Add new user message if provided
    if (options.message) {
      messages.push({
        role: 'user',
        content: options.message,
      });
    }
  } else {
    // No conversation history - create new conversation
    if (!options.message) {
      throw new Error('Either message or messages array must be provided');
    }

    // Add system instruction if provided
    if (options.systemInstruction) {
      messages.push({
        role: 'system',
        content: options.systemInstruction,
      });
    }

    // Add user message
    messages.push({
      role: 'user',
      content: options.message,
    });
  }

  // Build request payload
  const payload: OpenRouterAPIRequest = {
    model: options.model,
    messages,
  };

  // Add optional parameters
  if (options.temperature !== undefined) {
    payload.temperature = options.temperature;
  }

  if (options.maxTokens !== undefined) {
    payload.max_tokens = options.maxTokens;
  }

  if (options.topP !== undefined) {
    payload.top_p = options.topP;
  }

  if (options.frequencyPenalty !== undefined) {
    payload.frequency_penalty = options.frequencyPenalty;
  }

  if (options.presencePenalty !== undefined) {
    payload.presence_penalty = options.presencePenalty;
  }

  if (options.stop !== undefined) {
    payload.stop = options.stop;
  }

  if (options.stream !== undefined) {
    payload.stream = options.stream;
  }

  
  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': OPENROUTER_HTTP_REFERER,
        'X-Title': OPENROUTER_X_TITLE,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Log the full error for debugging
      console.error('OpenRouter API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      
      // Extract more detailed error message
      const errorMessage = errorData.error?.message 
        || errorData.error?.detail
        || errorData.message
        || `OpenRouter API error: ${response.status} ${response.statusText}`;
      
      throw new Error(errorMessage);
    }

    const data: OpenRouterAPIResponse = await response.json();

    // Validate response structure
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      console.error('Invalid OpenRouter response structure:', data);
      throw new Error('OpenRouter returned an invalid response: no choices available');
    }
  
    if (!data.choices[0].message) {
      console.error('Invalid OpenRouter response structure:', data);
      throw new Error('OpenRouter returned an invalid response: no message in choice');
    }

    // Add assistant response to conversation history
    // Assistant messages are always text, not multimodal
    const assistantContent = data.choices[0]?.message?.content || '';
    const assistantMessage: OpenRouterMessage = {
      role: 'assistant',
      content: typeof assistantContent === 'string' ? assistantContent : JSON.stringify(assistantContent),
    };
    const updatedMessages: OpenRouterMessage[] = [...messages, assistantMessage];

    // Transform response to our format
    // Ensure messages match the validator type exactly
    const responseMessages = updatedMessages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content as string | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >
    }));

    return {
      success: true,
      content: typeof assistantContent === 'string' ? assistantContent : JSON.stringify(assistantContent),
      model: data.model,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      finishReason: data.choices[0]?.finish_reason || 'stop',
      id: data.id,
      messages: responseMessages, // Return updated conversation history
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to communicate with OpenRouter API');
  }
}

// Convex Action handler with authentication and database access
export const sendMessage = action({
  args: {
    message: v.optional(v.string()),
    messages: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal('system'), v.literal('user'), v.literal('assistant')),
          content: v.union(
            v.string(),
            v.array(
              v.union(
                v.object({
                  type: v.literal('text'),
                  text: v.string(),
                }),
                v.object({
                  type: v.literal('image_url'),
                  image_url: v.object({
                    url: v.string(),
                  }),
                })
              )
            )
          ),
        })
      )
    ),
    model: v.optional(v.string()),
    systemInstruction: v.optional(v.string()),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    topP: v.optional(v.number()),
    frequencyPenalty: v.optional(v.number()),
    presencePenalty: v.optional(v.number()),
    stop: v.optional(v.union(v.string(), v.array(v.string()))),
    stream: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    content: v.string(),
    model: v.string(),
    usage: v.object({
      promptTokens: v.number(),
      completionTokens: v.number(),
      totalTokens: v.number(),
    }),
    finishReason: v.string(),
    id: v.string(),
    messages: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal('system'), v.literal('user'), v.literal('assistant')),
          content: v.union(
            v.string(),
            v.array(
              v.union(
                v.object({
                  type: v.literal('text'),
                  text: v.string(),
                }),
                v.object({
                  type: v.literal('image_url'),
                  image_url: v.object({
                    url: v.string(),
                  }),
                })
              )
            )
          ),
        })
      )
    ),
  }),
  handler: async (ctx, args) => {
    // Check authentication - get logged in user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Authentication required. Please log in to use this feature.');
    }

    // Validate message (REQUIRED)
    if (!args.message && (!args.messages || args.messages.length === 0)) {
      throw new Error('Either message or messages array is required');
    }

    const { model } = resolveOpenRouterModelWithSource(args.model);

    // Send request to OpenRouter
    const response = await sendToOpenRouter({
      message: args.message,
      messages: args.messages,
      model,
      systemInstruction: args.systemInstruction,
      temperature: args.temperature,
      maxTokens: args.maxTokens,
      topP: args.topP,
      frequencyPenalty: args.frequencyPenalty,
      presencePenalty: args.presencePenalty,
      stop: args.stop,
      stream: args.stream,
    });

    return response;
  },
});