// Pure readiness derivation for the plan-map. Dual-use: imported by vitest, loaded
// in the browser (attaches window.PlanmapReady), and imported by the roadmap tool.
// No DOM, no fetch — just data in, boolean out. One home for "what counts as READY".

export const slug = (s) => String(s ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 40);

export const isDead = (t) => !!t && (t.status === 'done' || t.status === 'superseded');

const depList = (t) => (t.deps || []).map((d) => (typeof d === 'string' ? { id: d, kind: 'hard' } : d));

const featureOf = (byId, targetId, featureSlug) => {
  if (!featureSlug) return null;
  const t = byId[targetId];
  return (t && (t.features || []).find((f) => slug(f.title) === featureSlug)) || undefined;
};

const featureDead = (f) => !!f && (f.status === 'done' || f.status === 'superseded');

// A topic is actionable when it is alive and every HARD dep is satisfied.
// chosen-order deps and deps pointing at an unknown id never block.
export const isActionable = (t, byId) => !isDead(t) &&
  depList(t).every((d) => {
    if (d.kind === 'chosen' || !byId[d.id]) return true;
    if (d.feature) {
      const f = featureOf(byId, d.id, d.feature);
      if (f) return featureDead(f);
      // slug didn't resolve (data race / typo) — fall back to whole topic.
    }
    return isDead(byId[d.id]);
  });

if (typeof window !== 'undefined') {
  window.PlanmapReady = { slug, isDead, isActionable };
}
