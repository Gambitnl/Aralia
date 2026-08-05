/**
 * @file ezTreeMeshSource.ts — the streamed world's tree geometry, built from
 * the vendored ez-tree library.
 *
 * The world and the combat map grew trees from two different generators. The
 * combat map has used ez-tree since the beautification wave; the streamed world
 * kept the hand-written `treeMeshGenerator`, whose three species and six forms
 * were always a placeholder. So the tree a player walks past and the tree they
 * fight beside were different objects, and only one of them had been art
 * directed. This file removes the second generator's reason to exist.
 *
 * What has to be true for a variant to drop into the world's renderer:
 *
 * 1. ONE indexed geometry per variant. The field draws a single InstancedMesh
 *    per (species, variant, shadow tier), so branches and leaves are merged
 *    here rather than kept as ez-tree's two meshes. Two meshes per variant
 *    would double a draw-call budget that was cut to 24 on purpose.
 * 2. UNIT FRAME. Trunk base at y = 0, total height exactly 1. Instances are
 *    scaled by SPECIES_HEIGHT_M, so a preset's own scale must be normalized
 *    away or every species inherits ez-tree's arbitrary native units.
 * 3. VERTEX COLORS carry the split. Bark is baked brown and foliage near-white,
 *    because the per-instance biome tint is what makes a taiga read cold and a
 *    rainforest read deep, and baking real leaf color here would cancel that.
 *    The tint reaches FOLIAGE ONLY: the shader in VegetationTreeField keys off
 *    this same green-channel split, because the tint is a leaf albedo and
 *    multiplying wood by it turned every trunk into a black column (measured;
 *    see BARK_RGB). Bark takes a hue nudge from it and nothing else.
 *
 * The presets are also trimmed on the way in, for the same reason the combat
 * map trims them: stock ez-tree presets are hero-tree detail at 30-60k
 * triangles, and the world draws thousands at once. Two branch levels and
 * fattened leaf clusters hold the silhouette at world distances for roughly a
 * quarter of the triangles.
 */
import * as THREE from 'three';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — vendored JS library; the stubbed textures.js has no types
import { Tree, TreePreset } from '../../../../vendor/ez-tree/src/lib/index.js';
import type { TreeGeometryData } from './treeMeshGenerator';
import { SPECIES_HEIGHT_M, TREE_SPECIES, VARIANTS_PER_SPECIES, type TreeSpecies } from './treeMeshGenerator';

/**
 * Baked bark color.
 *
 * This is the color a bole ends up with, not a starting point: the per-instance
 * biome tint no longer multiplies bark (see the shader split in
 * VegetationTreeField). Before that split the tint — a FOLIAGE albedo, measured
 * live at (0.047, 0.196, 0.043) in the deep temperate wood — was multiplying
 * through here, so wood shipped at (0.016, 0.047, 0.007): one twentieth of its
 * authored value AND green-dominant. Trunks measured 8/17/2 on screen against
 * ground at 58/39/25. That is the whole of the "flat black column" fault, and
 * it is why bark is left alone by the tint now rather than made brighter here.
 */
const BARK_RGB: readonly [number, number, number] = [0.34, 0.24, 0.16];

/**
 * Vertical value shaping baked into the bark, as multipliers on BARK_RGB.
 *
 * A bole lit by one directional key and a hemisphere fill has no value change
 * along its length — every point on a vertical cylinder faces the same way — so
 * it reads as a cut-out silhouette however bright it is. The gradient here is
 * the standing-wood cue a renderer cannot produce on its own: dark at the foot
 * where litter, moss and the crown's own occlusion sit, brightest through the
 * mid-bole, easing off again up in the branch mass.
 */
const BARK_FOOT_VALUE = 0.62;
const BARK_PEAK_VALUE = 1.14;
/** Height (unit frame) at which the bark gradient reaches BARK_PEAK_VALUE. */
const BARK_PEAK_Y = 0.34;
/** Per-vertex value jitter. Without it the gradient reads as an airbrush. */
const BARK_JITTER = 0.09;
/**
 * Baked foliage color. Near-white rather than white: a flat 1.0 leaves the
 * canopy entirely at the mercy of the palette tint, and a hair of green keeps
 * an untinted or badly-tinted instance from reading as snow.
 */
