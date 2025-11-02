import wasm from "vite-plugin-wasm";
import { viteStaticCopy } from "vite-plugin-static-copy";
import compression from 'vite-plugin-compression';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { Readable } from 'node:stream';

export default defineConfig({
  // base: "/haruhikage", // Toggle or change this when build
  build: {
    target: ["esnext"],
  },
  plugins: [
    react(),
    wasm(),
    viteStaticCopy({
      targets: [
        {
          src: "./public/icons/*",
          dest: "assets",
        },
        {
          src: "./public/*",
          dest: "public",
        },
      ],
    }),
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,
      deleteOriginFile: false,
    }),
    {
      name: 'dev-audio-proxy',
      configureServer(server) {
        server.middlewares.use('/proxy', async (req, res) => {
          try {
            const urlObj = new URL(req.url || '', 'http://localhost');
            const target = urlObj.searchParams.get('url');
            if (!target) {
              res.statusCode = 400;
              res.end('missing url');
              return;
            }

            const headers: Record<string, string> = {};
            if (req.headers['range']) headers['Range'] = String(req.headers['range']);

            const upstream = await fetch(target, { headers });

            res.statusCode = upstream.status;
            const passHeaders = ['content-type', 'content-length', 'accept-ranges', 'content-range', 'cache-control'];
            passHeaders.forEach((h) => {
              const v = upstream.headers.get(h);
              if (v) res.setHeader(h, v);
            });
            res.setHeader('Access-Control-Allow-Origin', '*');

            const body: any = upstream.body;
            if (body && typeof (Readable as any).fromWeb === 'function') {
              const nodeReadable = (Readable as any).fromWeb(body);
              nodeReadable.pipe(res);
            } else if (body && typeof body.getReader === 'function') {
              const reader = body.getReader();
              const pump = async () => {
                for (;;) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  res.write(Buffer.from(value));
                }
                res.end();
              };
              pump();
            } else {
              const buf = Buffer.from(await upstream.arrayBuffer());
              res.end(buf);
            }
          } catch (e) {
            res.statusCode = 502;
            res.end('proxy error');
          }
        });
      },
    }
  ],
});