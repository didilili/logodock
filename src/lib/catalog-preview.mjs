// Reviewed visible artwork bounds for directory previews. The container supplies outer spacing.
// Binding each range to its original SHA-256 makes a replacement use the full canvas again.
const boundsBySha256 = new Map([
  [
    '7edddc64238fbb7e201b1e19e194410a227f3715aaecd08303f839e2aa9f5bdf',
    { sourceWidth: 3864, sourceHeight: 2251, x: 1062, y: 762, width: 1805, height: 570 },
  ],
  [
    '50368171d80704c038d2b7f7d7778f338cdae54a1822243311f5b19ec68c4690',
    { sourceWidth: 1188, sourceHeight: 770, x: 215, y: 251, width: 756, height: 236 },
  ],
  [
    'd57981391725098fd880a531ec3b3d15b843ac7571469b29525eedab54770552',
    { sourceWidth: 320, sourceHeight: 38, x: 105, y: 0, width: 110, height: 38 },
  ],
  [
    '8eca411ac4866cae54da74b658042a98d3ae3e3a566b702d9307c0b5484bda84',
    { sourceWidth: 600, sourceHeight: 600, x: 45, y: 183, width: 508, height: 236 },
  ],
  // huawei: logo-color-vertical-official.svg
  [
    '18c6f80d423c1b1e01e4a6e02f66e1375567fd909de1af55c8013430a504126d',
    { sourceWidth: 150, sourceHeight: 150.0, x: 10.125, y: 7.375, width: 131, height: 133.875 },
  ],
  // tencent: wordmark-blue-official.png
  [
    'ceac8b3005bfe401edc8b157f400ce48e3e2dab910cf4b33b40a50e9c2d39a64',
    {
      sourceWidth: 2953,
      sourceHeight: 889,
      x: 93.5117,
      y: 256.1108,
      width: 2763.5158,
      height: 374.3158,
    },
  ],
  // bytedance: logo-bilingual-color-official.svg
  [
    'a07b002e7fe99cd02d781ea71beb710a7485f50074ac6fa2b24055f32ddfffbc',
    { sourceWidth: 146, sourceHeight: 38.0, x: 1.9467, y: 4.141, width: 94.0483, height: 24.2372 },
  ],
  // haier: wordmark-blue.png
  [
    'd142d481d2fb466c34641cd291a3e54541e23c6ebcc9de21baf8c3ef50e571bc',
    {
      sourceWidth: 3508,
      sourceHeight: 2480,
      x: 508.66,
      y: 853.9623,
      width: 2490.68,
      height: 772.0755,
    },
  ],
  // jd: logo-header-official.png
  [
    '1010514375eeb84a634f6003aad27b9ff6be4890843d3e72117ee5aff08e0d59',
    { sourceWidth: 268, sourceHeight: 84, x: 0, y: 3.0, width: 267, height: 80.0 },
  ],
  // honor: logo-color-black-horizontal-2026.svg
  [
    '47493d1a491664171f927c5afaeb688d1acab397de5389d63879f6fb3edaad89',
    {
      sourceWidth: 300,
      sourceHeight: 143.577661,
      x: 44,
      y: 44.1202,
      width: 211.75,
      height: 55.3372,
    },
  ],
  // netease: wordmark-red-official.svg
  [
    '15f89a996bff621d82bd37da0fffc5790f1b95a855cc905f75c75e2c6a932568',
    { sourceWidth: 53, sourceHeight: 25.0, x: 0, y: 0.0, width: 52.4258, height: 24.9558 },
  ],
  // icbc: logo.png
  [
    '24be2a6d6747c9b8ee2d602d448aeb65d233d1d3380bd2e0d1fc7d3e3df0a90e',
    { sourceWidth: 314, sourceHeight: 41, x: 1, y: 1.0, width: 313, height: 38.0 },
  ],
  // ping-an: logo.svg
  [
    'e6c0d17f1a5f74edc8247c350d191aa8ccc75b38d64f6c61523e39986b6f4436',
    { sourceWidth: 238, sourceHeight: 38.0, x: 29.9483, y: 3.9583, width: 176.12, height: 29.0938 },
  ],
  // zte: wordmark-blue-official.png
  [
    '1b1b6209036433aeb8f7aae65500e7137668da39250cd5e0e0465428a992584a',
    {
      sourceWidth: 1535,
      sourceHeight: 907,
      x: 161.175,
      y: 161.1876,
      width: 1212.65,
      height: 587.1834,
    },
  ],
  // oppo: wordmark-black-official.svg
  [
    '297c469a60d6be652328c2624ef9b61b0d95ba901e294bd464a857696d1682a0',
    { sourceWidth: 85, sourceHeight: 22.0, x: 0, y: 0.8489, width: 85, height: 20.3023 },
  ],
  // bilibili: wordmark-blue-international-official.svg
  [
    'e83beaa89357f9f3b4a7d2e97c12a46eb178640d2f2bdc1d93020d3fc4d531f8',
    { sourceWidth: 66, sourceHeight: 34.0, x: 4.015, y: 3.9612, width: 57.475, height: 25.6375 },
  ],
  // transsion: wordmark-black-official.svg
  [
    '37ac109cbd791078358eeeda68a0cb12d85d54bf0f9241ab3f0d7d5e7c003230',
    { sourceWidth: 153, sourceHeight: 25.0, x: 0.51, y: 0.6378, width: 151.8525, height: 23.9796 },
  ],
  // didi: logo-chinese-official.svg
  [
    'bc8b1689d5bb4e7ca33a3431d44934dba27e24eee22b2fcbeb95e4e41b42938f',
    {
      sourceWidth: 300,
      sourceHeight: 115.579966,
      x: 0.25,
      y: 12.7038,
      width: 299.5,
      height: 89.9232,
    },
  ],
  // huawei: logo-flat-horizontal-official.svg
  [
    '3559ddfc61f5b93a44e65fd769367a4d23437efb5069768274ec31bef19966a1',
    { sourceWidth: 300, sourceHeight: 67.50294, x: 1.125, y: 0.0, width: 298.875, height: 65.4574 },
  ],
  // weibo: logo-chinese-horizontal-official.svg
  [
    'd875d45082abea563ac870663657e22ff1ef45fbfdbad4da00ed727f2c16ca5c',
    {
      sourceWidth: 150,
      sourceHeight: 150.006296,
      x: 4.875,
      y: 50.8146,
      width: 139.2188,
      height: 48.377,
    },
  ],
  // alibaba-cloud: logo-chinese-horizontal.svg
  [
    '7c191cc2f82b64e7d45d34b2a08aa548cce39e5b7bea2388022ea98e19da48e6',
    { sourceWidth: 80, sourceHeight: 17.777778, x: 0, y: 0.0494, width: 78.85, height: 17.679 },
  ],
]);

