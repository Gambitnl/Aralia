/**
 * @file grownTreeMeshSource.ts — trees GROWN from a biome, not picked from a
 * preset list.
 *
 * THE PIPELINE
 *
 *   environment + seed -> genome -> traits -> skeleton -> proportions -> foliage
 *
 * The environment half lives in `treeEnvironment.ts`. This file is the rest.
 * The output is a `TreeGeometryData` in the SAME unit frame, with the SAME
 * vertex-color convention, as `ezTreeMeshSource.ts`, so it drops into the
 * existing instancing, batching and partition path untouched.
 *
 * THE PHYSICS THAT DOES THE WORK
 *
 * 1. PIPE MODEL. `r_parent^2 = sum(r_child^2)`. The leader takes
 *    `r_parent * 0.70`; the lateral siblings split the residual cross-sectional
 *    area between them. This is why the branching reads as STRUCTURAL: a limb
 *    is thick because of what it carries, not because a number said so.
 * 2. ALLOMETRY. Length follows radius, `L_child = L_parent * (r_child/r_parent)^(2/3)`.
 * 3. GRAVITY. Stem thickness scales `g^(1/3)` and droop base is `0.55*g^0.55`,
 *    accumulating `1 + level*0.30` toward the twigs. ARALIA HAS ONE GRAVITY, so
 *    `SURFACE_GRAVITY` is a constant of 1 and both terms collapse to their
 *    coefficients. The formulas are kept in that shape so the physics is
 *    readable, NOT because there is a gravity dial to turn.
 * 4. WIND thickens stems `1 + (wind-0.2)*0.6`, sharpens the taper, narrows
 *    leaves, and adds `(wind-0.2)*0.30` radians of droop.
 * 5. ARIDITY thickens stems `1 + (aridity-0.35)*0.7` and shrinks leaves toward
 *    needles.
 * 6. LIGHT: `leafLightMod = 1 + (0.6-light)*0.8`, so a dim understory enlarges
 *    leaves by up to about 48%.
 *
 * DETERMINISM IS LOAD-BEARING
 *
 * `(seed, environment)` must always give an identical tree. The genome is drawn
 * from `SeededRandom` in ONE FIXED ORDER, listed in `drawGenome`. Changing the
 * number of draws, or their order, reshuffles every downstream value and every
 * tree in the world. Treat that list as a wire format.
 *
 * PERFORMANCE
 *
 * Generation happens at build time. A handful of variants are grown per biome
 * and INSTANCED, exactly as the preset path is; nothing here runs per frame and
 * nothing here is per-tree.
 */
import { SeededRandom } from '../../../utils/random/seededRandom';
import type { TreeEnvironment } from './treeEnvironment';
import type { TreeGeometryData } from './treeMeshGenerator';

// ── Shared render contract ──────────────────────────────────────────────────

/**
 * A vertex is bark if its baked green channel is below this. Same 0.6 the
 * ez-tree source and the `VegetationTreeField` vertex shader both use — the
 * shader has to make the split without an extra attribute, so the threshold is
 * a contract, not a local choice. Kept as a literal rather than imported
 * because importing `ezTreeMeshSource` pulls the vendored ez-tree library into
 * headless callers that must stay free of it.
 */
export const FOLIAGE_COLOR_THRESHOLD = 0.6;

/** Baked bark color, matching `ezTreeMeshSource`'s BARK_RGB. */
const BARK_RGB: readonly [number, number, number] = [0.34, 0.24, 0.16];
/** Baked foliage color: near-white so the per-instance biome tint drives it. */
const LEAF_RGB: readonly [number, number, number] = [0.92, 0.97, 0.90];
/** Standing-wood value gradient, as in the ez-tree source. */
const BARK_FOOT_VALUE = 0.62;
const BARK_PEAK_VALUE = 1.14;
const BARK_PEAK_Y = 0.34;
const BARK_JITTER = 0.09;
/** How far a leaf normal is turned to face out of the crown. */
const CROWN_NORMAL_BLEND = 0.62;
/** Where a leaf blade is widest, as a fraction of its length. */
const BLADE_SHOULDER = 0.38;

// ── Physical constants ──────────────────────────────────────────────────────

/**
 * Aralia's surface gravity, relative to the value the allometry was written
 * against. ONE WORLD, ONE GRAVITY: this is a constant, not an input. It is kept
 * named so the `g^(1/3)` and `g^0.55` terms below stay legible as physics.
 */
