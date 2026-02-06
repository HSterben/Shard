import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { api } from './_generated/api';

const http = httpRouter();

function htmlResponse(html: string, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

async function stripeApiRequest(path: string, form: URLSearchParams) {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }

  const resp = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const message = (data as any)?.error?.message || `Stripe API error: ${resp.status}`;
    throw new Error(message);
  }
  return data as any;
}

function hexFromBuffer(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEquals(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function verifyStripeWebhookSignature(rawBody: string, signatureHeader: string, secret: string) {
  // Stripe-Signature: t=...,v1=...,v0=...
  const parts = signatureHeader.split(',');
  let timestamp: string | null = null;
  const signatures: string[] = [];

  for (const part of parts) {
    const [k, v] = part.split('=');
    if (!k || !v) continue;
    if (k === 't') timestamp = v;
    if (k === 'v1') signatures.push(v);
  }

  if (!timestamp || signatures.length === 0) {
    return { ok: false, reason: 'Invalid Stripe-Signature header' };
  }

  // 5 minute tolerance
  const toleranceSeconds = 300;
  const tsSeconds = parseInt(timestamp, 10);
  if (!Number.isFinite(tsSeconds)) {
    return { ok: false, reason: 'Invalid timestamp' };
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - tsSeconds) > toleranceSeconds) {
    return { ok: false, reason: 'Timestamp outside tolerance window' };
  }

  const signedPayload = `${timestamp}.${rawBody}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(signedPayload);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const computed = hexFromBuffer(signatureBuffer);

  const matches = signatures.some((sig) => constantTimeEquals(sig, computed));
  return { ok: matches, reason: matches ? undefined : 'Signature mismatch' };
}

// WorkOS AuthKit OAuth configuration
// WORKOS_CLIENT_ID is public (safe to hardcode)
// WORKOS_API_KEY must be set as a Convex environment variable (it's secret!)
const WORKOS_CLIENT_ID = 'client_01KGNG7JGSBPA9HZWGVKZ8N8MS';
const WORKOS_REDIRECT_URI = 'https://strong-poodle-712.convex.site/auth/callback';

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
      const { messages, model, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, stop } = body;
      const systemInstruction = body.systemInstruction ?? body.system_instruction;

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
          let buffer = ''; // Buffer for incomplete lines

          if (!reader) {
            controller.close();
            return;
          }

          try {
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                // Process any remaining buffered data
                if (buffer.trim()) {
                  const lines = buffer.split('\n');
              for (const line of lines) {
                // Handle SSE format: "data: {...}" or just "data:"
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim();
                  if (data === '[DONE]') {
                    controller.close();
                    return;
                  }
                  if (data) {
                    try {
                      const parsed = JSON.parse(data);
                      // Forward the SSE data
                      controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
                    } catch (e) {
                      // Skip invalid JSON
                      console.warn('Skipping invalid JSON in stream:', data.substring(0, 100));
                    }
                  }
                }
              }
                }
                controller.close();
                break;
              }

              // Decode chunk and append to buffer
              const chunk = decoder.decode(value, { stream: true });
              buffer += chunk;

              // Process complete lines (those ending with \n)
              const lines = buffer.split('\n');
              // Keep the last incomplete line in buffer
              buffer = lines.pop() || '';

              for (const line of lines) {
                // Handle SSE format: "data: {...}" or just "data:"
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim();
                  if (data === '[DONE]') {
                    controller.close();
                    return;
                  }
                  if (data) {
                    try {
                      const parsed = JSON.parse(data);
                      // Forward the SSE data
                      controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
                    } catch (e) {
                      // Skip invalid JSON
                      console.warn('Skipping invalid JSON in stream:', data.substring(0, 100));
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error('Stream processing error:', error);
            // Send error as SSE event before closing
            try {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Stream error' })}\n\n`));
            } catch (e) {
              // Ignore errors when sending error message
            }
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

