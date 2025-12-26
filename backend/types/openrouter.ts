export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterRequest {
  // Either provide a single message (for new conversations) or full conversation history
  message?: string; // New message to add (if messages array not provided)
  messages?: OpenRouterMessage[]; // Full conversation history (for chat with context)
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

export interface OpenRouterResponse {
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
  messages?: OpenRouterMessage[]; // Updated conversation history (for client to maintain state)
}

export interface OpenRouterError {
  error: string;
  message?: string;
}

