/**
 * This file renders Aralia's Idea Board and its separate personal Remember page.
 *
 * It loads research records from records.json, provides scalable search and
 * filters, and renders dated record or revision pages at stable hash URLs. The
 * research application never writes project state, downloads a listed dependency, or
 * turns a research recommendation into production behavior.
 *
 * Called by: public/idea-board/index.html
 * Depends on: records.json and the pure rules in lib.mjs
 */

import { configurePlanmap } from './organization.mjs';
import { mountConstellation } from './constellation.mjs';
import { mountRemember } from './remember.mjs';
import { BOARD_LEXICON, boardMeaning, termSlug } from './lexicon.mjs';
import { BOARD_PROMPTS, PROMPT_GROUPS, RECORD_PROMPT_IDS, emptyPrompts, fillPrompt, mergePrompts, newPromptId, promptVariables, readPrompts, savePrompts, variableLabel } from './prompts.mjs';

import {
  ASSESSMENT_STATUSES,
  CONFIDENCE_LEVELS,
  IDEA_KINDS,
  currentRevision,
  filterRecords,
  guideUrl,
  lexiconUrl,
  parseIdeaRoute,
  promptsUrl,
  recordUrl,
  revisionUrl,
  sortRevisionsNewestFirst,
} from './lib.mjs';

// ============================================================================
// Browser State
// ============================================================================
// Research state remains read-only. Remember owns separate browser-local personal
// storage; it never modifies the versioned research records or adoption decisions.
// ============================================================================

const root = document.querySelector('#idea-board-root');
const THEME_STORAGE_KEY = 'aralia-idea-board-theme';
const SORT_ORDERS = Object.freeze([
  ['newest', 'Newest assessment'],
  ['oldest', 'Oldest assessment'],
  ['title', 'Title A to Z'],
]);
const state = {
  data: null,
  filters: { query: '', status: '', kind: '', confidence: '' },
  sort: 'newest',
};

if (!root) throw new Error('Idea Board root element is missing.');

// ============================================================================
// Safe Markup Helpers
// ============================================================================
// Research content can contain arbitrary source titles. Escaping every string
// prevents a record from becoming executable page markup.
// ============================================================================

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function externalLink(url, label) {
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(label)}</a>`;
}

function pill(value, className = '') {
  const meaning = boardMeaning(value);
  const title = meaning ? ` title="${escapeHtml(meaning)}"` : '';
  return `<span class="pill ${escapeHtml(className)}"${title}>${escapeHtml(value)}</span>`;
}

function statusClass(status) {
  return `status-${String(status).replaceAll(' ', '-')}`;
}

function statusPill(status) {
  return pill(status, `pill-status ${statusClass(status)}`);
}

function tagPills(tags) {
  return tags.map((tag) => pill(tag, 'pill-tag')).join('');
}

// Record keys such as "requiredInput" become readable labels ("Required input").
function humanize(key) {
  const spaced = String(key).replaceAll(/([A-Z])/g, ' $1').trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Commit hashes and stable IDs render in monospace so they scan as identifiers.
function isIdentifier(value) {
  return /^(?:[0-9a-f]{12,}|(?:IB|SRC|REV|EXC)-\d+)(?:\s·\s\S.*)?$/.test(String(value ?? ''));
}

function fieldList(entries, className = '') {
  return `<dl class="facts-list ${escapeHtml(className)}">${entries.map(([label, value]) => field(label, value)).join('')}</dl>`;
}

function keyedFields(object) {
  return Object.entries(object).map(([key, value]) => [humanize(key), value]);
}

function list(items, emptyMessage = 'None recorded.') {
  if (!items?.length) return `<p class="empty-note">${escapeHtml(emptyMessage)}</p>`;
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function field(label, value) {
  // Array values render as lists so multi-item facts stay scannable.
  if (Array.isArray(value)) {
    return `<div class="fact"><dt>${escapeHtml(label)}</dt><dd>${list(value)}</dd></div>`;
  }
  const text = value ?? 'Unavailable';
  return `<div class="fact"><dt>${escapeHtml(label)}</dt><dd class="${isIdentifier(text) ? 'mono' : ''}">${escapeHtml(text)}</dd></div>`;
}

// Section headings carry a small ordinal so the reading column scans as a document.
function sectionHeading(number, title) {
  return `<h2><span class="num">${escapeHtml(String(number).padStart(2, '0'))}</span>${escapeHtml(title)}</h2>`;
}

const ICONS = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>',
};

// ============================================================================
// Shared Page Chrome
// ============================================================================
// The header keeps the institutional-memory boundary visible on every route,
// including deep links sent directly to a historical revision.
// ============================================================================

function activeTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function connectThemeControl() {
  const button = document.querySelector('#theme-toggle');
  if (!button) return;

  // The label names the next available action, while aria-pressed exposes the
  // current dark-mode state to assistive technology.
  const updateButton = () => {
    const isDark = activeTheme() === 'dark';
    button.setAttribute('aria-pressed', String(isDark));
    button.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
    button.innerHTML = `${isDark ? ICONS.sun : ICONS.moon}<span>${isDark ? 'Light' : 'Dark'}</span>`;
  };

  // Palette samples are presentation preferences; research and filters stay intact.
  const palette = document.querySelector('#palette-select');
  palette.value = document.documentElement.dataset.palette || 'original';
  button.hidden = palette.value !== 'original';
  palette.addEventListener('change', () => {
    document.documentElement.dataset.palette = palette.value;
    button.hidden = palette.value !== 'original';
    try { localStorage.setItem('aralia-idea-board-palette', palette.value); } catch { /* The sample still works without storage. */ }
  });
  updateButton();
  button.addEventListener('click', () => {
    const nextTheme = activeTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;

    // Remember only an explicit user choice. The guarded write keeps the theme
    // toggle usable even when browser privacy settings disable local storage.
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The visual change still applies for this page view when persistence is unavailable.
    }
    updateButton();
  });
}

function shell(content, title = 'Idea Board', current = 'index') {
  const counts = state.data
    ? `${state.data.records.length} research ideas · ${state.data.excludedSources.length} excluded`
    : 'Loading research index';

  document.title = title === 'Idea Board' ? 'Idea Board · Aralia' : `${title} · Idea Board · Aralia`;

  const navLink = (href, label, key) => `<a href="${href}" ${current === key ? 'aria-current="page"' : ''}>${label}</a>`;

  root.innerHTML = `
    <header class="board-header">
      <div class="container">
        <a class="brand" href="#/">
          <span class="brand-mark" aria-hidden="true">IB</span>
          <span>
            <h1>Idea Board</h1>
            <span class="eyebrow">Research & personal ideas</span>
          </span>
        </a>
        <nav class="header-nav" aria-label="Board routes">
          ${navLink('#/', 'Index', 'index')}
          ${navLink('#/remember', 'Remember', 'remember')}
          ${navLink(guideUrl(), 'Agent guide', 'guide')}
          ${navLink(lexiconUrl(), 'Lexicon', 'lexicon')}
          ${navLink(promptsUrl(), 'Prompts', 'prompts')}
        </nav>
        <div class="header-meta">
          ${pill(current === 'remember' || current === 'prompts' ? 'Saved in this browser' : 'Read only', 'read-only')}
          <span class="count">${escapeHtml(counts)}</span>
          <label class="palette-control">Palette<select id="palette-select"><option value="original">Original</option><option value="charcoal">Warm charcoal</option><option value="parchment">Light parchment</option><option value="slate">Cool slate</option></select></label>
          <button class="btn btn-ghost" id="theme-toggle" type="button">Theme</button>
        </div>
      </div>
    </header>
    <main class="container">${content}</main>
    <footer>
      <div class="container">${current === 'prompts' ? 'Curated prompts are versioned with the board. Your own prompts stay in this browser; export a backup to keep a copy. Copying a prompt runs nothing.' : current === 'remember' ? 'Personal ideas stay in this browser. Export a backup to keep a separate copy. Research assessments remain in the Index.' : 'Records describe external ideas only. Listing a tool does not install it, grant credentials, alter production behavior, or approve adoption.'}</div>
    </footer>`;

  // Every route redraws the shared page chrome, so reconnect the presentation-only
  // theme control after rendering without changing research data or route state.
  connectThemeControl();
}

// In-page jump links scroll within the document. The hash stays the router, so
// they must not rewrite it, and the active link follows the visible section.
function connectJumpNavigation(navSelector) {
  const nav = document.querySelector(navSelector);
  if (!nav) return;

  nav.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    event.preventDefault();
    document.getElementById(link.getAttribute('href').slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  if (!('IntersectionObserver' in window)) return;
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const targets = links.map((link) => document.getElementById(link.getAttribute('href').slice(1))).filter(Boolean);
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!visible) return;
    links.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${visible.target.id}`));
  }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });
  targets.forEach((target) => observer.observe(target));
}