const LEAF_RGB: readonly [number, number, number] = [0.92, 0.97, 0.90];

/**
 * Which ez-tree preset backs each species, and how tall that species stands.
 *
 * The species list widened from three to six here. Three meant a taiga, a
 * temperate wood and a rainforest all drew from the same silhouettes, so the
 * only thing telling them apart was canopy tint — which is why every forest
 * in the world read as the same forest in a different color.
 */
export const SPECIES_PRESET: Record<TreeSpecies, string> = {
  conifer: 'Pine Medium',
  broadleaf: 'Oak Medium',
  ash: 'Ash Medium',
  aspen: 'Aspen Medium',
  scrub: 'Bush 1',
  palm: 'Aspen Large',
};

/**
 * Per-species preset overrides applied on top of the shared trim.
 *
 * `palm` has no ez-tree preset and never will — the library grows temperate
 * broadleaf and conifer forms. It is built from a large aspen stripped to a
 * bare trunk with its crown thrown to the top, which is a fair reading of a
 * palm at the distances the world draws one, and is honest about being an
 * approximation rather than pretending a palm asset exists.
 */
const SPECIES_TWEAK: Partial<Record<TreeSpecies, (p: Record<string, any>) => void>> = {
  palm: (p) => {
    if (p.branch) {
      p.branch.levels = 1;
      if (p.branch.children) p.branch.children['0'] = 7;
      if (p.branch.start) p.branch.start['0'] = 0.82; // crown only at the very top
    }
    if (p.leaves) p.leaves.size = (p.leaves.size ?? 1) * 2.6; // long fronds
  },
  scrub: (p) => {
    if (p.branch) p.branch.levels = Math.min(p.branch.levels ?? 2, 2);
  },
};

/**
 * Leaf quads a tree is allowed, whatever its branching works out to.
 *
 * ez-tree hangs leaves only on the LAST branch level, so `leaves.count` is
 * per-terminal-branch and its meaning changes the moment the level count does.
 * A flat multiplier therefore cannot hold canopy mass steady across six species
 * whose terminal-branch counts run from 7 (palm) to 82 (pine): the same 3.2x
 * that was tuned on an oak silently gave the pine twelve times the leaves.
 * Budgeting the total and dividing by the terminals the preset actually
 * produces is the only version of this that survives a branching change.
 */
const LEAF_BUDGET = 1400;

/**
 * Leaf size multiplier.
 *
 * Up from the 1.6x that held the crown's mass when leaves were full rectangles.
 * `reshapeLeafBlades` cuts each quad to a pointed blade, which halves its
 * silhouette area, and this is what pays that back: 1.95^2 x 0.5 is 0.74 of the
 * old area per leaf, and the budget above then carries about 1.3x as many of
 * them. Net canopy mass is held, which the 2026-08-04 note about world trees
 * reading WISPIER than the cones they replaced requires.
 */
const LEAF_SIZE_MULT = 1.95;

/**
 * Terminal branches a preset will produce — the divisor for the leaf budget.
 *
 * The `+ 1` on the deciduous path is not a fudge: ez-tree grows a deciduous
 * branch's own continuation out of its last section on top of the `children`
 * it spawns, so every level multiplies by children + 1. Counting only the
 * children put an oak's terminals at 30 when the tree actually built 72, and
 * the budget overshot by that factor. Evergreens have no terminal branch (the
 * generator tapers them to a point instead), so they multiply by children.
 */
function terminalBranchCount(p: Record<string, any>): number {
  const branch = p.branch as Record<string, any> | undefined;
  const levels = Math.max(0, Math.round(branch?.levels ?? 0));
  const children = (branch?.children ?? {}) as Record<string, number>;
  const bonus = String(p.type ?? '').toLowerCase() === 'deciduous' ? 1 : 0;
  let n = 1;
  for (let i = 0; i < levels; i++) {
    n *= Math.max(1, Math.round(children[String(i)] ?? 1) + bonus);
  }
  return Math.max(1, n);
}

