#!/usr/bin/env node
// Publish the committed USD Layer 1 logic dossier as the standalone page `usd-layer1-logic.html` and as
// the plain-text download `docs/analysis-engine/USD_LAYER1_LOGIC.md.txt`.
//
// The dossier is the artifact a reviewer reads, so the page is generated from it rather than paraphrased:
// every heading, table, code block and sentence on the page is the Markdown file's own, and `--check`
// fails when either output no longer matches the source. The page's one exception is the shared navigation
// block, which backtester/scripts/build_shared_nav.js owns and this file carries through untouched.
// Nothing here measures anything, and nothing here reads a warehouse, a workflow or the live dashboard.
//
// Usage:
//   node backtester/scripts/build_usd_layer1_logic_page.js [SOURCE.md] [TEMPLATE.html] [OUT.html] [OUT.txt]
//   node backtester/scripts/build_usd_layer1_logic_page.js --check
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { renderMarkdownDocument, renderInline } = require('../lib/markdown_document');

const ROOT = path.resolve(__dirname, '../..');
const SOURCE_PATH = 'docs/analysis-engine/USD_LAYER1_LOGIC.md';
const DEFAULTS = {
  source: path.join(ROOT, SOURCE_PATH),
  template: path.join(__dirname, '../templates/usd-layer1-logic.html'),
  outHtml: path.join(ROOT, 'usd-layer1-logic.html'),
  outText: path.join(ROOT, `${SOURCE_PATH}.txt`)
};
const PLACEHOLDERS = [
  '__USD_LOGIC_TITLE__', '__USD_LOGIC_SECTION_COUNT__', '__USD_LOGIC_INDEX__',
  '__USD_LOGIC_PREAMBLE__', '__USD_LOGIC_SECTIONS__', '__USD_LOGIC_SOURCE__'
];
const NAV_START = '<!-- SHARED-NAV:START -->';
const NAV_END = '<!-- SHARED-NAV:END -->';

// The published copy of this page carries the shared navigation block between those markers, written there by
// backtester/scripts/build_shared_nav.js. The block belongs to that script, not to this one, so this file keeps
// it byte for byte and renders the page around it: a checkout whose page carries no block - this lane's own
// page, and the first build anywhere - is written exactly as before, and --check still compares whole bytes.
function navRegion(existing) {
  if (existing === null) return null;
  if (existing.split(NAV_START).length - 1 !== 1 || existing.split(NAV_END).length - 1 !== 1) return null;
  const start = existing.indexOf(NAV_START);
  const end = existing.indexOf(NAV_END) + NAV_END.length;
  const from = existing.slice(0, start).replace(/\r?\n$/, '').length;
  const to = existing.startsWith('\r\n', end) ? end + 2 : existing[end] === '\n' ? end + 1 : end;
  // A block that owns neither of its surrounding line breaks is half a block: refuse rather than guess.
  if (from === start || to === end) return null;
  return existing.slice(from, to);
}

// The block sits on the line after the body tag, which is where build_shared_nav.js places it.
function withNavRegion(html, region) {
  if (!region) return html;
  const body = html.match(/<body\b[^>]*>/);
  if (!body) throw new Error('The template lost its <body> tag, so the shared navigation block has no anchor.');
  const at = html.indexOf(body[0]) + body[0].length;
  return html.slice(0, at) + region + html.slice(at);
}

// Both outputs are written with git's own line ending, so a Windows and a Linux checkout generate the
// same bytes and the comparison in --check cannot depend on how the files were materialised.
function normalise(value) {
  return value.replace(/\r\n/g, '\n');
}

