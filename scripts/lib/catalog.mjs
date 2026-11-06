import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SaxesParser } from 'saxes';

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const svgNamespace = 'http://www.w3.org/2000/svg';
const xlinkNamespace = 'http://www.w3.org/1999/xlink';
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const fail = (message) => { throw new Error(`Invalid catalog: ${message}`); };
const requireValue = (condition, message) => { if (!condition) fail(message); };
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;

function fields(value, required, optional, context) {
  requireValue(value && typeof value === 'object' && !Array.isArray(value), `${context} must be an object`);
  requireValue(required.every((key) => Object.hasOwn(value, key)), `${context} is missing required fields`);
  requireValue(Object.keys(value).every((key) => [...required, ...optional].includes(key)), `${context} has unknown fields`);
}

function httpsUrl(value, context) {
  let url;
  try { url = new URL(value); } catch { fail(`${context} must be an absolute HTTPS URL`); }
  requireValue(typeof value === 'string' && /^https:\/\//.test(value) && !/[\s\\]/.test(value) && url.protocol === 'https:'
    && url.hostname && !url.username && !url.password, `${context} must be HTTPS without credentials`);
  return value;
}

function permission(rights, context) {
  fields(rights, ['status', 'license', 'reference', 'attribution', 'reviewedAt'], ['notes'], context);
  requireValue(rights.status === 'permitted', `${context}.status must be permitted`);
  for (const key of ['license', 'attribution']) requireValue(nonempty(rights[key]), `${context}.${key} must be nonempty`);
  if (rights.notes !== undefined) requireValue(typeof rights.notes === 'string', `${context}.notes must be a string`);
  const date = rights.reviewedAt;
  requireValue(typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date,
  `${context}.reviewedAt must be a real YYYY-MM-DD date`);
  return { status: rights.status, license: rights.license, reference: httpsUrl(rights.reference, `${context}.reference`),
    attribution: rights.attribution, reviewedAt: date, ...(rights.notes === undefined ? {} : { notes: rights.notes }) };
}

// A deliberately restricted static SVG subset, not a general SVG sanitizer.
const svgElements = new Set(('svg g defs title desc path rect circle ellipse line polyline polygon '
  + 'text tspan textPath clipPath mask pattern symbol use image linearGradient radialGradient stop').split(' '));
const svgAttributes = new Set(('id class version viewBox preserveAspectRatio x y x1 y1 x2 y2 cx cy r rx ry '
  + 'width height d points transform fill fill-opacity fill-rule stroke stroke-width stroke-opacity '
  + 'stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset opacity '
  + 'clip-path clip-rule mask maskUnits maskContentUnits clipPathUnits display visibility '
  + 'gradientUnits gradientTransform spreadMethod offset stop-color stop-opacity fx fy fr '
  + 'patternUnits patternContentUnits patternTransform text-anchor dominant-baseline alignment-baseline '
  + 'font-family font-size font-weight font-style letter-spacing word-spacing dx dy rotate textLength '
  + 'lengthAdjust startOffset method spacing overflow vector-effect shape-rendering color '
  + 'role aria-label aria-labelledby aria-describedby aria-hidden focusable').split(' '));
const fragment = /^#[A-Za-z_][A-Za-z0-9_.:-]*$/;

