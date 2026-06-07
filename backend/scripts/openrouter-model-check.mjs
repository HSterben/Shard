/**
 * Check which OpenRouter model the deployed Convex server will use.
 *
 *   cd backend
 *   npm run test:openrouter-model
 *
 * Optional:
 *   CONVEX_SITE_URL=https://your-deployment.convex.site
 */

const SITE =
  process.env.CONVEX_SITE_URL?.replace(/\/$/, '') ||
  'https://strong-poodle-712.convex.site';

async function main() {
  const url = `${SITE}/openrouter/model`;
  console.log('\n========== OpenRouter model (server) ==========');
  console.log('GET', url, '\n');

  const res = await fetch(url);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('Non-JSON response:', text.slice(0, 500));
    process.exit(1);
  }

  if (!res.ok) {
    console.error('Error:', data);
    process.exit(1);
  }

  console.log('Model in use:     ', data.model);
  console.log('Source:           ', data.source);
  console.log('Env vars set:     ', JSON.stringify(data.env, null, 2));
  console.log('Priority:         ', data.priority);
  if (data.source === 'fallback') {
    console.log('\n⚠ Server is using the built-in fallback. Set openrouter_model_name in the Convex dashboard, then run: npx convex deploy');
  }
  if (!data.env?.OPENROUTER_API_KEY) {
    console.log('\n⚠ OPENROUTER_API_KEY is not set on the deployment.');
  }
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