function tocMarkup(entries) {
  return `<nav class="toc" aria-label="Sections"><span class="label">On this page</span>${entries.map(([href, label]) => `<a href="${href}">${escapeHtml(label)}</a>`).join('')}</nav>`;
}

// ============================================================================
// Cold-Agent Guide
// ============================================================================
// This route turns the maintenance contract into a short operational guide at
// the point of use. It tells agents where durable data lives, but deliberately
// provides no browser-side editing or action that could mutate project state.
// ============================================================================

function renderGuide() {
  const toc = tocMarkup([
    ['#classify', '1. Classify'], ['#baseline', '2. Evidence and baseline'], ['#decision', '3. Two-sided decision'], ['#history', '4. History and verification'],
  ]);

  shell(`
    <nav class="breadcrumbs"><a href="#/">Idea Board</a><span>/</span><span>Agent guide</span></nav>
    <div class="guide-layout">
      ${toc}
      <div class="doc guide-doc">
        <section class="guide-hero">
          <p class="label">Cold-agent instruction</p>
          <h2>Preserve decisions, not bookmarks</h2>
          <p>The Idea Board is Aralia's dated institutional memory for external ideas. Each assessment compares primary evidence with the project as it actually existed on that date. It is not an enthusiasm feed, automatic integration queue, or proof that a polished demonstration is reusable.</p>
          <aside class="guide-callout"><strong>One supplied source, one recorded outcome:</strong> create a new idea, add supporting evidence to an existing idea, or record a deliberate exclusion with its reason.</aside>
        </section>

        <section id="classify" aria-labelledby="classify-heading">
          ${sectionHeading(1, 'Classify before you write')}
          <p>Search <code>public/idea-board/records.json</code> by normalized URL, mechanism, problem, repository, product, paper, and package. Do not create a duplicate record merely because another source shows the same technique.</p>
          <div class="guide-grid">
            <article class="guide-step"><span class="guide-number">A</span><h3>New record</h3><p>Use when the source introduces a distinct mechanism and problem identity. Allocate the next monotonic <code>IB-</code>, <code>SRC-</code>, and revision IDs.</p></article>
            <article class="guide-step"><span class="guide-number">B</span><h3>Supporting evidence</h3><p>Add the source to the existing record. Append a linked revision only when the new evidence changes the assessment, confidence, comparison, or recommendation.</p></article>
            <article class="guide-step"><span class="guide-number">C</span><h3>Deliberate exclusion</h3><p>Add it to <code>excludedSources</code> with a stable <code>EXC-</code> ID, supplied date, exclusion date, and an honest reason.</p></article>
          </div>
        </section>

        <section id="baseline" aria-labelledby="baseline-heading">
          ${sectionHeading(2, 'Capture the evidence and Aralia baseline')}
          <ol class="guide-checklist">
            <li>Record the source publication date, date supplied, assessment timestamp, and exact repository commit or release inspected. Use <code>unavailable: &lt;reason&gt;</code> when evidence does not support a date or revision.</li>
            <li>Snapshot Aralia with <code>git rev-parse HEAD</code>, the commit timestamp, the workspace inspection timestamp, and <code>git status --short</code>. If the workspace is dirty, say so explicitly.</li>
            <li>Retain primary sources and separate what each source claims, what it directly demonstrates, what its implementation contains, and what the assessor infers.</li>
            <li>Explain the mechanism as input, processing, output, dependencies, runtime, manual work, component type, external requirements, licence constraints, limitations, and problems it does not solve.</li>
          </ol>
        </section>

        <section id="decision" aria-labelledby="decision-heading">
          ${sectionHeading(3, 'Make a two-sided decision')}
          <p>For every relevant dimension, record the external approach, Aralia's current approach, the meaningful difference, practical consequence, supporting evidence, and remaining uncertainty.</p>
          <p style="margin-top:12px">The fit assessment must name benefits, exclusions, complements, what must not be replaced, the architectural boundary, introduced dependencies, blockers, risks, owners, migration or rollback, and one provisional conclusion.</p>
          <aside class="guide-callout guide-boundary"><strong>Boundary:</strong> documenting an idea does not authorize installing, cloning, downloading, importing, granting credentials, changing configuration, running an experiment, deploying, or promoting output. Experimental work requires an explicit later request and stays isolated until normal review.</aside>
        </section>

        <section id="history" aria-labelledby="history-heading">
          ${sectionHeading(4, 'Preserve history and verify')}
          <p>Never rewrite an earlier conclusion. Append a revision whose <code>previousRevisionId</code> points to the immediately preceding snapshot, and mark obsolete conclusions superseded without deleting them.</p>
          <div class="guide-command-list" aria-label="Required verification commands">
            <code>node scripts/idea-board/validate.mjs</code>
            <code>node --test scripts/idea-board/validate.test.mjs</code>
            <code>cmd /c npm run sync-check</code>
          </div>
          <p>Then inspect the index, the direct record URL, at least one historical revision URL, and a narrow-screen layout. Record the result in <code>docs/projects/idea-board/AUDIT_OR_PROOF.md</code>. The full maintenance authority is <code>docs/projects/idea-board/RUNBOOK.md</code>.</p>
        </section>
      </div>
    </div>`, 'Agent guide', 'guide');

  connectJumpNavigation('.toc');
}