/** @param {import('./types').Asset} asset */
export function directoryPreviewBounds(asset) {
  return boundsBySha256.get(asset.sha256);
}

/**
 * @param {import('./types').Asset} asset
 * @param {{ width?: number, height?: number }} dimensions
 */
export function directoryPreviewSize(asset, dimensions = asset) {
  const bounds = directoryPreviewBounds(asset);
  const ratio = bounds
    ? bounds.width / bounds.height
    : asset.aspectRatio || (dimensions.width ?? 0) / (dimensions.height ?? 0);
  if (asset.variant === 'icon' || asset.layout === 'standalone')
    return { shape: 'symbol', width: 60, height: 60 };
  if (asset.layout === 'vertical' && !(bounds && ratio > 1.5))
    return { shape: 'vertical', width: 76, height: 76 };
  if (!Number.isFinite(ratio) || ratio <= 0) return { shape: 'horizontal', width: 156, height: 46 };
  if (ratio >= 5) return { shape: 'horizontal', width: 164, height: 34 };
  if (ratio >= 3) return { shape: 'horizontal', width: 156, height: 46 };
  if (ratio >= 2) return { shape: 'horizontal', width: 140, height: 56 };
  return { shape: 'horizontal', width: 112, height: 64 };
}

/** @param {import('./types').Brand} brand */
export function directoryCover(brand) {
  const cover = coversByBrand.get(brand.id);
  if (!cover) return undefined;
  return brand.assets.find((asset) => asset.file === cover.file && asset.sha256 === cover.sha256);
}

// Directory covers approved alongside the balanced-size preview.
const coversByBrand = new Map([
  [
    'xiaomi',
    {
      file: 'logo-horizontal-official.svg',
      sha256: '42ddf8a8231442f2072c443bddbdc176a1604be668b450941ebfa362c312e951',
    },
  ],
  [
    'huawei',
    {
      file: 'logo-flat-horizontal-official.svg',
      sha256: '3559ddfc61f5b93a44e65fd769367a4d23437efb5069768274ec31bef19966a1',
    },
  ],
  [
    'weibo',
    {
      file: 'logo-chinese-horizontal-official.svg',
      sha256: 'd875d45082abea563ac870663657e22ff1ef45fbfdbad4da00ed727f2c16ca5c',
    },
  ],
  [
    'alibaba-cloud',
    {
      file: 'logo-chinese-horizontal.svg',
      sha256: '7c191cc2f82b64e7d45d34b2a08aa548cce39e5b7bea2388022ea98e19da48e6',
    },
  ],
  [
    'ping-an',
    {
      file: 'logo-horizontal.svg',
      sha256: '5e859ca12e179187ec8b5102780d727fb362d1664ecc1de1cc2e7433f7ba024f',
    },
  ],
]);
