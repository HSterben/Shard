// test-openrouter.ts
interface OpenRouterRequest {
    message: string;
    model: string;
    systemInstruction?: string;
    temperature?: number;
    maxTokens?: number;
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
  }
  
  async function askOpenRouter(
    message: string,
    model: string = 'openai/gpt-4',
    options?: {
      systemInstruction?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<OpenRouterResponse> {
    const apiUrl = 'http://localhost:3000';
    
    const requestBody: OpenRouterRequest = {
      message,
      model,
      ...options,
    };
  
    const response = await fetch(`${apiUrl}/api/openrouter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
  
    return await response.json();
  }
  
  async function example() {
    try {
      const response = await askOpenRouter(
        'Capital in France?',
        'mistralai/devstral-2512:free',
        {
          systemInstruction: 'You are a helpful geography assistant.',
          temperature: 0.7,
          maxTokens: 500,
        }
      );
  
      console.log('Response:', response.content);
      console.log('Tokens used:', response.usage.totalTokens);
    } catch (error) {
      console.error('Error:', error);
    }
  }
  
  // Run the example
  example();