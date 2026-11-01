// Tests for the zero-dependency markdown renderer behind the daemon's pretty
// doc pages (/docs/:name).
//   node --test "tools/agora/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { renderMarkdown, renderDocPage } from './mdRender.mjs';

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

// A small browser model checks target identity and lifecycle. Real browser
// screenshots and hit tests separately prove layout; these rectangles are fixtures.
function annotationPage(md) {
  const dom = new JSDOM(renderDocPage('fixture.md', md), {
    runScripts:'dangerously', url:'http://localhost/docs/fixture.md',
    beforeParse(window) {
      window.ResizeObserver = class { observe() {} };
      window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
      window.HTMLElement.prototype.getBoundingClientRect = function () {
        const rect = (left, top, width, height) => ({ left, top, width, height, right:left + width, bottom:top + height });
        const table = this.closest('table') || this.querySelector('table');
        const visible = table ? [...table.rows].filter((row) => !row.hidden) : [];
        if (this.tagName === 'TR') return rect(0, visible.indexOf(this) * 40, 800, this.hidden ? 0 : 40);
        if (this.tagName === 'TH' || this.tagName === 'TD') return rect(this.cellIndex * 100, 0, 100, 40);
        return rect(0, 0, 800, visible.length * 40);
      };
    }
  });
  return dom;
}

const registryFixture = '| Gap ID | Bucket | Status | Severity | Agent | Thread | Gap | Evidence |\n' +
  '|---|---|---|---|---|---|---|---|\n' +
  '| WF-G1 | intake | open | high | a | t1 | First | [source](https://example.test) |\n' +
  '| WF-G2 | proof | resolved | medium | b | t2 | Second | `code` |';

test('annotation targets default to cells and preserve source links and table content', () => {
  const dom = annotationPage(registryFixture);
  try {
    const doc = dom.window.document;
    assert.equal(doc.querySelector('[data-annotation-mode="cells"]').getAttribute('aria-pressed'), 'true');
    assert.equal(doc.querySelectorAll('.annotation-target').length, 0);
    assert.equal(doc.querySelector('tbody a').href, 'https://example.test/');
    assert.equal(doc.querySelectorAll('tbody tr').length, 2);
    assert.equal(doc.querySelectorAll('tbody tr:first-child > td').length, 8);
  } finally { dom.window.close(); }
});

test('each visible row and column has a separate named container referring to canonical content', () => {
  const dom = annotationPage(registryFixture);
  try {
    const doc = dom.window.document;
    doc.querySelector('[data-annotation-mode="rows"]').click();
    const rows = [...doc.querySelectorAll('[data-annotation-kind="row"]')];
    assert.equal(rows.length, 3);
    assert.equal(rows[1].getAttribute('aria-label'), 'Row: WF-G1');
    assert.equal(rows[1].style.width, '800px');
    assert.equal(doc.getElementById(rows[1].getAttribute('aria-describedby')).tagName, 'TR');
    rows[1].click();
    assert.equal(rows[1].getAttribute('aria-pressed'), 'true');
    doc.querySelector('[data-annotation-mode="columns"]').click();
    const columns = [...doc.querySelectorAll('[data-annotation-kind="column"]')];
    assert.equal(columns.length, 8);
    assert.equal(columns[0].getAttribute('aria-label'), 'Column: Gap ID');
    assert.equal(columns[0].style.height, '120px');
    assert.equal(columns[0].getAttribute('aria-describedby').split(' ').length, 3);
    assert.equal(doc.querySelectorAll('[data-annotation-kind="row"]').length, 0);
  } finally { dom.window.close(); }
});

test('filters retain stable source row identity and resize retains target selection', async () => {
  const dom = annotationPage(registryFixture);
  try {
    const doc = dom.window.document;
    doc.querySelector('[data-annotation-mode="rows"]').click();
    const original = doc.querySelector('[aria-label="Row: WF-G1"]');
    original.click();
    const search = doc.querySelector('[aria-label="Filter table rows"]');
    search.value = 'WF-G1';
    search.dispatchEvent(new dom.window.Event('input'));
    dom.window.dispatchEvent(new dom.window.Event('resize'));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 10));
    assert.equal(doc.querySelector('[aria-label="Row: WF-G1"]'), original);
    assert.equal(original.getAttribute('aria-pressed'), 'true');
    assert.equal(doc.querySelector('[aria-label="Row: WF-G2"]'), null);
    search.value = 'no match';
    search.dispatchEvent(new dom.window.Event('input'));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 10));
    assert.equal(doc.querySelectorAll('.annotation-target').length, 1); // header only
    assert.equal(doc.querySelectorAll('tbody tr[hidden]').length, 2);
    search.value = '';
    search.dispatchEvent(new dom.window.Event('input'));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 10));
    assert.equal(doc.querySelectorAll('.annotation-target').length, 3);
    assert.equal(doc.querySelector('[aria-label="Row: WF-G2"]').dataset.annotationIndex, '2');
  } finally { dom.window.close(); }
});

test('cards and Escape remove intercepting targets; multiple small tables have distinct targets', () => {
  const dom = annotationPage(registryFixture + '\n\n| A | B |\n|---|---|\n| one | two |');
  try {
    const doc = dom.window.document;
    const first = doc.querySelector('.table-wrap');
    doc.querySelector('[data-annotation-mode="columns"]').click();
    doc.querySelector('[data-v="cards"]').click();
    assert.equal(first.querySelectorAll('.annotation-target').length, 0);
    assert.equal(doc.querySelector('.annotation-controls').hidden, true);
    assert.equal(doc.querySelectorAll('.card').length, 2);
    doc.querySelector('[data-v="table"]').click();
    assert.equal(doc.querySelector('.annotation-controls').hidden, false);
    const buttons = [...doc.querySelectorAll('[data-annotation-mode="rows"]')];
    buttons.forEach((button) => button.click());
    const ids = [...doc.querySelectorAll('.annotation-target')].map((button) => button.id);
    assert.equal(new Set(ids).size, ids.length);
    first.querySelector('.annotation-target').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
    assert.equal(first.querySelectorAll('.annotation-target').length, 0);
    assert.equal(doc.activeElement.dataset.annotationMode, 'cells');
  } finally { dom.window.close(); }
});
