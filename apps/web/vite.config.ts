import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development the game server runs on :3000 (pnpm --filter @deal-city/server dev).
    proxy: { '/socket.io': { target: 'http://localhost:3000', ws: true } },
  },
});
