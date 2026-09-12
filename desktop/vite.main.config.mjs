import { defineConfig, loadEnv } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Main process must get the same Convex URL as the renderer (desktop/.env).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const backendEnv = loadEnv(mode, path.resolve(__dirname, '../backend'), '');
  const rootEnv = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const merged = { ...rootEnv, ...backendEnv, ...env };

  const convexUrl = (
    merged.VITE_CONVEX_URL || 'https://strong-poodle-712.convex.cloud'
  ).replace(/\/$/, '');
  const convexSiteUrl = (
    merged.VITE_CONVEX_SITE_URL ||
    convexUrl.replace(/\.convex\.cloud\/?$/, '.convex.site')
  ).replace(/\/$/, '');

  return {
    define: {
      'process.env.VITE_CONVEX_URL': JSON.stringify(convexUrl),
      'process.env.VITE_CONVEX_SITE_URL': JSON.stringify(convexSiteUrl),
    },
  };
});
