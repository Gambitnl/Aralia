/**
 * @file crystalGeometry.ts — parametric faceted crystal spikes.
 *
 * Approach poached (geometry only) from
 * github.com/achrefelouafi/LinearAbiltyCastingThreeJS —
 * `src/assets/ProceduralGeometry.js`, MIT, (c) 2026 mohamedachrefelouafi.
 * Remy approved the technique on 2026-08-12 for the elemental crystal crowns,
 * amethyst fist clusters, and faceted ice spikes: a crystal is a low-facet
 * prism whose radius TAPERS to a hard apex, whose facet radii are perturbed by
 * a ROUGHNESS term, and whose axis BENDS, so no two shards in a cluster repeat.
 *
 * Their materials are deliberately NOT ported: thickness-tinted
 * MeshStandardMaterial and raymarched volumetric fire both need bloom + ACES
 * tone mapping and die flat under our toon ramp. This file emits positions
 * only; the caller supplies the material.
 *
 * Cost: `facets` × (rings−1) × 2 + `facets` (apex fan) + (facets−2) (base cap)
 * triangles — at facets 5, rings 3 that is 28, cheaper than the tapered
 * cylinder plus two joint spheres it replaces. The 30k plan budget is why the
 * defaults stay low.
 */
import { BufferAttribute, BufferGeometry } from 'three';

export interface CrystalParams {
  /** Sides of the prism. 4–7 reads as a crystal; 8+ reads as a cone. */
  facets: number;
  /** Length along +Y (the caller orients it). */
  length: number;
  /** Radius at the base. */
  radius: number;
  /** Tip radius as a fraction of `radius` — 0 gives a needle, 0.3 a blunt shard. */
  taper: number;
  /** Per-facet radius jitter, fraction of radius. 0 = a perfect prism. */
  roughness: number;
  /** Lateral lean of the apex, fraction of length. */
  bend: number;
  /** Deterministic variation seed — same seed, same crystal, every frame. */
  seed: number;
}

/** Deterministic hash in [-1, 1]. */
function wob(seed: number, k: number): number {
  return Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453 % 1 * 2 - 1;
}

/**
 * A faceted crystal spike rising from y=0 to y=length, apex leaning by `bend`.
 * Positions only, non-indexed, outward winding (the caller's ink hull relies
 * on consistent winding — see CAMPAIGN.md's per-face winding lesson).
 */
export function crystalGeometry(p: CrystalParams): BufferGeometry {
  const facets = Math.max(3, Math.round(p.facets));
  const RINGS = 3; // base, shoulder, neck — then the apex point
  const bendX = p.bend * p.length;
  const bendZ = p.bend * p.length * 0.4 * wob(p.seed, 9);
  // per-facet radius scale, constant for the whole shard so the prism reads as
  // one crystal with uneven faces rather than a lumpy blob
  const faceScale: number[] = [];
  for (let f = 0; f < facets; f++) faceScale.push(1 + p.roughness * wob(p.seed, f + 1));
  const ringPt = (ring: number, f: number): [number, number, number] => {
    const t = ring / RINGS;
    const y = t * p.length;
    const r = p.radius * (1 - t * (1 - p.taper)) * faceScale[f % facets];
    const th = ((f % facets) / facets) * Math.PI * 2 + p.seed * 0.7;
    return [Math.cos(th) * r + bendX * t * t, y, Math.sin(th) * r + bendZ * t * t];
  };
  const apex: [number, number, number] = [bendX, p.length, bendZ];
  const pos: number[] = [];
  const push = (...pts: Array<[number, number, number]>): void => {
    for (const q of pts) pos.push(q[0], q[1], q[2]);
  };
  for (let ring = 0; ring < RINGS; ring++) {
    for (let f = 0; f < facets; f++) {
      const a = ringPt(ring, f);
      const b = ringPt(ring, f + 1);
      const c = ringPt(ring + 1, f + 1);
      const d = ringPt(ring + 1, f);
      push(a, b, c);
      push(a, c, d);
    }
  }
  for (let f = 0; f < facets; f++) push(ringPt(RINGS, f), ringPt(RINGS, f + 1), apex);
  // base cap (fan from facet 0) — the shard roots inside its host boulder, but
  // a hole there would show the ink hull through it
  const base0 = ringPt(0, 0);
  for (let f = 1; f < facets - 1; f++) push(base0, ringPt(0, f + 1), ringPt(0, f));
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.computeVertexNormals();
  return geo;
}