function checkSvg(buffer, context) {
  const reject = (reason) => fail(`${context}: SVG ${reason}`);
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
  catch { reject('must be valid UTF-8'); }
  const parser = new SaxesParser({ xmlns: true });
  let first = true;
  parser.on('error', () => reject('is malformed XML'));
  parser.on('doctype', () => reject('DOCTYPE is forbidden'));
  parser.on('processinginstruction', () => reject('processing instructions are forbidden'));
  parser.on('opentag', (tag) => {
    if (first && tag.local !== 'svg') reject('root must be svg');
    first = false;
    if (tag.uri !== svgNamespace || !svgElements.has(tag.local)) reject(`element ${tag.name} is outside the static subset`);
    for (const attribute of Object.values(tag.attributes)) {
      const { name, local, uri, value } = attribute;
      if (uri === 'http://www.w3.org/2000/xmlns/') {
        if (![svgNamespace, xlinkNamespace].includes(value)) reject('foreign namespace declarations are forbidden');
        continue;
      }
      if (uri === 'http://www.w3.org/XML/1998/namespace' && local === 'space' && ['default', 'preserve'].includes(value)) continue;
      if (uri && !(uri === xlinkNamespace && local === 'href')) reject(`attribute namespace ${name} is forbidden`);
      if (local === 'href') {
        const png = tag.local === 'image' && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
          && Buffer.from(value.split(',')[1], 'base64').subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
        if (!fragment.test(value) && !png) reject('href must reference a local fragment or an embedded PNG image');
        continue;
      }
      if (!svgAttributes.has(name) || /^on/i.test(local)) reject(`attribute ${name} is outside the static subset`);
      if (/[\\\u0000-\u001f]/.test(value) || value.includes('/*')) reject('CSS escapes, comments, and control characters are forbidden');
      if (/url\s*\(/i.test(value) && !/^url\(\s*#[A-Za-z_][A-Za-z0-9_.:-]*\s*\)$/i.test(value)) reject('external or complex CSS references are forbidden');
    }
  });
  try { parser.write(text).close(); }
  catch (error) { if (error.message.startsWith('Invalid catalog:')) throw error; reject('is malformed XML'); }
}

async function realEntry(path, directory) {
  const stat = await lstat(path).catch(() => fail(`${path}: missing or unreadable entry`));
  requireValue(!stat.isSymbolicLink(), `${path}: symbolic links are forbidden`);
  requireValue(directory ? stat.isDirectory() : stat.isFile(), `${path}: expected a ${directory ? 'directory' : 'file'}`);
  return stat;
}

// Format identification and basic header checks only; this does not decode images.
function checkRaster(buffer, extension, context) {
  const png = extension === '.png' && buffer.length >= 33
    && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    && buffer.readUInt32BE(8) === 13 && buffer.toString('ascii', 12, 16) === 'IHDR'
    && buffer.readUInt32BE(16) > 0 && buffer.readUInt32BE(20) > 0;
  const jpg = extension === '.jpg' && buffer.length >= 4
    && buffer.readUInt16BE(0) === 0xffd8 && buffer.readUInt16BE(buffer.length - 2) === 0xffd9;
  const webp = extension === '.webp' && buffer.length >= 20
    && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
    && buffer.readUInt32LE(4) === buffer.length - 8 && ['VP8 ', 'VP8L', 'VP8X'].includes(buffer.toString('ascii', 12, 16))
    && buffer.readUInt32LE(16) > 0 && buffer.readUInt32LE(16) <= buffer.length - 20;
  requireValue(png || jpg || webp, `${context}: image header does not match ${extension}`);
}

async function readAsset(asset, folder, id) {
  const context = `${id}.assets`;
  fields(asset, ['file', 'variant', 'source', 'sourcePage', 'sha256', 'bytes', 'rights'], [], context);
  const file = asset.file;
  requireValue(typeof file === 'string' && basename(file) === file && !/[\\/:\u0000-\u001f]/.test(file)
    && ['.svg', '.png', '.webp', '.jpg'].includes(extname(file)), `${context}.file must be an image basename`);
  requireValue(['icon', 'wordmark', 'logo'].includes(asset.variant), `${context}.variant is invalid`);
  requireValue(typeof asset.sha256 === 'string' && /^[a-f0-9]{64}$/.test(asset.sha256), `${context}.sha256 must be lowercase SHA-256`);
  requireValue(Number.isSafeInteger(asset.bytes) && asset.bytes > 0, `${context}.bytes must be a positive integer`);
  const path = join(folder, file);
  const stat = await realEntry(path, false);
  requireValue(stat.size === asset.bytes, `${path}: byte size does not match metadata`);
  const buffer = await readFile(path);
  requireValue(createHash('sha256').update(buffer).digest('hex') === asset.sha256, `${path}: SHA-256 does not match metadata`);
  if (extname(file) === '.svg') checkSvg(buffer, path);
  else checkRaster(buffer, extname(file), path);
  return { file, variant: asset.variant, source: httpsUrl(asset.source, `${context}.source`),
    sourcePage: httpsUrl(asset.sourcePage, `${context}.sourcePage`), sha256: asset.sha256, bytes: asset.bytes,
    rights: permission(asset.rights, `${context}.rights`), path: `logos/${id}/${file}` };
}

/** Validate local files and declared permission fields; does not verify legal permission. */
export async function loadCatalog(root = repositoryRoot) {
  const logos = join(root, 'logos');
  await realEntry(logos, true);
  const brands = [];
  const ids = new Set();
  for (const folderName of (await readdir(logos)).sort(order)) {
    const folder = join(logos, folderName);
    if (folderName === '.gitkeep') {
      requireValue((await realEntry(folder, false)).size === 0, `${folder}: .gitkeep must be empty`);
      continue;
    }
    await realEntry(folder, true);
    requireValue(idPattern.test(folderName), `${folder}: directory must use a lowercase-kebab ID`);
    const children = await readdir(folder);
    for (const child of children) await realEntry(join(folder, child), false);
    let metadata;
    try { metadata = JSON.parse(await readFile(join(folder, 'metadata.json'), 'utf8')); }
    catch { fail(`${folder}/metadata.json: missing or malformed JSON`); }
    fields(metadata, ['id', 'name', 'aliases', 'website', 'assets'], [], folder);
    requireValue(typeof metadata.id === 'string' && idPattern.test(metadata.id) && metadata.id === folderName,
      `${folder}: metadata ID must match directory`);
    requireValue(!ids.has(metadata.id), `${folder}: duplicate ID`);
    ids.add(metadata.id);
    requireValue(nonempty(metadata.name), `${folder}: name must be nonempty`);
    requireValue(Array.isArray(metadata.aliases) && metadata.aliases.every(nonempty)
      && new Set(metadata.aliases).size === metadata.aliases.length, `${folder}: aliases must be unique nonempty strings`);
    requireValue(Array.isArray(metadata.assets) && metadata.assets.length > 0, `${folder}: assets must not be empty`);
    const files = metadata.assets.map((item) => item?.file);
    requireValue(new Set(files).size === files.length, `${folder}: duplicate asset file`);
    const assets = [];
    for (const item of metadata.assets) assets.push(await readAsset(item, folder, metadata.id));
    requireValue(children.every((child) => child === 'metadata.json' || files.includes(child)), `${folder}: orphan file`);
    brands.push({ id: metadata.id, name: metadata.name, aliases: [...metadata.aliases].sort(order),
      website: httpsUrl(metadata.website, `${folder}.website`), assets: assets.sort((a, b) => order(a.file, b.file)) });
  }
  return { schemaVersion: 1, brands };
}
