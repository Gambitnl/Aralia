#!/usr/bin/env node
/**
 * paint-surface-mask.mjs — agora-a34b (IDEA - Geometry Painter deterministic
 * surface marking; idea ref `idea:surface-directed-detail-painting`).
 *
 * WHAT THIS PROVES. One deterministic semantic surface-marking SIDECAR: given
 * a fixed creature recipe (seed), this script rebuilds the exact same
 * skeleton segment/ball data Aralia's own procedural body pipeline emits,
 * tessellates it into an explicit triangle mesh (no runtime dependency —
 * plain trig, no `three` BufferGeometry, no WebGL), tags every vertex with a
 * semantic surface category (limb / digit / pad / contact / torso / neck /
 * tail) derived from the segment id that generated it, and writes two
 * canonicalized JSON files plus their SHA-256 hashes:
 *
 *   geometry.json — the mesh itself (vertices, faces, per-vertex source
 *                    segment id). Its hash is the "mesh hash".
 *   mask.json      — the semantic label sidecar, keyed by the mesh hash and
 *                    the recipe seed. Its hash is the "output hash".
 *
 * A minimal top-down + side orthographic PNG (mask-preview.png) visualizes
 * the category paint directly from this script's own vertex buffer, using a
 * hand-rolled PNG encoder (Node's built-in `zlib`, RFC1950 zlib-format IDAT —
 * no new package). This is NOT the "transfer evidence" render — that comes
 * from `capture-transfer-evidence.mjs`, which captures the REAL production
 * mesh through the entity debugger via `tools/entities3d/capture/captureLib.mjs`.
 *
 * PROVENANCE / CANDIDATE IDENTITY. There is no literal `canid-v2` identifier
 * under `src/systems/entities3d` (confirmed by grep) and no Idea Board record
 * for `idea:surface-directed-detail-painting` in `public/idea-board/records.json`
 * (confirmed by grep — the sibling agora-63e3 pass on 2026-09-09 found the
 * same for its own idea ref and documented it in
 * `docs/projects/idea-board/experiments/cascadeur-collision-penetration-cleaning.md`).
 * This script therefore uses the same stand-in this repo has already agreed
 * on: Aralia's deterministic procedural quadruped "beast" body plan
 * (`src/systems/entities3d/creaturePlans.ts` `beastPlan()`, selected by
 * `planForCreature()` for `CreatureType.Beast` — cues are not required; the
 * Beast switch case falls through to `beastPlan('Beast', h, b)` whenever no
 * bird/frog/spider cue is present, so plain `CreatureType.Beast` with no cues
 * already resolves to the same quadruped the entity debugger renders for
 * `?type=Beast`). Call this the **canid-v2 stand-in**, same as agora-63e3.
 *
 * WHY PURE NODE. `creaturePlans.ts`/`gaits.ts`/`compilePlan.ts` depend only on
 * `three`'s math classes (Matrix4/Quaternion/Vector3), not WebGL/DOM, so the
 * skeleton can be sampled deterministically under plain Node via `tsx` — no
 * browser, no dev server, no GPU context, not a "heavy command" per
 * AGENTS.md rule 6.
 *
 * USAGE
 *   npx tsx tools/geometry-painter/paint-surface-mask.mjs
 *
 * Deterministic: fixed seed, fixed pose (idle, phase 0), fixed tessellation
 * constants. Re-running produces byte-identical geometry.json/mask.json and
 * hashes as long as creaturePlans.ts/gaits.ts/compilePlan.ts are unchanged —
 * this is verified by running the script twice and diffing the hashes (see
 * the living doc's Run log).
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

import { rngFromPath, streamPath, makeSeedPath, fnv1a } from '../../src/systems/worldforge/seedPath.ts';
import { profileForCreature } from '../../src/systems/entities3d/creatureProfiles.ts';
import { planForCreature, bellyToneFor } from '../../src/systems/entities3d/creaturePlans.ts';
import { compilePlan } from '../../src/systems/entities3d/textPlan/compilePlan.ts';
import { createGaitDriver } from '../../src/systems/entities3d/three/gaits.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(REPO, '.agent', 'scratch', 'agora-a34b');

// ---- fixed candidate identity (the "canid-v2" stand-in) --------------------
const RECIPE = Object.freeze({
  kind: 'creature',
  creatureType: 'Beast',
  size: 'Medium',
  seed: 'agora-a34b:geometry-painter-canid-v2-surface-mask',
  cues: ['wolf', 'beast', 'hound'],
});

// Rest pose: idle (speed 0) at phase 0 — a static pose is what a surface
// mask should be painted onto, not a mid-stride sample.
const PHASE = 0;
const SPEED_MPS = 0;

// Tessellation constants — fixed, so mesh topology (and therefore mesh hash)
// is a pure function of the recipe, not of any external RNG draw.
const CAPSULE_RINGS = 8; // circumference segments
const CAPSULE_STACKS = 3; // length segments between the two caps
const CAP_RINGS = 2; // latitude rings per hemispherical cap
const SPHERE_RINGS = 6; // ball tessellation
const SPHERE_STACKS = 4;

// ---- semantic category legend ----------------------------------------------
// Mirrors the collider-mapping family table in
// docs/projects/idea-board/experiments/cascadeur-collision-penetration-cleaning.md
// (same segment id families, same body). One id -> exactly one category.
const CATEGORY_RULES = [
  [/^leg\d[LR]\.toe\d(c)?$/, 'digit'],
  [/^leg\d[LR]\.toePad$/, 'pad'],
  [/^leg\d[LR]\.foot$/, 'contact'],
  [/^leg\d[LR]\./, 'limb'],
  [/^mass\./, 'torso'],
  [/^spine\./, 'torso'],
  [/^neck\d\./, 'neck'],
  [/^tail\d\./, 'tail'],
];
function categoryFor(id) {
  for (const [re, cat] of CATEGORY_RULES) if (re.test(id)) return cat;
  return 'other';
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
    return out;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? Number(value.toFixed(6)) : value;
  return value;
}

function sha256(str) {
  return createHash('sha256').update(str, 'utf8').digest('hex');
}

function writeJsonWithHash(name, obj) {
  const canonical = canonicalize(obj);
  const json = `${JSON.stringify(canonical, null, 2)}\n`;
  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${name}.json`);
  writeFileSync(outPath, json, 'utf8');
  const hash = sha256(json);
  writeFileSync(path.join(OUT_DIR, `${name}.sha256`), `${hash}  ${name}.json\n`, 'utf8');
  return { path: outPath, hash, json };
}

function uniform(rng, lo, hi) {
  return lo + rng.next() * (hi - lo);
}

/** Duplicated from agora-63e3's export script (same reason: avoid pulling in
 * generateEntityBlueprint.ts's Vite-only `import.meta.glob()` races data). */