const SURFACE_GRAVITY = 1;
/** Pipe model: the fraction of parent RADIUS the leader child keeps. */
const LEADER_RADIUS_FRACTION = 0.70;
/** Allometric exponent relating branch length to branch radius. */
const LENGTH_RADIUS_EXPONENT = 2 / 3;
/** Base droop, in radians, before level accumulation and wind. */
const DROOP_BASE = 0.55 * Math.pow(SURFACE_GRAVITY, 0.55);
/** Droop accumulates this much per level toward the twigs. */
const DROOP_PER_LEVEL = 0.30;
/**
 * How much of a branch's droop is spent bending the branch itself.
 *
 * The rest is spent at the collar, where the branch leaves its parent. Without
 * this split the droop compounded: a level-3 twig inherited four branches' worth
 * of accumulated bend and ended up pointing at the ground. Measured terminal
 * tilt was 2.85 rad — 163 degrees from vertical, an upside-down tree.
 */
const DROOP_BRANCH_SHARE = 0.22;
/** Droop spent at the collar, as a fraction of the branch's droop. */
const DROOP_COLLAR_SHARE = 0.13;
/**
 * APICAL DOMINANCE. The leader keeps only this share of the droop.
 *
 * Without it the leader inherited every ancestor's bend and the tree came out as
 * one long whip sweeping to one side — the trunk left vertical at the first
 * branch order and never came back. A real leader is the one shoot that stays
 * upright; that is what makes a trunk a trunk.
 */
const LEADER_DROOP_SHARE = 0.16;
/** How far the leader is re-aimed toward vertical at each branch order. */
const LEADER_UPTURN_RAD = 0.16;
/**
 * Lateral reach, on top of the allometric length.
 *
 * Pure allometry gives a lateral about 0.56 of its parent, which compounds to a
 * crown of small tufts hugging the stem. Real limbs reach: the crown is most of
 * a tree's silhouette, and this is what pays for it.
 */
const LATERAL_LENGTH_GAIN = 1.8;
/**
 * Real leaves a rendered blade stands for.
 *
 * The world draws a tree at a range where one leaf is sub-pixel, so the
 * renderable primitive is a SPRAY, not a leaf. A spray of N leaves has about
 * sqrt(N) times a leaf's silhouette, which is where the blade size comes from —
 * and the leaf-area metric stays honest, because it measures the canopy the
 * spray represents. Rendering true single leaves gave a canopy of wisps.
 */
const LEAVES_PER_BLADE = 26;
/**
 * Hard limit on how far any branch may tilt from vertical.
 *
 * A weeping willow is the extreme real case and its twigs hang near 120 degrees.
 * Past that the accumulation is a bug, not a species.
 */
const MAX_TILT_RAD = 1.85;
/** Trunk height, in feet, for a genome of 1.0 in a vigor-1.0 biome. */
const REFERENCE_HEIGHT_FT = 78;
/** Height-to-base-radius ratio before the environment thickens the stem. */
const REFERENCE_SLENDERNESS = 34;
/** Leaf blade length, in feet, before the environment resizes it. */
const REFERENCE_LEAF_FT = 0.42;
/** Blade half-width as a fraction of blade length, before wind and drought. */
const REFERENCE_BLADE_ASPECT = 0.34;
/** Total leaf blades a tree is allowed, however its branching works out. */
const LEAF_BUDGET = 1150;
/**
 * Terminal branches a tree is allowed. THE PERFORMANCE GATE.
 *
 * Branching is `(laterals + 1)^levels`, which runs away fast: five laterals and
 * five levels is 7776 terminals and about 150k triangles for ONE tree that the
 * world draws thousands of. The branch order is cut until the tree fits, and the
 * cut is recorded in `TreeTraits.branchLevels` so nothing downstream is guessing.
 */
const MAX_TERMINAL_BRANCHES = 260;
/** Golden angle, the phyllotaxy used to space leaves and laterals. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// ── Genome ──────────────────────────────────────────────────────────────────

/**
 * The heritable half. Environment-free on purpose: the SAME genome in two
 * biomes is the whole point of the exercise, so nothing biome-shaped may leak
 * in here.
 */
export interface TreeGenome {
  heightBias: number;
  slendernessBias: number;
  extraLevel: 0 | 1;
  lateralCount: number;
  branchAngleBias: number;
  twistPhase: number;
  leafAspectBias: number;
  crownDensityBias: number;
  lean: number;
}

