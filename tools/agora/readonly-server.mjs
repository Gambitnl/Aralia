// tools/agora/readonly-server.mjs
// The read-only surface, on port 4321 (D-Y). Start it:
//
//   node tools/agora/readonly-server.mjs
//   node tools/agora/readonly-server.mjs --port 4321 --dir .agent/agora
//
// It answers:
//   GET /            the aging view as a page
//   GET /health      whether it can read the record, and how stale that is
//   GET /aging       every item, grouped active | quiet | unknown
//   GET /campaigns   /tasks   /seats
//   GET /campaigns/:id/triage   the triage report (design §10, D-A), from the snapshot
//
// WHAT MAKES IT READ-ONLY, structurally rather than by convention (D-V).
//
// 1. It imports ONE module, `readonly-store.mjs`, which holds no write call.
//    It imports no route file and never `createStore`, so the write path is
//    absent from this process rather than present and unused.
// 2. It answers GET and HEAD. Every other method is refused with 405 by a
//    single gate at the top, so a new route cannot accidentally accept a POST.
// 3. `readonly.test.mjs` proves both by reading the source, so the guarantee
//    is checked on every run instead of trusted.
//
// IT DOES NOT NEED THE DAEMON. It reads the snapshot off disk. A triage view
// is wanted most when something has gone wrong, which is exactly when the
// daemon may be the thing that is wrong.

import http from 'node:http';
import path from 'node:path';
import { openReadOnly, BOOKKEEPING_ACTIONS } from './readonly-store.mjs';

export const READONLY_PORT = 4321;

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ago(ms, now) {
  if (!ms) return 'never';
  const d = (now - ms) / 86400000;
  if (d < 1) return `${Math.max(1, Math.round(d * 24))}h ago`;
  return `${d.toFixed(1)}d ago`;
}

