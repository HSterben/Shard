import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';

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

export default http;
