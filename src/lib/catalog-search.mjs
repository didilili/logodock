export function normalizeQuery(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, ' ');
}

const names = new Intl.Collator('zh-CN', { sensitivity: 'base', numeric: true });

export function sortBrands(brands) {
  return [...brands].sort((a, b) => names.compare(a.name, b.name) || names.compare(a.id, b.id));
}

function primaryText(brand) {
  return normalizeQuery(
    [
      brand.name,
      brand.identity?.nameZh,
      brand.identity?.nameEn,
      ...(brand.aliases || []),
      ...(brand.identity?.legalNames || []).map((item) => item.name),
      brand.id,
    ].join(' '),
  );
}

// Brand identity and domain are shared; remaining terms must describe one file.
// Returning the original asset objects lets every directory action use that file.
export function matchingAssets(brand, query) {
  const identity = `${primaryText(brand)} ${normalizeQuery(brand.website)}`;
  const terms = normalizeQuery(query)
    .split(' ')
    .filter((term) => term && !identity.includes(term));
  if (!terms.length) return [...brand.assets];
  return brand.assets.filter((asset) => {
    const text = normalizeQuery([asset.file, asset.label, asset.rights?.license].join(' '));
    return terms.every((term) => text.includes(term));
  });
}

export function filterBrands(brands, query) {
  const terms = normalizeQuery(query).split(' ').filter(Boolean);
  if (!terms.length) return [...brands];
  return brands
    .map((brand, index) => {
      const primary = primaryText(brand);
      const matches = matchingAssets(brand, query).length > 0;
      const score = terms.reduce((sum, term) => sum + (primary.includes(term) ? 1 : 0), 0);
      return { brand, index, matches, score };
    })
    .filter((match) => match.matches)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((match) => match.brand);
}
