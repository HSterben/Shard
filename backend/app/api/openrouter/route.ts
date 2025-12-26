import { NextRequest, NextResponse } from 'next/server';
import { sendToOpenRouter } from '@/lib/openrouter';
import type { OpenRouterRequest } from '@/types/openrouter';

export async function POST(request: NextRequest) {
  try {
    const body: OpenRouterRequest = await request.json();

    //? AI Model (REQUIRED)
    if (!body.model) {
      return NextResponse.json(
        { error: 'Model is required' },
        { status: 400 }
      );
    }

    //? Message (REQUIRED)
    if (!body.message && (!body.messages || body.messages.length === 0)) {
      return NextResponse.json(
        { error: 'Either message or messages array is required' },
        { status: 400 }
      );
    }

    //* Send request to OpenRouter
    const response = await sendToOpenRouter({
      message: body.message,
      messages: body.messages,
      model: body.model,
      systemInstruction: body.systemInstruction,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      topP: body.topP,
      frequencyPenalty: body.frequencyPenalty,
      presencePenalty: body.presencePenalty,
      stop: body.stop,
      stream: body.stream,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('OpenRouter API Error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint to check API status
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'OpenRouter API',
    message: 'API is running',
  });
}

