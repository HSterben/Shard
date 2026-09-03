import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const backendEnv = loadEnv(mode, path.resolve(__dirname, '../backend'), '')
  const merged = { ...backendEnv, ...env }

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_CONVEX_URL': JSON.stringify(
        merged.VITE_CONVEX_URL || 'https://strong-poodle-712.convex.cloud',
      ),
      'import.meta.env.VITE_CONVEX_SITE_URL': JSON.stringify(
        merged.VITE_CONVEX_SITE_URL ||
          (merged.VITE_CONVEX_URL || 'https://strong-poodle-712.convex.cloud').replace(
            '.convex.cloud',
            '.convex.site',
          ),
      ),
    },
    server: {
      proxy: {
        '/user_management': {
          target: 'https://api.workos.com',
          changeOrigin: true,
          secure: true,
        },
      },
    },
  }
})
