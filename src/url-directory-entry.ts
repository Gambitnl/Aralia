/**
 * URL Directory — a dev-hub tool that surfaces every reachable URL in the app.
 *
 * Two URL layers, derived so this page never drifts:
 *  1. In-app routes (`?phase=<slug>` + special flags) — from src/routes.ts.
 *  2. Standalone pages (separate *.html documents) — from import.meta.glob over
 *     misc/ and devtools/roadmap/.
 *
 * Both of those are resolved at Vite TRANSFORM time, so the first paint is
 * instant but can't see a file added seconds ago. The "Rescan" button fixes
 * that: it hits /api/dev/url-inventory (a real filesystem scan on the dev
 * server) and reconciles, highlighting anything added/removed since page load.
 * When that endpoint is unavailable (e.g. a static production build) the page
 * silently keeps the build-time list.
 *
 * Logic only — the host is misc/url_directory.html.
 */

import { GamePhase } from './types';
import { getPhaseSlug, PHASE_SLUG_OVERRIDES } from './routes';

const BASE = import.meta.env.BASE_URL; // '/Aralia/'

type LinkRow = { label: string; url: string; note?: string; tag?: string };
type Groups = {
  rootApp: LinkRow[];
  phaseRoutes: LinkRow[];
  flagRoutes: LinkRow[];
  miscPages: LinkRow[];
  roadmapPages: LinkRow[];
};

// ── Build-time groups (instant first paint + offline fallback) ──────────────
function staticGroups(): Groups {
  const overrideSlugs = new Set(Object.values(PHASE_SLUG_OVERRIDES));
  const phaseValues = Object.values(GamePhase).filter((v): v is GamePhase => typeof v === 'number');

  const phaseRoutes: LinkRow[] = phaseValues.map((phase) => {
    const slug = getPhaseSlug(phase);
    return {
      label: GamePhase[phase],
      url: `${BASE}?phase=${slug}`,
      note: `?phase=${slug}`,
      tag: overrideSlugs.has(slug) ? 'clean slug' : phase === GamePhase.NOT_FOUND ? '404' : undefined,
    };
  });

  const toPages = (glob: Record<string, unknown>, tag: string): LinkRow[] =>
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

  return {
    rootApp: [{ label: 'Main Game', url: BASE, note: '/', tag: 'app' }],
    phaseRoutes,
    flagRoutes: [
      { label: 'World Map / World Generation', url: `${BASE}?worldmap=1`, note: '?worldmap=1  (alias: ?view=worldgen)', tag: 'flag' },
    ],
    miscPages: toPages(import.meta.glob('/misc/*.html'), 'misc'),
    roadmapPages: toPages(import.meta.glob('/devtools/roadmap/*.html'), 'roadmap'),
  };
}

// ── Map the server scan payload into the same Groups shape ──────────────────
function serverGroups(data: any): Groups {
  const page = (p: any, tag: string): LinkRow => ({ label: p.label, url: p.url, note: '/' + p.file, tag });
  return {
    rootApp: (data.rootApp ?? []).map((r: any) => ({ label: r.label, url: r.url, note: '/', tag: 'app' })),
    phaseRoutes: (data.phaseRoutes ?? []).map((r: any) => ({
      label: r.label,
      url: r.url,
      note: `?phase=${r.slug}`,
      tag: r.clean ? 'clean slug' : r.label === 'NOT_FOUND' ? '404' : undefined,
    })),
    flagRoutes: (data.flags ?? []).map((f: any) => ({ label: f.label, url: f.url, note: f.note, tag: 'flag' })),
    miscPages: (data.miscPages ?? []).map((p: any) => page(p, 'misc')),
    roadmapPages: (data.roadmapPages ?? []).map((p: any) => page(p, 'roadmap')),
  };
}

const flatUrls = (g: Groups): Set<string> =>
  new Set([...g.rootApp, ...g.phaseRoutes, ...g.flagRoutes, ...g.miscPages, ...g.roadmapPages].map((r) => r.url));