// Public subscription page (browser)
http.route({
  path: '/subscribe',
  method: 'GET',
  handler: httpAction(async (_, req) => {
    const url = new URL(req.url);
    const priceMonthly = process.env.STRIPE_PRICE_ID_MONTHLY || '';
    const priceYearly = process.env.STRIPE_PRICE_ID_YEARLY || '';

    return htmlResponse(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Shard Subscription</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 16px; }
      .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }
      label { display:block; margin: 10px 0 6px; font-weight: 600; }
      input, select, button { width: 100%; padding: 10px 12px; font-size: 16px; }
      button { margin-top: 14px; cursor: pointer; }
      .muted { color: #6b7280; font-size: 14px; }
      .error { color: #b91c1c; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <h1>Subscribe to Shard</h1>
    <p class="muted">Enter your email, pick a plan, and you’ll be redirected to Stripe Checkout.</p>

    <div class="card">
      <div id="configError" class="error"></div>
      <label>Email</label>
      <input id="email" type="email" placeholder="you@example.com" required />

      <label>Plan</label>
      <select id="plan">
        <option value="${priceMonthly}">Monthly</option>
        <option value="${priceYearly}">Yearly</option>
      </select>

      <button id="btn">Continue to Checkout</button>
      <div id="err" class="error" style="margin-top:10px;"></div>
    </div>

    <script>
      const priceMonthly = ${JSON.stringify(priceMonthly)};
      const priceYearly = ${JSON.stringify(priceYearly)};
      if (!priceMonthly && !priceYearly) {
        document.getElementById('configError').textContent =
          'Subscription pricing is not configured.\\nSet STRIPE_PRICE_ID_MONTHLY and/or STRIPE_PRICE_ID_YEARLY.';
      }
      const planSelect = document.getElementById('plan');
      if (!priceMonthly) planSelect.querySelector('option[value=\"\"]').textContent = 'Monthly (not configured)';
      if (!priceYearly) planSelect.querySelectorAll('option')[1].textContent = 'Yearly (not configured)';

      document.getElementById('btn').addEventListener('click', async () => {
        const email = document.getElementById('email').value.trim();
        const priceId = planSelect.value;
        const err = document.getElementById('err');
        err.textContent = '';
        if (!email) { err.textContent = 'Email is required.'; return; }
        if (!priceId) { err.textContent = 'Selected plan is not configured.'; return; }
        try {
          const res = await fetch(new URL('/stripe/create-checkout-session', window.location.origin), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, priceId }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
          window.location.href = data.url;
        } catch (e) {
          err.textContent = (e && e.message) ? e.message : String(e);
        }
      });
    </script>
  </body>
</html>`, 200);
  }),
});

http.route({
  path: '/subscribe/success',
  method: 'GET',
  handler: httpAction(async () => {
    return htmlResponse('<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Success</title></head><body style="font-family:system-ui;max-width:720px;margin:40px auto;padding:0 16px;"><h1>Subscription started</h1><p>You can close this tab.</p></body></html>');
  }),
});

http.route({
  path: '/subscribe/cancel',
  method: 'GET',
  handler: httpAction(async () => {
    return htmlResponse('<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Cancelled</title></head><body style="font-family:system-ui;max-width:720px;margin:40px auto;padding:0 16px;"><h1>Checkout cancelled</h1><p>No changes were made.</p></body></html>');
  }),
});

http.route({
  path: '/stripe/create-checkout-session',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    try {
      const { email, priceId } = (await req.json()) as { email?: string; priceId?: string };
      if (!email || !priceId) {
        return jsonResponse({ error: 'email and priceId are required' }, 400);
      }

      const baseUrl = new URL(req.url).origin;
      const successUrl = `${baseUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/subscribe/cancel`;

      // Record intent (so webhook updates have a row to patch)
      await ctx.runMutation(api.subscriptions.upsertByEmail, {
        email,
        status: 'pending',
        priceId,
      });

      const form = new URLSearchParams();
      form.set('mode', 'subscription');
      form.set('customer_email', email);
      form.set('allow_promotion_codes', 'true');
      form.set('success_url', successUrl);
      form.set('cancel_url', cancelUrl);
      form.set('line_items[0][price]', priceId);
      form.set('line_items[0][quantity]', '1');

      // Make email available later on subscription events
      form.set('subscription_data[metadata][email]', email);
      form.set('metadata[email]', email);

      const session = await stripeApiRequest('/checkout/sessions', form);
      if (!session?.url) {
        return jsonResponse({ error: 'Stripe did not return a checkout URL' }, 500);
      }

      return jsonResponse({ url: session.url }, 200);
    } catch (error) {
      return jsonResponse(
        { error: error instanceof Error ? error.message : 'Failed to create checkout session' },
        500
      );
    }
  }),
});

// CORS preflight for Stripe auth checkout (required when sending Authorization from Electron)
http.route({
  path: '/stripe/create-checkout-session-auth',
  method: 'OPTIONS',
  handler: httpAction(async () => {
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

// Stripe config for in-app subscription UI (public, no secrets)
http.route({
  path: '/stripe/plans',
  method: 'GET',
  handler: httpAction(async () => {
    return jsonResponse(
      {
        monthly: process.env.STRIPE_PRICE_ID_MONTHLY || null,
        yearly: process.env.STRIPE_PRICE_ID_YEARLY || null,
      },
      200,
      { 'Access-Control-Allow-Origin': '*' }
    );
  }),
});

// Authenticated checkout session creation (Flow A: tie to WorkOS account)
http.route({
  path: '/stripe/create-checkout-session-auth',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return jsonResponse({ error: 'Authentication required' }, 401, {
        'Access-Control-Allow-Origin': '*',
      });
    }

    const workosId = identity.subject;
    // WorkOS JWT may not include email depending on JWT template; fall back to users table (synced by webhook)
    let email =
      (identity as { email?: string }).email ??
      (await ctx.runQuery(api.users.getUserByWorkosId, { workosId }))?.email;

    if (!email) {
      return jsonResponse({ error: 'No email available for this account' }, 400, {
        'Access-Control-Allow-Origin': '*',
      });
    }

    try {
      const { priceId } = (await req.json()) as { priceId?: string };
      if (!priceId) {
        return jsonResponse({ error: 'priceId is required' }, 400, {
          'Access-Control-Allow-Origin': '*',
        });
      }

      const baseUrl = new URL(req.url).origin;
      const successUrl = `${baseUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/subscribe/cancel`;

      await ctx.runMutation(api.subscriptions.upsertByWorkosId, {
        workosId,
        email,
        status: 'pending',
        priceId,
      });

      const form = new URLSearchParams();
      form.set('mode', 'subscription');
      form.set('customer_email', email);
      form.set('client_reference_id', workosId);
      form.set('allow_promotion_codes', 'true');
      form.set('success_url', successUrl);
      form.set('cancel_url', cancelUrl);
      form.set('line_items[0][price]', priceId);
      form.set('line_items[0][quantity]', '1');

      // Make WorkOS id + email available in webhook events
      form.set('subscription_data[metadata][workosId]', workosId);
      form.set('subscription_data[metadata][email]', email);
      form.set('metadata[workosId]', workosId);
      form.set('metadata[email]', email);

      const session = await stripeApiRequest('/checkout/sessions', form);
      if (!session?.url) {
        return jsonResponse({ error: 'Stripe did not return a checkout URL' }, 500, {
          'Access-Control-Allow-Origin': '*',
        });
      }

      return jsonResponse({ url: session.url }, 200, { 'Access-Control-Allow-Origin': '*' });
    } catch (error) {
      return jsonResponse(
        { error: error instanceof Error ? error.message : 'Failed to create checkout session' },
        500,
        { 'Access-Control-Allow-Origin': '*' }
      );
    }
  }),
});

// Stripe webhook endpoint (subscriptions)
http.route({
  path: '/webhooks/stripe',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const signatureHeader = req.headers.get('stripe-signature');
    if (!signatureHeader) {
      return jsonResponse({ error: 'Missing stripe-signature header' }, 400);
    }

    const webhookSecret =
      process.env.STRIPE_WEBHOOK_SIGNING_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return jsonResponse(
        { error: 'STRIPE_WEBHOOK_SIGNING_SECRET or STRIPE_WEBHOOK_SECRET not configured' },
        500
      );
    }

    const rawBody = await req.text();

    const verified = await verifyStripeWebhookSignature(rawBody, signatureHeader, webhookSecret);
    if (!verified.ok) {
      return jsonResponse({ error: verified.reason || 'Invalid signature' }, 400);
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: 'Invalid JSON payload' }, 400);
    }

    const type = event?.type as string | undefined;
    const obj = event?.data?.object;

    try {
      if (type === 'checkout.session.completed') {
        const session = obj;
        const workosId =
          session?.metadata?.workosId ||
          session?.client_reference_id ||
          undefined;
        const email =
          session?.customer_details?.email ||
          session?.customer_email ||
          session?.metadata?.email ||
          undefined;

        if (workosId) {
          await ctx.runMutation(api.subscriptions.upsertByWorkosId, {
            workosId,
            email,
            status: session?.payment_status === 'paid' ? 'active' : 'pending',
            stripeCustomerId: session?.customer || undefined,
            stripeSubscriptionId: session?.subscription || undefined,
          });
        } else if (email) {
          await ctx.runMutation(api.subscriptions.upsertByEmail, {
            email,
            status: session?.payment_status === 'paid' ? 'active' : 'pending',
            stripeCustomerId: session?.customer || undefined,
            stripeSubscriptionId: session?.subscription || undefined,
          });
        }
      }

      if (
        type === 'customer.subscription.created' ||
        type === 'customer.subscription.updated' ||
        type === 'customer.subscription.deleted'
      ) {
        const sub = obj;
        const workosId = sub?.metadata?.workosId || undefined;
        const email = sub?.metadata?.email || undefined;
        const currentPeriodEnd =
          typeof sub?.current_period_end === 'number' ? sub.current_period_end * 1000 : undefined;
        const priceId = sub?.items?.data?.[0]?.price?.id || undefined;
        const status = sub?.status || 'unknown';

        if (workosId) {
          await ctx.runMutation(api.subscriptions.upsertByWorkosId, {
            workosId,
            email,
            status,
            stripeCustomerId: sub?.customer || undefined,
            stripeSubscriptionId: sub?.id || undefined,
            currentPeriodEnd,
            priceId,
          });
        } else if (email) {
          await ctx.runMutation(api.subscriptions.upsertByEmail, {
            email,
            status,
            stripeCustomerId: sub?.customer || undefined,
            stripeSubscriptionId: sub?.id || undefined,
            currentPeriodEnd,
            priceId,
          });
        }
        // Always update by subscription id so the row we created in checkout.session.completed gets status active
        if (sub?.id) {
          await ctx.runMutation(api.subscriptions.updateByStripeSubscriptionId, {
            stripeSubscriptionId: sub.id,
            status,
            stripeCustomerId: sub?.customer || undefined,
            currentPeriodEnd,
            priceId,
          });
        }
      }

      if (type === 'invoice.payment_succeeded' || type === 'invoice.payment_failed') {
        const invoice = obj;
        const workosId =
          invoice?.subscription_details?.metadata?.workosId ||
          invoice?.metadata?.workosId ||
          undefined;
        const email =
          invoice?.customer_email ||
          invoice?.customer_details?.email ||
          invoice?.metadata?.email ||
          undefined;

        if (workosId) {
          await ctx.runMutation(api.subscriptions.upsertByWorkosId, {
            workosId,
            email,
            status: type === 'invoice.payment_succeeded' ? 'active' : 'past_due',
            stripeCustomerId: invoice?.customer || undefined,
            stripeSubscriptionId: invoice?.subscription || undefined,
          });
        } else if (email) {
          await ctx.runMutation(api.subscriptions.upsertByEmail, {
            email,
            status: type === 'invoice.payment_succeeded' ? 'active' : 'past_due',
            stripeCustomerId: invoice?.customer || undefined,
            stripeSubscriptionId: invoice?.subscription || undefined,
          });
        }
      }

      // Always ACK so Stripe doesn't retry endlessly for unhandled events.
      return jsonResponse({ received: true }, 200);
    } catch (err) {
      console.error('Stripe webhook handling error:', err);
      return jsonResponse({ error: 'Webhook handling failed' }, 500);
    }
  }),
});

export default http;