// ============================================================================
// Lexicon
// ============================================================================
// Board-wide vocabulary comes from lexicon.mjs. Idea-specific terms come from
// each record's own `lexicon` list, so a reader sees only what that idea needs.
// ============================================================================

function termEntry(entry, ownerId = '') {
  const slug = ownerId ? `${ownerId}-${termSlug(entry.term)}` : termSlug(entry.term);
  const see = entry.see?.length
    ? `<span class="term-see">See ${entry.see.map((name) => `<a href="${lexiconUrl(termSlug(name))}">${escapeHtml(name)}</a>`).join(', ')}</span>`
    : '';
  return `<div class="term" id="term-${escapeHtml(slug)}"><dt>${escapeHtml(entry.term)}</dt><dd>${escapeHtml(entry.meaning)}${see}</dd></div>`;
}

function termList(entries, ownerId = '') {
  return `<dl class="term-list">${entries.map((entry) => termEntry(entry, ownerId)).join('')}</dl>`;
}

function renderLexicon(requestedSlug = '') {
  const groups = BOARD_LEXICON.map((group) => `<section id="group-${termSlug(group.group)}"><h2>${escapeHtml(group.group)}</h2>${termList(group.terms)}</section>`).join('');
  const ideas = state.data.records
    .filter((record) => record.lexicon?.length)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((record) => `<section id="group-${escapeHtml(record.id)}"><h2><a href="${recordUrl(record.id)}"><span class="mono">${escapeHtml(record.id)}</span> ${escapeHtml(record.title)}</a></h2>${termList(record.lexicon, record.id)}</section>`)
    .join('');
  const toc = tocMarkup([
    ...BOARD_LEXICON.map((group) => [`#group-${termSlug(group.group)}`, group.group]),
    ['#idea-terms', 'Idea-specific terms'],
  ]);

  shell(`
    <nav class="breadcrumbs"><a href="#/">Idea Board</a><span>/</span><span>Lexicon</span></nav>
    <div class="guide-layout">
      ${toc}
      <div class="doc lexicon-doc">
        <section class="guide-hero">
          <p class="label">Vocabulary</p>
          <h2>Lexicon</h2>
          <p>Two layers of terms. The first layer is the board's own contract: statuses, evidence classes, source roles, baselines, conclusions, and Aralia surfaces. The second layer lists the concepts each idea introduces. A record page shows only its own terms.</p>
        </section>
        <div class="lexicon-filter"><span class="search-wrap">${ICONS.search}<input id="lexicon-search" type="search" placeholder="Filter terms" autocomplete="off" aria-label="Filter terms"></span></div>
        ${groups}
        <section id="idea-terms"><h2>Idea-specific terms</h2><p>Each list belongs to one record and links back to it.</p></section>
        ${ideas || '<p class="empty-note">No record carries its own terms yet.</p>'}
      </div>
    </div>`, 'Lexicon', 'lexicon');

  connectJumpNavigation('.toc');

  // Filtering hides terms in place; it never changes the route or the data.
  document.querySelector('#lexicon-search')?.addEventListener('input', (event) => {
    const query = event.target.value.trim().toLowerCase();
    document.querySelectorAll('.term').forEach((node) => { node.hidden = Boolean(query) && !node.textContent.toLowerCase().includes(query); });
    document.querySelectorAll('.lexicon-doc section').forEach((section) => {
      const terms = section.querySelectorAll('.term');
      section.hidden = terms.length > 0 && [...terms].every((node) => node.hidden);
    });
  });

  if (requestedSlug) document.getElementById(`term-${requestedSlug}`)?.scrollIntoView({ block: 'start', behavior: 'instant' });
}


// ============================================================================
// Prompt Library
// ============================================================================
// Curated prompts come from prompts.mjs and are versioned with the board.
// Personal prompts stay in this browser. Copying a prompt runs nothing; the
// operator pastes it into an agent session and stays responsible for it.
// ============================================================================

const LONG_VARIABLES = /URLS|TERMS|NOTE|CHANGED|REASON|FOCUS/;

