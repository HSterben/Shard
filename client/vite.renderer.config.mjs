import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const openrouterModelName =
    env.openrouter_model_name || env.OPENROUTER_MODEL_NAME || '';

  return {
    plugins: [react()],
    define: {
      'import.meta.env.OPENROUTER_MODEL_NAME': JSON.stringify(openrouterModelName),
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          chat: path.resolve(__dirname, 'chat.html'),
          settings: path.resolve(__dirname, 'settings.html'),
          presets: path.resolve(__dirname, 'presets.html'),
          subscription: path.resolve(__dirname, 'subscription.html'),
        },
      },
    },
  };
});
