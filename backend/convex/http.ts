import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { api } from './_generated/api';

const http = httpRouter();

// WorkOS AuthKit OAuth configuration
// WORKOS_CLIENT_ID is public (safe to hardcode)
// WORKOS_API_KEY must be set as a Convex environment variable (it's secret!)
const WORKOS_CLIENT_ID = 'client_01KE1PA9FBR4R8JMP8507FE0SV';
const WORKOS_REDIRECT_URI = 'https://elegant-greyhound-73.convex.site/auth/callback';

// Start OAuth flow - redirects to WorkOS
http.route({
  path: '/auth/login',
  method: 'GET',
  handler: httpAction(async () => {
    const authUrl = new URL('https://api.workos.com/user_management/authorize');
    authUrl.searchParams.set('client_id', WORKOS_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', WORKOS_REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('provider', 'authkit');

    return new Response(null, {
      status: 302,
      headers: {
        Location: authUrl.toString(),
      },
    });
  }),
});

// OAuth callback - exchanges code for token
http.route({
  path: '/auth/callback',
  method: 'GET',
  handler: httpAction(async (_, req) => {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      // Redirect to error page in Electron app
      return new Response(null, {
        status: 302,
        headers: {
          Location: `shard://auth/error?message=${encodeURIComponent(error)}`,
        },
      });
    }

    if (!code) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: 'shard://auth/error?message=No%20code%20provided',
        },
      });
    }

    try {
      // Exchange code for tokens
      const tokenResponse = await fetch(
        'https://api.workos.com/user_management/authenticate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: WORKOS_CLIENT_ID,
            client_secret: process.env.WORKOS_API_KEY,
            grant_type: 'authorization_code',
            code,
            redirect_uri: WORKOS_REDIRECT_URI,
          }),
        }
      );

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.error('Token exchange failed:', errorData);
        return new Response(null, {
          status: 302,
          headers: {
            Location: `shard://auth/error?message=${encodeURIComponent('Authentication failed')}`,
          },
        });
      }

      const tokenData = await tokenResponse.json();

      // Redirect to Electron app with the access token
      // The access_token is a JWT that can be verified by Convex
      return new Response(null, {
        status: 302,
        headers: {
          Location: `shard://auth/success?token=${encodeURIComponent(tokenData.access_token)}&refresh=${encodeURIComponent(tokenData.refresh_token || '')}`,
        },
      });
    } catch (err) {
      console.error('Auth callback error:', err);
      return new Response(null, {
        status: 302,
        headers: {
          Location: 'shard://auth/error?message=Authentication%20failed',
        },
      });
    }
  }),
});

