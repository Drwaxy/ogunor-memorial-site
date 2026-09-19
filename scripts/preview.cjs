const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { validate, filesFor, MAX_BODY } = require('../lib/condolence-store.cjs');
const root = path.resolve(__dirname, '..');
const store = path.join(root, '.local-condolences');
const port = Number(process.env.PORT || 8001);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg' };
http.createServer(async (req, res) => {
  const json = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/api/condolences') {
      if (req.method === 'GET') return json(200, { preview: true });
      if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
      if (![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(req.headers.origin)) return json(403, { error: 'Not allowed' });
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > MAX_BODY) return json(413, { error: 'Too large' }); }
      const entry = validate(JSON.parse(raw));
      await fs.mkdir(store, { recursive: true });
      const folder = path.join(store, entry.id);
      try {
        const existing = JSON.parse(await fs.readFile(path.join(folder, 'receipt.json'), 'utf8'));
        if (existing.digest !== entry.digest) return json(409, { error: 'Reference used' });
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        const temp = await fs.mkdtemp(path.join(store, '.pending-'));
        try {
          for (const [name, content] of Object.entries(filesFor(entry))) await fs.writeFile(path.join(temp, name), content);
          await fs.rename(temp, folder);
        } finally { await fs.rm(temp, { recursive: true, force: true }); }
      }
      return json(200, { saved: true, reference: entry.id });
    }
    if (!['GET', 'HEAD'].includes(req.method)) return json(405, { error: 'Method not allowed' });
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    // Serve only public site assets, never archives, source, credentials or Git metadata.
    if (!/^(?:[\w-]+\.html|favicon\.(?:svg|ico)|apple-touch-icon\.png|memorial-music\.mp3|(?:assets|css|js|partials)\/[\w./-]+)$/.test(relative) || relative.split('/').includes('..')) return json(404, { error: 'Not found' });
    const filename = path.resolve(root, relative);
    if (!filename.startsWith(root + path.sep)) return json(404, { error: 'Not found' });
    const content = await fs.readFile(filename);
    res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) { json(error.code === 'ENOENT' ? 404 : 400, { error: 'Unable to process request' }); }
}).listen(port, '127.0.0.1', () => console.log(`Local preview: http://127.0.0.1:${port}/condolences.html\nTest entries: ${store}\nNo external writes or emails.`));
