/** @typedef {import('./types').Asset} Asset */
/** @typedef {import('./types').Brand} Brand */
/** @typedef {import('./types').ArtworkGroup} ArtworkGroup */

/** Pick a fallback only among files already reviewed as one artwork.
 * Explicit reviewed defaults always take precedence over this ranking.
 * @param {Asset[]} assets
 * @returns {Asset}
 */
function bestAvailableAsset(assets) {
  return [...assets].sort(
    (a, b) =>
      Number(a.display === 'alternative') - Number(b.display === 'alternative') ||
      Number(a.status === 'historical') - Number(b.status === 'historical') ||
      Number(b.file.endsWith('.svg')) - Number(a.file.endsWith('.svg')) ||
      (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0),
  )[0];
}

/** @param {ArtworkGroup} group */
export function isAlternativeArtwork(group) {
  return group.assets.every((asset) => asset.display === 'alternative');
}

/**
 * Group only explicitly reviewed artwork relationships. Missing declarations
 * stay as single-file choices; matching attributes alone do not establish that
 * two files depict the same artwork. Intersecting members keeps filtered
 * directory views usable without changing the group's identity.
 * @param {Brand} brand
 * @param {(asset: Asset) => string} [labelForAsset]
 * @returns {ArtworkGroup[]}
 */
export function artworkGroups(brand, labelForAsset = (asset) => asset.label) {
  const membership = new Map(
    (brand.artworks ?? []).flatMap((artwork) => artwork.files.map((file) => [file, artwork])),
  );
  const seen = new Set();
  const groups = [];
  for (const asset of brand.assets) {
    const artwork = membership.get(asset.file);
    if (!artwork) {
      groups.push({
        id: `file:${asset.file}`,
        label: labelForAsset(asset),
        assets: [asset],
        defaultAsset: asset,
      });
      continue;
    }
    if (seen.has(artwork.id)) continue;
    seen.add(artwork.id);
    const assets = brand.assets.filter((item) => artwork.files.includes(item.file));
    const primary = assets.filter((item) => item.display !== 'alternative');
    const preferred = primary.length ? primary : assets;
    const defaultAsset =
      preferred.find((item) => item.file === artwork.defaultAsset) ??
      preferred.find((item) => item.file === brand.defaultAsset) ??
      bestAvailableAsset(preferred);
    groups.push({ id: artwork.id, label: artwork.label, assets, defaultAsset });
  }
  return groups.sort(
    (a, b) =>
      Number(isAlternativeArtwork(a)) - Number(isAlternativeArtwork(b)) ||
      Number(b.assets.some((asset) => asset.file === brand.defaultAsset)) -
        Number(a.assets.some((asset) => asset.file === brand.defaultAsset)) ||
      Number(a.defaultAsset.status === 'historical') -
        Number(b.defaultAsset.status === 'historical'),
  );
}

/** @param {Brand} brand
 * @param {(asset: Asset) => string} [labelForAsset]
 * @returns {ArtworkGroup[]}
 */
export function primaryArtworkGroups(brand, labelForAsset) {
  const groups = artworkGroups(brand, labelForAsset);
  const primary = groups.filter((group) => !isAlternativeArtwork(group));
  return primary.length ? primary : groups;
}

/** When a directory filter leaves only alternatives, keep them in its main list.
 * @param {Brand} brand
 * @param {(asset: Asset) => string} [labelForAsset]
 * @returns {ArtworkGroup[]}
 */
export function alternativeArtworkGroups(brand, labelForAsset) {
  const groups = artworkGroups(brand, labelForAsset);
  return groups.some((group) => !isAlternativeArtwork(group))
    ? groups.filter(isAlternativeArtwork)
    : [];
}

/**
 * Locate a legacy filename selection inside its artwork without replacing the
 * selected representation. The caller continues to own the actual file state.
 * @param {Brand} brand
 * @param {Asset | string} [assetOrFilename]
 * @returns {ArtworkGroup}
 */
export function selectedArtwork(brand, assetOrFilename) {
  const groups = artworkGroups(brand);
  const file = typeof assetOrFilename === 'string' ? assetOrFilename : assetOrFilename?.file;
  const group =
    groups.find((item) => item.assets.some((asset) => asset.file === file)) ??
    groups.find((item) => item.assets.some((asset) => asset.file === brand.defaultAsset)) ??
    groups.find((item) => item.defaultAsset.status === 'current') ??
    groups[0];
  if (!group) throw new Error('Cannot select artwork from a brand without assets.');
  return group;
}

/**
 * Retain the preferred representation when a format has multiple source files.
 * An unavailable requested format falls back to a real default file.
 * @param {ArtworkGroup} group
 * @param {string} [preferredFormat]
 * @returns {Asset}
 */
export function preferredArtworkAsset(group, preferredFormat) {
  const format = preferredFormat?.toUpperCase();
  /** @param {Asset} asset */
  const formatOf = (asset) => asset.file.split('.').pop()?.toUpperCase();
  if (!format || formatOf(group.defaultAsset) === format) return group.defaultAsset;
  const matching = group.assets.filter((asset) => formatOf(asset) === format);
  return matching.length ? bestAvailableAsset(matching) : group.defaultAsset;
}
