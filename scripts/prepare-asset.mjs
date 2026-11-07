import { mkdir, realpath, rmdir, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { inspectAssetFile, metadataSchema, repositoryRoot } from './lib/catalog.mjs';

const assetFields = metadataSchema.$defs.asset.properties;
const provenanceFields = metadataSchema.$defs.provenance.properties;
const enumOptions = [
  ['entity-type', metadataSchema.properties.entityType], ['variant', assetFields.variant],
  ['status', assetFields.status], ['background', assetFields.background],
  ['language', assetFields.language], ['layout', assetFields.layout], ['color', assetFields.color],
  ['source-type', provenanceFields.sourceType], ['processing', provenanceFields.processing],
];
const help = `Usage: node scripts/prepare-asset.mjs <local-image> --id <brand-id> --name <name> --output <new-directory>

Creates a local draft outside logos/. The destination must not exist.
No network access, publication or permission approval is performed.
Schema: schema/metadata.schema.json (v${metadataSchema.properties.schemaVersion.const})

Options:
${enumOptions.map(([name, spec]) => `  --${name} <${spec.enum.join('|')}> (default: ${spec.default ?? 'unverified; fill manually'})`).join('\n')}
  --label <readable-version-name> (default: Original asset)
  --category <tag> (repeatable)
  --help

Manually verify identity, language, layout, color, provenance, version and background;
fill verified identity names/sources, website, source, sourcePage and every rights field.
Unverified identity names remain null. rights.status remains pending-review.
Only a human source/rights review can justify changing it to permitted.
`;

function options(args) {
  const result = { categories: [] };
  const names = new Set(['id', 'name', 'output', 'label', 'category', ...enumOptions.map(([name]) => name)]);
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg.startsWith('-') && result.input === undefined) { result.input = arg; continue; }
    const name = arg.slice(2);
    if (!arg.startsWith('--') || !names.has(name)) throw new Error(`Unknown argument: ${arg}. Use --help.`);
    const value = args[++index];
    if (!value || value.startsWith('--') || !value.trim()) throw new Error(`${arg} needs a value. Use --help.`);
    if (name === 'category') result.categories.push(value);
    else {
      if (result[name] !== undefined) throw new Error(`${arg} can only be supplied once.`);
      result[name] = value;
    }
  }
  for (const name of ['input', 'id', 'name', 'output']) {
    if (!result[name]) throw new Error(`Missing ${name === 'input' ? 'local image path' : `--${name}`}. Use --help.`);
  }
  if (!new RegExp(metadataSchema.$defs.id.pattern).test(result.id)) throw new Error('--id must use lowercase letters, numbers and single hyphens.');
  for (const [name, spec] of enumOptions) {
    if (result[name] === undefined && spec.default === undefined) { result[name] = ''; continue; }
    result[name] ??= spec.default;
    if (!spec.enum.includes(result[name])) throw new Error(`--${name} must be ${spec.enum.join(' or ')}.`);
  }
  result.categories = [...new Set(result.categories)];
  return result;
}

async function createDraft(config) {
  const input = resolve(config.input);
  const output = resolve(config.output);
  const file = basename(input);
  if (!new RegExp(metadataSchema.$defs.imageFile.pattern).test(file)) {
    throw new Error('Unsupported input filename. Use a non-hidden image filename with an allowed extension (see schema/metadata.schema.json).');
  }
  const inspected = await inspectAssetFile(input);
  const parent = await realpath(dirname(output)).catch(() => { throw new Error('The output parent directory must already exist and be readable.'); });
  const physicalOutput = join(parent, basename(output));
  const logos = await realpath(join(repositoryRoot, 'logos'));
  const fromLogos = relative(logos, physicalOutput);
  if (fromLogos === '' || (!isAbsolute(fromLogos) && fromLogos !== '..' && !fromLogos.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`))) {
    throw new Error('Draft output must be outside logos/. Choose a separate working directory.');
  }
  const draft = {
    schemaVersion: metadataSchema.properties.schemaVersion.const,
    id: config.id, name: config.name, aliases: [], website: '', entityType: config['entity-type'],
    identity: { nameZh: null, nameEn: null, legalNames: [], sources: [] },
    categories: config.categories, defaultAsset: file,
    assets: [{ file, label: config.label ?? 'Original asset', variant: config.variant,
      status: config.status, background: config.background,
      language: config.language, layout: config.layout, color: config.color,
      provenance: { sourceType: config['source-type'], processing: config.processing },
      source: '', sourcePage: '', sha256: inspected.sha256, bytes: inspected.bytes,
      rights: { status: 'pending-review', license: '', reference: '', attribution: '', reviewedAt: '',
        notes: 'Manual source and rights review required before inclusion.' } }],
  };
  await mkdir(output).catch((error) => {
    if (error.code === 'EEXIST') throw new Error(`Output already exists: ${output}. Choose a new directory; nothing was overwritten.`);
    throw new Error(`Cannot create output directory: ${output} (${error.code ?? error.message}).`);
  });
  const created = [];
  try {
    for (const [name, data] of [[file, inspected.buffer], ['metadata.json', `${JSON.stringify(draft, null, 2)}\n`]]) {
      const path = join(output, name);
      await writeFile(path, data, { flag: 'wx' });
      created.push(path);
    }
  } catch (error) {
    for (const path of created) await unlink(path).catch(() => {});
    await rmdir(output).catch(() => {});
    throw new Error(`Could not write the draft: ${error.code ?? error.message}. Existing files were not overwritten.`);
  }
  console.log(`Created draft: ${join(output, 'metadata.json')}\nManual review required: fill source and rights fields before catalog inclusion. No files were published.`);
}

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') console.log(help);
  else await createDraft(options(args));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
