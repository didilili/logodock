export default {
  '*.{js,mjs,cjs,ts,svelte}': 'eslint --max-warnings=0 --no-warn-ignored --',
  '*.{js,mjs,cjs,ts,svelte,json,css,html,md,yml,yaml}': 'prettier --check --ignore-unknown --',
};