/**
 * DRAW ORDER — nine draws, in this order, forever:
 *
 *   1 heightBias  2 slendernessBias  3 extraLevel  4 lateralCount
 *   5 branchAngleBias  6 twistPhase  7 leafAspectBias  8 crownDensityBias
 *   9 lean
 *
 * Add a draw anywhere but the END and every existing tree changes shape.
 * `nextInt` is MAX-EXCLUSIVE in this repo, so `nextInt(2, 5)` yields 2, 3 or 4.
 */
export function drawGenome(seed: number): TreeGenome {
  const rng = new SeededRandom(seed);
  const heightBias = 0.85 + rng.next() * 0.30;
  const slendernessBias = 0.85 + rng.next() * 0.30;
  const extraLevel = (rng.next() < 0.5 ? 0 : 1) as 0 | 1;
  const lateralCount = rng.nextInt(2, 5);
  const branchAngleBias = 0.85 + rng.next() * 0.30;
  const twistPhase = rng.next() * Math.PI * 2;
  const leafAspectBias = 0.85 + rng.next() * 0.30;
  const crownDensityBias = 0.85 + rng.next() * 0.30;
  const lean = (rng.next() - 0.5) * 0.16;
  return {
    heightBias, slendernessBias, extraLevel, lateralCount,
    branchAngleBias, twistPhase, leafAspectBias, crownDensityBias, lean,
  };
}

// ── Traits ──────────────────────────────────────────────────────────────────

