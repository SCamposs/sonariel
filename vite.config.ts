import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execFile } from 'node:child_process';
import path from 'node:path';

// Development-only bridge. Production uses Tauri IPC, never a web-exposed command runner.
export default defineConfig({
  plugins: [react(), {
    name: 'sonariel-local-core',
    configureServer(server) {
      server.middlewares.use('/__sonariel', (req, res) => {
        if (req.method !== 'POST' || (req.headers.origin && req.headers.origin !== 'http://127.0.0.1:1420')) { res.statusCode = 403; res.end(); return; }
        let body = '';
        req.on('data', (chunk) => { body += chunk; if (body.length > 1048576) req.destroy(); });
        req.on('end', () => {
          try {
            const { method, args } = JSON.parse(body);
            const command = path.resolve('.venv/Scripts/python.exe');
            const argv = method === '__connection' ? ['-m', 'sonariel', 'connection'] : ['-m', 'sonariel', 'rpc', method, JSON.stringify(args ?? {})];
            execFile(command, argv, { windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (_error, stdout, stderr) => {
              res.setHeader('Content-Type', 'application/json');
              if (!stdout) { res.statusCode = 500; res.end(JSON.stringify({ error: stderr })); return; }
              res.end(method === '__connection' ? JSON.stringify({ result: JSON.parse(stdout) }) : stdout);
            });
          } catch { res.statusCode = 400; res.end('{}'); }
        });
      });
    },
  }],
  server: { host: '127.0.0.1', port: 1420, strictPort: true },
  clearScreen: false,
});