/** Trim a preset to world-instancing detail. Mutates the clone it is given. */
function trimPreset(p: Record<string, any>, seed: number, species: TreeSpecies): void {
  p.seed = seed;
  const branch = p.branch as Record<string, any> | undefined;
  const evergreen = String(p.type ?? '').toLowerCase() === 'evergreen';
  if (branch) {
    // Three levels, not two.
    //
    // Two levels removed the twig level entirely, so every leaf hung directly
    // off a limb thick enough to be read as a limb. That is the "confetti"
    // fault: quads floating with nothing behind them, because there was
    // genuinely nothing behind them. The third level is what the leaves now
    // attach to, and it roughly triples the number of attachment points.
    branch.levels = Math.min(branch.levels ?? 3, 3);
    if (branch.children) {
      branch.children = {
        ...branch.children,
        // An evergreen's level-0 children are whorl branches, not limbs, and
        // there are 82 of them in the pine preset. The old flat cap of 5 was
        // written for an oak's six main limbs and, applied here, left a pine
        // with five branches carrying the entire leaf budget between them —
        // the same paper-plate read from the opposite direction. The whorls are
        // thinned rather than removed, and their rings are cut below to pay
        // for keeping thirty of them.
        '0': evergreen
          ? Math.min(branch.children['0'] ?? 30, 30)
          : Math.min(branch.children['0'] ?? 6, 5),
        '1': Math.min(branch.children['1'] ?? 4, 3),
        '2': Math.min(branch.children['2'] ?? 3, 2),
      };
    }
    // Twigs need to be VISIBLE, not round. A level-2 or level-3 limb spans a
    // few pixels at any range the player sees it from, so rings and radial
    // sides past this are triangles spent on a silhouette nobody can resolve —
    // and with three levels the deep limbs are where the count runs away.
    if (branch.sections) {
      branch.sections = {
        ...branch.sections,
        '1': Math.min(branch.sections['1'] ?? 6, evergreen ? 5 : 6),
        '2': Math.min(branch.sections['2'] ?? 3, 2),
        '3': Math.min(branch.sections['3'] ?? 1, 1),
      };
    }
    if (branch.segments) {
      branch.segments = {
        ...branch.segments,
        '1': Math.min(branch.segments['1'] ?? 5, evergreen ? 4 : 5),
        '2': Math.min(branch.segments['2'] ?? 3, 3),
        '3': Math.min(branch.segments['3'] ?? 3, 3),
      };
    }
  }
  if (p.bark && typeof p.bark === 'object') p.bark.textured = false;
  SPECIES_TWEAK[species]?.(p);

  // After the species tweak, because palm and scrub both move `levels` and the
  // budget is meaningless until the branching is final.
  const leaves = p.leaves as { count?: number; size?: number } | undefined;
  if (leaves) {
    leaves.count = Math.max(3, Math.round(LEAF_BUDGET / terminalBranchCount(p)));
    leaves.size = (leaves.size ?? 1) * LEAF_SIZE_MULT;
  }
}

interface Part {
  geo: THREE.BufferGeometry;
  rgb: readonly [number, number, number];
}

/** Where a blade is widest, as a fraction of its length. */
const BLADE_SHOULDER = 0.38;
/**
 * How far a leaf's normal is turned to face out of the crown.
 *
 * ez-tree gives all four corners of a leaf the same face normal, so every quad
 * shades as an independent flat plane and the crown becomes a mosaic of
 * unrelated values — the literal confetti. Turning the normals toward "away
 * from the middle of the crown" makes the leaves shade as one rounded mass and
 * costs nothing. Kept short of 1.0 so a leaf edge-on to the sun still goes dark
 * and the crown keeps some internal contrast.
 */
const CROWN_NORMAL_BLEND = 0.62;

/**
 * Cut every leaf rectangle down to a pointed blade and re-aim its normals.
 *
 * The vendored textures.js is a no-op stub — it has to be, because the real one
 * fires twenty texture loads at module scope and kills the WebGL context inside
 * an R3F canvas — so ez-tree's alpha-cutout leaf maps never arrive and each
 * leaf renders as the full opaque quad it was built as. That is the other half
 * of the confetti: at walking range the crown is a scatter of hard-edged
 * rectangles, which no amount of leaf count fixes.
 *
 * The blade is cut from the quad's own four corners, so the index buffer, the
 * vertex count and the triangle count are all untouched: a quad's two triangles
 * become (tip, shoulder-left, base) and (tip, base, shoulder-right). A
 * four-vertex outline with two vertices on the axis always encloses half the
 * bounding rectangle, which is why LEAF_SIZE_MULT is raised to pay it back
 * rather than the shape being made more elaborate.
 *
 * Vertex order comes from ez-tree's generateLeaf: 0 = tip-left, 1 = base-left,
 * 2 = base-right, 3 = tip-right.
 */