/** The page. One color per state, and `unknown` is a state you can see. */
function agingPage(view, src, now) {
  const row = (r) => `<tr class="${esc(r.aging.state)}">
    <td class="k">${esc(r.kind)}</td>
    <td class="id">${esc(r.id)}</td>
    <td>${esc(r.label)}</td>
    <td class="st">${esc(r.state)}</td>
    <td class="last${BOOKKEEPING_ACTIONS.includes(r.last.action) ? ' admin' : ''}">${esc(r.last.action || '—')} · ${esc(ago(r.last.at, now))}</td>
    <td class="why">${esc(r.aging.why)}</td>
  </tr>`;

  const group = (name, rows) => `<h2 class="${name}">${name} <span>${rows.length}</span></h2>
    ${rows.length ? `<table><thead><tr><th>kind</th><th>id</th><th>what</th><th>state</th><th>last touch, of any kind</th><th>why this verdict</th></tr></thead>
    <tbody>${rows.map(row).join('')}</tbody></table>` : '<p class="none">nothing here</p>'}`;

  const stale = src.behindByEvents > 0;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agora — what has gone quiet</title>
<style>
  :root { color-scheme: light dark; --ink:#1d1b17; --dim:#857e74; --line:#ddd6ca; --card:#fff; --ground:#f6f4f0;
          --quiet:#b45309; --active:#2f6d46; --unknown:#6d28d9; }
  @media (prefers-color-scheme: dark) { :root { --ink:#ece8e1; --dim:#7d776e; --line:#2e333c; --card:#1b1e25; --ground:#14161b;
          --quiet:#f0a24a; --active:#6cc48c; --unknown:#a78bfa; } }
  body { margin:0; background:var(--ground); color:var(--ink); font:14px/1.5 system-ui, sans-serif; padding:1.5rem; }
  h1 { font-size:1.3rem; margin:0 0 .2rem; }
  .sub { color:var(--dim); margin:0 0 1rem; max-width:70ch; }
  .src { border:1px solid var(--line); border-left:3px solid ${stale ? 'var(--quiet)' : 'var(--active)'};
         background:var(--card); border-radius:4px; padding:.6rem .8rem; margin-bottom:1.2rem; font-size:.85rem; }
  .src b { font-family:ui-monospace, monospace; }
  h2 { font-size:.8rem; text-transform:uppercase; letter-spacing:.12em; margin:1.6rem 0 .4rem; }
  h2.quiet { color:var(--quiet); } h2.active { color:var(--active); } h2.unknown { color:var(--unknown); }
  h2 span { color:var(--dim); }
  table { width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--line); border-radius:4px; }
  th { text-align:left; font-size:.62rem; text-transform:uppercase; letter-spacing:.1em; color:var(--dim);
       padding:.35rem .5rem; border-bottom:1px solid var(--line); }
  td { padding:.3rem .5rem; border-bottom:1px solid var(--line); vertical-align:top; }
  tr:last-child td { border-bottom:none; }
  .k, .id, .st, .last { font-family:ui-monospace, monospace; font-size:.76rem; white-space:nowrap; }
  .id { color:var(--dim); } .why { color:var(--dim); font-size:.8rem; }
  .last.admin { color:var(--dim); font-style:italic; }
  code { font-family:ui-monospace, monospace; font-size:.9em; }
  .none { color:var(--dim); font-style:italic; }
  .rule { color:var(--dim); font-size:.8rem; margin:.2rem 0 0; }
</style></head><body>
<h1>What has gone quiet</h1>
<p class="sub">Every item is judged against its OWN rhythm, not a fixed number of days. An item with fewer than three recorded gaps is not judged at all, and says so — treating "I do not know" as "fine" is the blind spot this page exists to remove.</p>
<p class="sub"><b>A row can say "touched an hour ago" and "silent for days" at the same time.</b> That is not a contradiction. Record maintenance —
${BOOKKEEPING_ACTIONS.map((a) => `<code>${esc(a)}</code>`).join(', ')} — is done TO the record, not to the job, so it does not count as activity. A maintenance sweep touches every row at once; if it counted, this page would report all clear on the day it stopped being able to see anything. Those touches are shown in gray, so you can tell them apart.</p>
<p class="sub">Finished work is left out rather than reported as quiet. A done task that has been silent for a fortnight is behaving correctly.</p>
<div class="src">
  ${src.ok ? '' : `<div><b>CANNOT READ THE RECORD:</b> ${esc(src.error)}</div>`}
  <div>snapshot <b>#${src.snapshotSeq}</b>, written ${esc(ago(src.snapshotWrittenAt, now))}</div>
  <div>${stale
    ? `<b>${src.behindByEvents} newer event(s) could NOT be applied and are NOT shown.</b> Everything else below includes the ${src.journalTailEvents} change(s) since the snapshot.`
    : `Includes all ${src.journalTailEvents} change(s) recorded since the snapshot.`}</div>
  <div class="rule">read at ${esc(new Date(now).toISOString())} · this surface never writes · ${view.counts.settledNotShown} finished item(s) not shown</div>
</div>
${group('quiet', view.groups.quiet)}
${group('unknown', view.groups.unknown)}
${group('active', view.groups.active)}
</body></html>`;
}

export function createReadOnlyServer({ dir, now = Date.now, workspaceRoot, presenceDropMs } = {}) {
  const resolved = dir || path.join(process.cwd(), '.agent', 'agora');

  const server = http.createServer((req, res) => {
    // ONE GATE, at the top. A route added later cannot accept a write by
    // forgetting to check, because the check is not per-route.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'content-type': 'application/json', allow: 'GET, HEAD' });
      res.end(JSON.stringify({
        error: 'this surface is read-only',
        detail: 'No write route exists here. Use the daemon on 4319 to change anything.',
      }));
      return;
    }

    // Opened per request, so the page never serves a stale copy of a file that
    // has since changed. The record is small enough that this is cheap, and a
    // cached reader would reintroduce the staleness this page reports on.
    const store = openReadOnly({ dir: resolved, now, ...(workspaceRoot ? { workspaceRoot } : {}), ...(presenceDropMs ? { presenceDropMs } : {}) });
    const src = store.source();
    const at = now();
    const url = new URL(req.url, 'http://localhost');

    const json = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body, null, 2));
    };

    if (url.pathname === '/health') {
      // A surface that cannot read the record must say so with a failing code.
      // 200 with an error inside it is how a monitor learns to ignore a page.
      return json(src.ok ? 200 : 503, { ok: src.ok, readOnly: true, port: READONLY_PORT, source: src });
    }
    if (url.pathname === '/aging') return json(200, { source: src, ...store.aging() });
    if (url.pathname === '/campaigns') return json(200, { source: src, campaigns: store.campaigns() });
    if (url.pathname === '/tasks') return json(200, { source: src, tasks: store.tasks() });
    if (url.pathname === '/seats') return json(200, { source: src, seats: store.seats() });
    // D-A: the triage report lives on the surface that cannot write.
    const triage = /^\/campaigns\/([^/]+)\/triage$/.exec(url.pathname);
    if (triage) {
      const report = store.triageReport(decodeURIComponent(triage[1]));
      return json(report.ok ? 200 : 404, report);
    }
    if (url.pathname === '/') {
      const html = agingPage(store.aging(), src, at);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(req.method === 'HEAD' ? '' : html);
      return;
    }
    return json(404, { error: 'no such view', views: ['/', '/health', '/aging', '/campaigns', '/tasks', '/seats', '/campaigns/:id/triage'] });
  });

  return server;
}

const isMain = process.argv[1] && process.argv[1].endsWith('readonly-server.mjs');
if (isMain) {
  const port = Number(arg('--port', String(READONLY_PORT)));
  const dir = arg('--dir', path.join(process.cwd(), '.agent', 'agora'));
  const server = createReadOnlyServer({ dir });
  server.listen(port, () => {
    process.stdout.write(`Agora read-only surface on http://localhost:${port}  (reading ${dir})\n`);
    process.stdout.write('It writes nothing. Stop it with Ctrl+C.\n');
  });
}
