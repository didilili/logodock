import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { isWithinDirectory } from './scripts/lib/paths.mjs';

const run = promisify(execFile);
const base = (process.env.BASE_PATH?.replace(/\/$/, '') || '') as '' | `/${string}`;
if (base && !/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+$/.test(base))
  throw new Error('BASE_PATH must use simple absolute path segments.');

function catalogWatch(): Plugin {
  return {
    name: 'logodock-catalog-watch',
    configureServer(server) {
      const root = process.cwd();
      const folders = ['logos', 'schema', 'scripts'].map((folder) => resolve(root, folder));
      server.watcher.add(folders);
      let timer: ReturnType<typeof setTimeout>;
      let pending = Promise.resolve();
      const onChange = (_event: string, file: string) => {
        if (!folders.some((folder) => isWithinDirectory(file, folder))) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          pending = pending.then(async () => {
            try {
              await run(process.execPath, ['scripts/prepare-site.mjs'], { cwd: root });
              delete process.env.LOGODOCK_VALIDATION_ERROR;
              for (const env of Object.values(server.environments)) env.moduleGraph.invalidateAll();
              server.ws.send({ type: 'full-reload' });
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              process.env.LOGODOCK_VALIDATION_ERROR = message;
              server.config.logger.error(message);
              server.ws.send({ type: 'error', err: { message, stack: '' } });
              for (const env of Object.values(server.environments)) env.moduleGraph.invalidateAll();
            }
          });
        }, 120);
      };
      server.watcher.on('all', onChange);
      server.httpServer?.once('close', () => {
        clearTimeout(timer);
        server.watcher.off('all', onChange);
      });
    },
  };
}

export default defineConfig({
  cacheDir: '.svelte-kit/vite',
  plugins: [
    tailwindcss(),
    sveltekit({
      adapter: adapter({ pages: '_site', assets: '_site', strict: true }),
      paths: { base, relative: false },
    }),
    catalogWatch(),
  ],
  server: { host: '127.0.0.1' },
});
