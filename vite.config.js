import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  server: {
    port: 3000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'three': 'three',
      'three/examples/jsm': 'three/examples/jsm'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
