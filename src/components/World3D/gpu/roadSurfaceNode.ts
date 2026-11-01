/**
 * @file roadSurfaceNode.ts — the world's roads as real surfaces, for the game
 * world on WebGPURenderer (`?gpu=1`). agora-257c, 2026-10-27.
 *
 * Remy: the roads did not look like roads. They were flat ribbons in one tint
 * per tier (a plain vertex-colored MeshStandardMaterial), so a plaza read as a
 * near-white sheet of paper and a lane as a brown stripe. This material draws
 * each ROAD_SURFACE kind (roadGeometry.ts) as the thing it is, in ROAD SPACE:
 * the `road` attribute carries the distance along the road, the distance across
 * it, its half width and its kind, so stones lie in courses across the road
 * and ruts run with it, around every bend.
 *
 * Colors are real-world reflectances, not the 2D map's tier tints (those stay
 * the tier identity on the wire): dry packed earth and building stone reflect
 * roughly 0.2 to 0.4 of the light in linear terms; the old plaza tint #d8cbb2
 * reflects about 0.6, brighter than any paving outdoors. The hex values below
 * are sRGB; TSL `color()` turns them into linear working values.
 *
 * Patterns, by kind:
 *   flagstone (plaza)  staggered slabs about 0.9 x 0.6 m, mortar joints;
 *   setts (avenue)     cut blocks 0.14 m along x 0.22 m across, in courses;
 *   cobble (street)    rounded field stones about 0.18 m (Worley cells);
 *   curb               long curb stones, 0.9 m, along the road;
 *   highway            large polygonal paving stones (Worley, about 0.6 m);
 *   lane and road      packed dirt, two wheel ruts at the 1.4 m cart gauge
 *                      (two pairs on a wide road), gravel specks;
 *   trail              two bare wheel tracks on worn grass;
 *   path               a broken worn line on worn grass;
 *   rut stripe         dropped: the dirt kinds draw their own ruts.
 *
 * DISTANCE FADE. From above, a cobble is smaller than a screen pixel, and the
 * pattern shimmered as salt-and-pepper noise. Each pattern fades to its own
 * average once one pixel covers more ground than its detail (`fwidth` of road
 * space): a joint fades to the share of area it covers, a tint to 1, so the
 * surface keeps its tone at every distance.
 */
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  Discard,
  Fn,
  If,
  abs,
  attribute,
  clamp,
  color,
  dFdx,
  dFdy,
  faceDirection,
  float,
  floor,
  fract,
  fwidth,
  length,
  max,
  min,
  mix,
  mod,
  mx_cell_noise_float,
  mx_noise_float,
  mx_worley_noise_float,
  mx_worley_noise_vec2,
  normalView,
  positionView,
  smoothstep,
  vec2,
  vec3,
} from 'three/tsl';
import { riverWaterDiscard } from './riverFootprintCut';

/* eslint-disable @typescript-eslint/no-explicit-any */
type N = any;

/** Kind ids: keep in step with ROAD_SURFACE in systems/world3d/roadGeometry.ts. */
const K = { flagstone: 1, setts: 2, cobble: 3, lane: 4, curb: 5, rutStripe: 6, highway: 7, road: 8, trail: 9, path: 10 };

/** Half the gauge of a cart's wheels, meters (a 1.4 m wheel track). */
const RUT_HALF_GAUGE_M = 0.7;

let material: MeshStandardNodeMaterial | null = null;

/** Distance from a point to the nearest joint of a unit cell, in meters. */
const jointDistance = (f: N, size: N): N =>
  min(min(f.x, float(1).sub(f.x)).mul(size.x), min(f.y, float(1).sub(f.y)).mul(size.y));

/** Laid units (slabs, setts, curbs): rows along `rowAxis` staggered by half a unit. */
const laidUnits = (p: N, size: N, jointM: number): { joint: N; cell: N } => {
  const q: N = p.div(size).toVar();
  // Every other row shifts by half a unit, as masons lay them.
  q.x.addAssign(mod(floor(q.y), 2).mul(0.5));
  const cell: N = floor(q);
  const joint: N = float(1).sub(smoothstep(jointM * 0.4, jointM, jointDistance(fract(q), size)));
  return { joint, cell };
};

/** Two wheel ruts at the cart gauge around `centerM` (signed meters across). */
const rutsAt = (across: N, centerM: number): N =>
  float(1).sub(smoothstep(0.1, 0.24, abs(abs(across.sub(centerM)).sub(RUT_HALF_GAUGE_M))));

