import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSvg } from './svg.mjs';
import { categoryDefinitions, topicLabels } from '../../src/lib/catalog-taxonomy.mjs';

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
export const metadataSchema = JSON.parse(
  await readFile(new URL('../../schema/metadata.schema.json', import.meta.url), 'utf8'),
);
const order = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const fail = (message) => {
  throw new Error(`Invalid catalog: ${message}`);
};
const requireValue = (condition, message) => {
  if (!condition) fail(message);
};
const definition = (spec) =>
  spec.$ref ? metadataSchema.$defs[spec.$ref.slice('#/$defs/'.length)] : spec;
const assetSchema = metadataSchema.$defs.asset;

// Evaluate the small schema subset used by metadata.schema.json. All metadata
// fields, required keys, enums and scalar rules come from that contract; file
// integrity and catalog graph invariants are checked separately below.
function fields(value, spec, context) {
  requireValue(
    value && typeof value === 'object' && !Array.isArray(value),
    `${context} must be an object`,
  );
  requireValue(
    spec.required.every((key) => Object.hasOwn(value, key)),
    `${context} is missing required fields`,
  );
  requireValue(
    Object.keys(value).every((key) => Object.hasOwn(spec.properties, key)),
    `${context} has unknown fields`,
  );
}

function scalar(value, field, context) {
  const spec = definition(field);
  const types = Array.isArray(spec.type) ? spec.type : [spec.type];
  requireValue(
    types.some((type) =>
      type === 'integer'
        ? Number.isSafeInteger(value)
        : type === 'null'
          ? value === null
          : typeof value === type,
    ),
    `${context} must be a ${types.join(' or ')}`,
  );
  if (value === null) return value;
  if (spec.const !== undefined)
    requireValue(value === spec.const, `${context} must be ${spec.const}`);
  if (spec.enum)
    requireValue(spec.enum.includes(value), `${context} must be ${spec.enum.join(' or ')}`);
  if (spec.pattern)
    requireValue(new RegExp(spec.pattern).test(value), `${context} has an invalid value`);
  if (spec.minLength !== undefined)
    requireValue(value.length >= spec.minLength, `${context} must not be empty`);
  if (spec.minimum !== undefined)
    requireValue(value >= spec.minimum, `${context} must be at least ${spec.minimum}`);
  if (spec.format === 'uri') httpsUrl(value, context);
  if (spec.format === 'date')
    requireValue(
      !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value,
      `${context} must be a real YYYY-MM-DD date`,
    );
  return value;
}

function validate(value, field, context) {
  const spec = definition(field);
  if (spec.type === 'object') {
    fields(value, spec, context);
    for (const key of Object.keys(value))
      validate(value[key], spec.properties[key], `${context}.${key}`);
  } else if (spec.type === 'array') {
    list(value, spec, context).forEach((item, index) =>
      validate(item, spec.items, `${context}[${index}]`),
    );
  } else scalar(value, spec, context);
}

function list(value, spec, context) {
  requireValue(Array.isArray(value), `${context} must be an array`);
  if (spec.minItems !== undefined)
    requireValue(
      value.length >= spec.minItems,
      `${context} must contain at least ${spec.minItems} items`,
    );
  if (spec.uniqueItems)
    requireValue(new Set(value).size === value.length, `${context} must contain unique values`);
  return value;
}

function stringList(value, spec, context) {
  return list(value, spec, context)
    .map((item) => scalar(item, spec.items, context))
    .sort(order);
}