/** The grown answer: what this genome becomes in THIS environment. */
export interface TreeTraits {
  heightFt: number;
  baseRadiusFt: number;
  branchLevels: number;
  lateralCount: number;
  branchAngleRad: number;
  /**
   * How far laterals reach out, as a multiplier on their allometric length.
   * This is the crown-width lever: bright open ground spreads, dim understory
   * and wind and drought pull in.
   */
  crownSpread: number;
  droopRad: number;
  taper: number;
  /** One real leaf's blade length, in feet. The botanical value. */
  leafLengthFt: number;
  /** The rendered blade — a spray of `LEAVES_PER_BLADE` real leaves. */
  bladeLengthFt: number;
  bladeHalfWidthFt: number;
  leavesPerTerminal: number;
  lean: number;
  twistPhase: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Bias the genome with the environment. This function IS the coupling: every
 * biome difference a player can see is produced here and nowhere else.
 */
export function traitsFor(genome: TreeGenome, env: TreeEnvironment): TreeTraits {
  // Wind and drought both thicken a stem — a tree that must stand up to load or
  // hold water builds wood instead of length.
  const windThicken = 1 + (env.wind - 0.2) * 0.6;
  const aridThicken = 1 + (env.aridity - 0.35) * 0.7;
  const gravityThicken = Math.pow(SURFACE_GRAVITY, 1 / 3);

  // Height is bought with the growing season and spent on standing up.
  const heightFt = REFERENCE_HEIGHT_FT
    * genome.heightBias
    * (0.30 + 0.85 * env.vigor)
    * (1 - 0.32 * env.wind)
    * (1 - 0.28 * env.aridity)
    * (1 - 0.22 * env.chill);

  // Slenderness FALLS as the stem thickens, so the trunk gets fatter.
  const slenderness = (REFERENCE_SLENDERNESS * genome.slendernessBias)
    / (windThicken * aridThicken * gravityThicken);
  const baseRadiusFt = heightFt / Math.max(6, slenderness);

  // Drought and cold buy fewer branch orders; a rainforest can afford one more.
  let branchLevels = 3 + genome.extraLevel;
  if (env.aridity > 0.7 || env.chill > 0.8) branchLevels -= 1;
  if (env.vigor > 0.85 && env.aridity < 0.2) branchLevels += 1;
  branchLevels = clamp(Math.round(branchLevels), 2, 5);

  // Dim light narrows the crown — a sapling under a canopy reaches, it does not
  // spread. Wind and drought narrow it too, for the opposite reason.
  //
  // The coefficients are deliberately STRONG. The first pass used gentle ones
  // and the four gate biomes came out inside 10% of each other on crown ratio —
  // a preset with a tint, which is the fault being removed. Weak coupling is
  // the failure mode here, not the safe choice.
  const spread = clamp(
    (0.35 + 1.15 * env.light) * (1 - 0.45 * env.wind) * (1 - 0.40 * env.aridity),
    0.22, 1.60,
  );
  const branchAngleRad = clamp(0.70 * genome.branchAngleBias * spread, 0.14, 1.25);

  const droopRad = DROOP_BASE
    * genome.branchAngleBias
    * (1 - 0.35 * env.chill)
    + (env.wind - 0.2) * 0.30;

  // Wind sharpens the taper: a whipped stem sheds section fast toward the tip.
  const taper = clamp(0.74 - (env.wind - 0.2) * 0.18, 0.48, 0.86);

  // Dim light enlarges a leaf up to ~48%; drought and cold drive it to a needle.
  const leafLightMod = 1 + (0.6 - env.light) * 0.8;
  const leafLengthFt = REFERENCE_LEAF_FT
    * genome.leafAspectBias
    * leafLightMod
    * (1 - 0.42 * env.aridity)
    * (1 - 0.26 * env.chill);
  // The aspect floor is a LOOK value, not botany. Driven to its mathematical
  // limit the blade became a hairline, and a desert tree rendered as a dead
  // stick — sparse is right, leafless is not. A needle still has width.
  const bladeAspect = clamp(
    REFERENCE_BLADE_ASPECT
      * (1 - (env.wind - 0.2) * 0.60)
      * (1 - 0.75 * env.aridity)
      * (1 - 0.60 * env.chill),
    0.09, 0.55,
  );
  // A rendered blade stands for a spray of real leaves, so its silhouette is
  // sqrt(N) times a leaf's. The aspect ratio — the needle-vs-leaf read — is the
  // leaf's own, so drought and cold still narrow what the player sees.
  const bladeLengthFt = leafLengthFt * Math.sqrt(LEAVES_PER_BLADE);
  const bladeHalfWidthFt = bladeLengthFt * bladeAspect;

  // Drought coarsens the branching, wet ground refines it.
  //
  // A rainforest tree is a long clean bole carrying MANY orders of FEW branches;
  // a desert shrub is FEW orders of MANY coarse ones. The first pass had this
  // backwards — it gave the rich biome more laterals, which blew the terminal
  // budget and got its branch order cut back to the same 3 as everything else.
  // Every biome then had identical branch order, so the knob was dead.
  const lateralCount = clamp(
    Math.round(genome.lateralCount * (0.75 + 0.5 * env.aridity)),
    2, 4,
  );

  // Cut branch orders until the tree fits the terminal budget. Done AFTER the
  // lateral count is final, because the budget is a product of both.
  while (branchLevels > 2 && Math.pow(lateralCount + 1, branchLevels) > MAX_TERMINAL_BRANCHES) {
    branchLevels -= 1;
  }

  return {
    heightFt,
    baseRadiusFt,
    branchLevels,
    lateralCount,
    branchAngleRad,
    crownSpread: spread,
    droopRad,
    taper,
    leafLengthFt,
    bladeLengthFt,
    bladeHalfWidthFt,
    // Budget the TOTAL and divide by the terminals the branching actually
    // produces, so a level change cannot silently multiply the canopy.
    leavesPerTerminal: 0, // filled in by growTree once the terminals are known
    lean: genome.lean,
    twistPhase: genome.twistPhase,
  };
}

// ── Vector helpers (plain arrays: no THREE dependency in the hot path) ───────

type V3 = [number, number, number];

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function norm(a: V3): V3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
/** Rotate `d` toward `target` by `angle` radians. Pure function of its inputs. */
function rotateToward(d: V3, target: V3, angle: number): V3 {
  const p = sub(target, mul(d, dot(d, target)));
  const pl = Math.hypot(p[0], p[1], p[2]);
  if (pl < 1e-6) return d;
  const u = mul(p, 1 / pl);
  return norm(add(mul(d, Math.cos(angle)), mul(u, Math.sin(angle))));
}
/**
 * A deterministic orthonormal frame around `d`. `(u, v, d)` is right-handed,
 * which the ring winding below relies on for outward-facing triangles.
 */
function frameFor(d: V3): { u: V3; v: V3 } {
  const helper: V3 = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(helper, d));
  const v = cross(d, u);
  return { u, v };
}

const DOWN: V3 = [0, -1, 0];

/** Never let a branch tilt past `MAX_TILT_RAD` from vertical. */
function limitTilt(d: V3): V3 {
  const tilt = Math.acos(clamp(d[1], -1, 1));
  if (tilt <= MAX_TILT_RAD) return d;
  // Rotate BACK toward vertical by the overshoot.
  return rotateToward(d, [0, 1, 0], tilt - MAX_TILT_RAD);
}