function buildPage({ markdown, template }) {
  const document = renderMarkdownDocument(markdown);
  const bytes = Buffer.byteLength(markdown, 'utf8');
  const lines = markdown.split('\n').length - 1;
  const digest = crypto.createHash('sha256').update(markdown, 'utf8').digest('hex');
  const index = document.sections.map(section => `      <li><a href="#${section.id}">${renderInline(section.title)}</a></li>`).join('\n');
  // Section bodies go in unindented: a prefix on every line would shift the continuation lines inside a
  // code block that is aligned by hand, and the dossier quotes several of those.
  const sections = document.sections.map(section => [
    `    <section class="chapter" id="${section.id}">`,
    section.html,
    '    </section>'
  ].join('\n')).join('\n');
  const values = {
    __USD_LOGIC_TITLE__: renderInline(document.title),
    __USD_LOGIC_SECTION_COUNT__: String(document.sections.length),
    __USD_LOGIC_INDEX__: index,
    __USD_LOGIC_PREAMBLE__: document.preamble,
    __USD_LOGIC_SECTIONS__: sections,
    __USD_LOGIC_SOURCE__: [`${SOURCE_PATH} as committed`, `${lines} lines`, `${bytes.toLocaleString('en-GB')} bytes`, `sha256 ${digest.slice(0, 12)}…`].join(' · ')
  };
  let html = template;
  for (const placeholder of PLACEHOLDERS) {
    if (!html.includes(placeholder)) throw new Error(`The template lost its ${placeholder} placeholder.`);
    html = html.split(placeholder).join(values[placeholder]);
  }
  return { html, sections: document.sections.length, title: document.title, bytes, lines, digest };
}

function renderOutputs(paths) {
  if (!fs.existsSync(paths.source)) throw new Error(`The dossier is missing: ${paths.source}`);
  if (!fs.existsSync(paths.template)) throw new Error(`The page template is missing: ${paths.template}`);
  const markdown = normalise(fs.readFileSync(paths.source, 'utf8'));
  const template = normalise(fs.readFileSync(paths.template, 'utf8'));
  const existing = fs.existsSync(paths.outHtml) ? normalise(fs.readFileSync(paths.outHtml, 'utf8')) : null;
  const page = buildPage({ markdown, template });
  const html = withNavRegion(page.html, navRegion(existing));
  return {
    facts: page,
    outputs: [
      { label: 'usd-layer1-logic.html', file: paths.outHtml, content: `${html}\n` },
      { label: `${SOURCE_PATH}.txt`, file: paths.outText, content: markdown }
    ]
  };
}

function run(argv = process.argv.slice(2)) {
  const check = argv.includes('--check');
  const positional = argv.filter(argument => !argument.startsWith('--')).map(value => path.resolve(value));
  for (const argument of argv.filter(value => value.startsWith('--'))) {
    if (argument !== '--check') throw new Error(`Unknown option: ${argument}`);
  }
  if (positional.length !== 0 && positional.length !== 4) {
    throw new Error('Usage: node backtester/scripts/build_usd_layer1_logic_page.js [SOURCE.md] [TEMPLATE.html] [OUT.html] [OUT.txt]');
  }
  const paths = positional.length
    ? { source: positional[0], template: positional[1], outHtml: positional[2], outText: positional[3] }
    : DEFAULTS;
  const { facts, outputs } = renderOutputs(paths);
  let changes = 0;
  for (const output of outputs) {
    const existing = fs.existsSync(output.file) ? normalise(fs.readFileSync(output.file, 'utf8')) : null;
    const state = existing === null ? 'missing' : normalise(output.content) === existing ? 'unchanged' : 'drifted';
    if (state !== 'unchanged') changes++;
    if (!check && state !== 'unchanged') fs.writeFileSync(output.file, output.content);
    console.log(`${output.label}: ${check ? state : state === 'unchanged' ? 'unchanged' : `${state} -> written`} (${Buffer.byteLength(output.content, 'utf8').toLocaleString('en-GB')} bytes)`);
  }
  console.log(`${changes} change(s) in ${outputs.length} generated file(s); ${facts.sections} sections from ${facts.lines} source lines.`);
  if (check && changes) process.exitCode = 1;
  return facts;
}

if (require.main === module) run();
module.exports = { DEFAULTS, SOURCE_PATH, PLACEHOLDERS, NAV_START, NAV_END, navRegion, withNavRegion, buildPage, renderOutputs, run };
