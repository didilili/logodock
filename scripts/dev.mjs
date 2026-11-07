import { createServer } from 'vite';
import { prepareSite } from './prepare-site.mjs';
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const equal = args.find(arg => arg.startsWith(`${name}=`));
  if (equal) return equal.slice(name.length + 1);
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
try {
  if (args.includes('--help')) {
    console.log('Usage: npm run dev -- [--port 5173] [--base /logodock/]\nStarts SvelteKit/Vite on 127.0.0.1 with hot updates. No deployment.');
  } else {
    const port = Number(option('--port', process.env.PORT || '5173'));
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Port must be an integer between 0 and 65535.');
    process.env.BASE_PATH = option('--base', process.env.BASE_PATH || '').replace(/\/$/, '');
    await prepareSite();
    const server = await createServer({ server: { port, host: '127.0.0.1', strictPort: true } });
    await server.listen();
    const address = server.httpServer.address();
    console.log(`LogoDock local preview: http://127.0.0.1:${address.port}${process.env.BASE_PATH || ''}/`);
    server.printUrls();
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); process.exit(0); });
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