function promptField(name, preset) {
  const label = `<span class="label">${escapeHtml(variableLabel(name))}</span>`;
  const value = escapeHtml(preset[name] ?? '');
  if (LONG_VARIABLES.test(name)) return `<label class="prompt-field prompt-field-wide">${label}<textarea data-var="${escapeHtml(name)}" rows="3">${value}</textarea></label>`;
  const list = name.startsWith('RECORD') ? ' list="prompt-record-ids"' : '';
  return `<label class="prompt-field">${label}<input data-var="${escapeHtml(name)}" value="${value}"${list} autocomplete="off"></label>`;
}

function promptCard(prompt, preset, personal = false) {
  const fields = promptVariables(prompt.body).map((name) => promptField(name, preset)).join('');
  const mine = personal
    ? `<button class="btn btn-sm btn-ghost" type="button" data-edit="${escapeHtml(prompt.id)}">Edit</button><button class="btn btn-sm btn-ghost" type="button" data-delete="${escapeHtml(prompt.id)}">Delete</button>`
    : '';
  return `<article class="prompt-card" id="prompt-${escapeHtml(prompt.id)}" data-prompt="${escapeHtml(prompt.id)}">
    <div class="prompt-head"><h3>${escapeHtml(prompt.title)}</h3>${personal ? pill('mine', 'pill-tag') : ''}</div>
    ${prompt.when ? `<p class="prompt-when">${escapeHtml(prompt.when)}</p>` : ''}
    ${fields ? `<div class="prompt-fields">${fields}</div>` : ''}
    <pre class="prompt-preview" tabindex="0" aria-label="Prompt text">${escapeHtml(fillPrompt(prompt.body, preset))}</pre>
    <div class="prompt-actions"><button class="btn btn-sm" type="button" data-copy>Copy prompt</button><a class="btn btn-sm btn-ghost" href="${promptsUrl(prompt.id)}">Link</a>${mine}<span class="prompt-status" role="status" aria-live="polite"></span></div>
  </article>`;
}

function loadPersonalPrompts() {
  try { return { collection: readPrompts(localStorage), error: '' }; }
  catch (error) { return { collection: emptyPrompts(), error: `Your saved prompts could not be loaded: ${error.message}. Nothing was changed.` }; }
}

