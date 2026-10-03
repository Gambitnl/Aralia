// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/07/2026, 22:28:56
 * Dependents: systems/entities3d/textPlan/compilePlan.ts, systems/entities3d/three/gaits.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file spineProfile.ts — THE body-radius profile, shared by the compiler and
 * the runtime driver.
 *
 * 2026-07-27: extracted after the "hot dog dragon" critique — the taper+bulge
 * formula lived in TWO places (compilePlan.hullRadiusAt for blend collars,
 * gaits.buildBody for the mesh) and could drift; and a single-sine bulge can
 * only make sausages. `spine.mass` [chest, waist, hips] adds a three-lobe
 * profile: predators get a deep chest where wings/forelegs hang, a tucked
 * waist, and driving hips. Plans without `mass` keep the historical
 * taper+bulge tube BYTE-IDENTICAL.
 */

/** Minimal shape both the CreaturePlan compiler and the PlanSpec driver can hand over. */
export interface SpineProfileSpec {
  bodyRadM: number;
  spine: { taper: number; bulge?: number; mass?: [number, number, number] };
}

/** Cosine-smoothed interpolation through ascending (u, multiplier) knots. */
function interpKnots(knots: ReadonlyArray<readonly [number, number]>, u: number): number {
  if (u <= knots[0][0]) return knots[0][1];
  for (let i = 1; i < knots.length; i++) {
    if (u <= knots[i][0]) {
      const [u0, m0] = knots[i - 1];
      const [u1, m1] = knots[i];
      const t = (u - u0) / (u1 - u0);
      return m0 + (m1 - m0) * (0.5 - 0.5 * Math.cos(t * Math.PI));
    }
  }
  return knots[knots.length - 1][1];
}

/**
 * Hull radius at spine fraction u (0 front → 1 rear), meters.
 *
 * mass present → three-lobe knots: chest at 0.18, waist at 0.50, hips at 0.78
 * (all × bodyRadM). round 4 (creature-anatomy): the old fixed end knots
 * (0.82 front / 0.88 rear) FORBADE any real taper — every mass body still
 * ended in near-full-radius capped discs and the critic read "pipes glued
 * end to end". Now the ends taper: the front rounds into the neck base at
 * 0.60 × chest, and `spine.taper` is reinterpreted as the REAR-TIP fraction
 * of the hips lobe (taper 0.3 on hips 0.6 → a near-pointed 0.18 tail tip;
 * taper 1 keeps a blunt rump). Legacy plans without `mass` keep the
 * historical taper+bulge tube byte-identical.
 */
export function spineRadiusAt(spec: SpineProfileSpec, u: number): number {
  const { bodyRadM, spine } = spec;
  if (spine.mass) {
    const [chest, waist, hips] = spine.mass;
    const tip = hips * Math.min(1, Math.max(0.05, spine.taper));
    return Math.max(
      0.01,
      bodyRadM * interpKnots([[0, chest * 0.6], [0.18, chest], [0.5, waist], [0.78, hips], [1, tip]], u),
    );
  }
  const base = Math.max(0.01, bodyRadM * (spine.taper + (1 - spine.taper) * u));
  const muscle = 1 + (spine.bulge ?? 0) * Math.sin(Math.min(1, Math.max(0, (u - 0.08) / 0.84)) * Math.PI) * 0.55;
  return base * muscle;
}
