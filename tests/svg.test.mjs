import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { inspectAssetFile } from '../scripts/lib/catalog.mjs';

const namespaces =
  'xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:cc="http://creativecommons.org/ns#" xmlns:dc="http://purl.org/dc/elements/1.1/"';
const svg = (body, attributes = '') => `<svg ${namespaces} ${attributes}>${body}</svg>`;

async function input(t) {
  const folder = await mkdtemp(join(tmpdir(), 'logodock-svg-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  return async (data) => {
    const path = join(folder, 'original.svg');
    await writeFile(path, data);
    return { path, inspect: () => inspectAssetFile(path) };
  };
}

test('inspects inert editor metadata and presentation styles without changing bytes', async (t) => {
  const file = await input(t);
  for (const data of [
    svg(
      '<sodipodi:namedview id="view" pagecolor="#fff" borderopacity="1" showgrid="false" fit-margin-top="0" inkscape:zoom="0.6" inkscape:current-layer="layer"/><g id="layer" inkscape:label="Layer 1" inkscape:groupmode="layer"><path inkscape:connector-curvature="0" d="M0 0" style="fill:#ff5a00;fill-opacity:1;stroke-width:6.38963"/></g>',
      'inkscape:version="1.2.2" sodipodi:docname="Original.svg"',
    ),
    svg(
      '<metadata id="meta"><rdf:RDF><cc:Work rdf:about=""><dc:format>image/svg+xml</dc:format><dc:type rdf:resource="http://purl.org/dc/dcmitype/StillImage"/><dc:creator><cc:Agent><dc:title>Author</dc:title></cc:Agent></dc:creator><cc:license rdf:resource="https://creativecommons.org/licenses/by/4.0/"/><dc:description>Original artwork</dc:description><dc:date>2026</dc:date></cc:Work></rdf:RDF></metadata><path d="M0 0"/>',
    ),
    svg(
      '<defs><style>\n.cls-1 {fill:#ff6400} .cls-2, path, #mark {fill:rgb(45, 45, 45);stroke:none}\n</style></defs><path id="mark" class="cls-1" data-name="图层_1"/>',
    ),
    svg(
      "<path style=\"font-style:normal;font-variant:normal;font-weight:normal;font-stretch:normal;font-size:2647.62px;line-height:1.25;font-family:'Geometr706 Md BT';-inkscape-font-specification:'Geometr706 Md BT';letter-spacing:0px;word-spacing:0px;fill:#3259b4;fill-opacity:1;stroke-width:93.437\"/>",
    ),
    svg(
      '<defs><linearGradient id="paint"/></defs><style><![CDATA[.paint{fill:url(#paint);color:hsl(120 50% 50% / .5);font-family:"Example Sans",sans-serif}]]></style><path style="fill:url(#paint);paint-order:stroke fill markers"/>',
    ),
  ]) {
    const { path, inspect } = await file(data);
    const result = await inspect();
    assert.deepEqual(result.buffer, Buffer.from(data));
    assert.deepEqual(await readFile(path), Buffer.from(data));
    assert.equal(result.bytes, Buffer.byteLength(data));
  }
});

test('preserves canonical Inkscape export metadata without enabling other editor attributes', async (t) => {
  const file = await input(t);
  const data = svg(
    '<path d="M0 0h8v8z"/>',
    'inkscape:export-filename="/home/author/brand/icon.png" inkscape:export-xdpi="384" inkscape:export-ydpi="384"',
  );
  const { path, inspect } = await file(data);
  assert.deepEqual((await inspect()).buffer, Buffer.from(data));
  assert.deepEqual(await readFile(path), Buffer.from(data));
  for (const attributes of [
    'inkscape:export-href="https://example.com/asset"',
    'inkscape:href="https://example.com/asset"',
    'xmlns:editor="http://www.inkscape.org/namespaces/inkscape" editor:export-filename="icon.png"',
  ])
    await assert.rejects((await file(svg('<path/>', attributes))).inspect(), /SVG/);
});

test('preserves bounded editor grid and license metadata without changing original bytes', async (t) => {
  const file = await input(t);
  const data = svg(
    '<sodipodi:namedview id="base" showborder="false" showguides="false" units="px" inkscape:document-rotation="0" inkscape:snap-global="false" inkscape:snap-page="true"><inkscape:grid type="xygrid" id="grid2067"/></sodipodi:namedview><metadata><rdf:RDF><cc:Work rdf:about=""><dc:publisher><cc:Agent><dc:title>Author</dc:title></cc:Agent></dc:publisher><dc:rights><cc:Agent><dc:title>CC0</dc:title></cc:Agent></dc:rights><dc:source>https://example.com/brand</dc:source></cc:Work><cc:License rdf:about="http://creativecommons.org/publicdomain/zero/1.0/"><cc:permits rdf:resource="http://creativecommons.org/ns#Reproduction"/></cc:License></rdf:RDF></metadata><path d="M0 0h8v8z" sodipodi:nodetypes="sccccccs"/>',
  );
  const { path, inspect } = await file(data);
  assert.deepEqual((await inspect()).buffer, Buffer.from(data));
  assert.deepEqual(await readFile(path), Buffer.from(data));
});

test('editor grids remain nonrendering leaves with only observed inert configuration', async (t) => {
  const file = await input(t);
  for (const body of [
    '<inkscape:grid type="xygrid"/>',
    '<sodipodi:namedview><inkscape:grid type="xygrid"><path/></inkscape:grid></sodipodi:namedview>',
    '<sodipodi:namedview><inkscape:grid type="xygrid"><script/></inkscape:grid></sodipodi:namedview>',
    '<sodipodi:namedview><inkscape:grid type="xygrid"><inkscape:grid/></inkscape:grid></sodipodi:namedview>',
    '<sodipodi:namedview><inkscape:grid type="xygrid">unexpected text</inkscape:grid></sodipodi:namedview>',
    ...[
      'href="https://example.com/asset"',
      'style="fill:red"',
      'onload="alert(1)"',
      'src="https://example.com/asset"',
      'xml:base="https://example.com/"',
      'rdf:resource="https://example.com/asset"',
      'color="red"',
      'type="image-set()"',
    ].map((attribute) => `<sodipodi:namedview><inkscape:grid ${attribute}/></sodipodi:namedview>`),
    '<sodipodi:namedview><grid xmlns="http://www.inkscape.org/namespaces/inkscape" type="xygrid"/></sodipodi:namedview>',
    '<sodipodi:namedview><editor:grid xmlns:editor="http://www.inkscape.org/namespaces/inkscape" type="xygrid"/></sodipodi:namedview>',
    '<sodipodi:namedview><inkscape:grid xmlns:inkscape="http://www.w3.org/2000/svg"/></sodipodi:namedview>',
    '<cc:License/>',
    '<cc:permits/>',
    '<dc:publisher/>',
    '<dc:rights/>',
    '<dc:source/>',
    '<metadata><rdf:RDF><cc:License><script/></cc:License></rdf:RDF></metadata>',
    '<metadata><rdf:RDF><cc:permits href="https://example.com/asset"/></rdf:RDF></metadata>',
  ])
    await assert.rejects((await file(svg(body))).inspect(), /SVG/);
});

test('preserves normal-only source font settings while rejecting unsupported font values', async (t) => {
  const file = await input(t);
  const properties = [
    'font-variation-settings',
    'font-variant-ligatures',
    'font-variant-caps',
    'font-variant-numeric',
    'font-variant-east-asian',
  ];
  const data = svg(
    `<path d="M0 0h8v8z" style="${properties.map((name) => `${name}:normal`).join(';')};fill:#2185d0"/>`,
  );
  const { inspect } = await file(data);
  assert.deepEqual((await inspect()).buffer, Buffer.from(data));
  for (const name of properties) {
    for (const value of [
      'url(https://example.com/font)',
      'var(--font)',
      "'wght' 700",
      'unexpected',
    ]) {
      await assert.rejects((await file(svg(`<path style="${name}:${value}"/>`))).inspect(), /SVG/);
    }
  }
});

test('rejects foreign aliases, namespace rebinding, and namespace declarations as element permission', async (t) => {
  const file = await input(t);
  for (const body of [
    '<x:RDF xmlns:x="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/>',
    '<metadata><rdf:RDF xmlns:rdf="http://creativecommons.org/ns#"/></metadata>',
    '<metadata><cc:script/></metadata>',
    '<metadata><rdf:path/></metadata>',
    '<metadata xmlns="http://creativecommons.org/ns#"><Work/></metadata>',
    '<g xmlns:inkscape="http://www.w3.org/2000/svg"><inkscape:path/></g>',
    '<g xmlns:x="https://evil.example"/>',
    '<rdf:RDF/>',
    '<cc:Work/>',
    '<dc:title/>',
    '<inkscape:path/>',
    '<path rdf:resource="https://example.com/"/>',
    '<path inkscape:href="https://example.com/"/>',
  ])
    await assert.rejects((await file(svg(body))).inspect(), /SVG/);
});

test('metadata and editor blocks cannot contain rendering, active, or unknown nodes', async (t) => {
  const file = await input(t);
  for (const body of [
    '<g><metadata/></g>',
    '<metadata><metadata/></metadata>',
    '<metadata><path/></metadata>',
    '<metadata><script/></metadata>',
    '<metadata><rdf:RDF><foreignObject/></rdf:RDF></metadata>',
    '<metadata><rdf:RDF><dc:title onload="alert(1)"/></rdf:RDF></metadata>',
    '<sodipodi:namedview><path/></sodipodi:namedview>',
    '<sodipodi:namedview><script/></sodipodi:namedview>',
    '<sodipodi:namedview><sodipodi:namedview/></sodipodi:namedview>',
    '<sodipodi:namedview href="https://example.com/"/>',
    '<sodipodi:namedview style="fill:red"/>',
    '<path xml:base="https://example.com/"/>',
    '<style><path/></style>',
    '<style><script/></style>',
  ])
    await assert.rejects((await file(svg(body))).inspect(), /SVG/);
});

test('rejects CSS resources, executable syntax, unknown properties, and unconsumed text', async (t) => {
  const file = await input(t);
  for (const css of [
    'fill:url(https://example.com/a)',
    'fill:url(data:image/svg+xml;base64,PHN2Zy8+)',
    'fill:url(//example.com/a)',
    'fill:url(#a) red',
    'fill:url("#a")',
    'fill:u\\72l(https://example.com/a)',
    'fill:r/**/ed',
    '@import "x"',
    'fill:red!important',
    'fill:expression(alert(1))',
    'fill:var(--a)',
    'fill:attr(x)',
    'fill:env(x)',
    'fill:calc(1 + 1)',
    'fill:rgb(url(#x))',
    'fill:red;--paint:red',
    'background:red',
    'filter:url(#x)',
    'font:12px sans-serif',
    'behavior:url(#x)',
    'animation:none',
    'fill:red;garbage',
    'fill:red:blue',
    'fill:red;;stroke:none',
    'fill:\u007fred',
    'font-family:"x;fill:red"',
  ]) {
    await assert.rejects(
      (await file(svg(`<path style="${css.replaceAll('"', '&quot;')}"/>`))).inspect(),
      /SVG/,
    );
    await assert.rejects((await file(svg(`<style>path{${css}}</style>`))).inspect(), /SVG/);
  }
});

test('stylesheets only permit complete flat rules with simple known selectors', async (t) => {
  const file = await input(t);
  for (const css of [
    'path:hover{fill:red}',
    '[id]{fill:red}',
    'g path{fill:red}',
    'g>path{fill:red}',
    'path.x{fill:red}',
    '*{fill:red}',
    'script{fill:red}',
    '.x{path{fill:red}}',
    '@font-face{font-family:x;src:url(#x)}',
    '@media all{path{fill:red}}',
    'path{fill:red}garbage',
    'path{fill:red',
    'path{fill:red}}',
    'path, {fill:red}',
    'path{fill:red}/*comment*/',
  ])
    await assert.rejects((await file(svg(`<style>${css}</style>`))).inspect(), /SVG/);
});

test('presentation attributes reject resource functions and dynamic CSS values', async (t) => {
  const file = await input(t);
  for (const value of [
    "image-set('http://127.0.0.1:9999/mask.png' 1x)",
    "-webkit-image-set('https://example.com/mask.png' 1x)",
    "cross-fade('https://example.com/a.png', 'https://example.com/b.png', 50%)",
    "image('https://example.com/mask.png')",
    'paint(external)',
    'var(--mask)',
    'env(mask)',
    'attr(mask)',
    'expression(alert(1))',
    'url(https://example.com/mask.svg)',
  ]) {
    for (const attribute of [
      'mask',
      'clip-path',
      'fill',
      'stroke',
      'color',
      'stop-color',
      'font-family',
      'font-size',
      'width',
    ]) {
      await assert.rejects(
        (
          await file(
            svg(
              `<rect ${attribute === 'width' ? '' : 'width="8"'} height="8" ${attribute}="${value}"/>`,
            ),
          )
        ).inspect(),
        /SVG/,
        `${attribute}: ${value}`,
      );
    }
  }
});

test('presentation validation preserves local references, colors, geometry, and SVG transforms', async (t) => {
  const file = await input(t);
  const data = svg(
    '<defs><path id="shape" d="M1-2.5e-3A5,10 0 01.5 2z"/><linearGradient id="paint" gradientTransform="translate(10,20) rotate(45)"/><pattern id="p" patternTransform="scale(2)"/><mask id="m"><rect width="100%" height="100%" fill="white"/></mask><clipPath id="c"><rect width="8" height="8"/></clipPath></defs><g transform="matrix(1,0,0,1,-10.5,2e2) translate(2 3) scale(2) rotate(45 2 3) skewX(5) skewY(-5)"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#shape" fill="url(#paint)" mask="url(#m)" clip-path="url(#c)" stroke="rgb(255, 0, 0)" stroke-dasharray="1 2.5, 3" font-family="Example Sans, sans-serif"/><image width="8" height="8" href="data:image/png;base64,iVBORw0KGgo="/></g>',
  );
  const { inspect } = await file(data);
  assert.deepEqual((await inspect()).buffer, Buffer.from(data));
});

test('DOCTYPE and processing instructions remain forbidden with otherwise inert content', async (t) => {
  const file = await input(t);
  for (const data of [
    `<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">${svg('')}`,
    `<!DOCTYPE svg [<!ENTITY paint "red">]>${svg('<path fill="&paint;"/>')}`,
    svg('<?editor harmless?>'),
  ])
    await assert.rejects((await file(data)).inspect(), /DOCTYPE|processing instructions/);
});
