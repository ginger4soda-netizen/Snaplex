import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    publicDir: 'public',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    },
    build: {
      // Remove console.log and debugger in production
      minify: 'esbuild',
      target: 'es2020',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            markdown: ['react-markdown', 'remark-gfm'],
          },
        },
      },
    },
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
  };
});