// Refresh token endpoint
http.route({
  path: '/auth/refresh',
  method: 'POST',
  handler: httpAction(async (_, req) => {
    try {
      const body = await req.json();
      const refreshToken = body.refresh_token;

      if (!refreshToken) {
        return new Response(JSON.stringify({ error: 'No refresh token provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const tokenResponse = await fetch(
        'https://api.workos.com/user_management/authenticate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: WORKOS_CLIENT_ID,
            client_secret: process.env.WORKOS_API_KEY,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          }),
        }
      );

      if (!tokenResponse.ok) {
        return new Response(JSON.stringify({ error: 'Token refresh failed' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const tokenData = await tokenResponse.json();

      return new Response(
        JSON.stringify({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } catch (err) {
      console.error('Refresh error:', err);
      return new Response(JSON.stringify({ error: 'Refresh failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }),
});

// CORS preflight for refresh endpoint
http.route({
  path: '/auth/refresh',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }),
});

// Helper: Verify WorkOS webhook signature
// WorkOS signs: HMAC-SHA256(secret, "{timestamp}.{raw_body}")
async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
  secret: string
): Promise<boolean> {
  if (!signature || !timestamp || !secret) {
    return false;
  }

  try {
    // Check timestamp tolerance (5 minutes) to prevent replay attacks
    // WorkOS sends timestamp in milliseconds, convert to seconds for comparison
    const currentTime = Math.floor(Date.now() / 1000);
    const requestTimeMs = parseInt(timestamp, 10);
    const requestTimeSeconds = Math.floor(requestTimeMs / 1000);
    const tolerance = 300; // 5 minutes in seconds

    if (isNaN(requestTimeMs) || Math.abs(currentTime - requestTimeSeconds) > tolerance) {
      console.error('Webhook timestamp outside tolerance window');
      console.error('Current time (s):', currentTime);
      console.error('Request time (ms):', requestTimeMs, '-> (s):', requestTimeSeconds);
      console.error('Difference:', Math.abs(currentTime - requestTimeSeconds), 'seconds');
      return false;
    }

    // Reconstruct the signed payload: "{timestamp_ms}.{raw_body}"
    // WorkOS uses milliseconds in the signed payload
    const signedPayload = `${timestamp}.${rawBody}`;

    // Import crypto for HMAC
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(signedPayload);

    // Use Web Crypto API for HMAC-SHA256
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Debug logging (remove in production)
    console.log('Signature verification debug:');
    console.log('  Signed payload:', signedPayload.substring(0, 100) + '...');
    console.log('  Received signature:', signature.substring(0, 20) + '...');
    console.log('  Computed signature:', computedSignature.substring(0, 20) + '...');
    console.log('  Signatures match:', signature === computedSignature);

    // Constant-time comparison to prevent timing attacks
    if (signature.length !== computedSignature.length) {
      console.log('  Signature length mismatch:', signature.length, 'vs', computedSignature.length);
      return false;
    }

    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ computedSignature.charCodeAt(i);
    }

    const matches = result === 0;
    if (!matches) {
      console.log('  Signature bytes differ');
    }
    return matches;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

// WorkOS webhook endpoint
http.route({
  path: '/webhooks/workos',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    try {
      // Get the raw request body as text
      const rawBody = await req.text();

      // Debug: Log all headers to see what we're receiving
      const allHeaders: Record<string, string> = {};
      req.headers.forEach((value, key) => {
        allHeaders[key] = value;
      });
      console.log('Received headers:', JSON.stringify(allHeaders, null, 2));

      // WorkOS sends signature in format: "t={timestamp}, v1={signature}"
      const signatureHeader = req.headers.get('workos-signature');

      if (!signatureHeader) {
        console.error('Missing workos-signature header');
        console.error('Available headers:', Object.keys(allHeaders));
        return new Response(
          JSON.stringify({
            error: 'Missing signature',
            receivedHeaders: Object.keys(allHeaders),
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Parse the signature header: "t=1768308389638, v1=a5f8b91150b89db13d56c79c552b49f917980407527adb859969309bbd4a98e9"
      let timestamp: string | null = null;
      let signature: string | null = null;

      // Extract timestamp (t=...) and signature (v1=...)
      const timestampMatch = signatureHeader.match(/t=(\d+)/);
      const signatureMatch = signatureHeader.match(/v1=([a-f0-9]+)/);

      if (timestampMatch) {
        timestamp = timestampMatch[1];
      }
      if (signatureMatch) {
        signature = signatureMatch[1];
      }

      if (!signature || !timestamp) {
        console.error('Failed to parse workos-signature header');
        console.error('Signature header value:', signatureHeader);
        return new Response(
          JSON.stringify({
            error: 'Invalid signature format',
            signatureHeader: signatureHeader,
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Get the webhook secret from environment
      const webhookSecret = process.env.WORKOS_SIGNATURE_SECRET;
      if (!webhookSecret) {
        console.error('WORKOS_SIGNATURE_SECRET not configured');
        return new Response(JSON.stringify({ error: 'Server configuration error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // WorkOS signs with milliseconds in the payload: "{timestamp_ms}.{raw_body}"
      // But validates timestamp tolerance in seconds
      const timestampMs = timestamp; // Use milliseconds for signature verification

      // Verify the webhook signature (uses milliseconds in signed payload)
      const isValid = await verifyWebhookSignature(
        rawBody,
        signature,
        timestampMs,
        webhookSecret
      );

      if (!isValid) {
        console.error('Invalid webhook signature');
        console.error('Received signature:', signature);
        console.error('Timestamp (ms):', timestampMs);
        console.error('Raw body length:', rawBody.length);
        console.error('Raw body preview:', rawBody.substring(0, 100));
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Parse the webhook payload
      const payload = JSON.parse(rawBody);
      const event = payload.event;
      const data = payload.data;

      console.log('Received WorkOS webhook:', event);

      // Handle different event types
      switch (event) {
        case 'user.created':
        case 'user.updated': {
          // Create or update user
          // Convert null values to undefined (Convex validators don't accept null for optional fields)
          await ctx.runMutation(api.users.upsertUser, {
            workosId: data.id,
            email: data.email,
            firstName: data.first_name ?? undefined,
            lastName: data.last_name ?? undefined,
            profilePictureUrl: data.profile_picture_url ?? undefined,
          });
          break;
        }

        case 'user.deleted': {
          // Delete user
          await ctx.runMutation(api.users.deleteUser, {
            workosId: data.id,
          });
          break;
        }

        default:
          console.log('Unhandled webhook event:', event);
      }

      // Return success response
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Webhook processing error:', error);
      return new Response(
        JSON.stringify({
          error: 'Webhook processing failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }),
});

// Streaming OpenRouter endpoint
http.route({
  path: '/openrouter/stream',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    // Handle CORS preflight
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }),
});

http.route({
  path: '/openrouter/stream',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      );
    }

    try {
      const body = await req.json();
      const { messages, model, systemInstruction, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, stop } = body;

      if (!model) {
        return new Response(
          JSON.stringify({ error: 'Model is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!messages || messages.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Messages are required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Process messages and add system instruction if provided
      let processedMessages = [...messages];
      
      // Add system instruction if provided and not already present
      if (systemInstruction) {
        const hasSystemMessage = processedMessages.some(msg => msg.role === 'system');
        if (!hasSystemMessage) {
          processedMessages.unshift({
            role: 'system',
            content: systemInstruction,
          });
        }
      }

      const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
      const OPENROUTER_HTTP_REFERER = process.env.OPENROUTER_HTTP_REFERER || '';
      const OPENROUTER_X_TITLE = process.env.OPENROUTER_X_TITLE || 'Shard';

      if (!OPENROUTER_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'OpenRouter API key not configured' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Build payload
      const payload: any = {
        model,
        messages: processedMessages,
        stream: true,
      };

      if (temperature !== undefined) payload.temperature = temperature;
      if (maxTokens !== undefined) payload.max_tokens = maxTokens;
      if (topP !== undefined) payload.top_p = topP;
      if (frequencyPenalty !== undefined) payload.frequency_penalty = frequencyPenalty;
      if (presencePenalty !== undefined) payload.presence_penalty = presencePenalty;
      if (stop !== undefined) payload.stop = stop;

      // Call OpenRouter with streaming
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
        return new Response(
          JSON.stringify({ error: errorData.error?.message || 'OpenRouter API error' }),
          { 
            status: response.status, 
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            } 
          }
        );
      }

      // Create a readable stream that proxies OpenRouter's stream
      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            controller.close();
            return;
          }

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') {
                    controller.close();
                    return;
                  }
                  try {
                    const parsed = JSON.parse(data);
                    // Forward the SSE data
                    controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
                  } catch (e) {
                    // Skip invalid JSON
                  }
                }
              }
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    } catch (error) {
      console.error('Streaming error:', error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      );
    }
  }),
});

export default http;
