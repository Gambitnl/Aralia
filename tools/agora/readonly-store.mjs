// tools/agora/readonly-store.mjs
// A READER for the Agora record. It opens the snapshot and the journal tail,
// and it never writes either one.
//
// WHY THIS IS NOT `createStore`, WHICH ALREADY READS BOTH.
//
// `createStore` is the single writer. It opens the journal for append, it
// rewrites the snapshot every 200 events, and it starts a heartbeat sweep. A
// second process holding that store would be a SECOND WRITER against one
// journal, which is the exact invariant the daemon is built on. So the
// read-only surface cannot reuse it, however tempting the code reuse is.
//
// D-V asked for the write path to be ABSENT rather than unused. That is why
// this module exists: it holds no `emit`, no journal append, and no fs write
// call of any kind. `assertNoWritePath()` below proves that by reading this
// file's source, and the source of every module it imports, so the guarantee
// is checked rather than promised.
//
// WHAT IT CAN AND CANNOT SEE, stated plainly.
//
// The journal is truncated when a snapshot is taken, so the tail holds only
// the events since. Until 2026-09-13 this reader showed the snapshot alone,
// because replaying the tail needed the reducers, which lived inside the
// writer's closure, and a second copy of a reducer drifts. Stage 1 of the
// campaign trial then got a 404 for a campaign that existed only in the tail
// (WF-G168). The reducers now live in `store-reducers.mjs`, ONE copy that the
// daemon and this reader both import, and the tail is applied here in memory.
//
// So the contract is: the view includes the journal tail, any event that
// could not be applied is named, and nothing is presented as fresher than it is.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
// The same pure rules the daemon applies. That module holds no write call, and
// assertNoWritePath reads it too.
import { buildTriageReport } from './campaign-model.mjs';
// The daemon's reducers, applied here to the journal tail in memory (WF-G168).
import {
  applyJournalText,
  createEmptyState,
  createReducers,
  createStateHelpers,
  loadSnapshotInto,
} from './store-reducers.mjs';

/** How many gaps an item needs before this view will judge it at all (D-U). */
export const AGING_MIN_GAPS = 3;

/** Silence longer than this multiple of the item's OWN typical gap is quiet. */
export const AGING_QUIET_MULTIPLE = 2;

/** The three states. There is no fourth, and `unknown` is never folded into
 *  `active`: treating unknown as fine is the blind spot the view exists to
 *  remove. */
export const AGING_STATES = Object.freeze(['active', 'quiet', 'unknown']);

const DAY_MS = 86400000;

/** Say a span in a unit a person can read.
 *
 *  It printed everything in days, so a four-hour rhythm read as "0d" and the
 *  row said "9.6d silent vs 0d typical" — which states nothing.
 */