function reshapeLeafBlades(geo: THREE.BufferGeometry): void {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
  const nrm = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (!pos || pos.count < 4 || pos.count % 4 !== 0) return;

  let ccx = 0;
  let ccy = 0;
  let ccz = 0;
  for (let i = 0; i < pos.count; i++) {
    ccx += pos.getX(i);
    ccy += pos.getY(i);
    ccz += pos.getZ(i);
  }
  ccx /= pos.count;
  ccy /= pos.count;
  ccz /= pos.count;

  for (let q = 0; q < pos.count; q += 4) {
    const x0 = pos.getX(q), y0 = pos.getY(q), z0 = pos.getZ(q);
    const x1 = pos.getX(q + 1), y1 = pos.getY(q + 1), z1 = pos.getZ(q + 1);
    const x2 = pos.getX(q + 2), y2 = pos.getY(q + 2), z2 = pos.getZ(q + 2);
    const x3 = pos.getX(q + 3), y3 = pos.getY(q + 3), z3 = pos.getZ(q + 3);

    const bx = (x1 + x2) / 2, by = (y1 + y2) / 2, bz = (z1 + z2) / 2;
    const tx = (x0 + x3) / 2, ty = (y0 + y3) / 2, tz = (z0 + z3) / 2;
    const ax = tx - bx, ay = ty - by, az = tz - bz;
    // Half-width, taken from the base edge so the blade keeps the quad's span.
    const hx = (x2 - x1) / 2, hy = (y2 - y1) / 2, hz = (z2 - z1) / 2;

    const sx = bx + ax * BLADE_SHOULDER, sy = by + ay * BLADE_SHOULDER, sz = bz + az * BLADE_SHOULDER;
    pos.setXYZ(q, tx, ty, tz);
    pos.setXYZ(q + 1, sx - hx, sy - hy, sz - hz);
    pos.setXYZ(q + 2, bx, by, bz);
    pos.setXYZ(q + 3, sx + hx, sy + hy, sz + hz);
  }

  if (nrm) {
    for (let i = 0; i < pos.count; i++) {
      let ox = pos.getX(i) - ccx;
      let oy = pos.getY(i) - ccy;
      let oz = pos.getZ(i) - ccz;
      const len = Math.hypot(ox, oy, oz);
      if (len < 1e-6) continue;
      ox /= len; oy /= len; oz /= len;
      const k = CROWN_NORMAL_BLEND;
      const nx = nrm.getX(i) * (1 - k) + ox * k;
      const ny = nrm.getY(i) * (1 - k) + oy * k;
      const nz = nrm.getZ(i) * (1 - k) + oz * k;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nrm.setXYZ(i, nx / nl, ny / nl, nz / nl);
    }
  }
}

/**
 * Merge parts into one indexed geometry in the unit frame.
 *
 * Normalization uses the merged bounding box rather than the trunk alone: a
 * preset's "height" is whatever its tallest leaf reaches, and sizing off the
 * trunk would leave every species overshooting its SPECIES_HEIGHT_M by however
 * much crown sits above the last branch.
 */
