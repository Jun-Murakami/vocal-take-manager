import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import fs from 'node:fs';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    {
      name: 'kuromoji-dict-loader',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith('/dict/') && req.url.endsWith('.dat.gz')) {
            // Prevent Vite from adding Content-Encoding: gzip
            // by handling these files specially
            const filePath = path.join(process.cwd(), 'public', req.url);

            if (fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'application/octet-stream');
              res.setHeader('Cache-Control', 'public, max-age=31536000');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Polyfill for kuromoji.js browser compatibility
      path: 'path-browserify',
    },
  },
  define: {
    // Polyfill process.env for kuromoji.js
    'process.env': {},
  },
  test: {
    exclude: ['**/node_modules/**', '**/tests/**'],
  },
});
