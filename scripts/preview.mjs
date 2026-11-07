import { join } from 'node:path';
import { repositoryRoot } from './lib/catalog.mjs';
import { createPreviewServer } from './lib/preview-server.mjs';
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const equal = args.find(arg => arg.startsWith(`${name}=`));
  if (equal) return equal.slice(name.length + 1);
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
try {
  const port = Number(option('--port', '4173'));
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Port must be an integer between 0 and 65535.');
  const basePath = option('--base', process.env.BASE_PATH ? process.env.BASE_PATH.replace(/\/$/, '') + '/' : '/');
  const server = createPreviewServer(join(repositoryRoot, '_site'), { basePath });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`LogoDock static preview: http://127.0.0.1:${server.address().port}${basePath}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
} catch (error) { console.error(error.message); process.exitCode = 1; }