// ── Render ──────────────────────────────────────────────────────────────────
const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function renderRow(r: LinkRow, isNew: boolean): string {
  return `
    <div class="urld-row${isNew ? ' urld-row--new' : ''}">
      <a class="urld-link" href="${esc(r.url)}">${esc(r.label)}</a>
      ${isNew ? '<span class="urld-tag urld-tag--new">new</span>' : ''}
      ${r.tag ? `<span class="urld-tag urld-tag--${esc(r.tag.replace(/\s+/g, '-'))}">${esc(r.tag)}</span>` : ''}
      <code class="urld-path">${esc(r.note ?? r.url)}</code>
      <button class="urld-copy" data-url="${esc(r.url)}">Copy</button>
    </div>`;
}

function renderSection(title: string, subtitle: string, rows: LinkRow[], baseline: Set<string> | null): string {
  if (!rows.length) return '';
  return `
    <section class="urld-section">
      <h2>${esc(title)} <span class="urld-count">${rows.length}</span></h2>
      <p class="urld-sub">${esc(subtitle)}</p>
      <div class="urld-rows">${rows.map((r) => renderRow(r, baseline ? !baseline.has(r.url) : false)).join('')}</div>
    </section>`;
}

const SECTION_META: Array<[keyof Groups, string, string]> = [
  ['rootApp', 'Main App', 'The root SPA entry (index.html).'],
  ['phaseRoutes', 'In-App Routes', 'Navigation inside the main app via the ?phase= query param. Reachable only once app state allows (e.g. PLAYING needs a party).'],
  ['flagRoutes', 'Deep-Link Flags', 'Standalone query flags handled outside the phase system.'],
  ['miscPages', 'Standalone Pages — misc/', 'Separate HTML tools registered in vite.config.ts (build) and served from misc/ (dev).'],
  ['roadmapPages', 'Standalone Pages — devtools/roadmap/', 'Roadmap tooling pages (roadmap build mode).'],
];

const root = document.getElementById('urld-root')!;