// ── Mesh accumulation ───────────────────────────────────────────────────────

interface MeshSink {
  pos: number[];
  nrm: number[];
  col: number[];
  idx: number[];
}

/** Radial sides per branch level. Deep twigs span a few pixels; do not round them. */
const SIDES_BY_LEVEL = [7, 5, 4, 4, 4, 4];
/** Sub-segments per branch. More at the base, where the droop curve is read. */
const SEGMENTS_BY_LEVEL = [4, 3, 2, 2, 2, 2];

/** Emit one tapered, curving tube and return the tip point and direction. */
function emitBranch(
  sink: MeshSink,
  origin: V3,
  dir: V3,
  radius: number,
  lengthFt: number,
  taper: number,
  droopStep: number,
  level: number,
): { tip: V3; tipDir: V3; ringPoints: { p: V3; d: V3 }[] } {
  const sides = SIDES_BY_LEVEL[Math.min(level, SIDES_BY_LEVEL.length - 1)];
  const segments = SEGMENTS_BY_LEVEL[Math.min(level, SEGMENTS_BY_LEVEL.length - 1)];
  const segLen = lengthFt / segments;

  let p = origin;
  let d = dir;
  const stations: { p: V3; d: V3; r: number }[] = [{ p, d, r: radius }];
  for (let s = 1; s <= segments; s++) {
    p = add(p, mul(d, segLen));
    // Curve toward gravity a little at every station, so the droop reads as a
    // bend and not as a single hinge at the branch collar.
    d = limitTilt(rotateToward(d, DOWN, droopStep / segments));
    const t = s / segments;
    stations.push({ p, d, r: radius * (1 + (taper - 1) * t) });
  }

  const baseVert = sink.pos.length / 3;
  for (let s = 0; s < stations.length; s++) {
    const st = stations[s];
    const { u, v } = frameFor(st.d);
    // Radius slope, for a normal that tilts with the taper instead of pointing
    // flat out of a cone.
    const pi = Math.max(0, s - 1);
    const ni = Math.min(stations.length - 1, s + 1);
    const dR = (stations[ni].r - stations[pi].r) / Math.max(1e-4, segLen * (ni - pi));
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      const radial = add(mul(u, Math.cos(a)), mul(v, Math.sin(a)));
      const point = add(st.p, mul(radial, st.r));
      const n = norm(sub(radial, mul(st.d, dR)));
      sink.pos.push(point[0], point[1], point[2]);
      sink.nrm.push(n[0], n[1], n[2]);
      sink.col.push(BARK_RGB[0], BARK_RGB[1], BARK_RGB[2]);
    }
  }
  for (let s = 0; s < stations.length - 1; s++) {
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides;
      const a = baseVert + s * sides + k;
      const b = baseVert + s * sides + k2;
      const c = baseVert + (s + 1) * sides + k;
      const e = baseVert + (s + 1) * sides + k2;
      // (u, v, d) is right-handed, so this winding faces OUT. Emitting both
      // windings would z-fight, which is a known trap in this repo.
      sink.idx.push(a, b, c, b, e, c);
    }
  }

  const last = stations[stations.length - 1];
  return {
    tip: last.p,
    tipDir: last.d,
    ringPoints: stations.map((st) => ({ p: st.p, d: st.d })),
  };
}

/** Emit one pointed leaf blade: four vertices, two triangles, no index growth. */
function emitLeaf(
  sink: MeshSink,
  attach: V3,
  bladeDir: V3,
  sideDir: V3,
  lengthFt: number,
  halfWidthFt: number,
): number {
  const tip = add(attach, mul(bladeDir, lengthFt));
  const shoulder = add(attach, mul(bladeDir, lengthFt * BLADE_SHOULDER));
  const left = sub(shoulder, mul(sideDir, halfWidthFt));
  const right = add(shoulder, mul(sideDir, halfWidthFt));
  const n = norm(cross(bladeDir, sideDir));
  const base = sink.pos.length / 3;
  for (const p of [tip, left, attach, right]) {
    sink.pos.push(p[0], p[1], p[2]);
    sink.nrm.push(n[0], n[1], n[2]);
    sink.col.push(LEAF_RGB[0], LEAF_RGB[1], LEAF_RGB[2]);
  }
  sink.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  // A kite's area is half the product of its diagonals.
  return lengthFt * halfWidthFt;
}

// ── The grower ──────────────────────────────────────────────────────────────

