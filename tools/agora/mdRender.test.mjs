// Tests for the zero-dependency markdown renderer behind the daemon's pretty
// doc pages (/docs/:name).
//   node --test "tools/agora/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderMarkdown } from './mdRender.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));

test('renders headings, emphasis, inline code, and links', () => {
  const html = renderMarkdown('# Title\n\nSome **bold** and `code` and [a link](https://x.test).');
  assert.match(html, /<h1[^>]*>Title<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<code>code<\/code>/);
  assert.match(html, /<a href="https:\/\/x\.test"[^>]*>a link<\/a>/);
});

test('renders tables with header and body', () => {
  const html = renderMarkdown('| A | B |\n|---|---|\n| 1 | `x` |\n| 2 | y |');
  assert.match(html, /<table>/);
  assert.match(html, /<th>A<\/th>/);
  assert.match(html, /<td><code>x<\/code><\/td>/);
  assert.match(html, /<td>y<\/td>/);
});

test('renders fenced code blocks literally (no inline formatting inside)', () => {
  const html = renderMarkdown('```\nnode x.mjs --flag **notbold**\n```');
  assert.match(html, /<pre><code>node x\.mjs --flag \*\*notbold\*\*\n<\/code><\/pre>/);
});

test('renders lists (ordered + unordered) with continuation lines', () => {
  const html = renderMarkdown('1. first line\n   continues here\n2. second\n\n- bullet\n- other');
  assert.match(html, /<ol>/);
  assert.match(html, /<li>first line continues here<\/li>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<li>bullet<\/li>/);
});

test('YAML frontmatter becomes a styled meta block, not body text', () => {
  const html = renderMarkdown('---\nschema_version: 1\nallowed: [a, b]\n---\n\n# Doc');
  assert.match(html, /class="frontmatter"/);
  assert.match(html, /schema_version: 1/);
  assert.match(html, /<h1[^>]*>Doc<\/h1>/);
});

test('escapes HTML in content (no injection through doc files)', () => {
  const html = renderMarkdown('hello <script>alert(1)</script> | and | pipes');
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('the three real reference docs render without crashing and keep their tables', () => {
  for (const name of ['PROTOCOL.md', 'ORCHESTRATOR.md', 'WORKFLOW_GAPS.md']) {
    const md = fs.readFileSync(path.join(DIR, name), 'utf8');
    const html = renderMarkdown(md);
    assert.ok(html.length > 500, `${name} rendered`);
  }
  const wg = renderMarkdown(fs.readFileSync(path.join(DIR, 'WORKFLOW_GAPS.md'), 'utf8'));
  assert.match(wg, /<td>WF-G1<\/td>/); // the registry table survives rendering
  assert.match(wg, /class="frontmatter"/);
});