function mergeToUnitFrame(parts: Part[]): TreeGeometryData {
  let vertCount = 0;
  let idxCount = 0;
  for (const p of parts) {
    vertCount += p.geo.getAttribute('position').count;
    const idx = p.geo.getIndex();
    idxCount += idx ? idx.count : p.geo.getAttribute('position').count;
  }

  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const colors = new Float32Array(vertCount * 3);
  const indices = new Uint32Array(idxCount);

  let vo = 0;
  let io = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  let cx = 0;
  let cz = 0;

  for (const p of parts) {
    const pos = p.geo.getAttribute('position');
    const nrm = p.geo.getAttribute('normal');
    const idx = p.geo.getIndex();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      positions[(vo + i) * 3] = x;
      positions[(vo + i) * 3 + 1] = y;
      positions[(vo + i) * 3 + 2] = z;
      if (nrm) {
        normals[(vo + i) * 3] = nrm.getX(i);
        normals[(vo + i) * 3 + 1] = nrm.getY(i);
        normals[(vo + i) * 3 + 2] = nrm.getZ(i);
      }
      colors[(vo + i) * 3] = p.rgb[0];
      colors[(vo + i) * 3 + 1] = p.rgb[1];
      colors[(vo + i) * 3 + 2] = p.rgb[2];
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if (idx) {
      for (let i = 0; i < idx.count; i++) indices[io + i] = idx.getX(i) + vo;
      io += idx.count;
    } else {
      for (let i = 0; i < pos.count; i++) indices[io + i] = vo + i;
      io += pos.count;
    }
    vo += pos.count;
  }

  // Center on the trunk axis and normalize height. A preset whose model is
  // already unit-height would divide by ~1 and be left alone.
  const span = maxY - minY;
  const k = span > 1e-6 ? 1 / span : 1;
  for (let i = 0; i < vertCount; i++) {
    cx += positions[i * 3];
    cz += positions[i * 3 + 2];
  }
  cx /= Math.max(1, vertCount);
  cz /= Math.max(1, vertCount);
  for (let i = 0; i < vertCount; i++) {
    positions[i * 3] = (positions[i * 3] - cx) * k;
    positions[i * 3 + 1] = (positions[i * 3 + 1] - minY) * k;
    positions[i * 3 + 2] = (positions[i * 3 + 2] - cz) * k;
  }

  return { positions, normals, colors, indices };
}

/**
 * A vertex is bark if its baked green channel is low.
 *
 * Bark bakes near 0.24 green and foliage near 0.97, so one threshold separates
 * them everywhere — in this file, and in the vertex shader that has to make the
 * same distinction without an extra attribute. Both sides use 0.6; the bark
 * shading below is bounded so it can never cross it.
 */
export const FOLIAGE_COLOR_THRESHOLD = 0.6;

/** Bake the standing-wood value gradient into the merged bark vertices. */
function bakeBarkValue(data: TreeGeometryData): void {
  const n = data.positions.length / 3;
  for (let i = 0; i < n; i++) {
    if (data.colors[i * 3 + 1] >= FOLIAGE_COLOR_THRESHOLD) continue;
    const y = data.positions[i * 3 + 1];
    const t = y <= BARK_PEAK_Y
      ? y / BARK_PEAK_Y
      : 1 - Math.min(1, (y - BARK_PEAK_Y) / Math.max(1e-3, 1 - BARK_PEAK_Y)) * 0.55;
    const ramp = BARK_FOOT_VALUE + (BARK_PEAK_VALUE - BARK_FOOT_VALUE) * Math.min(1, Math.max(0, t));
    // Hash on the vertex's own position so the jitter is stable per variant and
    // does not need a second RNG threaded through the merge.
    const h = Math.sin(
      data.positions[i * 3] * 127.1 + y * 311.7 + data.positions[i * 3 + 2] * 74.7,
    ) * 43758.5453;
    const jitter = 1 + (h - Math.floor(h) - 0.5) * 2 * BARK_JITTER;
    const k = ramp * jitter;
    data.colors[i * 3] = BARK_RGB[0] * k;
    data.colors[i * 3 + 1] = Math.min(FOLIAGE_COLOR_THRESHOLD - 0.05, BARK_RGB[1] * k);
    data.colors[i * 3 + 2] = BARK_RGB[2] * k;
  }
}

/**
 * Root flare, built as its own skirt rather than by pushing the trunk's own
 * vertices outward.
 *
 * ez-tree spaces a trunk's rings evenly along its whole length — eight of them
 * over the bole — so the bottom five percent of the tree contains exactly one
 * ring. Deforming what is there gives a single widened ring and a smooth cone
 * up to the next one, which is a funnel, not a flare. A purpose-built skirt can
 * put three rings in that five percent for 72 triangles, and can be lobed,
 * which is the part that actually reads: real basal swell is a ring of
 * buttresses, not a surface of revolution.
 *
 * The skirt's lowest ring sits slightly BELOW y = 0. The unit frame's contract
 * is that the trunk base is y = 0 and the trunk-to-crown span is 1, and both
 * still hold — normalization happens before this runs. What dips below is the
 * root tips, and they have to, because a flared base standing exactly on y = 0
 * shows daylight under its downhill side on any slope at all.
 */