function renderPrompts(requestedId = '') {
  const recordId = new URLSearchParams(location.hash.split('?')[1] ?? '').get('record') ?? '';
  const preset = recordId ? { RECORD_ID: recordId, RECORD_A: recordId } : {};
  const { collection, error } = loadPersonalPrompts();
  const records = state.data?.records ?? [];

  const groups = PROMPT_GROUPS.map((group) => `<section id="group-${termSlug(group)}" class="prompt-group"><h2>${escapeHtml(group)}</h2>${BOARD_PROMPTS.filter((prompt) => prompt.group === group).map((prompt) => promptCard(prompt, preset)).join('')}</section>`).join('');
  const mine = collection.prompts.length
    ? collection.prompts.map((prompt) => promptCard(prompt, preset, true)).join('')
    : '<p class="empty-note">No personal prompts yet. Add one below; it stays in this browser.</p>';
  const toc = tocMarkup([...PROMPT_GROUPS.map((group) => [`#group-${termSlug(group)}`, group]), ['#my-prompts', 'My prompts']]);

  shell(`
    <nav class="breadcrumbs"><a href="#/">Idea Board</a><span>/</span><span>Prompts</span></nav>
    <div class="guide-layout">
      ${toc}
      <div class="doc prompt-doc">
        <section class="guide-hero">
          <p class="label">Copy, fill, paste</p>
          <h2>Prompt library</h2>
          <p>Ready-made instructions for agents that work on this board. Fill the fields, copy the prompt, and paste it into an agent session. Curated prompts point at the runbook, so they stay correct across sessions. Copying a prompt runs nothing.</p>
          ${recordId ? `<aside class="guide-callout">Fields are pre-filled for <a href="${recordUrl(recordId)}"><span class="mono">${escapeHtml(recordId)}</span></a>. <a href="${promptsUrl()}">Clear</a></aside>` : ''}
        </section>
        <div class="lexicon-filter"><span class="search-wrap">${ICONS.search}<input id="prompt-search" type="search" placeholder="Filter prompts" autocomplete="off" aria-label="Filter prompts"></span></div>
        <datalist id="prompt-record-ids">${records.map((record) => `<option value="${escapeHtml(record.id)}">${escapeHtml(record.title)}</option>`).join('')}</datalist>
        ${groups}
        <section id="my-prompts" class="prompt-group">
          <h2>My prompts</h2>
          ${error ? `<p class="notice">${escapeHtml(error)}</p>` : ''}
          ${mine}
          <form class="prompt-editor" id="prompt-editor">
            <h3 id="prompt-editor-title">New prompt</h3>
            <input type="hidden" name="id" value="">
            <label class="prompt-field"><span class="label">Title</span><input name="title" required autocomplete="off"></label>
            <label class="prompt-field"><span class="label">Group</span><input name="group" placeholder="My prompts" autocomplete="off"></label>
            <label class="prompt-field prompt-field-wide"><span class="label">Prompt</span><textarea name="body" rows="7" required placeholder="Write the prompt. Use {{RECORD_ID}} or any {{NAME}} in capitals for a fill-in field."></textarea></label>
            <div class="prompt-actions"><button class="btn" type="submit">Save prompt</button><button class="btn btn-ghost" type="reset">Cancel</button><span class="prompt-status" role="status" aria-live="polite"></span></div>
          </form>
          <div class="prompt-actions prompt-backup"><button class="btn btn-sm btn-ghost" type="button" id="prompts-export">Export my prompts</button><label class="btn btn-sm btn-ghost">Import prompts<input type="file" id="prompts-import" accept="application/json,.json" hidden></label></div>
        </section>
      </div>
    </div>`, 'Prompts', 'prompts');

  connectJumpNavigation('.toc');
  const all = [...BOARD_PROMPTS, ...collection.prompts];
  const status = (node, text) => { if (!node) return; node.textContent = text; setTimeout(() => { node.textContent = ''; }, 2400); };

  // Each card re-renders its own preview from its own fields; nothing else changes.
  document.querySelectorAll('.prompt-card').forEach((card) => {
    const prompt = all.find((item) => item.id === card.dataset.prompt);
    const preview = card.querySelector('.prompt-preview');
    const values = () => Object.fromEntries([...card.querySelectorAll('[data-var]')].map((input) => [input.dataset.var, input.value]));
    card.querySelectorAll('[data-var]').forEach((input) => input.addEventListener('input', () => { preview.textContent = fillPrompt(prompt.body, values()); }));
    card.querySelector('[data-copy]')?.addEventListener('click', async () => {
      const text = fillPrompt(prompt.body, values());
      const unfilled = promptVariables(text);
      try {
        await navigator.clipboard.writeText(text);
        status(card.querySelector('.prompt-status'), unfilled.length ? `Copied. Still unfilled: ${unfilled.map(variableLabel).join(', ')}.` : 'Copied.');
      } catch {
        // Older copy path for contexts that block the async clipboard API.
        const range = document.createRange(); range.selectNodeContents(preview);
        const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
        let copied = false;
        try { copied = document.execCommand('copy'); } catch { copied = false; }
        status(card.querySelector('.prompt-status'), copied ? 'Copied.' : 'Copy is blocked here. The text is selected; press Ctrl+C.');
      }
    });
  });

  // Filtering hides cards in place; it never changes the route or saved prompts.
  document.querySelector('#prompt-search')?.addEventListener('input', (event) => {
    const query = event.target.value.trim().toLowerCase();
    document.querySelectorAll('.prompt-card').forEach((card) => { card.hidden = Boolean(query) && !card.textContent.toLowerCase().includes(query); });
    document.querySelectorAll('.prompt-group').forEach((section) => {
      const cards = section.querySelectorAll('.prompt-card');
      section.hidden = section.id !== 'my-prompts' && cards.length > 0 && [...cards].every((card) => card.hidden);
    });
  });

  const persist = (next, message) => {
    if (error) throw new Error(error);
    savePrompts(localStorage, next);
    sessionStorage.setItem('idea-board-prompts-flash', message);
    renderPrompts(requestedId);
  };
  const form = document.querySelector('#prompt-editor');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const entry = { id: String(data.get('id') || '') || newPromptId(collection), title: String(data.get('title')).trim(), group: String(data.get('group') || '').trim() || 'My prompts', body: String(data.get('body')), updatedAt: new Date().toISOString() };
    if (!entry.title || !entry.body.trim()) return;
    const prompts = collection.prompts.some((item) => item.id === entry.id)
      ? collection.prompts.map((item) => (item.id === entry.id ? entry : item))
      : [...collection.prompts, entry];
    try { persist({ version: 1, prompts }, 'Prompt saved in this browser.'); }
    catch (saveError) { status(form.querySelector('.prompt-status'), `Not saved: ${saveError.message}`); }
  });
  form?.addEventListener('reset', () => { form.elements.id.value = ''; document.querySelector('#prompt-editor-title').textContent = 'New prompt'; });
  document.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => {
    const prompt = collection.prompts.find((item) => item.id === button.dataset.edit);
    form.elements.id.value = prompt.id; form.elements.title.value = prompt.title; form.elements.group.value = prompt.group; form.elements.body.value = prompt.body;
    document.querySelector('#prompt-editor-title').textContent = `Edit "${prompt.title}"`;
    form.scrollIntoView({ block: 'center' }); form.elements.title.focus();
  }));
  document.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => {
    const prompt = collection.prompts.find((item) => item.id === button.dataset.delete);
    if (!confirm(`Delete "${prompt.title}" from this browser? The previous copy stays in the backup slot.`)) return;
    try { persist({ version: 1, prompts: collection.prompts.filter((item) => item.id !== prompt.id) }, 'Prompt deleted.'); }
    catch (saveError) { status(button.closest('.prompt-card').querySelector('.prompt-status'), `Not deleted: ${saveError.message}`); }
  }));
  document.querySelector('#prompts-export')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), prompts: collection.prompts }, null, 2)], { type: 'application/json' });
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `idea-board-prompts-${new Date().toISOString().slice(0, 10)}.json` });
    link.click(); URL.revokeObjectURL(link.href);
  });
  document.querySelector('#prompts-import')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const note = document.querySelector('.prompt-backup');
    try {
      const { collection: next, added, skipped } = mergePrompts(collection, await file.text());
      persist(next, `Imported ${added} prompt${added === 1 ? '' : 's'}; skipped ${skipped} already present.`);
    } catch (importError) {
      note.insertAdjacentHTML('beforeend', `<span class="prompt-status" role="status">${escapeHtml(importError.message)}</span>`);
    }
  });

  const flash = sessionStorage.getItem('idea-board-prompts-flash');
  if (flash) {
    sessionStorage.removeItem('idea-board-prompts-flash');
    status(document.querySelector('#prompt-editor .prompt-status'), flash);
    document.querySelector('#my-prompts')?.scrollIntoView({ block: 'start' });
  } else if (requestedId) {
    const card = document.getElementById(`prompt-${requestedId}`);
    card?.classList.add('active');
    card?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
}

// ============================================================================
// Growing Index
// ============================================================================
// The index places newest assessments first and keeps every main classification
// available as a filter. The empty state explains how the real board should grow
// instead of disguising test data as reviewed research.
// ============================================================================

