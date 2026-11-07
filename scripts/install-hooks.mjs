import { existsSync } from 'node:fs';

const { CI, HUSKY, NODE_ENV } = process.env;
const onCI = CI && CI !== 'false' && CI !== '0';

// Archives and production installs can intentionally omit Husky itself.
if (!onCI && HUSKY !== '0' && NODE_ENV !== 'production' && existsSync('.git')) {
  const { default: husky } = await import('husky');
  const error = husky();
  if (error) throw new Error(error);
}
