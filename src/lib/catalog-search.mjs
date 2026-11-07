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

export function filterBrands(brands, query) {
  const terms = normalizeQuery(query).split(' ').filter(Boolean);
  if (!terms.length) return [...brands];
  return brands
    .map((brand, index) => {
      const primary = normalizeQuery(
        [
          brand.name,
          brand.identity?.nameZh,
          brand.identity?.nameEn,
          ...(brand.aliases || []),
          ...(brand.identity?.legalNames || []).map((item) => item.name),
          brand.id,
        ].join(' '),
      );
      const secondary = normalizeQuery(
        [
          brand.website,
          ...brand.assets.flatMap((asset) => [asset.file, asset.label, asset.rights?.license]),
        ].join(' '),
      );
      const matches = terms.every((term) => primary.includes(term) || secondary.includes(term));
      const score = terms.reduce((sum, term) => sum + (primary.includes(term) ? 1 : 0), 0);
      return { brand, index, matches, score };
    })
    .filter((match) => match.matches)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((match) => match.brand);
}
