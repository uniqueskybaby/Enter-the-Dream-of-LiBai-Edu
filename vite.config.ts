import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/edu': {
        target: 'http://127.0.0.1:4178',
        changeOrigin: true,
      },
    },
  },
});