export function spanWords(ms) {
  if (!Number.isFinite(ms) || ms < 0) return 'unknown';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}min`;
  if (ms < DAY_MS) return `${(ms / 3600000).toFixed(1)}h`;
  return `${(ms / DAY_MS).toFixed(1)}d`;
}

/** Writes closer together than this are ONE action, not two.
 *
 *  This is not a staleness threshold. Nothing here decides whether an item is
 *  quiet — that stays measured against the item's own rhythm (D-U). This only
 *  answers what counts as a single event, so a creation burst or a bulk sweep
 *  cannot masquerade as a fast rhythm.
 */
export const BURST_MS = 60000;

/** Record maintenance. These are things done TO the record, not work on the
 *  job, and they are excluded from the rhythm.
 *
 *  WHY THIS LIST EXISTS. Three migrations on 2026-09-07 and 2026-09-08 wrote
 *  `membership`, `id-migrated`, `deps-typed` and `deps-renamed` onto almost
 *  every record within minutes. Counted as activity, they reset the apparent
 *  freshness of the whole board: measured before this filter, the aging view
 *  reported 0 quiet items out of 261, because everything had been touched the
 *  day before. A view that a maintenance sweep can blind is worse than no view,
 *  because it reports "all clear" precisely when it has stopped looking.
 *
 *  A job's own events — created, claimed, state, retired — stay in.
 */
export const SETTLED_TASK_STATES = Object.freeze(['done', 'retired', 'cancelled', 'reaped']);

export const BOOKKEEPING_ACTIONS = Object.freeze([
  'membership', 'id-migrated', 'deps-typed', 'deps-renamed',
]);

/** Read the snapshot. A missing or corrupt file is reported, never guessed at.
 *
 *  The daemon may be down. That is when a triage view is most wanted, so this
 *  never requires a running server (D-V).
 */
export function readSnapshot(dir) {
  const snapshotPath = path.join(dir, 'snapshot.json');
  if (!fs.existsSync(snapshotPath)) {
    return { ok: false, error: 'no snapshot file', snapshotPath, snapshot: null };
  }
  let raw;
  try {
    raw = fs.readFileSync(snapshotPath, 'utf8');
  } catch (e) {
    return { ok: false, error: `snapshot unreadable: ${e.message}`, snapshotPath, snapshot: null };
  }
  let snapshot;
  try {
    snapshot = JSON.parse(raw);
  } catch (e) {
    // A corrupt snapshot is NOT silently replaced by an empty one. An empty
    // board and an unreadable board look identical on a page, and only one of
    // them is a reason to stop trusting the page.
    return { ok: false, error: `snapshot is not valid JSON: ${e.message}`, snapshotPath, snapshot: null };
  }
  const stat = fs.statSync(snapshotPath);
  return { ok: true, error: '', snapshotPath, snapshot, writtenAt: stat.mtimeMs };
}

/** Count the journal events the snapshot does not yet include.
 *
 *  This is the honesty measure. It does not apply them.
 */
export function readJournalLag(dir, snapshotSeq) {
  const journalPath = path.join(dir, 'journal.jsonl');
  if (!fs.existsSync(journalPath)) return { events: 0, newestAt: 0, types: {} };
  let raw = '';
  try {
    raw = fs.readFileSync(journalPath, 'utf8');
  } catch {
    return { events: 0, newestAt: 0, types: {}, unreadable: true };
  }
  let events = 0;
  let newestAt = 0;
  const types = {};
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let ev;
    try {
      ev = JSON.parse(line);
    } catch {
      continue; // a torn last line from a crash mid-write
    }
    if ((ev.seq || 0) <= snapshotSeq) continue;
    events += 1;
    if (ev.ts > newestAt) newestAt = ev.ts;
    types[ev.type] = (types[ev.type] || 0) + 1;
  }
  return { events, newestAt, types };
}

/** The aging verdict for ONE item, measured against its OWN history (D-U).
 *
 *  There is no fixed number of days anywhere in here. A task touched hourly
 *  and a task touched monthly are both judged against their own rhythm, which
 *  is what Remy chose over a threshold.
 */
export function ageOf(history, now) {
  const real = (history || []).filter((h) => !BOOKKEEPING_ACTIONS.includes(String(h && h.action)));
  const stamps = real
    .map((h) => Number(h && h.at))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  const lastAt = stamps.length ? stamps[stamps.length - 1] : 0;
  const silenceMs = lastAt ? Math.max(0, now - lastAt) : 0;

  // ONE BURST IS ONE ACTION. Creating a task writes three history lines in
  // under a second, and a bulk migration writes another two seconds apart.
  // Counted as gaps, those are sub-second and sub-minute numbers, and they
  // drag the median down until ANY silence passes the multiple.
  //
  // Measured on the live record 2026-09-08, task agora-8a37:
  //   gaps: 341ms, 165ms, 14.1d, 16.5s, 1.4d   → median 16.5s
  // so a task touched two hours earlier was reported as quiet. Every one of
  // the six quietest items was an artifact of that, not a stalled job. A view
  // that shouts about everything is a view nobody reads, which is precisely
  // the failure D-U exists to prevent.
  //
  // BURST_MS is not a staleness threshold — the rule stays self-tuning, and no
  // fixed number decides quiet. It answers a different question: what counts
  // as ONE action. Writes inside a minute of each other are one.
  const collapsed = [];
  for (const at of stamps) {
    if (!collapsed.length || at - collapsed[collapsed.length - 1] > BURST_MS) collapsed.push(at);
  }

  const gaps = [];
  for (let i = 1; i < collapsed.length; i++) gaps.push(collapsed[i] - collapsed[i - 1]);

  // TOO LITTLE HISTORY IS ITS OWN ANSWER, and it says so (D-U). It is never
  // reported as quiet and never as fine.
  if (gaps.length < AGING_MIN_GAPS) {
    return {
      state: 'unknown',
      why: `not enough history yet — ${gaps.length} recorded gap(s), ${AGING_MIN_GAPS} needed`
        + (real.length < (history || []).length ? ' (record maintenance not counted)' : ''),
      gaps: gaps.length,
      lastAt,
      silenceDays: lastAt ? +(silenceMs / DAY_MS).toFixed(1) : null,
      typicalDays: null,
    };
  }

  const sorted = [...gaps].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const typicalMs = sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);

  const quiet = silenceMs > typicalMs * AGING_QUIET_MULTIPLE;
  return {
    state: quiet ? 'quiet' : 'active',
    why: quiet
      ? `silent ${spanWords(silenceMs)} against its own typical ${spanWords(typicalMs)}`
      : `last touched inside its own rhythm (${spanWords(typicalMs)})`,
    gaps: gaps.length,
    lastAt,
    silenceDays: +(silenceMs / DAY_MS).toFixed(1),
    typicalDays: +(typicalMs / DAY_MS).toFixed(1),
    silence: spanWords(silenceMs),
    typical: spanWords(typicalMs),
  };
}

/** The last thing that happened to an item, named.
 *
 *  A bulk migration touches every record at once. Without this, such a sweep
 *  would make an abandoned board look busy, so the view always says WHAT the
 *  last touch was and lets the reader judge it.
 */
export function lastAction(history) {
  const h = (history || []).filter((x) => x && Number.isFinite(Number(x.at)));
  if (!h.length) return { action: '', at: 0 };
  const newest = h.reduce((a, b) => (Number(b.at) > Number(a.at) ? b : a));
  return { action: String(newest.action || ''), at: Number(newest.at) };
}

/** Open the record for reading. Nothing here mutates anything on disk. */
export function openReadOnly({ dir, now = Date.now, workspaceRoot = process.cwd(), presenceDropMs = 3600000 } = {}) {
  if (!dir) throw new Error('openReadOnly requires a { dir }');

  const journalPath = path.join(dir, 'journal.jsonl');
  let read = readSnapshot(dir);
  // NO SNAPSHOT YET is not a broken record. A new daemon writes its first
  // snapshot only after 200 events, and until then it rebuilds itself from the
  // journal alone. This reader does the same (found by Stage 1 re-run,
  // 2026-09-13: a fresh daemon had a 12 KB journal and no snapshot file). A
  // CORRUPT snapshot is still refused, and so is a record with neither file.
  if (!read.ok && read.error === 'no snapshot file' && fs.existsSync(journalPath)) {
    read = { ok: true, error: '', snapshotPath: read.snapshotPath, snapshot: {}, writtenAt: 0, noSnapshotYet: true };
  }
  const snapshotSeq = read.ok ? (read.snapshot.lastSeq || 0) : 0;
  const lag = read.ok ? readJournalLag(dir, snapshotSeq) : { events: 0, newestAt: 0, types: {} };

  // WF-G168: the snapshot is written only every 200 events, so a record newer
  // than it was invisible here — Stage 1 of the campaign trial (design §72)
  // got a 404 for a campaign that existed only in the journal tail. The tail
  // is now applied IN MEMORY, with the daemon's own reducers from
  // store-reducers.mjs, so both processes read the record by one set of rules.
  // Nothing is written: the state lives in this function and is discarded.
  // A corrupt snapshot is still refused rather than rebuilt from the tail
  // alone, because the tail without its snapshot is a partial board.
  const state = createEmptyState();
  const reducers = createReducers(state, createStateHelpers(state));
  const notApplied = [];
  if (read.ok) {
    loadSnapshotInto(state, read.snapshot);
    let raw = '';
    try {
      raw = fs.existsSync(journalPath) ? fs.readFileSync(journalPath, 'utf8') : '';
    } catch {
      raw = '';
    }
    applyJournalText(state, reducers, raw, snapshotSeq, {
      onError: (event, error) => notApplied.push({ seq: event.seq, type: event.type, error: error.message }),
    });
  }
  const snap = {
    lastSeq: state.seq,
    campaigns: [...state.campaigns.values()],
    tasks: [...state.tasks.values()],
    seats: [...state.seats.values()],
    agents: [...state.agents.values()],
    aliases: [...state.aliases.entries()],
  };

  function source() {
    const notAppliedTypes = {};
    for (const n of notApplied) notAppliedTypes[n.type] = (notAppliedTypes[n.type] || 0) + 1;
    return {
      ok: read.ok,
      error: read.error,
      snapshotPath: read.snapshotPath,
      snapshotSeq,
      snapshotWrittenAt: read.writtenAt || 0,
      noSnapshotYet: Boolean(read.noSnapshotYet),
      // The journal events newer than the snapshot, applied in memory.
      journalTailEvents: lag.events,
      recordSeq: state.seq,
      // THE LAG, ALWAYS. What is still NOT shown is the events that could not
      // be applied. A view that hides its own staleness is worse than no view:
      // it converts "I do not know" into "nothing is wrong".
      behindByEvents: notApplied.length,
      behindByTypes: notAppliedTypes,
      notApplied,
      newestJournalAt: lag.newestAt,
      readAt: now(),
    };
  }

  function campaigns() {
    return (snap.campaigns || []).map((c) => ({
      id: c.id,
      name: c.name || '',
      scope: c.scope || '',
      state: c.state || '',
      closedReason: c.closedReason || '',
      seatId: c.seatId || '',
      createdAt: c.createdAt || 0,
      updatedAt: c.updatedAt || 0,
      historyLength: (c.history || []).length,
      last: lastAction(c.history),
      aging: ageOf(c.history, now()),
    }));
  }

  function tasks() {
    return (snap.tasks || []).map((t) => ({
      id: t.id,
      title: t.title || '',
      state: t.state || '',
      campaignId: t.campaignId || '',
      membership: t.membership || '',
      category: t.category || '',
      createdAt: t.createdAt || 0,
      updatedAt: t.updatedAt || 0,
      historyLength: (t.history || []).length,
      last: lastAction(t.history),
      aging: ageOf(t.history, now()),
    }));
  }

  function seats() {
    return (snap.seats || []).map((s) => ({
      id: s.id,
      name: s.name || '',
      note: s.note || '',
      // The store names this field `holder`. Reading `heldBy` showed every seat
      // as unheld (found 2026-09-13, while adding the triage report).
      heldBy: s.holder || '',
      createdAt: s.createdAt || 0,
      updatedAt: s.updatedAt || 0,
    }));
  }

  /** The aging view: everything that can still move, grouped by three states.
   *
   *  A FINISHED ITEM IS NOT STALLED, so it is left out rather than reported as
   *  quiet. Measured 2026-09-08, before this: 11 of the 13 quiet rows were
   *  tasks already marked done, and a done task that has been silent for two
   *  weeks is behaving correctly. Leaving them in buries the one row that
   *  matters — a BLOCKED job, silent 11.5 days against its own 0.4-day rhythm.
   *  The count of what was left out is reported, so nothing vanishes quietly.
   */
  function aging() {
    const openCampaigns = campaigns().filter(
      (c) => !c.closedReason && !SETTLED_TASK_STATES.includes(String(c.state)),
    );
    const openTasks = tasks().filter((t) => !SETTLED_TASK_STATES.includes(String(t.state)));
    const settledOut = (campaigns().length - openCampaigns.length) + (tasks().length - openTasks.length);
    const rows = [
      ...openCampaigns.map((c) => ({ kind: 'campaign', id: c.id, label: c.name || c.scope.slice(0, 70), state: c.state, aging: c.aging, last: c.last })),
      ...openTasks.map((t) => ({ kind: 'task', id: t.id, label: t.title.slice(0, 70), state: t.state, aging: t.aging, last: t.last })),
    ];
    const by = { active: [], quiet: [], unknown: [] };
    for (const r of rows) by[r.aging.state].push(r);
    // The quietest first: the whole point is to surface what nothing else does.
    by.quiet.sort((a, b) => (b.aging.silenceDays || 0) - (a.aging.silenceDays || 0));
    return {
      counts: {
        active: by.active.length, quiet: by.quiet.length, unknown: by.unknown.length,
        total: rows.length,
        // Finished work, left out on purpose. Named so it is not a silent drop.
        settledNotShown: settledOut,
      },
      rule: `an item is quiet when its silence passes ${AGING_QUIET_MULTIPLE}x its own typical gap; under ${AGING_MIN_GAPS} gaps it is not judged`,
      notCountedAsActivity: BOOKKEEPING_ACTIONS,
      groups: by,
    };
  }

  /** Design §10 step 2 and D-A: the triage report, built from the snapshot by
   *  the same rules the daemon uses. It reads topics.json; it writes nothing.
   *  Liveness is judged the daemon's way — an agent is gone once its last
   *  sighting is older than the drop horizon — but as of the snapshot, and the
   *  source block says how far behind that is. */
  function triageReport(campaignId) {
    const aliases = new Map(snap.aliases || []);
    let id = campaignId;
    const seenIds = new Set();
    while (aliases.has(id) && !seenIds.has(id)) { seenIds.add(id); id = aliases.get(id); }
    const campaign = (snap.campaigns || []).find((c) => c.id === id);
    if (!campaign) return { ok: false, error: 'campaign not found' };
    let topics = null;
    try {
      topics = JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'public', 'planmap', 'topics.json'), 'utf8'));
    } catch { topics = null; }
    const at = now();
    const agents = new Map((snap.agents || []).map((a) => [a.id, a]));
    const isAgentLive = (agentId) => {
      const a = agents.get(agentId);
      return Boolean(a && at - (a.lastSeen || 0) <= presenceDropMs);
    };
    const seat = campaign.seatId ? (snap.seats || []).find((x) => x.id === campaign.seatId) : null;
    return {
      ...buildTriageReport({
        campaign,
        tasks: (snap.tasks || []).filter((t) => t.campaignId === campaign.id),
        topics,
        isAgentLive,
        attended: Boolean(seat && seat.holder && isAgentLive(seat.holder)),
        generatedAt: at,
      }),
      source: source(),
    };
  }

  return { source, campaigns, tasks, seats, aging, triageReport };
}

/** Prove the write path is ABSENT, by reading this module's own source.
 *
 *  D-V asked for a structural guarantee, not a convention. A promise in a
 *  comment is a convention. This is the check, and the test calls it.
 */
export function assertNoWritePath(files) {
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const targets = files || [
    path.join(here, 'readonly-store.mjs'),
    path.join(here, 'readonly-server.mjs'),
    // Imported by the reader since the triage report (design §72), so they are
    // part of what must hold no write call.
    path.join(here, 'campaign-model.mjs'),
    path.join(here, 'store-reducers.mjs'),
    path.join(here, 'planmap-reconcile-lib.mjs'),
  ];
  // EVERY TERM IS SPLIT IN TWO. The check reads this file among its targets,
  // so a whole "writeFileSync" written here would make the guard fail on its
  // own list — and a guard that always fails gets deleted rather than obeyed.
  // The halves are joined at run time, so the check is exact and this file
  // still contains no forbidden word.
  const banned = [
    ['write', 'FileSync'],
    ['append', 'FileSync'],
    ['create', 'WriteStream'],
    ['rm', 'Sync'],
    ['unlink', 'Sync'],
    ['mkdir', 'Sync'],
    ['rename', 'Sync'],
    ['write', 'File('],
    ['append', 'File('],
    // The writer's own vocabulary. If any of it appears here, this file has
    // stopped being a reader.
    ['create', 'Store'],
    ['emit', '('],
  ].map(([a, b]) => a + b);
  const found = [];
  for (const file of targets) {
    if (!fs.existsSync(file)) { found.push({ file, term: 'MISSING FILE' }); continue; }
    const src = fs.readFileSync(file, 'utf8');
    // Read the CODE, not the prose: a comment explaining why `createStore` is
    // absent must not itself trip the check.
    const code = src
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n');
    for (const term of banned) {
      if (code.includes(term)) found.push({ file: path.basename(file), term });
    }
  }
  return { ok: found.length === 0, found };
}
