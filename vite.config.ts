import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      // Expose the API_KEY to the client-side code securely
      // We map your 'GEMINI_API_KEY' from the .env file to 'process.env.API_KEY' in the app
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
  }
})