function buildBlueprint(recipe) {
  const base = makeSeedPath(fnv1a(recipe.seed), `entity:${fnv1a(`salt:${recipe.seed}`)}`);
  const frameRng = rngFromPath(streamPath(base, 'frame'));
  const anatomyRng = rngFromPath(streamPath(base, 'anatomy'));

  const resolved = profileForCreature(recipe.creatureType, recipe.size, recipe.cues ?? []);
  const heightFt = resolved.frame.heightFt * uniform(frameRng, 0.92, 1.08);
  const bulk = resolved.frame.bulk * uniform(frameRng, 0.9, 1.1);
  const template = planForCreature(recipe.creatureType, recipe.size, recipe.cues ?? [], heightFt, bulk, anatomyRng);
  if (!template) {
    throw new Error(`entities3d: recipe ${JSON.stringify(recipe)} has no plan template (planForCreature returned null).`);
  }
  const skinHex = '#8a7a63';
  return compilePlan({
    ...template,
    palette: {
      bodyHex: skinHex,
      accentHex: resolved.palette.accentHex,
      bellyHex: bellyToneFor(skinHex),
      eyeHex: resolved.palette.eyeHex,
    },
  });
}

function collectSkeleton() {
  const blueprint = buildBlueprint(RECIPE);
  if (blueprint.gait !== 'plan' || !blueprint.planSpec) {
    throw new Error(`entities3d: recipe ${JSON.stringify(RECIPE)} did not resolve to a compiled 'plan' quadruped (got gait="${blueprint.gait}").`);
  }
  const driver = createGaitDriver('plan', blueprint.frame, blueprint.planSpec);
  const loco = { position: { x: 0, y: 0, z: 0 }, heading: { x: 0, y: 0, z: 1 }, speed: SPEED_MPS };
  driver.setPhase(PHASE);
  driver.update(PHASE, 0, loco);

  const segs = [];
  const balls = [];
  const sink = {
    seg(id, ax, ay, az, bx, by, bz, r0, r1) {
      segs.push({ id, a: [ax, ay, az], b: [bx, by, bz], r0, r1 });
    },
    ball(id, x, y, z, r) {
      balls.push({ id, c: [x, y, z], r });
    },
  };
  driver.buildBody(sink);
  segs.sort((s1, s2) => (s1.id < s2.id ? -1 : s1.id > s2.id ? 1 : 0));
  balls.sort((s1, s2) => (s1.id < s2.id ? -1 : s1.id > s2.id ? 1 : 0));
  return { blueprint, segs, balls };
}

