const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { renderMarkdownDocument, parseBlocks, renderInline, splitTableRow } = require('../lib/markdown_document');

// The renderer turns the committed dossier into the sections of a dashboard page, so what it does with a
// construct matters more than how it looks: an emphasis pair it swallowed, a table row it merged or a
// construct it quietly ignored would change the meaning of the page without changing a single word of
// the document. These checks pin the constructs the dossier uses and the refusal of the ones it does not.
const SOURCE = path.resolve(__dirname, '../../docs/analysis-engine/USD_LAYER1_LOGIC.md');

test('inline markup keeps code, emphasis and arithmetic apart', () => {
  assert.equal(renderInline('`conviction_24h` is the raw share'), '<code>conviction_24h</code> is the raw share');
  assert.equal(renderInline('the code does *not* use it'), 'the code does <em>not</em> use it');
  assert.equal(renderInline('**direction** is overwritten'), '<strong>direction</strong> is overwritten');
  // The worked example multiplies with a bare asterisk; an emphasis pass that paired those would corrupt it.
  assert.equal(renderInline('0.85*0.45 + 0.99*0.35 + 0.70*0.20 = 0.869'), '0.85*0.45 + 0.99*0.35 + 0.70*0.20 = 0.869');
  assert.equal(renderInline('|net_edge| < 20'), '|net_edge| &lt; 20');
  assert.equal(renderInline('[a](b.md)'), '<a href="b.md">a</a>');
  assert.throws(() => renderInline('a **bold start with no end', 7), /Unbalanced \*\* on line 7/);
});

test('a table cell is split on its delimiters but not inside a code span', () => {
  assert.deepEqual(splitTableRow('| a | b | c |'), ['a', 'b', 'c']);
  assert.deepEqual(splitTableRow('| `|net_edge|` | 20 |'), ['`|net_edge|`', '20']);
});

test('blocks are read by their first line and continued without breaking', () => {
  const blocks = parseBlocks([
    '| Horizon | Conviction |',
    '| --- | ---: |',
    '| 24h | 85 |',
    '',
    '- **Snapshot choice.** The newest usable row wins;',
    '  the cheapest fallback is recorded.',
    '',
    '```json',
    '"purpose": "parity gate"',
    '```'
  ].join('\n'));
  assert.deepEqual(blocks.map(block => block.kind), ['table', 'list', 'code']);
  assert.match(blocks[0].html, /<td class="num">85<\/td>/);
  assert.match(blocks[1].html, /the cheapest fallback is recorded\./);
  assert.match(blocks[2].html, /<pre class="code"><code>"purpose": "parity gate"<\/code><\/pre>/);
});

test('a construct the page does not render fails loudly instead of printing as prose', () => {
  assert.throws(() => parseBlocks('> quoted from another agent'), /Blockquotes are not rendered \(line 1\)/);
  assert.throws(() => parseBlocks('- outer\n  - inner'), /Nested lists are not rendered \(line 2\)/);
  assert.throws(() => parseBlocks('| a | b |\n| 1 | 2 |'), /has no separator row/);
  assert.throws(() => parseBlocks('| a | b |\n| --- | --- |\n| 1 | 2 | 3 |'), /holds 3 cells against a 2-cell header/);
  assert.throws(() => parseBlocks('```\nunclosed'), /is never closed/);
  assert.throws(() => renderMarkdownDocument('## A section with no title above it'), /must carry a level-1 title/);
});

test('level-2 headings become the sections the page index links to', () => {
  const document = renderMarkdownDocument('# Title\n\nIntro paragraph.\n\n## 1. One\n\nA.\n\n## 2. Two\n\nB.');
  assert.equal(document.title, 'Title');
  assert.match(document.preamble, /Intro paragraph\./);
  assert.deepEqual(document.sections.map(section => section.id), ['sec-1', 'sec-2']);
  assert.deepEqual(document.sections.map(section => section.title), ['1. One', '2. Two']);
  assert.match(document.sections[1].html, /^<h2 id="sec-2">2\. Two<\/h2>/);
});

test('the committed dossier renders whole', () => {
  const document = renderMarkdownDocument(fs.readFileSync(SOURCE, 'utf8'));
  assert.equal(document.sections.length, 11, 'the dossier keeps its eleven sections');
  assert.equal(document.sections[0].title, '1. One-paragraph summary');
  assert.equal(document.sections[10].title, '11. How this dossier was built and how to re-check it');
  const headings = fs.readFileSync(SOURCE, 'utf8').replace(/\r\n/g, '\n').split('\n')
    .filter(line => line.startsWith('## ')).map(line => line.slice(3).trim());
  assert.deepEqual(document.sections.map(section => section.title), headings);
});
