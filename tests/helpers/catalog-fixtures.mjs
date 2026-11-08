import { createHash } from 'node:crypto';

export const fixtureSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8v8H0z"/></svg>';
export const fixtureWebsite = 'https://example.com/';
export const fixtureReviewDate = '2026-11-07';

export function assetMetadata({ file = 'icon.svg', data = fixtureSvg, ...overrides } = {}) {
  return {
    file,
    label: 'Current icon',
    variant: 'icon',
    status: 'current',
    background: 'any',
    language: 'none',
    layout: 'standalone',
    color: 'brand',
    provenance: { sourceType: 'official', processing: 'original' },
    source: fixtureWebsite,
    sourcePage: fixtureWebsite,
    sha256: createHash('sha256').update(data).digest('hex'),
    bytes: Buffer.byteLength(data),
    rights: {
      status: 'permitted',
      license: 'Example permission',
      reference: fixtureWebsite,
      attribution: 'Example',
      reviewedAt: fixtureReviewDate,
    },
    ...structuredClone(overrides),
  };
}

// Each call owns its arrays and nested records, including explicit overrides.
export function brandMetadata({ id = 'example', ...overrides } = {}) {
  return {
    schemaVersion: 3,
    id,
    name: id,
    aliases: [],
    website: fixtureWebsite,
    identity: { nameZh: null, nameEn: null, legalNames: [], sources: [] },
    entityType: 'company',
    categories: [],
    defaultAsset: 'icon.svg',
    assets: [assetMetadata()],
    ...structuredClone(overrides),
  };
}
