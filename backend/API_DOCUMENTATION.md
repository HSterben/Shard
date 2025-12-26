# OpenRouter API Integration

This backend provides an API endpoint to interact with OpenRouter, allowing you to send questions to various AI models with custom system instructions and parameters.

## Setup

1. **Get your OpenRouter API Key**
   - Sign up at [OpenRouter](https://openrouter.ai/)
   - Navigate to API Keys section and generate a key

2. **Configure Environment Variables**
   Create a `.env.local` file in the `backend` directory:
   ```env
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   OPENROUTER_HTTP_REFERER=https://your-domain.com
   OPENROUTER_X_TITLE=Shard
   ```

## API Endpoint

### POST `/api/openrouter`

Send a question to OpenRouter with model selection and system instructions.

#### Request Body

```json
{
  "message": "Your question or prompt here",
  "model": "openai/gpt-4",
  "systemInstruction": "You are a helpful assistant.",
  "temperature": 0.7,
  "maxTokens": 1000,
  "topP": 1.0,
  "frequencyPenalty": 0.0,
  "presencePenalty": 0.0,
  "stop": null,
  "stream": false
}
```

#### Required Fields
- `message` (string): The user's question or prompt
- `model` (string): The model identifier (e.g., "openai/gpt-4", "anthropic/claude-3-opus")

#### Optional Fields
- `systemInstruction` (string): System instructions to guide the model's behavior
- `temperature` (number): Controls randomness (0.0 to 2.0, default varies by model)
- `maxTokens` (number): Maximum tokens in the response
- `topP` (number): Nucleus sampling parameter (0.0 to 1.0)
- `frequencyPenalty` (number): Reduces repetition (-2.0 to 2.0)
- `presencePenalty` (number): Encourages new topics (-2.0 to 2.0)
- `stop` (string | string[]): Stop sequences
- `stream` (boolean): Enable streaming responses

## Example Usage

### Using JavaScript/TypeScript

```typescript
const response = await fetch('http://localhost:3000/api/openrouter', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: 'What is the capital of France?',
    model: 'openai/gpt-4',
    systemInstruction: 'You are a helpful geography assistant.',
    temperature: 0.7,
    maxTokens: 500,
  }),
});

const data = await response.json();
console.log(data.content);
```

## Available Models

See [OpenRouter Models](https://openrouter.ai/models) for the full list.

## Error Handling

The API handles various error scenarios:
- Missing required fields (400)
- Invalid API key (500)
- Rate limiting (500)
- Network errors (500)
- Invalid model (500)

Always check the `success` field in the response and handle errors appropriately.

## Testing

You can test the API status with a GET request:

```bash
curl http://localhost:3000/api/openrouter
```

This returns:
```json
{
  "status": "ok",
  "service": "OpenRouter API",
  "message": "API is running"
}
```
