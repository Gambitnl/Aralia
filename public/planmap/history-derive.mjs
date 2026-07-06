// Pure history-derivation for the plan-map date tracker. Dual-use: imported by
// vitest AND loaded in the browser (attaches window.PlanmapHistory). No DOM, no
// git — just data in, data out.
export const slug = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export function flatNodes(topics) {
  const out = [];
  for (const t of topics || []) {
    out.push({ key: t.id, kind: 'topic', topicId: t.id, title: t.title, status: t.status });
    for (const f of t.features || [])
      out.push({ key: `${t.id}::${slug(f.title)}`, kind: 'feature', topicId: t.id, title: f.title, status: f.status });
  }
  return out;
}

export function diffDone(prevTopics, nextTopics) {
  const prev = new Map(flatNodes(prevTopics).map(n => [n.key, n.status]));
  return flatNodes(nextTopics).filter(n => n.status === 'done' && prev.get(n.key) !== 'done');
}

export function momentumByDay(timeline) {
  const out = [];
  for (let i = 0; i < timeline.length; i++) {
    // The first recorded day is a BASELINE, not a shipping day: items already
    // done then were finished before history-tracking began, so momentum is 0.
    // A bar therefore only ever means "became done on a day we were watching".
    const shipped = i === 0 ? [] : diffDone(timeline[i - 1].topics, timeline[i].topics);
    out.push({ date: timeline[i].date, count: shipped.length, shipped });
  }
  return out;
}

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export function stalenessDays(timeline, today) {
  const last = timeline[timeline.length - 1];
  const res = new Map();
  for (const n of flatNodes(last.topics)) {
    if (n.status === 'done' || n.status === 'superseded') continue;
    let sinceDate = timeline[0].date, floored = true;
    for (let i = timeline.length - 2; i >= 0; i--) {
      const was = new Map(flatNodes(timeline[i].topics).map(x => [x.key, x.status])).get(n.key);
      if (was !== n.status) { sinceDate = timeline[i + 1].date; floored = false; break; }
    }
    res.set(n.key, { days: Math.max(0, daysBetween(sinceDate, today)), floored });
  }
  return res;
}

// --- Back-dating: blend manual designed/built dates with git snapshots -------
// A topic or feature may carry `history: { designed, built }` (YYYY-MM-DD) —
// real dates for work that predates git-tracking. nodeStatusAt derives its
// status on day D from those dates; undated nodes fall back to the git snapshot.
export function nodeStatusAt(node, D, gitStatus) {
  const h = node.history;
  if (h && (h.built || h.designed)) {
    if (h.built && D >= h.built) return 'done';
    if (h.designed && D >= h.designed) return 'specced';
    return null; // before it was designed → not on the map yet
  }
  return gitStatus ?? null; // undated: track git (absent if not in that snapshot)
}

// Reconstruct the full topics array as it stood on day D: dated nodes from their
// dates, undated nodes from the latest git snapshot on or before D.
export function stateAt(D, liveTopics, gitSnap) {
  const gm = new Map();
  if (gitSnap) for (const n of flatNodes(gitSnap.topics)) gm.set(n.key, n.status);
  const out = [];
  for (const t of liveTopics) {
    const ts = nodeStatusAt(t, D, gm.get(t.id));
    if (!ts) continue;
    const features = [];
    for (const f of t.features || []) {
      const fs = nodeStatusAt(f, D, gm.get(`${t.id}::${slug(f.title)}`));
      if (fs) features.push({ ...f, status: fs });
    }
    out.push({ ...t, status: ts, features });
  }
  return out;
}

// Build one {date, topics} entry per distinct date (git days + every manual
// designed/built date + today), so momentum/staleness/replay reach into the
// pre-git past. The final point (today) is the live map verbatim.
export function synthesizeTimeline(gitDays, liveTopics, today) {
  const dates = new Set([today]);
  for (const g of gitDays) dates.add(g.date);
  const addH = h => { if (h) { if (h.designed) dates.add(h.designed); if (h.built) dates.add(h.built); } };
  for (const t of liveTopics) { addH(t.history); for (const f of t.features || []) addH(f.history); }
  const sorted = [...dates].filter(Boolean).sort();
  const gitAt = D => { let s = null; for (const g of gitDays) { if (g.date <= D) s = g; } return s; };
  return sorted.map(D => ({ date: D, topics: D === today ? liveTopics : stateAt(D, liveTopics, gitAt(D)) }));
}

if (typeof window !== 'undefined') {
  window.PlanmapHistory = { slug, flatNodes, diffDone, momentumByDay, stalenessDays, nodeStatusAt, stateAt, synthesizeTimeline };
}