/**
 * ROAD SHAPE (roads step 4, agora-257c 2026-10-28). The road mesh is a flat
 * ribbon draped on the ground, so a road had no shape: no crown, no ruts,
 * no worn edges. The shape is drawn in light, not in geometry: each kind
 * sets a relief height in meters, and this tilts the surface normal by the
 * screen-space slope of that height (Mikkelsen, "Bump Mapping Unparametrized
 * Surfaces on the GPU", listing 2, as three's BumpMapNode does for textures).
 * The geometry stays flat, so feet, carts and the road layers do not move.
 */
const bumpNormal = (height: N): N => {
  const sigmaX: N = dFdx(positionView).normalize();
  const sigmaY: N = dFdy(positionView).normalize();
  const n: N = normalView;
  const r1: N = sigmaY.cross(n);
  const r2: N = n.cross(sigmaX);
  const det: N = sigmaX.dot(r1).mul(faceDirection);
  const grad: N = det.sign().mul(dFdx(height).mul(r1).add(dFdy(height).mul(r2)));
  return det.abs().mul(n).sub(grad).normalize();
};

/** A paved road's camber: the middle stands 6 cm over its edges, so rain runs off. */
const crowned = (side: N): N => side.mul(side).mul(-0.06);

/** A worn dirt road's bed: level across its middle, rising 8 cm into its banks. */
const sunkenWay = (side: N): N => smoothstep(0.6, 1, side).mul(0.08);

