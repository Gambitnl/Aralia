/**
 * @file keyNpcs.ts — Plan B: tag a town's "key NPCs" (SPEC D9).
 *
 * Key NPCs are the institution-holders who stay alive in the sim even when the
 * player is far away (Tier B): the lord (keep), priest (temple), and
 * marketmaster (market/plaza), plus 1–2 "wildcards" scaled by town size.
 *
 * Pure & additive: this reads a generated artifact TownPlan + roster and returns
 * a Map<occupantId, InstitutionRole>. It does NOT modify the roster.
 *
 * Why proximity, not workPlotId: generateTownRoster only staffs market/workshop
 * plots — it never assigns a worker to a temple or keep. So institution holders
 * are chosen as the adult living nearest the institution (preferring an actual
 * on-plot worker when one exists, i.e. for markets).
 */
import type { SeededRandom } from '../../../utils/random/seededRandom';
import type { TownPlan } from '../artifacts';
import type { Occupant, TownRoster } from '../roster/types';
import type { InstitutionRole } from './types';

export interface KeyNpcOptions {
  /** RNG for deterministic wildcard selection. */
  rng: SeededRandom;
  /** Override the auto-scaled wildcard count. */
  wildcards?: number;
}

/** Singular institutions: plot role → the role of its single holder. */
const SINGULAR_INSTITUTIONS: ReadonlyArray<readonly [string, InstitutionRole]> = [
  ['keep', 'lord'],
  ['temple', 'priest'],
  ['market', 'marketmaster'],
];

type Pt = [number, number];

function plotCentroid(footprint: ReadonlyArray<readonly [number, number]>): Pt {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of footprint) {
    sx += x;
    sy += y;
  }
  const n = footprint.length || 1;
  return [sx / n, sy / n];
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Auto-scaled wildcard count: ~1 per 120 people, clamped to [1, 3]. */
function defaultWildcardCount(population: number): number {
  return Math.max(1, Math.min(3, Math.round(population / 120)));
}

/**
 * Assign institution roles + wildcards to a town's occupants.
 * Returns occupantId → InstitutionRole for the key NPCs only.
 */
export function assignKeyNpcs(
  plan: TownPlan,
  roster: TownRoster,
  opts: KeyNpcOptions,
): Map<number, InstitutionRole> {
  const result = new Map<number, InstitutionRole>();

  // Adults + elders are eligible (no child lords).
  const adults = roster.occupants.filter((o) => o.ageBand !== 'child');
  if (adults.length === 0) return result;

  const homeCentroid = new Map<number, Pt>();
  for (const p of plan.plots) homeCentroid.set(p.id, plotCentroid(p.footprint));
  const homeOf = (o: Occupant): Pt => homeCentroid.get(o.homePlotId) ?? [0, 0];

  // Town centre = mean of all plot centroids (for "most central institution").
  const centre: Pt = (() => {
    let sx = 0;
    let sy = 0;
    for (const c of homeCentroid.values()) {
      sx += c[0];
      sy += c[1];
    }
    const n = homeCentroid.size || 1;
    return [sx / n, sy / n];
  })();

  for (const [role, institution] of SINGULAR_INSTITUTIONS) {
    const plots = plan.plots.filter((p) => p.role === role);
    if (plots.length === 0) continue;

    // Most central plot of this role.
    const plot = plots
      .map((p) => ({ p, d: dist(plotCentroid(p.footprint), centre) }))
      .sort((a, b) => a.d - b.d || a.p.id - b.p.id)[0].p;
    const pc = plotCentroid(plot.footprint);

    // Prefer an unassigned adult who actually works this plot, else nearest home.
    const workers = adults
      .filter((o) => o.workPlotId === plot.id && !result.has(o.id))
      .sort((a, b) => a.id - b.id);
    let holder: Occupant | undefined = workers[0];
    if (!holder) {
      holder = adults
        .filter((o) => !result.has(o.id))
        .map((o) => ({ o, d: dist(homeOf(o), pc) }))
        .sort((a, b) => a.d - b.d || a.o.id - b.o.id)[0]?.o;
    }
    if (holder) result.set(holder.id, institution);
  }

  // Wildcards: deterministic rng pick among remaining adults.
  const wildcardCount = opts.wildcards ?? defaultWildcardCount(roster.occupants.length);
  const pool = adults.filter((o) => !result.has(o.id)).sort((a, b) => a.id - b.id);
  for (let i = 0; i < wildcardCount && pool.length > 0; i++) {
    const idx = opts.rng.nextInt(0, pool.length);
    const [picked] = pool.splice(idx, 1);
    result.set(picked.id, 'wildcard');
  }

  return result;
}
