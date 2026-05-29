import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(dirname, 'renderer'),
  base: './',
  plugins: [react()],
  build: {
    outDir: path.resolve(dirname, 'dist/renderer'),
    emptyOutDir: true,
    sourcemap: true,
  },
});
