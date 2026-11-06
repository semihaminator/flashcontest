// Local preview: node dev-server.mjs  (ADMIN_PASSWORD=test by default). Mimics Vercel routing.
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
process.env.ADMIN_PASSWORD ||= 'test';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    const mod = await import(`./api/${url.pathname.slice(5)}.js`);
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
    return mod.default(req, res);
  }
  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!path.extname(p)) p += '.html';
  try {
    const f = await fs.readFile(path.join('public', path.normalize(p)));
    res.setHeader('Content-Type', types[path.extname(p)] || 'application/octet-stream');
    res.end(f);
  } catch { res.statusCode = 404; res.end('Not found'); }
}).listen(process.env.PORT || 3000, () => console.log('http://localhost:' + (process.env.PORT || 3000)));
