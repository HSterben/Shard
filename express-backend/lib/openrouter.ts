import type { OpenRouterRequest, OpenRouterResponse, OpenRouterMessage } from '@/types/openrouter';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

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

export async function sendToOpenRouter(
  options: OpenRouterRequest
): Promise<OpenRouterResponse> {
  //? Check API Key
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set in environment variables');
  }

  // Build messages array
  let messages: OpenRouterMessage[] = [];

  // If conversation history is provided, use it
  if (options.messages && options.messages.length > 0) {
    messages = [...options.messages];
    
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
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || '',
        'X-Title': process.env.OPENROUTER_X_TITLE || 'Shard',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || 
        `OpenRouter API error: ${response.status} ${response.statusText}`
      );
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
    const assistantMessage: OpenRouterMessage = {
      role: 'assistant',
      content: data.choices[0]?.message?.content || '',
    };
    const updatedMessages = [...messages, assistantMessage];

    // Transform response to our format
    return {
      success: true,
      content: data.choices[0]?.message?.content || '',
      model: data.model,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      finishReason: data.choices[0]?.finish_reason || 'stop',
      id: data.id,
      messages: updatedMessages, // Return updated conversation history
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to communicate with OpenRouter API');
  }
}