/** The shared road material, one instance for every chunk. */
export function getRoadSurfaceNodeMaterial(): MeshStandardNodeMaterial {
  if (material) return material;
  const m = new MeshStandardNodeMaterial();
  m.vertexColors = false;
  m.roughness = 0.9;
  m.metalness = 0;

  const road: N = attribute('road', 'vec4');
  const along: N = road.x;
  const across: N = road.y;
  const halfW: N = road.z;
  const kind: N = road.w;
  const p: N = vec2(along, across);

  const albedo: N = vec3(0).toVar('roadAlbedo');
  const rough: N = float(0.9).toVar('roadRough');
  // The surface's relief in meters (roads step 4): each kind sets it next to
  // its albedo, and normalNode tilts the light by it (see bumpNormal).
  const relief: N = float(0).toVar('roadRelief');
  // How far across the road, 0 on the center line, 1 at the edge.
  const side: N = clamp(abs(across).div(max(halfW, 0.1)), 0, 1);

  m.colorNode = Fn(() => {
    // NOT the river-footprint cut: with it every street inside the live river's
    // rectangle vanished (Remy's tab, 2026-10-28). Only the river's own water
    // removes a road (riverWaterDiscard), so a road that ran on through the
    // channel no longer paves the river bed under its bridge.
    riverWaterDiscard();
    // Ground-scale mottling shared by every kind: no surface is one flat tint.
    const mottle: N = mx_noise_float(vec3(p.mul(0.35), 0)).mul(0.5).add(0.5);
    const grit: N = mx_noise_float(vec3(p.mul(6.0), 1.7)).mul(0.5).add(0.5);
    const isKind = (id: number): N => abs(kind.sub(id)).lessThan(0.5);
    // Ground covered by one pixel, meters; a detail fades out between lo and hi.
    const footprint: N = length(fwidth(p));
    const fine = (lo: number, hi: number): N => float(1).sub(smoothstep(lo, hi, footprint));
    /** A joint mask faded to the share of area it covers. */
    const fadeTo = (mask: N, share: number, lo: number, hi: number): N => mix(share, mask, fine(lo, hi));
    /** A tint factor faded to 1. */
    const fadeTint = (tint: N, lo: number, hi: number): N => mix(1, tint, fine(lo, hi));

    If(isKind(K.rutStripe), () => {
      Discard();
    });

    If(isKind(K.flagstone), () => {
      const { joint, cell } = laidUnits(p, vec2(0.9, 0.6), 0.02);
      const tint: N = fadeTint(mx_cell_noise_float(cell).sub(0.5).mul(0.24).add(1), 0.3, 0.9);
      const stone: N = color(0xa69e91).mul(tint).mul(mix(0.9, 1.06, mottle));
      albedo.assign(mix(stone, color(0x6b6256), fadeTo(joint, 0.05, 0.06, 0.25)));
      rough.assign(mix(0.78, 0.95, joint));
      // A square is laid level: only its joints sink.
      relief.assign(joint.mul(-0.004).mul(fine(0.06, 0.25)));
    })
      .ElseIf(isKind(K.setts), () => {
        // Courses run ACROSS the road: a course is 0.14 m along, its blocks 0.22 m across.
        const { joint, cell } = laidUnits(vec2(across, along), vec2(0.22, 0.14), 0.014);
        const tint: N = fadeTint(mx_cell_noise_float(cell).sub(0.5).mul(0.3).add(1), 0.07, 0.25);
        const stone: N = color(0x88837c).mul(tint).mul(mix(0.92, 1.05, grit));
        albedo.assign(mix(stone, color(0x5a5248), fadeTo(joint, 0.12, 0.03, 0.12)));
        rough.assign(mix(0.72, 0.95, joint));
        relief.assign(crowned(side).add(joint.mul(-0.006).mul(fine(0.03, 0.12))));
      })
      .ElseIf(isKind(K.cobble), () => {
        const cells: N = mx_worley_noise_vec2(p.mul(5.5), 0.9);
        const edge: N = cells.y.sub(cells.x);
        const gap: N = fadeTo(float(1).sub(smoothstep(0.04, 0.2, edge)), 0.18, 0.04, 0.14);
        // Rounded tops catch more light toward each stone's middle.
        const crown: N = fadeTint(smoothstep(0.05, 0.6, edge).mul(0.18).add(0.9), 0.06, 0.2);
        const tint: N = fadeTint(mx_noise_float(vec3(p.mul(5.5), 3.1)).mul(0.14).add(1), 0.08, 0.25);
        const stone: N = color(0x827c73).mul(tint).mul(crown).mul(mix(0.92, 1.05, mottle));
        albedo.assign(mix(stone, color(0x4f4436), gap));
        rough.assign(mix(0.68, 0.95, gap));
        // Each cobble is a low dome between sunken gaps.
        const dome: N = smoothstep(0.03, 0.45, edge).mul(0.018).mul(fine(0.03, 0.12));
        relief.assign(crowned(side).add(dome));
      })
      .ElseIf(isKind(K.curb), () => {
        const { joint, cell } = laidUnits(vec2(along, across.mul(0.01)), vec2(0.9, 1), 0.015);
        const tint: N = mx_cell_noise_float(cell).sub(0.5).mul(0.16).add(1);
        albedo.assign(mix(color(0x73706c).mul(tint), color(0x4a463f), fadeTo(joint, 0.03, 0.06, 0.25)));
        rough.assign(0.8);
      })
      .ElseIf(isKind(K.highway), () => {
        const cells: N = mx_worley_noise_vec2(p.mul(1.6), 0.8);
        const gap: N = fadeTo(float(1).sub(smoothstep(0.03, 0.09, cells.y.sub(cells.x))), 0.1, 0.08, 0.3);
        const tint: N = mx_noise_float(vec3(p.mul(1.6), 5.3)).mul(0.16).add(1);
        albedo.assign(mix(color(0x9a9284).mul(tint).mul(mix(0.9, 1.05, grit)), color(0x5c5346), gap));
        rough.assign(mix(0.8, 0.95, gap));
        relief.assign(crowned(side).add(gap.mul(-0.008).mul(fine(0.08, 0.3))));
      })
      .ElseIf(isKind(K.lane).or(isKind(K.road)), () => {
        // A narrow lane carries one wheel track; a wide road (half width over
        // 3 m) carries one pair each way.
        const wide: N = halfW.greaterThan(3);
        const ruts: N = max(
          rutsAt(across, 0).mul(float(1).sub(wide.select(1, 0))),
          max(rutsAt(across, 1.6), rutsAt(across, -1.6)).mul(wide.select(1, 0)),
        );
        // Round gravel grains of mixed size (Worley), not square cells: the old
        // cell-noise specks read as pixel blocks up close (Remy's walk, 2026-10-28).
        // Radius in Worley cells (about 11 cm); noise below zero leaves a cell bare.
        const grainR: N = clamp(mx_noise_float(vec3(p.mul(4), 4.4)).mul(0.3), 0.001, 0.14);
        const grain: N = float(1).sub(smoothstep(grainR.mul(0.7), grainR, mx_worley_noise_float(p.mul(9), 0.9)));
        const speck: N = fadeTo(grain, 0.1, 0.03, 0.1);
        const dirt: N = color(0x8f8069).mul(mix(0.82, 1.08, mottle)).mul(mix(0.94, 1.04, grit));
        const worn: N = mix(dirt, color(0x6a5a45), ruts.mul(0.75));
        albedo.assign(mix(worn, color(0xa39a8a), speck.mul(0.35)));
        rough.assign(mix(0.96, 0.82, ruts));
        // A HOLLOW WAY: wheels and feet wear a dirt road down, so its edges
        // rise to the verges and the ruts sink below the rest of its bed.
        relief.assign(sunkenWay(side).sub(ruts.mul(0.05)));
      })
      .ElseIf(isKind(K.trail), () => {
        const track: N = rutsAt(across, 0);
        const grass: N = color(0x6e7448).mul(mix(0.85, 1.1, mottle));
        const dirt: N = color(0x857660).mul(mix(0.9, 1.05, grit));
        albedo.assign(mix(grass, dirt, clamp(track.mul(1.2), 0, 1)));
        rough.assign(0.95);
        relief.assign(track.mul(-0.03));
      })
      .Else(() => {
        // Path: one worn line, broken where the grass grows back over it.
        const line: N = float(1).sub(smoothstep(0.15, 0.35, abs(across)));
        const gaps: N = smoothstep(0.35, 0.6, mx_noise_float(vec3(along.mul(0.25), 0, 7.7)).mul(0.5).add(0.5));
        const grass: N = color(0x6e7448).mul(mix(0.85, 1.1, mottle));
        albedo.assign(mix(grass, color(0x857660), line.mul(gaps)));
        rough.assign(0.95);
      });
    return albedo;
  })();
  m.roughnessNode = rough;
  // The relief is assigned in colorNode above; node materials build the
  // diffuse color before the normal, so the variable is set when this runs.
  m.normalNode = bumpNormal(relief);

  material = m;
  return m;
}