// Baseline of "already seen" URLs, persisted for the browser session so the
// added/removed diff survives Vite's HMR full-reloads (adding a globbed *.html
// reloads the page). Without persistence the diff would reset on every reload
// and never show anything. Cleared when the tab closes, or via "mark seen".
const BASELINE_KEY = 'urld-baseline-v1';
const loadBaseline = (): Set<string> | null => {
  try {
    const raw = sessionStorage.getItem(BASELINE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
};
const saveBaseline = (urls: Set<string>): void => {
  try {
    sessionStorage.setItem(BASELINE_KEY, JSON.stringify([...urls]));
  } catch {
    /* sessionStorage unavailable — diff just won't persist */
  }
};
let baselineUrls: Set<string> | null = loadBaseline();

function renderSections(groups: Groups, removed: string[]): void {
  const container = document.getElementById('urld-sections')!;
  let html = SECTION_META.map(([key, title, sub]) => renderSection(title, sub, groups[key], baselineUrls)).join('');
  if (removed.length) {
    html += `
      <section class="urld-section urld-section--removed">
        <h2>Removed since page load <span class="urld-count">${removed.length}</span></h2>
        <p class="urld-sub">These URLs were present when the page loaded but are gone from the latest scan.</p>
        <div class="urld-rows">${removed
          .map((u) => `<div class="urld-row urld-row--removed"><span class="urld-link">${esc(u)}</span><span class="urld-tag urld-tag--removed">removed</span></div>`)
          .join('')}</div>
      </section>`;
  }
  container.innerHTML = html;
  applyFilter();
}

function setStatus(text: string, kind: 'idle' | 'ok' | 'warn' | 'busy' = 'idle'): void {
  const el = document.getElementById('urld-status');
  if (el) {
    el.textContent = text;
    el.className = `urld-status urld-status--${kind}`;
  }
}

// ── Live rescan (real filesystem scan via the dev server) ───────────────────
async function rescan(): Promise<void> {
  setStatus('Scanning…', 'busy');
  try {
    // Dev-server API routes are matched at the bare /api path (no base prefix),
    // matching every other dev-hub endpoint.
    const res = await fetch('/api/dev/url-inventory', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const groups = serverGroups(data);
    lastGroups = groups;
    const latest = flatUrls(groups);
    if (!baselineUrls) {
      baselineUrls = new Set(latest); // first scan ever = baseline (no spurious "new")
      saveBaseline(baselineUrls);
    }

    const added = [...latest].filter((u) => !baselineUrls!.has(u));
    const removed = [...baselineUrls].filter((u) => !latest.has(u));
    renderSections(groups, removed);

    const total = latest.size;
    const when = new Date(data.scannedAt).toLocaleTimeString();
    const delta =
      added.length || removed.length
        ? ` · ${added.length ? `+${added.length} new` : ''}${added.length && removed.length ? ' · ' : ''}${removed.length ? `−${removed.length} removed` : ''} since load`
        : ' · no changes since load';
    setStatus(`Scanned ${total} URLs at ${when}${delta}`, added.length || removed.length ? 'warn' : 'ok');
  } catch (e) {
    // Endpoint unavailable (static build, server restarting) — keep the static list.
    setStatus(`Live rescan unavailable (${String((e as Error).message)}). Showing build-time list.`, 'warn');
  }
}

// ── Filter ───────────────────────────────────────────────────────────────────
function applyFilter(): void {
  const filter = document.getElementById('urld-filter') as HTMLInputElement | null;
  const q = (filter?.value ?? '').trim().toLowerCase();
  root.querySelectorAll<HTMLElement>('.urld-row').forEach((row) => {
    row.style.display = !q || row.textContent!.toLowerCase().includes(q) ? '' : 'none';
  });
  root.querySelectorAll<HTMLElement>('.urld-section').forEach((sec) => {
    const anyVisible = [...sec.querySelectorAll<HTMLElement>('.urld-row')].some((r) => r.style.display !== 'none');
    sec.style.display = anyVisible ? '' : 'none';
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────
root.innerHTML = `
  <header class="urld-hero">
    <a class="urld-back" href="${BASE}misc/dev_hub.html">&larr; Dev Hub</a>
    <h1>URL Directory</h1>
    <p class="urld-subtitle">
      Every reachable URL in the app. The first paint is derived at build time from
      <code>src/routes.ts</code> and a file glob; <strong>Rescan</strong> runs a live
      filesystem scan on the dev server and flags anything added or removed since load.
    </p>
    <div class="urld-toolbar">
      <input id="urld-filter" class="urld-filter" type="search" placeholder="Filter URLs…" autocomplete="off" />
      <button id="urld-rescan" class="urld-rescan" type="button">↻ Rescan</button>
      <button id="urld-markseen" class="urld-rescan" type="button" title="Reset the added/removed baseline to the current scan">✓ Mark seen</button>
      <span id="urld-status" class="urld-status urld-status--idle">Build-time list</span>
    </div>
  </header>
  <div id="urld-sections"></div>
`;

// Instant first paint from the build-time list. If a persisted baseline exists
// (a return visit this session), highlight anything new vs it; on a first-ever
// visit there's no baseline yet — it's established from the first server scan
// below, so the static (possibly stale) list never seeds false "new" flags.
const initial = staticGroups();
let lastGroups: Groups = initial;
const initialUrls = flatUrls(initial);
renderSections(initial, baselineUrls ? [...baselineUrls].filter((u) => !initialUrls.has(u)) : []);

document.getElementById('urld-rescan')!.addEventListener('click', rescan);
document.getElementById('urld-markseen')!.addEventListener('click', () => {
  baselineUrls = flatUrls(lastGroups);
  saveBaseline(baselineUrls);
  renderSections(lastGroups, []);
  setStatus('Baseline reset — all current URLs marked seen.', 'ok');
});
document.getElementById('urld-filter')!.addEventListener('input', applyFilter);

// Copy buttons (event-delegated so they survive re-renders).
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

// Auto-reconcile once on load so the page reflects disk state immediately.
void rescan();
