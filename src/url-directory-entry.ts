/**
 * URL Directory — a dev-hub tool that surfaces every reachable URL in the app.
 *
 * Two URL layers, derived live so this page never drifts:
 *  1. In-app routes (`?phase=<slug>` + special flags) — read from src/routes.ts,
 *     so any phase added to GamePhase / PHASE_SLUG_OVERRIDES shows up here.
 *  2. Standalone pages (the separate *.html documents) — enumerated with
 *     import.meta.glob over misc/ and devtools/roadmap/, so adding/removing an
 *     HTML file updates this list automatically.
 *
 * Logic only — the host is misc/url_directory.html.
 */

import { GamePhase } from './types';
import { getPhaseSlug, PHASE_SLUG_OVERRIDES, isWorldGenDeepLink } from './routes';

const BASE = import.meta.env.BASE_URL; // '/Aralia/'

type LinkRow = { label: string; url: string; note?: string; tag?: string };

// ── 1. In-app phase routes ──────────────────────────────────────────────────
const phaseValues = Object.values(GamePhase).filter((v): v is GamePhase => typeof v === 'number');
const overrideSlugs = new Set(Object.values(PHASE_SLUG_OVERRIDES));

const phaseRoutes: LinkRow[] = phaseValues.map((phase) => {
  const slug = getPhaseSlug(phase);
  const isClean = overrideSlugs.has(slug);
  return {
    label: GamePhase[phase],
    url: `${BASE}?phase=${slug}`,
    tag: isClean ? 'clean slug' : phase === GamePhase.NOT_FOUND ? '404 route' : undefined,
    note: `?phase=${slug}`,
  };
});

// ── 2. Special deep-link flags (handled outside the phase system) ───────────
const flagRoutes: LinkRow[] = [
  {
    label: 'World Map / World Generation',
    url: `${BASE}?worldmap=1`,
    note: '?worldmap=1  (alias: ?view=worldgen)',
    tag: 'flag',
  },
];

// ── 3. Standalone pages (separate .html documents) ──────────────────────────
// Keys are repo-root-relative paths like '/misc/dev_hub.html'. We only need the
// keys, so the glob loaders are never invoked (nothing is bundled).
const toRows = (glob: Record<string, unknown>, tag: string): LinkRow[] =>
  Object.keys(glob)
    .sort()
    .map((p) => {
      const file = p.replace(/^\//, '');
      return {
        label: file.split('/').pop()!.replace(/\.html$/, '').replace(/[_-]/g, ' '),
        url: BASE + file,
        note: '/' + file,
        tag,
      };
    });

const miscPages = toRows(import.meta.glob('/misc/*.html'), 'misc');
const roadmapPages = toRows(import.meta.glob('/devtools/roadmap/*.html'), 'roadmap');
const rootApp: LinkRow[] = [{ label: 'Main Game', url: BASE, note: '/', tag: 'app' }];

// ── Render ──────────────────────────────────────────────────────────────────
const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function renderRows(rows: LinkRow[]): string {
  return rows
    .map(
      (r) => `
      <div class="urld-row">
        <a class="urld-link" href="${esc(r.url)}">${esc(r.label)}</a>
        ${r.tag ? `<span class="urld-tag urld-tag--${esc(r.tag)}">${esc(r.tag)}</span>` : ''}
        <code class="urld-path">${esc(r.note ?? r.url)}</code>
        <button class="urld-copy" data-url="${esc(r.url)}">Copy</button>
      </div>`,
    )
    .join('');
}

function renderSection(title: string, subtitle: string, rows: LinkRow[]): string {
  return `
    <section class="urld-section">
      <h2>${esc(title)} <span class="urld-count">${rows.length}</span></h2>
      <p class="urld-sub">${esc(subtitle)}</p>
      <div class="urld-rows">${renderRows(rows)}</div>
    </section>`;
}

const root = document.getElementById('urld-root');
if (root) {
  root.innerHTML = `
    <header class="urld-hero">
      <a class="urld-back" href="${BASE}misc/dev_hub.html">&larr; Dev Hub</a>
      <h1>URL Directory</h1>
      <p class="urld-subtitle">
        Every reachable URL in the app, derived live. In-app routes come from
        <code>src/routes.ts</code>; standalone pages are globbed from disk — neither
        list is hand-maintained, so this stays accurate as routes and pages change.
      </p>
      <input id="urld-filter" class="urld-filter" type="search" placeholder="Filter URLs…" autocomplete="off" />
    </header>
    ${renderSection('Main App', 'The root SPA entry (index.html).', rootApp)}
    ${renderSection('In-App Routes', 'Navigation inside the main app via the ?phase= query param. Reachable only once the app state allows (e.g. PLAYING needs a party).', phaseRoutes)}
    ${renderSection('Deep-Link Flags', 'Standalone query flags handled outside the phase system.', flagRoutes)}
    ${renderSection('Standalone Pages — misc/', 'Separate HTML tools registered in vite.config.ts (build) and served from misc/ (dev).', miscPages)}
    ${renderSection('Standalone Pages — devtools/roadmap/', 'Roadmap tooling pages (roadmap build mode).', roadmapPages)}
  `;

  // Copy buttons → absolute URL on the clipboard.
  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.urld-copy');
    if (!btn) return;
    const abs = new URL(btn.dataset.url!, window.location.origin).href;
    navigator.clipboard?.writeText(abs).then(() => {
      const prev = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => (btn.textContent = prev), 1200);
    });
  });

  // Live filter across label + path.
  const filter = document.getElementById('urld-filter') as HTMLInputElement | null;
  filter?.addEventListener('input', () => {
    const q = filter.value.trim().toLowerCase();
    root.querySelectorAll<HTMLElement>('.urld-row').forEach((row) => {
      row.style.display = !q || row.textContent!.toLowerCase().includes(q) ? '' : 'none';
    });
    root.querySelectorAll<HTMLElement>('.urld-section').forEach((sec) => {
      const anyVisible = [...sec.querySelectorAll<HTMLElement>('.urld-row')].some((r) => r.style.display !== 'none');
      sec.style.display = anyVisible ? '' : 'none';
    });
  });
}