const FLARE_SIDES = 12;
/** Vertical stations of the skirt, as fractions of FLARE_HEIGHT. */
const FLARE_RINGS: readonly number[] = [-0.14, 0.16, 0.48, 1];
/** Skirt height in the unit frame — about 0.35 m on a 7 m broadleaf. */
const FLARE_HEIGHT = 0.05;
/**
 * Extra radius at the foot, as a fraction of trunk radius, and its ceiling.
 *
 * The cap is what keeps this honest across presets: pine's trunk is already
 * four times an oak's in the unit frame, and a pure ratio would have given it a
 * two-and-a-half-meter foot.
 */
const FLARE_RATIO = 1.25;
const FLARE_MAX_ADD = 0.03;

function appendRootFlare(data: TreeGeometryData, seed: number): TreeGeometryData {
  const n = data.positions.length / 3;
  let baseR = 0;
  let nBase = 0;
  for (let i = 0; i < n; i++) {
    if (data.colors[i * 3 + 1] >= FOLIAGE_COLOR_THRESHOLD) continue;
    if (data.positions[i * 3 + 1] > 0.015) continue;
    baseR += Math.hypot(data.positions[i * 3], data.positions[i * 3 + 2]);
    nBase++;
  }
  // A bush has no bole at ground level, so it has nothing to flare.
  if (nBase < 3) return data;
  baseR /= nBase;
  if (baseR < 1e-4) return data;

  const add = Math.min(baseR * FLARE_RATIO, FLARE_MAX_ADD);
  const rings = FLARE_RINGS.length;
  const vCount = FLARE_SIDES * rings;
  const tCount = FLARE_SIDES * (rings - 1) * 2;

  const pos = new Float32Array(vCount * 3);
  const nrm = new Float32Array(vCount * 3);
  const col = new Float32Array(vCount * 3);
  const idx = new Uint32Array(tCount * 3);

  // Per-lobe amplitude. Buttresses on a real bole are uneven — two or three
  // strong ones and the rest barely there — and an even ring of them reads as a
  // machined collar.
  const lobe: number[] = [];
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let s = 0; s < FLARE_SIDES; s++) {
    h = (Math.imul(h ^ (h >>> 15), 0x85ebca6b) + 0x27d4eb2d) >>> 0;
    lobe.push(0.35 + (h / 0xffffffff) * 0.65);
  }

  const radiusAt = (side: number, t: number): number => {
    const falloff = Math.pow(Math.max(0, 1 - t), 2.2);
    return baseR + add * lobe[side] * falloff;
  };

  for (let r = 0; r < rings; r++) {
    const t = FLARE_RINGS[r];
    const y = t * FLARE_HEIGHT;
    // Slope of the skirt at this station, for the normal. Radius grows
    // downward, so dR/dy is negative and the normal tilts outward AND up.
    const tPrev = FLARE_RINGS[Math.max(0, r - 1)];
    const tNext = FLARE_RINGS[Math.min(rings - 1, r + 1)];
    const dy = Math.max(1e-4, (tNext - tPrev) * FLARE_HEIGHT);
    for (let s = 0; s < FLARE_SIDES; s++) {
      const a = (s / FLARE_SIDES) * Math.PI * 2;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const rad = radiusAt(s, t);
      const dR = (radiusAt(s, tNext) - radiusAt(s, tPrev)) / dy;
      const nr = 1;
      const ny = -dR;
      const nl = Math.hypot(nr, ny) || 1;
      const vi = r * FLARE_SIDES + s;
      pos[vi * 3] = cos * rad;
      pos[vi * 3 + 1] = y;
      pos[vi * 3 + 2] = sin * rad;
      nrm[vi * 3] = (cos * nr) / nl;
      nrm[vi * 3 + 1] = ny / nl;
      nrm[vi * 3 + 2] = (sin * nr) / nl;
      // The foot of a tree is the darkest wood on it — litter, damp and the
      // crown's own shadow all land there — so the skirt starts below
      // BARK_FOOT_VALUE and climbs to meet the bole's own ramp.
      const k = BARK_FOOT_VALUE * (0.72 + 0.28 * Math.max(0, t));
      col[vi * 3] = BARK_RGB[0] * k;
      col[vi * 3 + 1] = BARK_RGB[1] * k;
      col[vi * 3 + 2] = BARK_RGB[2] * k;
    }
  }

  let o = 0;
  for (let r = 0; r < rings - 1; r++) {
    for (let s = 0; s < FLARE_SIDES; s++) {
      const s2 = (s + 1) % FLARE_SIDES;
      const a = r * FLARE_SIDES + s;
      const b = r * FLARE_SIDES + s2;
      const c = (r + 1) * FLARE_SIDES + s;
      const d = (r + 1) * FLARE_SIDES + s2;
      idx[o++] = a; idx[o++] = c; idx[o++] = b;
      idx[o++] = b; idx[o++] = c; idx[o++] = d;
    }
  }

  const base = n;
  const outPos = new Float32Array(data.positions.length + pos.length);
  const outNrm = new Float32Array(data.normals.length + nrm.length);
  const outCol = new Float32Array(data.colors.length + col.length);
  const outIdx = new Uint32Array(data.indices.length + idx.length);
  outPos.set(data.positions); outPos.set(pos, data.positions.length);
  outNrm.set(data.normals); outNrm.set(nrm, data.normals.length);
  outCol.set(data.colors); outCol.set(col, data.colors.length);
  outIdx.set(data.indices);
  for (let i = 0; i < idx.length; i++) outIdx[data.indices.length + i] = idx[i] + base;

  return { positions: outPos, normals: outNrm, colors: outCol, indices: outIdx };
}

