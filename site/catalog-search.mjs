export function normalizeQuery(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().trim().replace(/\s+/gu, ' ');
}

export function filterBrands(brands, query) {
  const terms = normalizeQuery(query).split(' ').filter(Boolean);
  return brands.filter((brand) => {
    const text = normalizeQuery([brand.id, brand.name, ...brand.aliases,
      ...brand.assets.flatMap((asset) => [asset.file, asset.rights?.license])].join(' '));
    return terms.every((term) => text.includes(term));
  });
}
