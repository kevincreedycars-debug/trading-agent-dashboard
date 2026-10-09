'use strict';
// Render a committed Markdown document as the sections of a standalone dashboard page.
//
// The dossier is the artifact a reviewer reads; the page is a second rendering of the same bytes, so the
// renderer refuses anything it does not actually render instead of printing it as prose. An unsupported
// construct (a blockquote, a nested list, a table without its separator row) throws with the line number,
// which is what keeps a later edit to the document from silently changing the meaning of the page.
//
// Only the constructs the USD dossier uses are implemented: ATX headings, paragraphs, fenced code,
// pipe tables with `---:` alignment, flat bullet and numbered lists, thematic breaks, and the inline
// set of code spans, bold, italics and links.
const HEADING = /^(#{1,6}) +(.*)$/;
const THEMATIC_BREAK = /^(-{3,}|\*{3,}|_{3,})\s*$/;
const BULLET = /^- +(.*)$/;
const NUMBERED = /^\d+[.)] +(.*)$/;

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// A single `*` opens emphasis only where it stands alone, so the arithmetic a document quotes
// (`0.85*0.45`) is rendered as written rather than swallowed as a broken pair of delimiters.
function renderItalics(text, line) {
  let out = '';
  let index = 0;
  while (index < text.length) {
    const start = text.indexOf('*', index);
    if (start === -1) return out + text.slice(index);
    const before = start === 0 ? ' ' : text[start - 1];
    const opens = /[\s(["'\u2014-]/.test(before);
    const close = opens ? text.indexOf('*', start + 1) : -1;
    const body = close === -1 ? '' : text.slice(start + 1, close);
    if (!opens || close === -1 || !/[A-Za-z]/.test(body)) {
      out += text.slice(index, start + 1);
      index = start + 1;
      continue;
    }
    out += `${text.slice(index, start)}<em>${body}</em>`;
    index = close + 1;
  }
  return out;
}

// Inline rendering order is fixed: code spans are lifted out first because their content is literal,
// then the whole line is escaped, then emphasis and links are applied, then the code spans go back.
function renderInline(text, line = 0) {
  const code = [];
  const guarded = text.replace(/`([^`]+)`/g, (match, body) => {
    code.push(body);
    return `\u0000${code.length - 1}\u0000`;
  });
  const parts = escapeHtml(guarded).split('**');
  if (parts.length % 2 === 0) throw new Error(`Unbalanced ** on line ${line}: ${text.trim()}`);
  let html = parts.map((part, index) => (index % 2 ? `<strong>${part}</strong>` : part)).join('');
  html = renderItalics(html, line);
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, href) => `<a href="${escapeHtml(href)}">${label}</a>`);
  return html.replace(/\u0000(\d+)\u0000/g, (match, index) => `<code>${escapeHtml(code[Number(index)])}</code>`);
}

// A table cell is split on its pipe delimiters, but not on a pipe a cell quotes inside a code span.
function splitTableRow(line) {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = [];
  let current = '';
  let inCode = false;
  for (const character of inner) {
    if (character === '`') inCode = !inCode;
    if (character === '|' && !inCode) { cells.push(current); current = ''; continue; }
    current += character;
  }
  cells.push(current);
  return cells.map(cell => cell.trim());
}

function tableAlignments(line) {
  return splitTableRow(line).map(cell => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    return left ? 'left' : '';
  });
}

function renderTable(lines, start) {
  const header = splitTableRow(lines[start]);
  const separator = lines[start + 1];
  const separatorIsRow = Boolean(separator) && /^\|[\s:|-]+\|$/.test(separator.trim());
  if (!separatorIsRow) throw new Error(`The table on line ${start + 1} has no separator row.`);
  const alignments = tableAlignments(separator);
  const head = header.map((cell, column) => `<th${alignments[column] === 'right' ? ' class="num"' : ''}>${renderInline(cell, start + 1)}</th>`);
  const body = [];
  let index = start + 2;
  while (index < lines.length && lines[index].trim().startsWith('|')) {
    const cells = splitTableRow(lines[index]);
    if (cells.length !== header.length) {
      throw new Error(`The table row on line ${index + 1} holds ${cells.length} cells against a ${header.length}-cell header.`);
    }
    body.push(cells.map((cell, column) => {
      const kind = alignments[column] === 'right' ? ' class="num"' : alignments[column] === 'center' ? ' class="center"' : '';
      return `<td${kind}>${renderInline(cell, index + 1)}</td>`;
    }).join(''));
    index++;
  }
  const html = [
    '<div class="table-wrap">',
    '  <table>',
    '    <thead>',
    `      <tr>${head.join('')}</tr>`,
    '    </thead>',
    '    <tbody>',
    ...body.map(row => `      <tr>${row}</tr>`),
    '    </tbody>',
    '  </table>',
    '</div>'
  ].join('\n');
  return { html, next: index };
}