/** Per-variant seed stride, shared with the hand-written generator's schedule. */
export const EZ_VARIANT_SEED_STRIDE = 7919;

/** Build one species/variant. Exported for the asset-preview harness. */
export function generateEzTreeGeometry(species: TreeSpecies, seed: number): TreeGeometryData {
  const presetName = SPECIES_PRESET[species];
  const source = (TreePreset as Record<string, unknown>)[presetName]
    ?? (TreePreset as Record<string, unknown>)['Oak Medium'];
  const preset = JSON.parse(JSON.stringify(source)) as Record<string, any>;
  trimPreset(preset, seed, species);

  const tree = new Tree();
  // The vendored library's TreeOptions type is stricter than the preset JSON
  // it ships; the presets ARE its own data files.
  tree.loadFromJson(preset as never);

  reshapeLeafBlades(tree.leavesMesh.geometry as THREE.BufferGeometry);

  const merged = mergeToUnitFrame([
    { geo: tree.branchesMesh.geometry as THREE.BufferGeometry, rgb: BARK_RGB },
    { geo: tree.leavesMesh.geometry as THREE.BufferGeometry, rgb: LEAF_RGB },
  ]);
  // Both of these run after the merge because both are stated in the unit
  // frame: the bark ramp is keyed to height 0..1, and the flare's radius is
  // measured off the normalized trunk.
  bakeBarkValue(merged);
  return appendRootFlare(merged, seed);
}

/**
 * Every species' variants from one world seed.
 *
 * Drop-in for `generateTreeVariantSet`: same signature, same unit frame, same
 * vertex-color convention, so instancing, batching and the species partition
 * are untouched.
 */
export function generateEzTreeVariantSet(seed: number): Record<TreeSpecies, TreeGeometryData[]> {
  const out = {} as Record<TreeSpecies, TreeGeometryData[]>;
  for (const species of TREE_SPECIES) {
    const variants: TreeGeometryData[] = [];
    for (let v = 0; v < VARIANTS_PER_SPECIES; v++) {
      variants.push(generateEzTreeGeometry(species, (seed + v * EZ_VARIANT_SEED_STRIDE) >>> 0));
    }
    out[species] = variants;
  }
  return out;
}

/** Re-exported so callers need only this module to place a tree. */
export { SPECIES_HEIGHT_M, TREE_SPECIES, type TreeSpecies };
