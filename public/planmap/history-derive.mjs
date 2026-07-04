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
    const prev = i === 0 ? [] : timeline[i - 1].topics;
    const shipped = diffDone(prev, timeline[i].topics);
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

if (typeof window !== 'undefined') {
  window.PlanmapHistory = { slug, flatNodes, diffDone, momentumByDay, stalenessDays };
}