/** Measured facts about a grown tree. The differentiation gate asserts on these. */
export interface TreeMetrics {
  /** Trunk height in FEET (feet are canon in Worldforge). */
  heightFt: number;
  /** Trunk radius at the foot, in feet. */
  trunkRadiusFt: number;
  /** Widest crown diameter, in feet. */
  crownWidthFt: number;
  /** Crown width divided by height. Survives the unit-frame normalization. */
  crownRatio: number;
  /** Total one-sided leaf blade area, in square feet. */
  leafAreaFt2: number;
  /** Mean leaf blade length, in feet. Needles are small, understory leaves big. */
  leafLengthFt: number;
  /** Mean angle of a terminal branch from vertical, in radians. Droop, measured. */
  meanTerminalTiltRad: number;
  branchLevels: number;
  leafCount: number;
  triangles: number;
}

export interface GrownTree extends TreeGeometryData {
  metrics: TreeMetrics;
  traits: TreeTraits;
  genome: TreeGenome;
}

interface GrowState {
  sink: MeshSink;
  traits: TreeTraits;
  leafArea: number;
  leafCount: number;
  tiltSum: number;
  tiltCount: number;
  terminalIndex: number;
}

/** Count the terminal branches the recursion will reach, before it runs. */
function terminalCount(levels: number, laterals: number): number {
  // Every non-terminal branch spawns one leader plus `laterals` siblings.
  return Math.pow(laterals + 1, levels);
}

function growRecursive(
  state: GrowState,
  origin: V3,
  dir: V3,
  radius: number,
  lengthFt: number,
  level: number,
  isLeader: boolean,
): void {
  const t = state.traits;
  // Only part of a branch's droop bends the branch; the rest is spent at the
  // collar below. Splitting it is what stops the bend compounding into an
  // upside-down tree by the third branch order. The LEADER keeps only a sliver
  // of it — apical dominance is what holds a trunk up.
  const droop = level === 0
    ? 0
    : t.droopRad * (1 + level * DROOP_PER_LEVEL) * DROOP_BRANCH_SHARE
      * (isLeader ? LEADER_DROOP_SHARE : 1);
  const branch = emitBranch(state.sink, origin, dir, radius, lengthFt, t.taper, droop, level);

  if (level >= t.branchLevels) {
    // Terminal: hang the leaves and record the droop this branch ended at.
    state.tiltSum += Math.acos(clamp(branch.tipDir[1], -1, 1));
    state.tiltCount += 1;
    const n = t.leavesPerTerminal;
    const { u, v } = frameFor(branch.tipDir);
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      const along = add(origin, mul(sub(branch.tip, origin), 0.25 + f * 0.75));
      const a = t.twistPhase + (state.terminalIndex * 2 + i) * GOLDEN_ANGLE;
      const radial = add(mul(u, Math.cos(a)), mul(v, Math.sin(a)));
      // Blades stand out and slightly down: leaves present area to the sky but
      // hang under their own weight, which is the same gravity term as the droop.
      const bladeDir = rotateToward(radial, DOWN, 0.35 + t.droopRad * 0.4);
      const sideDir = norm(cross(bladeDir, branch.tipDir));
      state.leafArea += emitLeaf(
        state.sink, along, bladeDir, sideDir, t.bladeLengthFt, t.bladeHalfWidthFt,
      );
      state.leafCount += 1;
    }
    state.terminalIndex += 1;
    return;
  }

  // PIPE MODEL. The leader keeps 70% of the parent's radius; the laterals split
  // whatever cross-sectional area is left between them.
  const leaderR = radius * LEADER_RADIUS_FRACTION;
  const residualArea = Math.max(0, radius * radius - leaderR * leaderR);
  const lateralR = Math.sqrt(residualArea / t.lateralCount);
  const lengthFor = (childR: number): number =>
    lengthFt * Math.pow(childR / radius, LENGTH_RADIUS_EXPONENT);

  const { u, v } = frameFor(branch.tipDir);
  for (let i = 0; i < t.lateralCount; i++) {
    const a = t.twistPhase + (level * 1.7) + (i / t.lateralCount) * Math.PI * 2;
    const axis = add(mul(u, Math.cos(a)), mul(v, Math.sin(a)));
    let childDir = norm(add(
      mul(branch.tipDir, Math.cos(t.branchAngleRad)),
      mul(axis, Math.sin(t.branchAngleRad)),
    ));
    childDir = limitTilt(rotateToward(
      childDir, DOWN, t.droopRad * (1 + level * DROOP_PER_LEVEL) * DROOP_COLLAR_SHARE,
    ));
    // `crownSpread` is the crown-width lever: it lengthens or shortens what the
    // laterals reach out with, leaving the leader chain (and so the height)
    // alone.
    growRecursive(
      state, branch.tip, childDir, lateralR,
      lengthFor(lateralR) * t.crownSpread * LATERAL_LENGTH_GAIN, level + 1, false,
    );
  }
  // The leader continues, leaning by the genome's own lean at the trunk. It is
  // re-aimed toward vertical at every order, which is the apical dominance that
  // separates a trunk from the limbs it carries.
  const leaderDir = level === 0
    ? rotateToward(branch.tipDir, [1, 0, 0], t.lean)
    : rotateToward(branch.tipDir, [0, 1, 0], LEADER_UPTURN_RAD);
  growRecursive(state, branch.tip, leaderDir, leaderR, lengthFor(leaderR), level + 1, true);
}

