import { createBuilder } from 'vite';
import { writeFile } from 'node:fs/promises';
import { prepareSite } from './prepare-site.mjs';
try {
  await prepareSite();
  const builder = await createBuilder();
  await builder.buildApp();
  await writeFile('_site/.nojekyll', '');
} catch (error) { console.error(error.message); process.exitCode = 1; }
