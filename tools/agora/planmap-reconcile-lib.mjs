/**
 * planmap-reconcile-lib.mjs — pure board→plan-map reconcile logic, extracted
 * from planmap-reconcile.mjs so other tools (sync-surfaces.mjs) can import it
 * without spawning a child process. No I/O here: caller supplies the parsed
 * topics.json `data` and the Agora task list.
 */

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
// SHARED SCHEME with planmap-to-wave.mjs (must stay identical or the truth-loop
// breaks): slugs are computed over the FULL features array (done included, so
// indices never shift), and duplicate base slugs get -2, -3... by occurrence order.
export const featureSlugs = (features) => {
  const counts = new Map();
  return features.map((f) => {
    const base = slug(f.title);
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
};
const RANK = { parked: 0, specced: 1, active: 2, done: 3 };

/**
 * Reconcile Agora board evidence onto plan-map statuses. Mutates `data` in
 * place (upgrade-only per RANK; never downgrades). Rules match the CLI docs:
 *   - task done  → feature status "done", EXCEPT (WF-G150):
 *       a task closed by triage (it carries closedReason) is no evidence, and
 *       a feature that a not-yet-done chartered campaign names as its primary
 *       is capped at "active"
 *   - any task claimed/in-flight on a feature → feature at least "active"
 *   - all features of a topic done → topic "done" (else if any active → "active")
 *
 * @param {{topics?: Array}} data  parsed public/planmap/topics.json
 * @param {Array<{state?: string, refs?: string[], closedReason?: string}>} tasks  Agora /tasks list
 * @param {{campaigns?: Array<{id: string, state?: string, charter?: {body?: {planMapPrimary?: string}}}>}} [opts]
 *   Agora /campaigns list. WF-G150: a feature that a chartered campaign names as
 *   its PRIMARY reference may not read done before that campaign is done.
 * @returns {{changes: string[], disconnected: {id: string, status: string}[], evidence: number, held: string[]}}
 *   held — feature keys whose done evidence was capped at active, and why.
 *   changes — human-readable change lines (same text the CLI prints);
 *   disconnected — specced/active topics with ZERO board refs (reconcile can
 *     never update them, so their status can only rot);
 *   evidence — count of distinct topic/feature keys with actionable board
 *     evidence (0 means there was nothing to reconcile from).
 */
export function reconcileBoardToPlanmap(data, tasks, { campaigns = [] } = {}) {
  // planmap:<topic>/<featureSlug> → strongest state seen across tasks
  const seen = new Map();
  // Topic ids that have ANY board task referencing them (any state, feature-level
  // or not) — used for the disconnected-topic warning below. A topic absent from
  // this set has zero board presence, so reconcile can NEVER update it.
  const topicsWithRefs = new Set();
  for (const t of tasks) {
    for (const ref of t.refs ?? []) {
      const anyTopic = /^planmap:([a-z0-9-]+)(?:\/|$)/.exec(ref);
      if (anyTopic) topicsWithRefs.add(anyTopic[1]);
      const m = /^planmap:([a-z0-9-]+)\/([a-z0-9-]+)$/.exec(ref);
      if (!m) continue;
      const key = `${m[1]}/${m[2]}`;
      // Daemon states (store.mjs TASK_STATES): open | claimed | in_progress | blocked | done.
      // Only done and genuinely in-flight states are evidence — open AND blocked are not
      // (a blocked task is stalled, not being worked on).
      // WF-G150: a task closed by triage as obsolete or superseded delivered
      // nothing. Its done state is a closure, not evidence that the work exists.
      const state = t.state === 'done' && t.closedReason ? null
        : t.state === 'done' ? 'done'
        : (t.state === 'claimed' || t.state === 'in_progress') ? 'active'
        : null;
      if (!state) continue;
      const cur = seen.get(key);
      if (!cur || RANK[state] > RANK[cur]) seen.set(key, state);
    }
  }

  // WF-G150 (measured 2026-09-13): the feature "Campaign charter + tiered intake
  // + Plan Map reference contract" read done because its ONE linked task — the
  // approval step — was done, while none of the feature was built. Task refs
  // cannot say "this task delivers the feature" from "this task serves the
  // campaign that will". A charter can: its planMapPrimary IS the feature the
  // campaign exists to deliver. So a feature named as the primary of a campaign
  // that is not yet done is capped at active, whatever its tasks say.
  // Measured first: capping every campaign's done tasks instead would have held
  // back 24 of 61 feature keys, because most wave campaigns are never closed.
  const held = [];
  const openPrimaries = new Map();
  for (const c of campaigns || []) {
    const primary = c && c.charter && c.charter.body && c.charter.body.planMapPrimary;
    if (typeof primary !== 'string' || !primary.startsWith('planmap:')) continue;
    if (c.state === 'done' || c.state === 'closed') continue;
    openPrimaries.set(primary.slice('planmap:'.length), c.id);
  }
  for (const [key, st] of seen) {
    if (st === 'done' && openPrimaries.has(key)) {
      seen.set(key, 'active');
      held.push(`${key}: primary of campaign ${openPrimaries.get(key)}, which is not done`);
    }
  }

  const disconnectedOf = () => (data.topics ?? [])
    .filter((t) => (t.status === 'specced' || t.status === 'active') && !topicsWithRefs.has(t.id))
    .map((t) => ({ id: t.id, status: t.status }));

  // No board evidence at all → nothing to reconcile FROM; leave data untouched
  // (matches the original CLI's early exit before its change loop).
  if (!seen.size) return { changes: [], disconnected: disconnectedOf(), evidence: 0, held };

  const changes = [];
  for (const topic of data.topics ?? []) {
    const slugs = featureSlugs(topic.features ?? []);
    (topic.features ?? []).forEach((f, i) => {
      const evidence = seen.get(`${topic.id}/${slugs[i]}`);
      if (evidence && RANK[evidence] > RANK[f.status]) {
        changes.push(`"${topic.id}" / "${f.title}": ${f.status} → ${evidence}`);
        f.status = evidence;
      }
    });
    const feats = topic.features ?? [];
    if (feats.length) {
      const target = feats.every((f) => f.status === 'done') ? 'done'
        : feats.some((f) => f.status === 'active' || f.status === 'done') ? 'active'
        : null;
      if (target && RANK[target] > RANK[topic.status]) {
        changes.push(`"${topic.id}": ${topic.status} → ${target} (derived from features)`);
        topic.status = target;
      }
    }
  }

  // The highest-value signal this tool emits: topics the plan-map claims are in
  // motion (specced/active) but which NO board task references. Reconcile is a
  // board→plan-map one-way sync — for these topics there is nothing to sync FROM,
  // so their status can only rot (the feature-tree's death). Surface them loudly.
  return { changes, disconnected: disconnectedOf(), evidence: seen.size, held };
}