function selectControl(id, label, values, selected) {
  return `<label class="filter-group"><span class="label">${escapeHtml(label)}</span><select id="${id}"><option value="">All</option>${values.map((value) => `<option value="${escapeHtml(value)}" ${selected === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label>`;
}

function sortRecords(records) {
  const byAssessed = (left, right) => currentRevision(right).assessedAt.localeCompare(currentRevision(left).assessedAt);
  if (state.sort === 'oldest') return records.sort((left, right) => byAssessed(right, left));
  if (state.sort === 'title') return records.sort((left, right) => left.title.localeCompare(right.title));
  return records.sort(byAssessed);
}

function recordRow(record) {
  const revision = currentRevision(record);
  return `<article class="record-row ${statusClass(revision.status)}">
    <div class="card-topline">
      ${statusPill(revision.status)}${pill(record.kind)}${pill(`${revision.confidence} confidence`)}
      <span class="when">Assessed <time datetime="${escapeHtml(revision.assessedAt)}">${escapeHtml(revision.assessedAt.slice(0, 10))}</time></span>
    </div>
    <h2><a href="${recordUrl(record.id)}">${escapeHtml(record.title)}</a></h2>
    <p class="summary">${escapeHtml(record.summary)}</p>
    <div class="row-foot">
      <span class="mono">${escapeHtml(record.id)}</span>
      <span class="mono">${escapeHtml(revision.projectBaseline.commit.slice(0, 9))}</span>
      ${tagPills(record.tags)}
    </div>
  </article>`;
}

function statusFilterList() {
  const counts = new Map(ASSESSMENT_STATUSES.map((status) => [status, 0]));
  for (const record of state.data.records) {
    const status = currentRevision(record)?.status;
    if (counts.has(status)) counts.set(status, counts.get(status) + 1);
  }
  const choices = ASSESSMENT_STATUSES.map((status) => {
    const selected = state.filters.status === status;
    const count = counts.get(status);
    return `<button type="button" class="status-choice ${statusClass(status)}" data-status="${escapeHtml(status)}" aria-pressed="${selected}" ${count === 0 && !selected ? 'disabled' : ''}>${escapeHtml(status)}<span class="n">${count}</span></button>`;
  }).join('');
  return `<div class="filter-group filter-status" role="group" aria-labelledby="status-label">
    <span class="label" id="status-label">Status${state.filters.status ? '<button type="button" id="clear-status">Any</button>' : ''}</span>
    <div class="status-list">${choices}</div>
  </div>`;
}

function datasetCard() {
  const baseline = state.data.localProject.committedBaseline;
  const dirty = state.data.localProject.workspaceInspection.dirty;
  return `<aside class="dataset-card" aria-label="Dataset baseline">
    <span class="label">Dataset baseline</span>
    <div class="row"><span>Commit</span><span class="mono">${escapeHtml(baseline.commit.slice(0, 9))}</span></div>
    <div class="row"><span>Committed</span><span>${escapeHtml(baseline.committedAt.slice(0, 10))}</span></div>
    <div class="row"><span>Generated</span><span>${escapeHtml(String(state.data.generatedAt ?? '').slice(0, 10) || 'Unavailable')}</span></div>
    <div class="row"><span>Workspace</span><span class="${dirty ? 'dirty' : 'clean'}">${dirty ? 'Uncommitted work present' : 'Matched baseline'}</span></div>
  </aside>`;
}

// The visual explorer reuses the same dataset and stable assessment routes.
// The original ledger remains available for dense reading and all prior filters.
function renderIndex() {
  shell('<div id="constellation-root"></div>');
  mountConstellation(document.querySelector('#constellation-root'), state.data, renderLedger);
}

function renderLedger() {
  const records = sortRecords(filterRecords(state.data.records, state.filters));
  const total = state.data.records.length;
  const filtered = Boolean(state.filters.query || state.filters.status || state.filters.kind || state.filters.confidence);

  const rows = records.map(recordRow).join('');
  const empty = total === 0
    ? `<section class="empty-state"><h2>No assessed sources yet</h2><p>The board is ready for its first real source. Add it only after deciding whether it is a new idea, supporting evidence for an existing technique, or a deliberate exclusion.</p><code>public/idea-board/records.json</code></section>`
    : `<section class="empty-state"><h2>No records match</h2><p>Change or clear the filters to return to the full evidence index.</p></section>`;

  const exclusions = state.data.excludedSources.length
    ? `<section class="exclusion-shelf"><h2>Deliberately excluded sources</h2>${state.data.excludedSources.map((source) => `<article><strong>${escapeHtml(source.title)}</strong><p>${escapeHtml(source.reason)}</p>${externalLink(source.url, 'Open source')}</article>`).join('')}</section>`
    : '';

  shell(`
    <div class="page-head">
      <h2>Research index</h2><button type="button" class="btn" id="open-constellation">Explore constellation</button>
      <p class="lede">Dated evidence, honest comparisons, and bounded experiments. Not an integration queue.</p>
    </div>
    <div class="index-layout">
      <aside class="filter-rail" aria-label="Idea filters">
        <label class="filter-group filter-search">
          <span class="label">Search${filtered ? '<button type="button" id="clear-filters">Clear all</button>' : ''}</span>
          <span class="search-wrap">${ICONS.search}<input id="idea-search" type="search" value="${escapeHtml(state.filters.query)}" placeholder="Technique, problem, tag, or ID" autocomplete="off"></span>
        </label>
        ${statusFilterList()}
        ${selectControl('kind-filter', 'Source maturity', IDEA_KINDS, state.filters.kind)}
        ${selectControl('confidence-filter', 'Confidence', CONFIDENCE_LEVELS, state.filters.confidence)}
        ${datasetCard()}
      </aside>
      <div>
        <div class="list-head">
          <span><strong>${records.length}</strong> of ${total} ideas</span>
          <label>Sort<select id="sort-order">${SORT_ORDERS.map(([value, label]) => `<option value="${value}" ${state.sort === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        </div>
        <section class="record-list" aria-label="Idea records">${rows || empty}</section>
        ${exclusions}
      </div>
    </div>`);

  document.querySelector('#open-constellation')?.addEventListener('click', renderIndex);

  // Filter changes redraw only this static research surface and never alter its data file.
  const search = document.querySelector('#idea-search');
  search?.addEventListener('input', (event) => {
    state.filters.query = event.target.value;
    const caret = event.target.selectionStart;
    renderLedger();
    const next = document.querySelector('#idea-search');
    next?.focus();
    next?.setSelectionRange(caret, caret);
  });
  document.querySelectorAll('.status-choice').forEach((button) => button.addEventListener('click', () => {
    const status = button.dataset.status;
    state.filters.status = state.filters.status === status ? '' : status;
    renderLedger();
  }));
  document.querySelector('#clear-status')?.addEventListener('click', () => { state.filters.status = ''; renderLedger(); });
  document.querySelector('#kind-filter')?.addEventListener('change', (event) => { state.filters.kind = event.target.value; renderLedger(); });
  document.querySelector('#confidence-filter')?.addEventListener('change', (event) => { state.filters.confidence = event.target.value; renderLedger(); });
  document.querySelector('#sort-order')?.addEventListener('change', (event) => { state.sort = event.target.value; renderLedger(); });
  document.querySelector('#clear-filters')?.addEventListener('click', () => { state.filters = { query: '', status: '', kind: '', confidence: '' }; renderLedger(); });
}

// ============================================================================
// Detailed Evidence Sections
// ============================================================================
// Each section keeps facts, inference, uncertainty, and recommendation visually
// separate. This prevents a polished source claim from being mistaken for local
// proof or an adoption decision.
// ============================================================================

function renderSources(record, number) {
  return `<section id="sources">${sectionHeading(number, 'Source shelf')}<div class="source-list">${record.sources.map((source) => `<article>
    <div class="card-topline">${pill(source.type)}${pill(source.role)}<span class="pill mono">${escapeHtml(source.id)}</span></div>
    <h3>${externalLink(source.url, source.title)}</h3>
    <div class="source-body">
      <div>${fieldList([['Published', source.publishedAt], ['Latest revision inspected', source.latestRevisionInspected], ['Licence', source.licence], ['Provenance', source.provenance], ['Archive', source.archiveUrl || 'Not retained']], 'single')}</div>
      <div>
        <h4>Source explicitly claims</h4>${list(source.claims)}
        <h4>Directly demonstrated</h4>${list(source.demonstrates)}
        <h4>Implementation contains</h4>${list(source.implementationContains)}
      </div>
    </div>
  </article>`).join('')}</div></section>`;
}

function renderComparison(comparisons, number) {
  return `<section id="comparison">${sectionHeading(number, 'Current-project comparison')}<div class="compare-list">
    ${comparisons.map((item) => `<article class="compare-item">
      <h3>${escapeHtml(item.dimension)}</h3>
      <div class="compare-sides">
        <div><span class="label">External approach</span>${escapeHtml(item.externalApproach)}</div>
        <div><span class="label">Aralia at assessment</span>${escapeHtml(item.projectApproach)}</div>
      </div>
      <div class="compare-foot">
        <div><span class="label">Difference and consequence</span><b>${escapeHtml(item.meaningfulDifference)}</b>${escapeHtml(item.practicalConsequence)}</div>
        <div><span class="label">Evidence and uncertainty</span>${escapeHtml(item.evidence)}<em>Uncertainty: ${escapeHtml(item.uncertainty)}</em></div>
      </div>
    </article>`).join('')}
  </div></section>`;
}

function renderExperiment(experiment, number) {
  if (!experiment) return '';
  return `<section id="experiment">${sectionHeading(number, 'Bounded experiment')}
    ${fieldList([['Question', experiment.question], ['Exact input', experiment.exactInput], ['Pinned revisions', experiment.pinnedRevisions], ['Expected output', experiment.expectedOutput], ['Project baseline', experiment.projectBaseline], ['Measurements', experiment.measurements], ['Limit', experiment.limit], ['Isolation boundary', experiment.isolationBoundary], ['Cleanup / rollback', experiment.cleanup], ['Result and date', experiment.result ? `${experiment.result} — ${experiment.resultAt}` : 'Not run']])}
    <h3>Acceptance criteria</h3>${list(experiment.acceptanceCriteria)}<h3>Rejection criteria</h3>${list(experiment.rejectionCriteria)}</section>`;
}

function renderRecord(record, requestedRevisionId = '') {
  const revisions = sortRevisionsNewestFirst(record.revisions);
  const revision = requestedRevisionId
    ? revisions.find((item) => item.id === requestedRevisionId)
    : revisions[0];

  // A stale shared URL receives a clear not-found state instead of silently showing a different conclusion.
  if (!revision) {
    shell(`<section class="empty-state"><h2>Revision not found</h2><p>The requested historical assessment does not exist for this record.</p><a href="${recordUrl(record.id)}">Open current record</a></section>`, record.title, 'record');
    return;
  }

  const isHistorical = revision.id !== revisions[0].id;
  const timeline = revisions.map((item) => `<li class="${item.id === revision.id ? 'selected-revision' : ''}"><a href="${revisionUrl(record.id, item.id)}">${escapeHtml(item.assessedAt)} · ${escapeHtml(item.status)}</a><span>${escapeHtml(item.changeSummary)}</span></li>`).join('');

  const { conclusion, ...fitRest } = revision.fit;
  const related = record.relatedIdeaIds.length
    ? `<ul>${record.relatedIdeaIds.map((id) => {
        const target = state.data.records.find((item) => item.id === id);
        return `<li><a href="${recordUrl(id)}"><span class="mono">${escapeHtml(id)}</span>${target ? ` · ${escapeHtml(target.title)}` : ''}</a></li>`;
      }).join('')}</ul>`
    : '<p class="empty-note">None linked.</p>';

  const sections = [
    ['evidence', 'Evidence'], record.lexicon?.length ? ['terms', 'Terms'] : null, ['sources', 'Sources'], ['technique', 'Technique'], ['comparison', 'Comparison'],
    ['fit', 'Fit'], revision.experiment ? ['experiment', 'Experiment'] : null, ['timeline', 'Timeline'], ['history', 'History'], ['related', 'Related'],
  ].filter(Boolean);
  const number = (id) => sections.findIndex(([key]) => key === id) + 1;
  const toc = tocMarkup(sections.map(([id, label]) => [`#${id}`, label]));
  const shareUrl = `${location.origin}${location.pathname}${revisionUrl(record.id, revision.id)}`;

  shell(`
    <nav class="breadcrumbs"><a href="#/">Idea Board</a><span>/</span><span class="mono">${escapeHtml(record.id)}</span></nav>
    ${isHistorical ? `<aside class="notice"><strong>Historical snapshot</strong><span>This conclusion is preserved as written. <a href="${recordUrl(record.id)}">Open the current assessment.</a></span></aside>` : ''}
    <header class="record-hero">
      <div class="card-topline">${statusPill(revision.status)}${pill(record.kind)}${pill(`${revision.confidence} confidence`)}</div>
      <h2>${escapeHtml(record.title)}</h2>
      <p class="summary">${escapeHtml(record.summary)}</p>
      <div class="tag-row">${tagPills(record.tags)}</div>
    </header>
    <div class="record-layout">
      ${toc}
      <div class="doc">
        <section id="evidence">
          ${sectionHeading(number('evidence'), 'Evidence')}
          <div class="evidence-quadrants">
            <article class="facts"><h2>Facts</h2>${list(revision.facts)}</article>
            <article class="inferences"><h2>Inferences</h2>${list(revision.inferences)}</article>
            <article class="unknowns"><h2>Unknowns</h2>${list(revision.unknowns)}</article>
            <article class="recommendations"><h2>Recommendations</h2>${list(revision.recommendations)}</article>
          </div>
        </section>
        ${record.lexicon?.length ? `<section id="terms">${sectionHeading(number('terms'), 'Terms in this idea')}<p>Concepts this record relies on. Board-wide vocabulary such as statuses and evidence classes lives in the <a href="${lexiconUrl()}">lexicon</a>.</p>${termList(record.lexicon, record.id)}</section>` : ''}
        ${renderSources(record, number('sources'))}
        <section id="technique">${sectionHeading(number('technique'), 'Technique in practical terms')}${fieldList(keyedFields(revision.technique))}</section>
        ${renderComparison(revision.comparisons, number('comparison'))}
        <section id="fit">${sectionHeading(number('fit'), 'Fit assessment')}${fieldList(keyedFields(fitRest))}${conclusion ? `<div class="conclusion"><strong>Conclusion</strong>${escapeHtml(conclusion)}</div>` : ''}</section>
        ${renderExperiment(revision.experiment, number('experiment'))}
        <section id="timeline">${sectionHeading(number('timeline'), 'Evidence timeline')}${fieldList([['Source publication dates', record.sources.map((source) => `${source.title}: ${source.publishedAt}`)], ['Source provided', revision.sourceProvidedAt], ['Assessment', revision.assessedAt], ['Workspace inspected', revision.projectBaseline.inspectedAt], ['Committed baseline', `${revision.projectBaseline.commit} · ${revision.projectBaseline.committedAt}`], ['Uncommitted work present', revision.projectBaseline.dirty ? revision.projectBaseline.dirtyNote : 'No']])}</section>
        <section id="history">${sectionHeading(number('history'), 'Assessment history')}<ol class="timeline">${timeline}</ol></section>
        <section id="related">${sectionHeading(number('related'), 'Related ideas')}${related}</section>
      </div>
      <aside class="meta-rail" aria-label="Record metadata">
        ${fieldList([['Problem', record.problem], ['Record ID', record.id], ['Revision', revision.id], ['Source provided', revision.sourceProvidedAt], ['Assessed', revision.assessedAt], ['Aralia baseline', revision.projectBaseline.commit.slice(0, 12)]], 'single')}
        <div>
          <span class="label">Shareable URL</span>
          <div class="share"><input id="share-url" type="text" readonly value="${escapeHtml(shareUrl)}" aria-label="Shareable URL"><button class="btn btn-sm" id="copy-share" type="button">Copy</button></div>
        </div>
        <div>
          <span class="label">Prompts for this idea</span>
          <ul class="rail-prompts">${RECORD_PROMPT_IDS.map((id) => BOARD_PROMPTS.find((prompt) => prompt.id === id)).filter(Boolean).map((prompt) => `<li><a href="${promptsUrl(prompt.id, record.id)}">${escapeHtml(prompt.title)}</a></li>`).join('')}</ul>
        </div>
      </aside>
    </div>`, record.title, 'record');

  connectJumpNavigation('.toc');

  // Copying a link is a clipboard-only convenience; it never touches record data.
  document.querySelector('#copy-share')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    try {
      await navigator.clipboard.writeText(shareUrl);
      button.textContent = 'Copied';
    } catch {
      document.querySelector('#share-url')?.select();
      button.textContent = 'Select';
    }
    setTimeout(() => { button.textContent = 'Copy'; }, 1600);
  });
}