/**
 * Grow one tree.
 *
 * Geometry comes back in the unit frame (trunk base at y = 0, total height
 * exactly 1) because that is the contract the world's instancer scales against.
 * The metrics are measured in FEET, BEFORE normalization — the unit frame
 * erases absolute size on purpose, so absolute differences would be invisible
 * if they were only read off the geometry.
 */
export function growTree(seed: number, env: TreeEnvironment): GrownTree {
  const genome = drawGenome(seed);
  const traits = traitsFor(genome, env);

  // The leaf budget is set here, not in `traitsFor`, because it depends on the
  // branching the traits just decided.
  const terminals = terminalCount(traits.branchLevels, traits.lateralCount);
  traits.leavesPerTerminal = Math.max(
    2,
    Math.round((LEAF_BUDGET * genome.crownDensityBias) / terminals),
  );

  const sink: MeshSink = { pos: [], nrm: [], col: [], idx: [] };
  const state: GrowState = {
    sink, traits, leafArea: 0, leafCount: 0, tiltSum: 0, tiltCount: 0, terminalIndex: 0,
  };

  // Trunk length, so that the LEADER CHAIN sums to the trait height.
  //
  // Every leader keeps `LEADER_RADIUS_FRACTION` of its parent's radius, and
  // allometry turns that into `q = 0.70^(2/3)` of its parent's length. The
  // stack of leaders is therefore a geometric series, and the trunk is the
  // first term. Dividing by the series is what keeps `heightFt` a real height
  // instead of drifting with the branch order.
  const q = Math.pow(LEADER_RADIUS_FRACTION, LENGTH_RADIUS_EXPONENT);
  let leaderSeries = 0;
  for (let i = 0; i <= traits.branchLevels; i++) leaderSeries += Math.pow(q, i);
  growRecursive(
    state, [0, 0, 0], [0, 1, 0],
    traits.baseRadiusFt, traits.heightFt / leaderSeries, 0, true,
  );

  const positions = new Float32Array(sink.pos);
  const normals = new Float32Array(sink.nrm);
  const colors = new Float32Array(sink.col);
  const indices = new Uint32Array(sink.idx);

  // ── Measure in feet, before the unit frame erases the scale ───────────────
  let minY = Infinity;
  let maxY = -Infinity;
  let maxR = 0;
  let cx = 0;
  let cz = 0;
  const vCount = positions.length / 3;
  for (let i = 0; i < vCount; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    cx += x;
    cz += z;
  }
  cx /= Math.max(1, vCount);
  cz /= Math.max(1, vCount);
  for (let i = 0; i < vCount; i++) {
    const r = Math.hypot(positions[i * 3] - cx, positions[i * 3 + 2] - cz);
    if (r > maxR) maxR = r;
  }
  const heightFt = maxY - minY;

  const metrics: TreeMetrics = {
    heightFt,
    trunkRadiusFt: traits.baseRadiusFt,
    crownWidthFt: maxR * 2,
    crownRatio: (maxR * 2) / Math.max(1e-6, heightFt),
    leafAreaFt2: state.leafArea,
    leafLengthFt: traits.leafLengthFt,
    meanTerminalTiltRad: state.tiltCount ? state.tiltSum / state.tiltCount : 0,
    branchLevels: traits.branchLevels,
    leafCount: state.leafCount,
    triangles: indices.length / 3,
  };

  // ── Unit frame: centre on the trunk axis, base at 0, height exactly 1 ─────
  const k = heightFt > 1e-6 ? 1 / heightFt : 1;
  for (let i = 0; i < vCount; i++) {
    positions[i * 3] = (positions[i * 3] - cx) * k;
    positions[i * 3 + 1] = (positions[i * 3 + 1] - minY) * k;
    positions[i * 3 + 2] = (positions[i * 3 + 2] - cz) * k;
  }

  bakeBarkValue({ positions, normals, colors, indices });
  blendCrownNormals({ positions, normals, colors, indices });

  return { positions, normals, colors, indices, metrics, traits, genome };
}

