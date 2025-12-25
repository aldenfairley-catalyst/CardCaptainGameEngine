import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// GitHub Pages uses a sub-path like /<repo-name>/.
// This makes local dev stay at '/', but CI builds get the right base.
const repo = process.env.GITHUB_REPOSITORY?.split('/')?.[1];

export default defineConfig({
  plugins: [react()],
  base: repo ? `/${repo}/` : '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173
  }
});