let vergeMaterial: MeshStandardNodeMaterial | null = null;

/** Verge kinds: keep in step with ROAD_SURFACE.vergePaved and vergeDirt. */
const VERGE_PAVED = 11;

/**
 * The road VERGE (roads step 3, agora-257c 2026-10-28): the strip each side of
 * a road (roadGeometry.buildRoadVergeMesh) that takes the road's hard edge into
 * the ground. Transparent, so the real terrain under it shows through as it
 * thins; it writes no depth, and the road layers above it win where they meet.
 *   t     = how far out across the verge, 0 at the road's edge, 1 at its rim;
 *   width = vergeWidthM in roadGeometry.ts (0.5 m beside paving; a quarter of
 *           the road's half width, 0.6 to 1.5 m, beside dirt);
 * A noise line along the road makes the rim ragged, so no edge is straight.
 * Beside dirt the verge is the road's own spilled dirt going to worn grass;
 * beside paving it is dust and gutter grime.
 */
export function getRoadVergeNodeMaterial(): MeshStandardNodeMaterial {
  if (vergeMaterial) return vergeMaterial;
  const m = new MeshStandardNodeMaterial();
  m.vertexColors = false;
  m.transparent = true;
  m.depthWrite = false;
  m.roughness = 0.95;
  m.metalness = 0;

  const road: N = attribute('road', 'vec4');
  const along: N = road.x;
  const across: N = road.y;
  const halfW: N = road.z;
  const kind: N = road.w;
  const paved: N = abs(kind.sub(VERGE_PAVED)).lessThan(0.5);
  const width: N = paved.select(float(0.5), clamp(halfW.mul(0.25), 0.6, 1.5));
  const t: N = clamp(abs(across).sub(halfW).div(width), 0, 1);
  // A ragged rim: the line wanders along the road and a little across it.
  const wander: N = mx_noise_float(vec3(along.mul(0.55), abs(across).mul(0.8), 9.1));
  const tr: N = t.add(wander.mul(0.35));
  const mottle: N = mx_noise_float(vec3(along.mul(0.35), across.mul(0.35), 0)).mul(0.5).add(0.5);

  const dirt: N = color(0x8f8069).mul(mix(0.82, 1.08, mottle));
  const grass: N = color(0x6e7448).mul(mix(0.85, 1.1, mottle));
  const dust: N = mix(color(0x5f5444), color(0x86786a), smoothstep(0.0, 0.6, tr));
  // A verge over the river's water goes with its road (riverWaterDiscard).
  m.colorNode = Fn(() => {
    riverWaterDiscard();
    return paved.select(dust, mix(dirt, grass, smoothstep(0.1, 0.8, tr)));
  })();
  m.opacityNode = float(1).sub(smoothstep(0.15, 0.95, tr)).mul(paved.select(float(0.85), float(1)));

  vergeMaterial = m;
  return m;
}

/** Test seam: drop the cached material so a fresh one is built. */
export function resetRoadSurfaceNodeMaterialForTest(): void {
  material?.dispose();
  material = null;
  vergeMaterial?.dispose();
  vergeMaterial = null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
