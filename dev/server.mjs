// Local preview: serves web/ and executes the real application routes with
// an in-memory DB and a fixed local user. No cloud credentials are involved.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { application } from '../functions/routes.mjs';
import { BackendError, makeRequireUser, memoryDb } from './fakes.mjs';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const webRoot = join(projectRoot, 'web');
const port = Number(process.argv[2] || 8787);
const localUser = { id: 'local-dev-user', name: '本地开发用户' };
const db = memoryDb();
let failMode = false;
let anonMode = false;
const makeHandle = () => application({ db, requireUser: makeRequireUser(anonMode ? null : localUser), BackendError });
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname.startsWith('/__local/')) {
      if (url.pathname === '/__local/fail-on') failMode = true;
      else if (url.pathname === '/__local/fail-off') failMode = false;
      else if (url.pathname === '/__local/anon-on') anonMode = true;
      else if (url.pathname === '/__local/anon-off') anonMode = false;
      else { res.writeHead(404); res.end('Unknown local control'); return; }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ failMode, anonMode }));
      return;
    }
    if (url.pathname.startsWith('/functions/v1/app')) {
      if (failMode) { res.writeHead(503, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'service_unavailable' })); return; }
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(key, value);
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const request = new Request('http://127.0.0.1' + url.pathname + url.search, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : body
      });
      let response;
      try { response = await makeHandle()({ request, requestId: crypto.randomUUID() }); }
      catch (error) {
        const status = error instanceof BackendError ? error.status : 503;
        const code = error instanceof BackendError ? error.code : 'internal_error';
        response = Response.json({ error: code }, { status });
      }
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    if (path === '' || path.endsWith('/')) path += 'index.html';
    const file = join(webRoot, path);
    if (!file.startsWith(webRoot)) { res.writeHead(403); res.end('Forbidden'); return; }
    const content = await readFile(file);
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(content);
  } catch (error) {
    if (error?.code === 'ENOENT') { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Not found'); }
    else { res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Local preview error'); }
  }
});
server.listen(port, '127.0.0.1', () => console.log('Local preview: http://127.0.0.1:' + port + '/ (in-memory fixture data, local user only)'));