function renderList(lines, start) {
  const ordered = NUMBERED.test(lines[start]);
  const marker = ordered ? NUMBERED : BULLET;
  const items = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) break;
    if (/^\s/.test(line)) {
      if (marker.test(line.trim())) throw new Error(`Nested lists are not rendered (line ${index + 1}).`);
      if (items.length) {
        items[items.length - 1].text += ` ${line.trim()}`;
        index++;
        continue;
      }
      break;
    }
    const match = marker.exec(line);
    if (match) { items.push({ text: match[1], line: index + 1 }); index++; continue; }
    break;
  }
  const tag = ordered ? 'ol' : 'ul';
  const html = [`<${tag}>`, ...items.map(item => `  <li>${renderInline(item.text, item.line)}</li>`), `</${tag}>`].join('\n');
  return { html, next: index };
}

// The block reader decides by a block's first line only, and treats later lines as its continuation,
// which is how CommonMark reads the dossier: a paragraph is not interrupted by a pipe or a dash mid-sentence.
function parseBlocks(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const at = index + 1;
    if (!line.trim()) { index++; continue; }
    const fence = /^```(\S*)\s*$/.exec(line);
    if (fence) {
      const body = [];
      index++;
      while (index < lines.length && !/^```/.test(lines[index])) { body.push(lines[index]); index++; }
      if (index >= lines.length) throw new Error(`The code block on line ${at} is never closed.`);
      index++;
      blocks.push({ kind: 'code', html: `<pre class="code"><code>${escapeHtml(body.join('\n'))}</code></pre>` });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2].trim() });
      index++;
      continue;
    }
    if (THEMATIC_BREAK.test(line.trim())) { blocks.push({ kind: 'rule', html: '<hr>' }); index++; continue; }
    if (line.trim().startsWith('|')) {
      const table = renderTable(lines, index);
      blocks.push({ kind: 'table', html: table.html });
      index = table.next;
      continue;
    }
    if (BULLET.test(line) || NUMBERED.test(line)) {
      const list = renderList(lines, index);
      blocks.push({ kind: 'list', html: list.html });
      index = list.next;
      continue;
    }
    const paragraph = [];
    while (index < lines.length) {
      const current = lines[index];
      if (!current.trim()) break;
      if (current.trim().startsWith('>')) throw new Error(`Blockquotes are not rendered (line ${index + 1}).`);
      if (paragraph.length && (HEADING.test(current) || /^```/.test(current) || THEMATIC_BREAK.test(current.trim()) || BULLET.test(current) || NUMBERED.test(current) || current.trim().startsWith('|'))) break;
      paragraph.push(current.trim());
      index++;
    }
    blocks.push({ kind: 'paragraph', html: `<p>${renderInline(paragraph.join(' '), at)}</p>` });
  }
  return blocks;
}

// Sections are the level-2 headings; everything before the first one is the preamble the page keeps
// under its own header, and every section gets a stable anchor so the on-page index can link to it.
function renderMarkdownDocument(markdown) {
  const blocks = parseBlocks(markdown);
  const titleBlock = blocks.find(block => block.kind === 'heading' && block.level === 1);
  if (!titleBlock) throw new Error('The document must carry a level-1 title.');
  const sections = [];
  const preamble = [];
  let current = null;
  for (const block of blocks) {
    if (block.kind === 'heading' && block.level === 1) continue;
    if (block.kind === 'heading' && block.level === 2) {
      current = { id: `sec-${sections.length + 1}`, title: block.text, html: '' };
      sections.push(current);
      current.html += `<h2 id="${current.id}">${renderInline(block.text)}</h2>`;
      continue;
    }
    const html = block.kind === 'heading'
      ? `<h${block.level}>${renderInline(block.text)}</h${block.level}>`
      : block.html;
    if (current) current.html += `\n${html}`;
    else preamble.push(html);
  }
  return { title: titleBlock.text, preamble: preamble.join('\n'), sections };
}

module.exports = { renderMarkdownDocument, parseBlocks, renderInline, splitTableRow };
