import { filterBrands } from './catalog-search.mjs';

const catalog = JSON.parse(document.querySelector('#catalog-data').textContent);
const brands = catalog.brands;
const sourceCommit = document.documentElement.dataset.sourceCommit;
const $ = (id) => document.getElementById(id);
const search = $('search');
const grid = $('brand-grid');
const inspector = $('inspector');
const detailImage = document.createElement('img');
detailImage.id = 'detail-image';
detailImage.width = 512;
detailImage.height = 512;
detailImage.decoding = 'async';
const labels = { icon: '图形标识', wordmark: '文字标识', logo: '组合标识' };
let selectedId = brands[0]?.id;
let selectedAsset;
let copyTimer;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function assetPath(asset) {
  return asset.path.split('/').map(encodeURIComponent).join('/');
}

function isHistorical(asset) {
  return /(?:^|[-_.])legacy(?:[-_.]|$)/i.test(asset.file);
}

function versionLabel(asset) {
  return `${labels[asset.variant] || asset.variant}${isHistorical(asset) ? ' · 历史' : ''}`;
}

function fileInfo(asset, image) {
  const format = asset.file.split('.').pop().toUpperCase();
  const dimensions = image?.naturalWidth ? `${image.naturalWidth} × ${image.naturalHeight} · ` : '';
  return `${dimensions}${format} · ${(asset.bytes / 1024).toFixed(1)} KB`;
}

function selectAsset(brand, asset) {
  selectedAsset = asset;
  clearTimeout(copyTimer);
  $('copy-link').textContent = '复制链接';
  $('action-status').textContent = '';
  const image = detailImage;
  image.onload = () => { $('detail-fileinfo').textContent = fileInfo(asset, image); };
  image.onerror = () => { $('action-status').textContent = '图片未能加载，可以尝试下载原始文件。'; };
  image.alt = `${brand.name} ${versionLabel(asset)}`;
  image.src = assetPath(asset);
  if (!image.isConnected) $('detail-canvas').append(image);
  $('detail-filename').textContent = asset.file;
  $('detail-fileinfo').textContent = fileInfo(asset);
  const download = $('download-link');
  download.href = assetPath(asset);
  download.download = `${brand.id}-${asset.file}`;
  download.textContent = `下载 ${asset.file.split('.').pop().toUpperCase()}`;
  $('detail-license').textContent = asset.rights.license;
  $('detail-license').href = asset.rights.reference;
  const summaries = [];
  if (isHistorical(asset)) summaries.push('历史版本');
  if (asset.rights.license.includes('-NC-')) summaries.push('仅限非商业用途');
  $('asset-summary').textContent = summaries.join(' · ');
  $('asset-summary').hidden = !summaries.length;
  $('rights-notes').textContent = asset.rights.notes || '';
  $('rights-notes').hidden = !asset.rights.notes;
  $('source-page').href = asset.sourcePage;
  $('reviewed-date').textContent = asset.rights.reviewedAt;
  $('attribution').textContent = asset.rights.attribution;
  for (const button of $('variant-list').children) button.setAttribute('aria-pressed', String(button.dataset.file === asset.file));
}

function showDetails(brand, shouldScroll = false) {
  selectedId = brand.id;
  inspector.hidden = false;
  $('detail-name').textContent = brand.name;
  $('detail-website').href = brand.website;
  $('variant-list').replaceChildren();
  for (const asset of brand.assets) {
    const button = element('button', 'variant-button', versionLabel(asset));
    button.type = 'button';
    button.dataset.file = asset.file;
    button.title = asset.file;
    button.addEventListener('click', () => selectAsset(brand, asset));
    $('variant-list').append(button);
  }
  selectAsset(brand, brand.assets[0]);
  for (const card of grid.children) card.setAttribute('aria-pressed', String(card.dataset.brand === selectedId));
  if (shouldScroll && matchMedia('(max-width: 720px)').matches) {
    inspector.scrollIntoView({ behavior: 'auto', block: 'start' });
    $('detail-name').focus({ preventScroll: true });
  }
}

function renderResults() {
  const matches = filterBrands(brands, search.value);
  const fileCount = matches.reduce((sum, brand) => sum + brand.assets.length, 0);
  $('result-count').textContent = `${matches.length} 个品牌 · ${fileCount} 份文件`;
  $('clear-search').hidden = !search.value;
  $('empty-state').hidden = matches.length !== 0;
  grid.replaceChildren();
  for (const brand of matches) {
    const asset = brand.assets.find((item) => item.variant === 'icon') || brand.assets[0];
    const card = element('button', 'brand-card');
    card.type = 'button';
    card.dataset.brand = brand.id;
    card.setAttribute('aria-pressed', String(brand.id === selectedId));
    card.setAttribute('aria-controls', 'inspector');
    const top = element('span', 'brand-card-top');
    top.append(element('span', '', brand.assets.every(isHistorical) ? '历史素材' : brand.assets.length > 1 ? '多版本' : asset.file.split('.').pop().toUpperCase()), element('span', 'selection-label', '已选中'));
    const art = element('span', 'brand-art');
    const image = element('img');
    image.src = assetPath(asset);
    image.alt = '';
    image.width = 80;
    image.height = 80;
    image.decoding = 'async';
    art.append(image);
    const bottom = element('span', 'brand-card-bottom');
    bottom.append(element('span', 'brand-name', brand.name), element('span', 'brand-version-count', `${brand.assets.length} 个版本`));
    card.append(top, art, bottom);
    card.addEventListener('click', () => showDetails(brand, true));
    grid.append(card);
  }
  if (!matches.length) {
    inspector.hidden = true;
    selectedAsset = undefined;
  } else {
    const selected = matches.find((brand) => brand.id === selectedId) || matches[0];
    showDetails(selected);
  }
}

function updateQuery() {
  renderResults();
  const url = new URL(location.href);
  if (search.value.trim()) url.searchParams.set('q', search.value);
  else url.searchParams.delete('q');
  history.replaceState(null, '', url);
}

function resetSearch() {
  search.value = '';
  updateQuery();
  search.focus();
}

document.querySelector('.search-form').addEventListener('submit', (event) => event.preventDefault());
search.addEventListener('input', updateQuery);
$('clear-search').addEventListener('click', resetSearch);
$('reset-search').addEventListener('click', resetSearch);
document.addEventListener('keydown', (event) => {
  const editing = event.target instanceof HTMLElement && (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName));
  if (event.key === '/' && !editing && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    search.focus();
  }
  if (event.key === 'Escape' && event.target === search && search.value) {
    event.preventDefault();
    resetSearch();
  }
});

$('copy-link').addEventListener('click', async () => {
  if (!selectedAsset) return;
  const path = assetPath(selectedAsset);
  const url = /^[a-f0-9]{40}$/.test(sourceCommit || '')
    ? `https://raw.githubusercontent.com/didilili/company-logos/${sourceCommit}/${path}`
    : new URL(path, document.baseURI).href;
  try {
    await navigator.clipboard.writeText(url);
    $('copy-link').textContent = '已复制';
    $('action-status').textContent = '已复制图片链接。';
    copyTimer = setTimeout(() => { $('copy-link').textContent = '复制链接'; }, 2400);
  } catch {
    $('copy-link').textContent = '复制失败';
    $('action-status').textContent = '无法访问剪贴板，请使用下载按钮获取原始文件。';
  }
});

search.value = new URL(location.href).searchParams.get('q') || '';
renderResults();
