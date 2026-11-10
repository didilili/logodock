import { SaxesParser } from 'saxes';

// Validate a deliberately restricted static subset. Never sanitize or rewrite bytes.
const ns = {
  svg: 'http://www.w3.org/2000/svg',
  xlink: 'http://www.w3.org/1999/xlink',
  inkscape: 'http://www.inkscape.org/namespaces/inkscape',
  sodipodi: 'http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  cc: 'http://creativecommons.org/ns#',
  dc: 'http://purl.org/dc/elements/1.1/',
};
const words = (value) => new Set(value.split(' '));
const svgElements = words(
  'svg g defs title desc path rect circle ellipse line polyline polygon ' +
    'text tspan textPath clipPath mask pattern symbol use image linearGradient radialGradient stop',
);
const svgAttributes = words(
  'id class version viewBox preserveAspectRatio x y x1 y1 x2 y2 cx cy r rx ry ' +
    'width height d points transform fill fill-opacity fill-rule stroke stroke-width stroke-opacity ' +
    'stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset opacity ' +
    'clip-path clip-rule mask maskUnits maskContentUnits clipPathUnits display visibility ' +
    'gradientUnits gradientTransform spreadMethod offset stop-color stop-opacity fx fy fr ' +
    'patternUnits patternContentUnits patternTransform text-anchor dominant-baseline alignment-baseline ' +
    'font-family font-size font-weight font-style letter-spacing word-spacing dx dy rotate textLength ' +
    'lengthAdjust startOffset method spacing overflow vector-effect shape-rendering color ' +
    'role aria-label aria-labelledby aria-describedby aria-hidden focusable data-name',
);
const cssProperties = words(
  'fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap ' +
    'stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset opacity clip-path clip-rule mask ' +
    'display visibility stop-color stop-opacity text-anchor dominant-baseline alignment-baseline ' +
    'font-family font-size font-weight font-style letter-spacing word-spacing overflow vector-effect ' +
    'shape-rendering color enable-background font-variant font-stretch line-height -inkscape-font-specification paint-order ' +
    'font-variation-settings font-variant-ligatures font-variant-caps font-variant-numeric font-variant-east-asian',
);
const normalFontProperties = words(
  'font-variation-settings font-variant-ligatures font-variant-caps ' +
    'font-variant-numeric font-variant-east-asian',
);
// These allowed XML attributes also feed CSS or length/number presentation values.
// Keep path data/points and SVG transform lists out of the CSS token grammar.
const presentationAttributes = new Set([
  ...cssProperties,
  ...words(
    'x y x1 y1 x2 y2 cx cy r rx ry ' + 'width height offset dx dy rotate textLength startOffset',
  ),
]);
const inkscapeSvgAttributes = words(
  'version label groupmode connector-curvature export-filename export-xdpi export-ydpi',
);
const inkscapeViewAttributes = words(
  'showpageshadow pageshadow pageopacity pagecheckerboard deskcolor ' +
    'document-units document-rotation snap-global snap-page zoom cx cy window-width window-height window-x window-y window-maximized current-layer',
);
const namedviewAttributes = words(
  'id pagecolor bordercolor borderopacity showgrid showborder showguides units fit-margin-top ' +
    'fit-margin-left fit-margin-right fit-margin-bottom objecttolerance gridtolerance guidetolerance',
);
const metadataElements = {
  rdf: words('RDF'),
  cc: words('Work Agent license License permits'),
  dc: words('title format type creator description date publisher rights source'),
};
const fragment = /^#[A-Za-z_][A-Za-z0-9_.:-]*$/;
const localUrl = /^url\(\s*#[A-Za-z_][A-Za-z0-9_.:-]*\s*\)$/i;
const identifier = '[A-Za-z_][A-Za-z0-9_-]*';
const number = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
const cssToken = new RegExp(
  `^(?:${identifier}|${number}(?:%|px|pt|pc|in|cm|mm|q|em|ex|ch|rem|vw|vh|vmin|vmax)?|#[a-fA-F0-9]{3,8})$`,
);
const colorFunction = new RegExp(
  `^(?:rgb|rgba|hsl|hsla)\\(\\s*${number}%?(?:[\\s,/]+${number}%?)*\\s*\\)$`,
  'i',
);

function cssSafety(value, reject) {
  // eslint-disable-next-line no-control-regex -- Reject control characters in untrusted SVG CSS.
  if (/[\\\u0000-\u0008\u000b-\u001f\u007f@!]|\/\*|\*\//.test(value))
    reject('CSS escapes, comments, control characters, and at-rules are forbidden');
}

function cssValue(property, value, reject) {
  cssSafety(value, reject);
  value = value.trim();
  if (normalFontProperties.has(property) && value.toLowerCase() !== 'normal')
    reject('CSS font setting is outside the static subset');
  if (/url\s*\(/i.test(value)) {
    if (!['fill', 'stroke', 'clip-path', 'mask'].includes(property) || !localUrl.test(value))
      reject('external or complex CSS references are forbidden');
  } else if (['font-family', '-inkscape-font-specification'].includes(property)) {
    const family = new RegExp(
      `^(?:${identifier}(?: +${identifier})*|'[^'"\\r\\n:;(){}<>]+'|"[^'"\\r\\n:;(){}<>]+")$`,
    );
    if (!value.split(',').every((part) => family.test(part.trim())))
      reject('CSS font family is outside the static subset');
  } else if (
    !colorFunction.test(value) &&
    !value.split(/[\s,]+/).every((token) => cssToken.test(token))
  ) {
    reject('CSS value is outside the static subset');
  }
}

function declarations(text, reject) {
  cssSafety(text, reject);
  if (!text.trim()) return;
  const items = text.trim().replace(/;\s*$/, '').split(';');
  for (const item of items) {
    const match = /^\s*([-a-z]+)\s*:\s*(.*?)\s*$/is.exec(item);
    if (!match || !cssProperties.has(match[1].toLowerCase()) || !match[2])
      reject('CSS declaration is outside the static subset');
    cssValue(match[1].toLowerCase(), match[2], reject);
  }
}

function transforms(value, reject) {
  const counts = {
    matrix: [6],
    translate: [1, 2],
    scale: [1, 2],
    rotate: [1, 3],
    skewX: [1],
    skewY: [1],
  };
  const argumentsPattern = new RegExp(`^\\s*${number}(?:(?:\\s*,\\s*|\\s+)${number})*\\s*$`);
  let remaining = value.trim();
  while (remaining) {
    const match = /^(matrix|translate|scale|rotate|skewX|skewY)\(([^()]*)\)/.exec(remaining);
    if (
      !match ||
      !argumentsPattern.test(match[2]) ||
      !counts[match[1]].includes([...match[2].matchAll(new RegExp(number, 'g'))].length)
    )
      reject('transform is outside the static subset');
    remaining = remaining.slice(match[0].length).trim();
    if (remaining.startsWith(',')) {
      remaining = remaining.slice(1).trim();
      if (!remaining) reject('transform is outside the static subset');
    }
  }
}

function stylesheet(text, reject) {
  cssSafety(text, reject);
  let remaining = text.trim();
  while (remaining) {
    const rule = /^([^{}]+)\{([^{}]*)\}/.exec(remaining);
    if (
      !rule ||
      !rule[1].split(',').every((part) => {
        const selector = part.trim();
        return new RegExp(`^[.#]${identifier}$`).test(selector) || svgElements.has(selector);
      })
    )
      reject('CSS stylesheet is outside the static subset');
    declarations(rule[2], reject);
    remaining = remaining.slice(rule[0].length).trim();
  }
}

function canvasAspectRatio(attributes) {
  const units = { px: 1, pt: 96 / 72, pc: 16, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, q: 96 / 101.6 };
  const lengths = ['width', 'height'].map((name) => {
    const match = attributes[name]?.value
      .trim()
      .match(new RegExp(`^(${number})(px|pt|pc|in|cm|mm|q)?$`, 'i'));
    return match ? Number(match[1]) * units[match[2]?.toLowerCase() || 'px'] : undefined;
  });
  if (lengths.some((value) => value !== undefined && value <= 0)) return undefined;
  if (lengths.every((value) => Number.isFinite(value))) return lengths[0] / lengths[1];
  const box = attributes.viewBox?.value
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  return box?.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0
    ? box[2] / box[3]
    : undefined;
}

/** Throws on unsupported content and reports the intrinsic canvas ratio. Original bytes stay intact. */
export function checkSvg(buffer, context) {
  const reject = (reason) => {
    throw new Error(`Invalid catalog: ${context}: SVG ${reason}`);
  };
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    reject('must be valid UTF-8');
  }
  const parser = new SaxesParser({ xmlns: true });
  const stack = [];
  let first = true;
  let aspectRatio;
  parser.on('error', () => reject('is malformed XML'));
  parser.on('doctype', () => reject('DOCTYPE is forbidden'));
  parser.on('processinginstruction', () => reject('processing instructions are forbidden'));
  parser.on('opentag', (tag) => {
    const parent = stack.at(-1);
    if (first && (tag.local !== 'svg' || tag.uri !== ns.svg)) reject('root must be svg');
    if (first) aspectRatio = canvasAspectRatio(tag.attributes);
    first = false;
    if (parent?.kind === 'grid' || parent?.kind === 'style')
      reject('grid and style elements must contain no elements');
    let kind = 'svg';
    if (parent?.kind === 'namedview') {
      if (tag.uri !== ns.inkscape || tag.prefix !== 'inkscape' || tag.local !== 'grid')
        reject('namedview may only contain an inert editor grid');
      kind = 'grid';
    } else if (parent?.kind === 'metadata') {
      if (ns[tag.prefix] !== tag.uri || !metadataElements[tag.prefix]?.has(tag.local))
        reject(`element ${tag.name} is outside the static metadata subset`);
      kind = 'metadata';
    } else if (tag.uri === ns.svg && tag.local === 'metadata') {
      if (stack.length !== 1) reject('metadata must be a direct svg child');
      kind = 'metadata';
    } else if (tag.uri === ns.sodipodi && tag.prefix === 'sodipodi' && tag.local === 'namedview') {
      if (stack.length !== 1) reject('namedview must be a direct svg child');
      kind = 'namedview';
    } else if (tag.uri === ns.svg && tag.local === 'style') kind = 'style';
    else if (tag.uri !== ns.svg || !svgElements.has(tag.local))
      reject(`element ${tag.name} is outside the static subset`);
    for (const attribute of Object.values(tag.attributes)) {
      const { name, local, prefix, uri, value } = attribute;
      if (uri === 'http://www.w3.org/2000/xmlns/') {
        const key = name === 'xmlns' ? 'svg' : local;
        const canonical = Object.hasOwn(ns, key) && ns[key] === value;
        const svgAlias = !Object.hasOwn(ns, key) && [ns.svg, ns.xlink].includes(value);
        if (!canonical && !svgAlias) reject('foreign namespace declarations are forbidden');
        continue;
      }
      if (/^on/i.test(local)) reject(`attribute ${name} is outside the static subset`);
      if (kind === 'style' && !uri && local === 'type' && value === 'text/css') continue;
      if (kind === 'grid') {
        if (!uri && (local === 'id' || (local === 'type' && value === 'xygrid'))) continue;
        reject(`attribute ${name} is outside the static grid subset`);
      }
      if (
        uri === 'http://www.w3.org/XML/1998/namespace' &&
        local === 'space' &&
        ['default', 'preserve'].includes(value)
      )
        continue;
      if (kind === 'metadata') {
        if (
          (!uri && tag.uri === ns.svg && local === 'id') ||
          (uri === ns.rdf && prefix === 'rdf' && ['about', 'resource'].includes(local))
        )
          continue;
        reject(`attribute ${name} is outside the static metadata subset`);
      }
      if (kind === 'namedview') {
        if (
          (!uri && namedviewAttributes.has(local)) ||
          (uri === ns.inkscape && prefix === 'inkscape' && inkscapeViewAttributes.has(local))
        )
          continue;
        reject(`attribute ${name} is outside the static editor subset`);
      }
      if (
        (uri === ns.inkscape && prefix === 'inkscape' && inkscapeSvgAttributes.has(local)) ||
        (uri === ns.sodipodi && prefix === 'sodipodi' && ['docname', 'nodetypes'].includes(local))
      )
        continue;
      if (uri && !(uri === ns.xlink && local === 'href'))
        reject(`attribute namespace ${name} is forbidden`);
      if (local === 'href') {
        const png =
          tag.local === 'image' &&
          /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value) &&
          Buffer.from(value.split(',')[1], 'base64')
            .subarray(0, 8)
            .equals(Buffer.from('89504e470d0a1a0a', 'hex'));
        if (!fragment.test(value) && !png)
          reject('href must reference a local fragment or an embedded PNG image');
        continue;
      }
      if (name === 'style') {
        declarations(value, reject);
        continue;
      }
      if (!svgAttributes.has(name)) reject(`attribute ${name} is outside the static subset`);
      // eslint-disable-next-line no-control-regex -- Reject control characters in untrusted SVG attributes.
      if (/[\\\u0000-\u001f]/.test(value) || value.includes('/*'))
        reject('CSS escapes, comments, and control characters are forbidden');
      if (presentationAttributes.has(name)) cssValue(name, value, reject);
      if (['transform', 'gradientTransform', 'patternTransform'].includes(name))
        transforms(value, reject);
      if (/url\s*\(/i.test(value) && !localUrl.test(value))
        reject('external or complex CSS references are forbidden');
    }
    stack.push({ kind, text: '' });
  });
  const content = (value) => {
    const current = stack.at(-1);
    if (current?.kind === 'style') current.text += value;
    if (['namedview', 'grid'].includes(current?.kind) && value.trim())
      reject('editor view and grid elements must contain no text');
  };
  parser.on('text', content);
  parser.on('cdata', content);
  parser.on('closetag', () => {
    const current = stack.pop();
    if (current.kind === 'style') stylesheet(current.text, reject);
  });
  try {
    parser.write(text).close();
  } catch (error) {
    if (error.message.startsWith('Invalid catalog:')) throw error;
    reject('is malformed XML');
  }
  return Number.isFinite(aspectRatio) && aspectRatio > 0 ? { aspectRatio } : {};
}