/** Bake the standing-wood value gradient into the bark vertices. */
function bakeBarkValue(data: TreeGeometryData): void {
  const n = data.positions.length / 3;
  for (let i = 0; i < n; i++) {
    if (data.colors[i * 3 + 1] >= FOLIAGE_COLOR_THRESHOLD) continue;
    const y = data.positions[i * 3 + 1];
    const t = y <= BARK_PEAK_Y
      ? y / BARK_PEAK_Y
      : 1 - Math.min(1, (y - BARK_PEAK_Y) / Math.max(1e-3, 1 - BARK_PEAK_Y)) * 0.55;
    const ramp = BARK_FOOT_VALUE
      + (BARK_PEAK_VALUE - BARK_FOOT_VALUE) * Math.min(1, Math.max(0, t));
    const h = Math.sin(
      data.positions[i * 3] * 127.1 + y * 311.7 + data.positions[i * 3 + 2] * 74.7,
    ) * 43758.5453;
    const jitter = 1 + (h - Math.floor(h) - 0.5) * 2 * BARK_JITTER;
    const kk = ramp * jitter;
    data.colors[i * 3] = BARK_RGB[0] * kk;
    data.colors[i * 3 + 1] = Math.min(FOLIAGE_COLOR_THRESHOLD - 0.05, BARK_RGB[1] * kk);
    data.colors[i * 3 + 2] = BARK_RGB[2] * kk;
  }
}

/**
 * Turn the leaf normals toward "away from the middle of the crown".
 *
 * A flat quad normal makes every leaf shade as an independent plane, and the
 * crown becomes a mosaic of unrelated values — the confetti fault the ez-tree
 * path already had to fix. Kept short of 1.0 so a blade edge-on to the sun
 * still goes dark and the crown keeps internal contrast.
 */
function blendCrownNormals(data: TreeGeometryData): void {
  const n = data.positions.length / 3;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (data.colors[i * 3 + 1] < FOLIAGE_COLOR_THRESHOLD) continue;
    cx += data.positions[i * 3];
    cy += data.positions[i * 3 + 1];
    cz += data.positions[i * 3 + 2];
    count++;
  }
  if (count === 0) return;
  cx /= count; cy /= count; cz /= count;
  for (let i = 0; i < n; i++) {
    if (data.colors[i * 3 + 1] < FOLIAGE_COLOR_THRESHOLD) continue;
    let ox = data.positions[i * 3] - cx;
    let oy = data.positions[i * 3 + 1] - cy;
    let oz = data.positions[i * 3 + 2] - cz;
    const len = Math.hypot(ox, oy, oz);
    if (len < 1e-6) continue;
    ox /= len; oy /= len; oz /= len;
    const b = CROWN_NORMAL_BLEND;
    const nx = data.normals[i * 3] * (1 - b) + ox * b;
    const ny = data.normals[i * 3 + 1] * (1 - b) + oy * b;
    const nz = data.normals[i * 3 + 2] * (1 - b) + oz * b;
    const nl = Math.hypot(nx, ny, nz) || 1;
    data.normals[i * 3] = nx / nl;
    data.normals[i * 3 + 1] = ny / nl;
    data.normals[i * 3 + 2] = nz / nl;
  }
}

/** Per-variant seed stride, shared with both existing generators' schedules. */
export const GROWN_VARIANT_SEED_STRIDE = 7919;

/**
 * The variants one biome gets from one world seed.
 *
 * Same shape as the preset path's variant set: a small number of trees, grown
 * once at build time and INSTANCED everywhere. Nothing here is per-tree.
 */
export function growTreeVariants(
  seed: number,
  env: TreeEnvironment,
  count: number,
): GrownTree[] {
  const out: GrownTree[] = [];
  for (let v = 0; v < count; v++) {
    out.push(growTree((seed + v * GROWN_VARIANT_SEED_STRIDE) >>> 0, env));
  }
  return out;
}