// ============================================================================
// Route And Data Boot
// ============================================================================
// Routing is rerun on hash changes, while the dataset is fetched once. A clear
// error state avoids presenting a blank dashboard as an empty evidence set.
// ============================================================================

function route() {
  const parsed = parseIdeaRoute(location.hash);
  // A hash change that arrives while the dataset is still loading waits for boot to route.
  if (!state.data && parsed.view !== 'remember' && parsed.view !== 'prompts') return;
  // Each hash route is a new page, so it starts at the top like a normal navigation.
  window.scrollTo(0, 0);
  if (parsed.view === 'remember') {
    shell('<div id="remember-root"></div>', 'Remember', 'remember');
    return mountRemember(document.querySelector('#remember-root'));
  }
  if (parsed.view === 'index') return renderIndex();
  if (parsed.view === 'guide') return renderGuide();
  if (parsed.view === 'lexicon') return renderLexicon(parsed.term);
  if (parsed.view === 'prompts') return renderPrompts(parsed.prompt);

  const record = state.data.records.find((item) => item.id === parsed.recordId);
  if (!record) {
    shell(`<section class="empty-state"><h2>Idea record not found</h2><p>No record uses the stable identifier ${escapeHtml(parsed.recordId)}.</p><a href="#/">Return to the index</a></section>`, 'Idea Board', 'record');
    return;
  }

  renderRecord(record, parsed.view === 'revision' ? parsed.revisionId : '');
}

async function boot() {
  // Personal capture still works when the independent research dataset is offline.
  window.addEventListener('hashchange', route);
  try {
    const planResponse = await fetch('../planmap/topics.json', { cache: 'no-store' });
    if (!planResponse.ok) throw new Error('Could not load Planmap categories.');
    configurePlanmap(await planResponse.json());
    const response = await fetch('./records.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Dataset request failed with ${response.status}.`);
    state.data = await response.json();
    route();
  } catch (error) {
    state.data = { records: [], excludedSources: [] };
    if (['remember', 'prompts'].includes(parseIdeaRoute(location.hash).view)) return route();
    shell(`<section class="empty-state error"><h2>Idea Board unavailable</h2><p>${escapeHtml(error.message)}</p></section>`);
  }
}

boot();