function httpsUrl(value, context, spec) {
  if (spec) scalar(value, spec, context);
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${context} must be an absolute HTTPS URL`);
  }
  requireValue(
    url.protocol === 'https:' && url.hostname && !url.username && !url.password,
    `${context} must be HTTPS without credentials`,
  );
  return value;
}

async function realEntry(path, directory) {
  const stat = await lstat(path).catch(() => fail(`${path}: missing or unreadable entry`));
  requireValue(!stat.isSymbolicLink(), `${path}: symbolic links are forbidden`);
  requireValue(
    directory ? stat.isDirectory() : stat.isFile(),
    `${path}: expected a ${directory ? 'directory' : 'file'}`,
  );
  return stat;
}

// Format identification and basic header checks only; this does not decode images.
function checkRaster(buffer, extension, context) {
  const png =
    extension === '.png' &&
    buffer.length >= 33 &&
    buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) &&
    buffer.readUInt32BE(8) === 13 &&
    buffer.toString('ascii', 12, 16) === 'IHDR' &&
    buffer.readUInt32BE(16) > 0 &&
    buffer.readUInt32BE(20) > 0;
  const jpg =
    extension === '.jpg' &&
    buffer.length >= 4 &&
    buffer.readUInt16BE(0) === 0xffd8 &&
    buffer.readUInt16BE(buffer.length - 2) === 0xffd9;
  const webp =
    extension === '.webp' &&
    buffer.length >= 20 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP' &&
    buffer.readUInt32LE(4) === buffer.length - 8 &&
    ['VP8 ', 'VP8L', 'VP8X'].includes(buffer.toString('ascii', 12, 16)) &&
    buffer.readUInt32LE(16) > 0 &&
    buffer.readUInt32LE(16) <= buffer.length - 20;
  requireValue(png || jpg || webp, `${context}: image header does not match ${extension}`);
  if (png) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (jpg) {
    // Read SOF dimensions without decoding pixels. Minimal header fixtures can
    // be valid under the basic checks above while carrying no SOF information.
    let offset = 2;
    while (offset + 1 < buffer.length) {
      if (buffer[offset++] !== 0xff) break;
      while (buffer[offset] === 0xff) offset++;
      const marker = buffer[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > buffer.length) break;
      const length = buffer.readUInt16BE(offset);
      if (length < 2 || offset + length > buffer.length) break;
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker) && length >= 8) {
        const height = buffer.readUInt16BE(offset + 3);
        const width = buffer.readUInt16BE(offset + 5);
        requireValue(
          width > 0 && height > 0,
          `${context}: image header contains invalid dimensions`,
        );
        return { width, height };
      }
      offset += length;
    }
  }
  return {};
}

async function readRegisteredFile(entry, folder, context) {
  requireValue(basename(entry.file) === entry.file, `${context}.file must be a basename`);
  const path = join(folder, entry.file);
  const stat = await realEntry(path, false);
  requireValue(stat.size === entry.bytes, `${path}: byte size does not match metadata`);
  const buffer = await readFile(path);
  requireValue(
    createHash('sha256').update(buffer).digest('hex') === entry.sha256,
    `${path}: SHA-256 does not match metadata`,
  );
  return { path, buffer };
}

// Basic native-format identification only. Design attachments are downloaded,
// never parsed as renderable images or inserted into the document.
function checkSourceFile(buffer, extension, context) {
  let header = buffer.toString('latin1', 0, 8192);
  const pdf =
    /^%PDF-\d\.\d[\r\n]/.test(header) &&
    /%%EOF\s*$/.test(buffer.subarray(-1024).toString('latin1'));
  if (buffer.length >= 30 && buffer.readUInt32BE(0) === 0xc5d0d3c6) {
    const offset = buffer.readUInt32LE(4);
    const length = buffer.readUInt32LE(8);
    requireValue(
      offset >= 30 && length > 0 && offset + length <= buffer.length,
      `${context}: source file header contains invalid EPS offsets`,
    );
    header = buffer.toString('latin1', offset, offset + Math.min(length, 8192));
  }
  const postscript = /^%!PS-Adobe-[\d.]+(?: EPSF-[\d.]+)?[\r\n]/.test(header);
  const illustrator = postscript && /%%Creator:[^\r\n]*Illustrator/i.test(header);
  const eps = /^%!PS-Adobe-[\d.]+ EPSF-[\d.]+[\r\n]/.test(header);
  requireValue(
    (extension === '.pdf' && pdf) ||
      (extension === '.ai' && (pdf || illustrator)) ||
      (extension === '.eps' && eps),
    `${context}: source file header does not match ${extension}`,
  );
}

async function readSourceFiles(sourceFiles, assets, folder, id) {
  if (sourceFiles === undefined) return undefined;
  const files = new Set();
  const assetFiles = new Set(assets.map((asset) => asset.file));
  const result = [];
  for (const entry of sourceFiles) {
    const context = `${id}.sourceFiles.${entry.file}`;
    requireValue(!files.has(entry.file), `${context}: duplicate source file`);
    files.add(entry.file);
    requireValue(
      entry.assetFiles.every((file) => assetFiles.has(file)),
      `${context}.assetFiles must reference registered assets`,
    );
    const { buffer, path } = await readRegisteredFile(entry, folder, context);
    checkSourceFile(buffer, extname(entry.file), path);
    result.push({
      file: entry.file,
      label: entry.label,
      assetFiles: [...entry.assetFiles].sort(order),
      source: entry.source,
      sourcePage: entry.sourcePage,
      sha256: entry.sha256,
      bytes: entry.bytes,
      rights: { ...entry.rights },
      path: `logo/${id}/${entry.file}`,
    });
  }
  return result.sort((a, b) => order(a.file, b.file));
}

async function readAsset(asset, folder, id) {
  const context = `${id}.assets`;
  validate(asset, assetSchema, context);
  const { sourceType, channel, placement, pageTitle } = asset.provenance;
  requireValue(
    channel === undefined ||
      (sourceType === 'commons' ? channel === 'commons' : channel !== 'commons'),
    `${context}.provenance.channel must agree with sourceType ${sourceType}`,
  );
  requireValue(
    placement === undefined || channel === 'website',
    `${context}.provenance.placement requires the website channel`,
  );
  const file = asset.file;
  const { path, buffer } = await readRegisteredFile(asset, folder, context);
  let dimensions;
  if (extname(file) === '.svg') dimensions = checkSvg(buffer, path);
  else dimensions = checkRaster(buffer, extname(file), path);
  return {
    file,
    label: asset.label,
    variant: asset.variant,
    ...(asset.usage === undefined ? {} : { usage: asset.usage }),
    status: asset.status,
    ...(asset.display === undefined ? {} : { display: asset.display }),
    background: asset.background,
    language: asset.language,
    layout: asset.layout,
    color: asset.color,
    provenance: {
      sourceType,
      processing: asset.provenance.processing,
      ...(channel === undefined ? {} : { channel }),
      ...(placement === undefined ? {} : { placement }),
      ...(pageTitle === undefined ? {} : { pageTitle }),
      ...(asset.provenance.originalAsset === undefined
        ? {}
        : { originalAsset: asset.provenance.originalAsset }),
      ...(asset.provenance.originalSha256 === undefined
        ? {}
        : { originalSha256: asset.provenance.originalSha256 }),
    },
    ...(asset.qualityNotes === undefined ? {} : { qualityNotes: [...asset.qualityNotes] }),
    ...(asset.usageWarnings === undefined ? {} : { usageWarnings: [...asset.usageWarnings] }),
    source: httpsUrl(asset.source, `${context}.source`, assetSchema.properties.source),
    sourcePage: httpsUrl(
      asset.sourcePage,
      `${context}.sourcePage`,
      assetSchema.properties.sourcePage,
    ),
    sha256: asset.sha256,
    bytes: asset.bytes,
    rights: {
      status: asset.rights.status,
      license: asset.rights.license,
      reference: asset.rights.reference,
      attribution: asset.rights.attribution,
      reviewedAt: asset.rights.reviewedAt,
      ...(asset.rights.notes === undefined ? {} : { notes: asset.rights.notes }),
    },
    ...dimensions,
    path: `logo/${id}/${file}`,
  };
}

function readArtworks(artworks, assets, context) {
  if (artworks === undefined) return undefined;
  const ids = new Set();
  const membership = new Set();
  const byFile = new Map(assets.map((asset) => [asset.file, asset]));
  return artworks.map((artwork) => {
    requireValue(!ids.has(artwork.id), `${context}: duplicate artwork ID ${artwork.id}`);
    ids.add(artwork.id);
    const members = artwork.files.map((file) => {
      requireValue(byFile.has(file), `${context}.${artwork.id}: ${file} is not a registered asset`);
      requireValue(!membership.has(file), `${context}: ${file} belongs to more than one artwork`);
      membership.add(file);
      return byFile.get(file);
    });
    requireValue(
      artwork.files.includes(artwork.defaultAsset),
      `${context}.${artwork.id}.defaultAsset must reference a member file`,
    );
    requireValue(
      byFile.get(artwork.defaultAsset).display !== 'alternative' ||
        members.every((member) => member.display === 'alternative'),
      `${context}.${artwork.id}.defaultAsset must select a primary member when one exists`,
    );
    for (const key of ['variant', 'usage', 'language', 'layout', 'color', 'status']) {
      requireValue(
        members.every((member) => member[key] === members[0][key]),
        `${context}.${artwork.id}: members must share ${key}`,
      );
    }
    return {
      id: artwork.id,
      label: artwork.label,
      files: [...artwork.files],
      defaultAsset: artwork.defaultAsset,
    };
  });
}

/** Validate local files and declared permission fields; does not verify legal permission. */
export async function loadCatalog(root = repositoryRoot) {
  const logos = join(root, 'logo');
  await realEntry(logos, true);
  const brands = [];
  const ids = new Set();
  for (const folderName of (await readdir(logos)).sort(order)) {
    if (folderName === '.DS_Store') continue;
    const folder = join(logos, folderName);
    if (folderName === '.gitkeep') {
      requireValue(
        (await realEntry(folder, false)).size === 0,
        `${folder}: .gitkeep must be empty`,
      );
      continue;
    }
    await realEntry(folder, true);
    scalar(folderName, metadataSchema.properties.id, `${folder}: directory ID`);
    const children = (await readdir(folder)).filter((name) => name !== '.DS_Store');
    for (const child of children) await realEntry(join(folder, child), false);
    let metadata;
    try {
      metadata = JSON.parse(await readFile(join(folder, 'metadata.json'), 'utf8'));
    } catch {
      fail(`${folder}/metadata.json: missing or malformed JSON`);
    }
    validate(metadata, metadataSchema, folder);
    requireValue(metadata.id === folderName, `${folder}: metadata ID must match directory`);
    requireValue(!ids.has(metadata.id), `${folder}: duplicate ID`);
    ids.add(metadata.id);
    const aliases = stringList(
      metadata.aliases,
      metadataSchema.properties.aliases,
      `${folder}.aliases`,
    );
    const categories = stringList(
      metadata.categories,
      metadataSchema.properties.categories,
      `${folder}.categories`,
    );
    for (const id of categories)
      requireValue(
        categoryDefinitions.get(id)?.parent,
        `${folder}.categories: unknown leaf industry ${id}. See src/lib/catalog-taxonomy.mjs.`,
      );
    const topics =
      metadata.topics === undefined
        ? undefined
        : stringList(metadata.topics, metadataSchema.properties.topics, `${folder}.topics`);
    for (const id of topics ?? [])
      requireValue(
        Object.hasOwn(topicLabels, id),
        `${folder}.topics: unknown topic ${id}. See src/lib/catalog-taxonomy.mjs.`,
      );
    list(metadata.assets, metadataSchema.properties.assets, `${folder}.assets`);
    const files = metadata.assets.map((item) => item?.file);
    requireValue(new Set(files).size === files.length, `${folder}: duplicate asset file`);
    const assets = [];
    for (const item of metadata.assets) assets.push(await readAsset(item, folder, metadata.id));
    for (const asset of assets) {
      const originalFile = asset.provenance.originalAsset;
      const extracted = asset.provenance.processing === 'extracted';
      requireValue(
        extracted || (originalFile === undefined && asset.provenance.originalSha256 === undefined),
        `${folder}.${asset.file}: originalAsset requires extracted processing`,
      );
      if (!extracted) continue;
      const original = assets.find((entry) => entry.file === originalFile);
      requireValue(
        extname(asset.file) === '.svg' &&
          asset.variant === 'icon' &&
          asset.layout === 'standalone' &&
          original &&
          extname(original.file) === '.svg' &&
          original.provenance.processing === 'original',
        `${folder}.${asset.file}: extracted symbols require a registered original SVG`,
      );
      requireValue(
        asset.source === original.source &&
          asset.provenance.originalSha256 === original.sha256 &&
          asset.sourcePage === original.sourcePage &&
          asset.provenance.sourceType === original.provenance.sourceType &&
          asset.provenance.channel === original.provenance.channel &&
          asset.provenance.placement === undefined,
        `${folder}.${asset.file}: extracted symbols must preserve original acquisition sources`,
      );
    }
    const artworks = readArtworks(metadata.artworks, assets, `${folder}.artworks`);
    const sourceFiles = await readSourceFiles(metadata.sourceFiles, assets, folder, metadata.id);
    const selected = assets.find((item) => item.file === metadata.defaultAsset);
    requireValue(selected, `${folder}.defaultAsset must reference a registered asset`);
    requireValue(
      selected.display !== 'alternative',
      `${folder}.defaultAsset must select a primary asset`,
    );
    requireValue(
      selected.status === 'current' || !assets.some((item) => item.status === 'current'),
      `${folder}.defaultAsset must select a current asset when one exists`,
    );
    requireValue(
      children.every(
        (child) =>
          child === 'metadata.json' ||
          files.includes(child) ||
          sourceFiles?.some((entry) => entry.file === child),
      ),
      `${folder}: orphan file`,
    );
    brands.push({
      schemaVersion: metadata.schemaVersion,
      id: metadata.id,
      name: metadata.name,
      aliases,
      identity: {
        nameZh: metadata.identity.nameZh,
        nameEn: metadata.identity.nameEn,
        legalNames: metadata.identity.legalNames.map(
          ({ name, language, role, source, reviewedAt }) => ({
            name,
            language,
            role,
            source,
            reviewedAt,
          }),
        ),
        sources: metadata.identity.sources.map(({ label, url, reviewedAt }) => ({
          label,
          url,
          reviewedAt,
        })),
      },
      website: httpsUrl(metadata.website, `${folder}.website`, metadataSchema.properties.website),
      entityType: metadata.entityType,
      categories,
      ...(topics === undefined ? {} : { topics }),
      ...(metadata.parentId === undefined ? {} : { parentId: metadata.parentId }),
      defaultAsset: metadata.defaultAsset,
      ...(artworks === undefined ? {} : { artworks }),
      ...(sourceFiles === undefined ? {} : { sourceFiles }),
      assets: assets.sort((a, b) => order(a.file, b.file)),
    });
  }
  const byId = new Map(brands.map((brand) => [brand.id, brand]));
  for (const brand of brands) {
    const visited = new Set([brand.id]);
    let current = brand;
    while (current.parentId !== undefined) {
      requireValue(
        byId.has(current.parentId),
        `${current.id}.parentId must reference an existing brand`,
      );
      requireValue(
        !visited.has(current.parentId),
        `${brand.id}.parentId forms a self-reference or cycle`,
      );
      visited.add(current.parentId);
      current = byId.get(current.parentId);
    }
  }
  return { schemaVersion: metadataSchema.properties.schemaVersion.const, brands };
}

/** Inspect local input for a draft; does not establish source or permission. */
export async function inspectAssetFile(path) {
  scalar(basename(path), assetSchema.properties.file, 'input filename');
  const stat = await realEntry(path, false);
  requireValue(stat.size > 0, `${path}: image must not be empty`);
  const buffer = await readFile(path);
  if (extname(path) === '.svg') checkSvg(buffer, path);
  else checkRaster(buffer, extname(path), path);
  return {
    buffer,
    bytes: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
}
