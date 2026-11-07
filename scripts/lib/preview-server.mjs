import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';

const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

export function createPreviewServer(directory, { basePath = '/' } = {}) {
  const root = resolve(directory);
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(basePath)) throw new Error('Base path must start and end with / and use simple path segments.');
  return createServer(async (request, response) => {
    const reply = (status, message) => {
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : message);
    };
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD');
      reply(405, 'Method not allowed');
      return;
    }
    let requestUrl;
    let pathname;
    try {
      requestUrl = new URL(request.url, 'http://localhost');
      pathname = decodeURIComponent(requestUrl.pathname);
    }
    catch { reply(400, 'Invalid URL'); return; }
    if (basePath !== '/' && pathname === basePath.slice(0, -1)) {
      response.writeHead(308, { Location: basePath + requestUrl.search }); response.end(); return;
    }
    if (!pathname.startsWith(basePath)) { reply(404, 'Not found'); return; }
    const name = pathname.slice(basePath.length);
    if (name.includes('\\') || name.includes('\0') || name.split('/').some(part => part.startsWith('.'))) {
      reply(403, 'Forbidden'); return;
    }
    let file = resolve(root, name || 'index.html');
    if (file !== root && !file.startsWith(root + sep)) { reply(403, 'Forbidden'); return; }
    try {
      let info = await stat(file);
      if (info.isDirectory()) {
        if (!pathname.endsWith('/')) {
          response.writeHead(308, { Location: requestUrl.pathname + '/' + requestUrl.search }); response.end(); return;
        }
        file = resolve(file, 'index.html'); info = await stat(file);
      }
      const actual = await realpath(file);
      const outside = relative(await realpath(root), actual);
      if (outside.startsWith('..' + sep) || outside === '..' || isAbsolute(outside) || !info.isFile()) {
        reply(403, 'Forbidden'); return;
      }
      response.writeHead(200, {
        'Content-Type': contentTypes[extname(file)] || 'application/octet-stream',
        'Content-Length': info.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      });
      if (request.method === 'HEAD') { response.end(); return; }
      const stream = createReadStream(actual);
      stream.on('error', () => response.destroy());
      response.on('close', () => stream.destroy());
      stream.pipe(response);
    } catch (error) {
      reply(['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : 500, error.code === 'ENOENT' ? 'Not found' : 'Could not read file');
    }
  });
}