// ---- deterministic tessellation --------------------------------------------
// Pure trig, no `three` geometry classes — this is the "no new runtime
// dependency" boundary: nothing here touches BufferGeometry/WebGL, and
// nothing in src/ imports this file.

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function length(a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); }
function normalize(a) { const l = length(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

/** Orthonormal basis with `axis` as the "up" (local Y). Deterministic pick of
 * a reference vector so the ring seam is stable across runs. */
function basisFor(axis) {
  const ref = Math.abs(axis[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0];
  const x = normalize(cross(ref, axis));
  const z = normalize(cross(axis, x));
  return { x, y: axis, z };
}

/** One capsule (segment a->b, radius r0 at a, r1 at b) as a triangle mesh.
 * Returns { positions: [[x,y,z],...], faces: [[i,j,k],...] } in LOCAL vertex
 * indices (0-based, caller offsets into the combined buffer). */
function tessellateCapsule(a, b, r0, r1) {
  const axisVec = sub(b, a);
  const axisLen = length(axisVec) || 1e-6;
  const axis = normalize(axisVec);
  const { x: ex, z: ez } = basisFor(axis);
  const positions = [];
  const rings = []; // ring index -> array of vertex indices

  const ringAt = (center, radius) => {
    const idxs = [];
    for (let i = 0; i < CAPSULE_RINGS; i++) {
      const theta = (i / CAPSULE_RINGS) * Math.PI * 2;
      const dir = add(scale(ex, Math.cos(theta)), scale(ez, Math.sin(theta)));
      positions.push(add(center, scale(dir, radius)));
      idxs.push(positions.length - 1);
    }
    return idxs;
  };

  // Body rings (stacks+1 rings) lerping radius r0->r1 along the axis.
  for (let s = 0; s <= CAPSULE_STACKS; s++) {
    const t = s / CAPSULE_STACKS;
    const center = add(a, scale(axisVec, t));
    const radius = r0 + (r1 - r0) * t;
    rings.push(ringAt(center, radius));
  }

  // Hemispherical start cap (below `a`, bulging toward -axis) and end cap
  // (above `b`, bulging toward +axis) — small fixed lat rings, closing at a
  // single pole vertex each so the capsule is watertight.
  const capRings = (poleCenter, poleOutward, baseRing, baseCenter, baseRadius) => {
    const out = [];
    for (let lat = 1; lat <= CAP_RINGS; lat++) {
      const phi = (lat / (CAP_RINGS + 1)) * (Math.PI / 2); // 0..~90deg
      const ringRadius = baseRadius * Math.cos(phi);
      const ringHeight = baseRadius * Math.sin(phi);
      const center = add(baseCenter, scale(poleOutward, ringHeight));
      out.push(ringAt(center, ringRadius));
    }
    positions.push(add(baseCenter, scale(poleOutward, baseRadius)));
    const poleIdx = positions.length - 1;
    return { rings: out, poleIdx };
  };
  const startCap = capRings(a, scale(axis, -1), rings[0], a, r0);
  const endCap = capRings(b, axis, rings[rings.length - 1], b, r1);

  const faces = [];
  const stitchRings = (ringA, ringB) => {
    for (let i = 0; i < CAPSULE_RINGS; i++) {
      const i2 = (i + 1) % CAPSULE_RINGS;
      faces.push([ringA[i], ringB[i], ringB[i2]]);
      faces.push([ringA[i], ringB[i2], ringA[i2]]);
    }
  };
  const stitchPole = (poleIdx, ring, flip) => {
    for (let i = 0; i < CAPSULE_RINGS; i++) {
      const i2 = (i + 1) % CAPSULE_RINGS;
      faces.push(flip ? [poleIdx, ring[i2], ring[i]] : [poleIdx, ring[i], ring[i2]]);
    }
  };

  // start cap: pole -> first lat ring -> ... -> body ring 0
  const startChain = [...startCap.rings].reverse().concat([rings[0]]);
  stitchPole(startCap.poleIdx, startChain[0], true);
  for (let i = 0; i + 1 < startChain.length; i++) stitchRings(startChain[i], startChain[i + 1]);
  // body rings
  for (let s = 0; s + 1 < rings.length; s++) stitchRings(rings[s], rings[s + 1]);
  // end cap: body ring last -> lat rings -> pole
  const endChain = [rings[rings.length - 1], ...endCap.rings];
  for (let i = 0; i + 1 < endChain.length; i++) stitchRings(endChain[i], endChain[i + 1]);
  stitchPole(endCap.poleIdx, endChain[endChain.length - 1], false);

  return { positions, faces };
}

/** One UV sphere for a `ball()` (center c, radius r). */
function tessellateSphere(c, r) {
  const positions = [];
  const rings = [];
  for (let lat = 1; lat < SPHERE_STACKS; lat++) {
    const phi = (lat / SPHERE_STACKS) * Math.PI; // 0..PI
    const y = Math.cos(phi);
    const ringR = Math.sin(phi);
    const idxs = [];
    for (let i = 0; i < SPHERE_RINGS; i++) {
      const theta = (i / SPHERE_RINGS) * Math.PI * 2;
      positions.push(add(c, scale([ringR * Math.cos(theta), y, ringR * Math.sin(theta)], r)));
      idxs.push(positions.length - 1);
    }
    rings.push(idxs);
  }
  positions.push(add(c, [0, r, 0]));
  const topPole = positions.length - 1;
  positions.push(add(c, [0, -r, 0]));
  const botPole = positions.length - 1;

  const faces = [];
  for (let i = 0; i < SPHERE_RINGS; i++) {
    const i2 = (i + 1) % SPHERE_RINGS;
    faces.push([topPole, rings[0][i2], rings[0][i]]);
    faces.push([botPole, rings[rings.length - 1][i], rings[rings.length - 1][i2]]);
  }
  for (let s = 0; s + 1 < rings.length; s++) {
    for (let i = 0; i < SPHERE_RINGS; i++) {
      const i2 = (i + 1) % SPHERE_RINGS;
      faces.push([rings[s][i], rings[s + 1][i], rings[s + 1][i2]]);
      faces.push([rings[s][i], rings[s + 1][i2], rings[s][i2]]);
    }
  }
  return { positions, faces };
}

function buildMesh(segs, balls) {
  const vertices = [];
  const faces = [];
  const vertexSourceId = [];
  const vertexCategory = [];
  const sourceSegments = [];

  const addPiece = (id, piece) => {
    const offset = vertices.length;
    for (const p of piece.positions) {
      vertices.push(p);
      vertexSourceId.push(id);
      vertexCategory.push(categoryFor(id));
    }
    for (const f of piece.faces) faces.push([f[0] + offset, f[1] + offset, f[2] + offset]);
    sourceSegments.push({ id, category: categoryFor(id), vertexStart: offset, vertexCount: piece.positions.length });
  };

  for (const s of segs) addPiece(s.id, tessellateCapsule(s.a, s.b, s.r0, s.r1));
  for (const b of balls) addPiece(b.id, tessellateSphere(b.c, b.r));

  return { vertices, faces, vertexSourceId, vertexCategory, sourceSegments };
}

// ---- minimal PNG encoder (built-in zlib only, no new dependency) ----------
function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
/** `pixels` is a flat RGB Uint8Array, width*height*3. */
function encodePng(width, height, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0; // filter: none
    pixels.copy(raw, rowStart + 1, y * width * 3, (y + 1) * width * 3);
  }
  const idat = deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const CATEGORY_COLOR = {
  limb: [66, 133, 244],
  digit: [251, 188, 5],
  pad: [234, 67, 53],
  contact: [154, 160, 166],
  torso: [52, 168, 83],
  neck: [171, 71, 188],
  tail: [255, 112, 67],
  other: [120, 120, 120],
};

/** Orthographic projection of the vertex buffer onto `axes` (e.g. ['x','y']
 * for a front view), one filled circle per vertex, colored by category. Pure
 * canvas-free rasterization — deterministic, no dependency on the DOM. */
function rasterizeProjection(vertices, vertexCategory, axes, size) {
  const ai = { x: 0, y: 1, z: 2 }[axes[0]];
  const bi = { x: 0, y: 1, z: 2 }[axes[1]];
  let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
  for (const v of vertices) {
    minA = Math.min(minA, v[ai]); maxA = Math.max(maxA, v[ai]);
    minB = Math.min(minB, v[bi]); maxB = Math.max(maxB, v[bi]);
  }
  const pad = 8;
  const spanA = Math.max(maxA - minA, 1e-6);
  const spanB = Math.max(maxB - minB, 1e-6);
  const scaleFactor = Math.min((size - 2 * pad) / spanA, (size - 2 * pad) / spanB);
  const pixels = Buffer.alloc(size * size * 3, 245); // light background

  for (let vi = 0; vi < vertices.length; vi++) {
    const v = vertices[vi];
    const px = Math.round(pad + (v[ai] - minA) * scaleFactor);
    // flip B (world "up"/"forward") to image-down so the silhouette reads upright
    const py = Math.round(size - pad - (v[bi] - minB) * scaleFactor);
    const [r, g, bcol] = CATEGORY_COLOR[vertexCategory[vi]] || CATEGORY_COLOR.other;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = px + dx, y = py + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const idx = (y * size + x) * 3;
        pixels[idx] = r; pixels[idx + 1] = g; pixels[idx + 2] = bcol;
      }
    }
  }
  return pixels;
}

function buildMaskPreviewPng(vertices, vertexCategory) {
  const size = 256;
  const top = rasterizeProjection(vertices, vertexCategory, ['x', 'z'], size); // top-down
  const side = rasterizeProjection(vertices, vertexCategory, ['z', 'y'], size); // side view
  const gutter = 8;
  const width = size * 2 + gutter;
  const height = size;
  const combined = Buffer.alloc(width * height * 3, 255);
  for (let y = 0; y < size; y++) {
    top.copy(combined, (y * width) * 3, y * size * 3, (y + 1) * size * 3);
    side.copy(combined, (y * width + size + gutter) * 3, y * size * 3, (y + 1) * size * 3);
  }
  return encodePng(width, height, combined);
}

function main() {
  const { blueprint, segs, balls } = collectSkeleton();
  const mesh = buildMesh(segs, balls);

  const geometryDoc = {
    schema: 'agora-a34b.geometry.v1',
    idea: 'idea:surface-directed-detail-painting',
    task: 'agora-a34b',
    candidateLabel: 'canid-v2 (stand-in: deterministic wolf/beast quadruped plan, same identity agora-63e3 used)',
    recipe: RECIPE,
    pose: { phase: PHASE, speedMps: SPEED_MPS },
    tessellation: { capsuleRings: CAPSULE_RINGS, capsuleStacks: CAPSULE_STACKS, capRings: CAP_RINGS, sphereRings: SPHERE_RINGS, sphereStacks: SPHERE_STACKS },
    frame: blueprint.frame,
    vertexCount: mesh.vertices.length,
    faceCount: mesh.faces.length,
    vertices: mesh.vertices,
    faces: mesh.faces,
    sourceSegments: mesh.sourceSegments,
  };
  const geometryOut = writeJsonWithHash('geometry', geometryDoc);
  const meshHash = geometryOut.hash;

  const categoryCounts = {};
  for (const c of mesh.vertexCategory) categoryCounts[c] = (categoryCounts[c] || 0) + 1;

  const maskDoc = {
    schema: 'agora-a34b.mask.v1',
    idea: 'idea:surface-directed-detail-painting',
    task: 'agora-a34b',
    seed: RECIPE.seed,
    meshHash,
    meshVertexCount: mesh.vertices.length,
    semantics: {
      description: 'One category per vertex, derived deterministically from the source skeleton segment/ball id that generated the vertex (see sourceSegments in geometry.json). Categories mirror the collider-family table in docs/projects/idea-board/experiments/cascadeur-collision-penetration-cleaning.md.',
      legend: {
        limb: 'leg capsule links (upper/lower, fore and hind)',
        digit: 'toe segments (three-toe foot chain)',
        pad: 'toe pad capsule under the digits',
        contact: 'ground-contact foot ball',
        torso: 'spine chain + authored mass lumps (brisket/withers/shoulder/haunch)',
        neck: 'neck capsule chain',
        tail: 'tail capsule chain',
        other: 'unmatched id (should be empty for this recipe; a non-empty count is a category-rule gap)',
      },
      categoryCounts,
    },
    toolProvenance: {
      script: 'tools/geometry-painter/paint-surface-mask.mjs',
      generatedBy: 'agora-a34b (idea-geopainter-20260909)',
      pipeline: 'profileForCreature -> planForCreature -> compilePlan -> createGaitDriver(\'plan\').buildBody, then a hand-written capsule/sphere tessellator (no three.js BufferGeometry, no runtime dependency)',
      runtimeImpact: 'none — this script is not imported by anything under src/ and is not part of the game bundle',
      promoted: false,
    },
    vertexCategory: mesh.vertexCategory,
  };
  const maskOut = writeJsonWithHash('mask', maskDoc);

  const pngBuf = buildMaskPreviewPng(mesh.vertices, mesh.vertexCategory);
  mkdirSync(OUT_DIR, { recursive: true });
  const pngPath = path.join(OUT_DIR, 'mask-preview.png');
  writeFileSync(pngPath, pngBuf);
  const pngHash = createHash('sha256').update(pngBuf).digest('hex');
  writeFileSync(path.join(OUT_DIR, 'mask-preview.sha256'), `${pngHash}  mask-preview.png\n`, 'utf8');

  console.log('recipe.seed:', RECIPE.seed);
  console.log('geometry written:', path.relative(REPO, geometryOut.path), 'mesh_hash(sha256):', meshHash);
  console.log('mask written:', path.relative(REPO, maskOut.path), 'output_hash(sha256):', maskOut.hash);
  console.log('mask-preview.png written:', path.relative(REPO, pngPath), 'sha256:', pngHash);
  console.log('vertexCount:', mesh.vertices.length, 'faceCount:', mesh.faces.length, 'categoryCounts:', JSON.stringify(categoryCounts));
}

main();
