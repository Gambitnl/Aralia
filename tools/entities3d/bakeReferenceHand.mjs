/**
 * @file bakeReferenceHand.mjs — bake the licensed reference hand into the
 * entity engine.
 *
 * Source: public/references/hand.glb — "Low Poly Hand" by ronildo.facanha
 * (Sketchfab), CC-BY 4.0. The GLB carries one canonical 512-vert hand
 * duplicated as four identical instances; this script extracts the first,
 * canonicalizes it into the engine's palm frame (+Y fingers, +X thumb side
 * for the sgn=+1 hand, +Z palm face; wrist at the origin; handR = 1 length
 * unit via the palm-length anchor), computes per-vertex link weights for the
 * digit wrap, and writes src/systems/entities3d/three/referenceHandMesh.ts.
 *
 * Run: node tools/entities3d/bakeReferenceHand.mjs
 * Diagnostics land in .agent/scratch/part-quality/refhand-bake/.
 *
 * The hands campaign (GOAL-part-quality-campaign) closed on Remy's GO:
 * the licensed mesh IS the humanoid hand; smoothBipedGeometry wraps its
 * digits onto the bipedHandDigits rest layout at merge time.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '')), '..', '..');
const GLB = path.join(ROOT, 'public', 'references', 'hand.glb');
const OUT_TS = path.join(ROOT, 'src', 'systems', 'entities3d', 'three', 'referenceHandMesh.ts');
const DIAG = path.join(ROOT, '.agent', 'scratch', 'part-quality', 'refhand-bake');
fs.mkdirSync(DIAG, { recursive: true });

// ---------- GLB parse ----------
const buf = fs.readFileSync(GLB);
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
const binStart = 20 + jsonLen + 8;
function acc(i) {
  const a = json.accessors[i];
  const bv = json.bufferViews[a.bufferView];
  const off = binStart + (bv.byteOffset || 0) + (a.byteOffset || 0);
  if (a.componentType === 5126) return new Float32Array(buf.buffer, buf.byteOffset + off, a.count * (a.type === 'VEC3' ? 3 : a.type === 'VEC2' ? 2 : 1));
  if (a.componentType === 5125) return new Uint32Array(buf.buffer, buf.byteOffset + off, a.count);
  throw new Error('unsupported componentType ' + a.componentType);
}
const prim = json.meshes[0].primitives[0];
const srcPos = acc(prim.attributes.POSITION);
const srcIdx = acc(prim.indices);
const nSrc = srcPos.length / 3;

// ---------- analysis helpers ----------
const v3 = (x = 0, y = 0, z = 0) => [x, y, z];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => mul(a, 1 / len(a));
const at = (arr, i) => [arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]];

// weld (analysis only — the emitted mesh keeps the authored splits so
// computeVertexNormals preserves the hard facet edges)
const weldMap = new Map();
const uni = [];
for (let i = 0; i < nSrc; i++) {
  const p = at(srcPos, i);
  const k = p.map((v) => v.toFixed(3)).join(',');
  if (!weldMap.has(k)) {
    weldMap.set(k, uni.length);
    uni.push(p);
  }
}

// PCA on welded verts
const mean = mul(uni.reduce((s, v) => add(s, v), v3()), 1 / uni.length);
const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
for (const v of uni) {
  const d = sub(v, mean);
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += d[a] * d[b];
}
function topEig(M) {
  let v = [1, 0.3, 0.7];
  for (let it = 0; it < 300; it++) {
    const w = [0, 1, 2].map((a) => M[a][0] * v[0] + M[a][1] * v[1] + M[a][2] * v[2]);
    v = norm(w);
  }
  const Mv = [0, 1, 2].map((a) => M[a][0] * v[0] + M[a][1] * v[1] + M[a][2] * v[2]);
  return { v, l: len(Mv) };
}
const e1 = topEig(C);
const C2 = C.map((r, a) => r.map((x, b) => x - e1.l * e1.v[a] * e1.v[b]));
const e2 = topEig(C2);
const C3 = C2.map((r, a) => r.map((x, b) => x - e2.l * e2.v[a] * e2.v[b]));
const e3 = topEig(C3);

// finger direction: +e1 toward the fingertips (they sit toward (-x, +z))
let F = dot(e1.v, [-0.5, 0, 0.85]) > 0 ? e1.v : mul(e1.v, -1);
// thumb tip: the vertex farthest along e2 on the +y lobe
let T2 = dot(e2.v, [0, 1, 0]) > 0 ? e2.v : mul(e2.v, -1);
let thumbTip = uni[0];
for (const v of uni) if (dot(sub(v, mean), T2) > dot(sub(thumbTip, mean), T2)) thumbTip = v;
// palm normal: e3 signed toward the thumb side (the relaxed thumb rides
// slightly palm-ward of the hand plane)
let N = dot(sub(thumbTip, mean), e3.v) > 0 ? e3.v : mul(e3.v, -1);

// orthonormal canonical basis: yAxis = fingers, zAxis = palm face, xAxis = y×z
const yAxis = norm(F);
let zAxis = norm(sub(N, mul(yAxis, dot(N, yAxis))));
const xAxis = norm(cross(yAxis, zAxis));
// the mesh must be the sgn=+1 hand: thumb on +x
if (dot(sub(thumbTip, mean), xAxis) < 0) throw new Error('thumb landed on -x: handedness assumption broken');

const toCanonRaw = (p) => {
  const d = sub(p, mean);
  return [dot(d, xAxis), dot(d, yAxis), dot(d, zAxis)];
};
const cUni = uni.map(toCanonRaw);

// ---------- wrist waist: minimum cross-section between stump and palm ----------
const ys = cUni.map((p) => p[1]);
const yLo = Math.min(...ys);
const yHi = Math.max(...ys);
let wristY = yLo;
let wristMin = Infinity;
// scan the lower half for the narrowest slice (the wrist waist)
for (let y = yLo + (yHi - yLo) * 0.12; y < yLo + (yHi - yLo) * 0.55; y += (yHi - yLo) / 80) {
  const slab = cUni.filter((p) => Math.abs(p[1] - y) < (yHi - yLo) / 40);
  if (slab.length < 6) continue;
  const w = Math.max(...slab.map((p) => Math.hypot(p[0], p[2])));
  if (w < wristMin) {
    wristMin = w;
    wristY = y;
  }
}
const wristSlab = cUni.filter((p) => Math.abs(p[1] - wristY) < (yHi - yLo) / 30);
const wristC = mul(wristSlab.reduce((s, p) => add(s, p), v3()), 1 / wristSlab.length);
console.log('wrist waist at y=%s r=%s center=%s', wristY.toFixed(1), wristMin.toFixed(1), wristC.map((v) => v.toFixed(1)).join(','));

// recenter: wrist at origin
const cUni2 = cUni.map((p) => sub(p, [wristC[0], wristY, wristC[2]]));

// ---------- finger clusters (pre-scale) ----------
// knuckle region estimate: fingers occupy the top of the y range
const yTop = Math.max(...cUni2.map((p) => p[1]));
// thumb verts: far +x beyond the palm edge OR near the thumb tip direction
const thumbTipC = sub(toCanonRaw(thumbTip), [wristC[0], wristY, wristC[2]]);
console.log('canonical thumb tip:', thumbTipC.map((v) => v.toFixed(1)).join(','));
// fingers + thumb: connected components of the welded mesh above the cut —
// the digits are separate tubes topologically, so components split them
// cleanly no matter how the fan spreads in x.
const cutY = yTop * 0.5;
const weldOf = new Array(nSrc);
for (let i = 0; i < nSrc; i++) weldOf[i] = weldMap.get(at(srcPos, i).map((v) => v.toFixed(3)).join(','));
const adj = new Map();
const link = (a, b) => {
  if (!adj.has(a)) adj.set(a, new Set());
  adj.get(a).add(b);
};
for (let t = 0; t < srcIdx.length; t += 3) {
  const w = [weldOf[srcIdx[t]], weldOf[srcIdx[t + 1]], weldOf[srcIdx[t + 2]]];
  link(w[0], w[1]); link(w[1], w[0]); link(w[1], w[2]); link(w[2], w[1]); link(w[2], w[0]); link(w[0], w[2]);
}
function components(pred) {
  const seen2 = new Set();
  const out = [];
  for (let i = 0; i < uni.length; i++) {
    if (seen2.has(i) || !pred(cUni2[i])) continue;
    const comp = [];
    const stack = [i];
    seen2.add(i);
    while (stack.length) {
      const v = stack.pop();
      comp.push(cUni2[v]);
      for (const nb of adj.get(v) ?? []) {
        if (!seen2.has(nb) && pred(cUni2[nb])) {
          seen2.add(nb);
          stack.push(nb);
        }
      }
    }
    if (comp.length >= 8) out.push(comp);
  }
  return out;
}
const clusters = components((p) => p[1] > cutY);
// the thumb rides low and lateral — its own component pass on the +x wing
const xMax = Math.max(...cUni2.map((p) => p[0]));
const thumbComps = components((p) => p[0] > xMax * 0.58 && p[1] > 0);
console.log('finger components:', clusters.map((c) => `n=${c.length} x=${(c.reduce((s, p) => s + p[0], 0) / c.length).toFixed(1)}`).join(' | '));
console.log('thumb components:', thumbComps.map((c) => `n=${c.length} x=${(c.reduce((s, p) => s + p[0], 0) / c.length).toFixed(1)}`).join(' | '));

// per-cluster digit chain: root (min proj on cluster axis) → tip (max proj)
function digitChain(cluster) {
  const m = mul(cluster.reduce((s, p) => add(s, p), v3()), 1 / cluster.length);
  const Cc = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of cluster) {
    const d = sub(p, m);
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) Cc[a][b] += d[a] * d[b];
  }
  let axis = topEig(Cc).v;
  if (axis[1] < 0) axis = mul(axis, -1); // digits point +y-ish
  const proj = cluster.map((p) => dot(sub(p, m), axis));
  const lo = Math.min(...proj);
  const hi = Math.max(...proj);
  // root/tip on the axis; pull the root slightly toward the cluster mean of
  // the base ring so a splayed low-poly base does not skew it
  return { root: add(m, mul(axis, lo)), tip: add(m, mul(axis, hi)), axis, len: hi - lo };
}

// ---------- report + diagnostics, then scale ----------
// four finger components, pinky → index (ascending x, FINGER_COLS order)
const withX = clusters.map((c) => ({ c, x: c.reduce((s, p) => s + p[0], 0) / c.length }));
withX.sort((a, b) => a.x - b.x);
if (withX.length !== 4) throw new Error(`expected 4 finger components, got ${withX.length}`);
const fingerClusters = withX.map((e) => e.c);
if (thumbComps.length < 1) throw new Error('no thumb component found');
const thumbCluster = thumbComps.sort((a, b) => b.length - a.length)[0];
const fingerChains = fingerClusters.map(digitChain);
const knuckleY = Math.min(...fingerChains.map((f) => f.root[1]));
console.log('knuckleY=%s (yTop=%s)', knuckleY.toFixed(1), yTop.toFixed(1));

// scale anchor: knuckle line lands at palmLen = 1.28 handR
const S = 1.28 / knuckleY;
console.log('scale S=%s → 1 unit = 1 handR', S.toFixed(5));

const scale3 = (p) => mul(p, S);
const canon = [];
for (let i = 0; i < nSrc; i++) {
  const p = sub(toCanonRaw(at(srcPos, i)), [wristC[0], wristY, wristC[2]]);
  canon.push(scale3(p));
}
const fingersScaled = fingerChains.map((f) => ({ root: scale3(f.root), tip: scale3(f.tip), axis: f.axis, len: f.len * S }));
const thumbScaled = thumbCluster ? (() => { const d = digitChain(thumbCluster); return { root: scale3(d.root), tip: scale3(d.tip), axis: d.axis, len: d.len * S }; })() : null;
for (const [i, f] of fingersScaled.entries()) {
  console.log('finger %d root=%s tip=%s len=%s', i, f.root.map((v) => v.toFixed(2)).join(','), f.tip.map((v) => v.toFixed(2)).join(','), f.len.toFixed(2));
}
if (thumbScaled) console.log('thumb root=%s tip=%s len=%s', thumbScaled.root.map((v) => v.toFixed(2)).join(','), thumbScaled.tip.map((v) => v.toFixed(2)).join(','), thumbScaled.len.toFixed(2));
console.log('canonical bounds: x[%s], y[%s], z[%s]',
  [Math.min(...canon.map((p) => p[0])), Math.max(...canon.map((p) => p[0]))].map((v) => v.toFixed(2)).join(','),
  [Math.min(...canon.map((p) => p[1])), Math.max(...canon.map((p) => p[1]))].map((v) => v.toFixed(2)).join(','),
  [Math.min(...canon.map((p) => p[2])), Math.max(...canon.map((p) => p[2]))].map((v) => v.toFixed(2)).join(','));

// ---------- diagnostic SVGs ----------
function diagSVG(name, fx, fy, marks = []) {
  let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
  const P = canon.map((v) => {
    const x = fx(v), y = fy(v);
    mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y);
    return [x, y];
  });
  const W = 640, H = 640, pad = 40;
  const sc = Math.min((W - 2 * pad) / (mxx - mnx), (H - 2 * pad) / (mxy - mny));
  const px = ([x, y]) => [(x - mnx) * sc + pad, H - ((y - mny) * sc + pad)];
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#fff">`;
  // unit grid
  for (let g = Math.ceil(mnx); g <= mxx; g += 0.5) {
    const [gx] = px([g, 0]);
    s += `<line x1="${gx}" y1="0" x2="${gx}" y2="${H}" stroke="${Number.isInteger(g) ? '#fbb' : '#eee'}" stroke-width="1"/>`;
  }
  for (let g = Math.ceil(mny); g <= mxy; g += 0.5) {
    const [, gy] = px([0, g]);
    s += `<line x1="0" y1="${gy}" x2="${W}" y2="${gy}" stroke="${Number.isInteger(g) ? '#fbb' : '#eee'}" stroke-width="1"/>`;
  }
  const seen = new Set();
  for (let t = 0; t < srcIdx.length; t += 3) {
    for (const [a, b] of [[srcIdx[t], srcIdx[t + 1]], [srcIdx[t + 1], srcIdx[t + 2]], [srcIdx[t + 2], srcIdx[t]]]) {
      const k = a < b ? a + '_' + b : b + '_' + a;
      if (seen.has(k)) continue;
      seen.add(k);
      const [x1, y1] = px(P[a]), [x2, y2] = px(P[b]);
      s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#245" stroke-width="0.7"/>`;
    }
  }
  for (const [mp, color] of marks) {
    const [mx, my] = px([fx(mp), fy(mp)]);
    s += `<circle cx="${mx}" cy="${my}" r="5" fill="${color}"/>`;
  }
  s += `<text x="10" y="22" font-size="15">${name} (grid 0.5 handR, red = integer)</text></svg>`;
  fs.writeFileSync(path.join(DIAG, name + '.svg'), s);
}
const chainMarks = [];
for (const f of fingersScaled) chainMarks.push([f.root, '#e33'], [f.tip, '#3a3']);
if (thumbScaled) chainMarks.push([thumbScaled.root, '#e90'], [thumbScaled.tip, '#90e']);
diagSVG('canon-front-XY', (v) => v[0], (v) => v[1], chainMarks);
diagSVG('canon-side-ZY', (v) => v[2], (v) => v[1], chainMarks);
diagSVG('canon-top-XZ', (v) => v[0], (v) => -v[2], chainMarks);

// ---------- stump trim ----------
// clamp, not cut: triangle trimming left a jagged open rim whose sliver
// survivors rendered as needle spikes off the wrist (dwarf capture,
// 2026-08-21). Clamping squashes the deep stump onto the keep plane — every
// triangle survives, the flattened end stays buried inside the forearm loft.
const STUMP_KEEP = -0.9; // handR units below the wrist
let clamped = 0;
for (const p of canon) {
  if (p[1] < STUMP_KEEP) {
    p[1] = STUMP_KEEP;
    clamped++;
  }
}
const outPos = [];
for (const p of canon) outPos.push(...p);
const outIdx = Array.from(srcIdx);
const nOut = outPos.length / 3;
console.log('stump clamp: %d verts squashed to y=%s; %d verts, %d tris', clamped, STUMP_KEEP, nOut, outIdx.length / 3);

// ---------- link weights (bind chains = straight mesh digits) ----------
// link ids (mirror in referenceHandMesh.ts REF_HAND_LINKS)
const L = { palm: 0, stump: 1, thumbA: 2, thumbB: 3, f0a: 4, f0b: 5, f1a: 6, f1b: 7, f2a: 8, f2b: 9, f3a: 10, f3b: 11 };
// bind chains, canonical units: j1 at 0.58 of the digit run (proximal link
// slightly longer, matching the engine len0:len1 cascade ≈ 0.58:0.42)
const bindChains = fingersScaled.map((f) => {
  const dir = norm(sub(f.tip, f.root));
  const j1 = add(f.root, mul(dir, f.len * 0.58));
  return { root: f.root, j1, tip: f.tip };
});
const bindThumb = thumbScaled ? (() => {
  const dir = norm(sub(thumbScaled.tip, thumbScaled.root));
  const j1 = add(thumbScaled.root, mul(dir, thumbScaled.len * 0.53));
  return { root: thumbScaled.root, j1, tip: thumbScaled.tip };
})() : null;

function segDist(p, a, b) {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab)));
  return { d: len(sub(p, add(a, mul(ab, t)))), t };
}
const smooth = (t) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); };

const linkA = new Array(nOut).fill(L.palm);
const linkB = new Array(nOut).fill(L.palm);
const wB = new Array(nOut).fill(0);
for (let i = 0; i < nOut; i++) {
  const p = [outPos[i * 3], outPos[i * 3 + 1], outPos[i * 3 + 2]];
  // stump: below the wrist, blend palm → forearm
  if (p[1] < 0) {
    linkA[i] = L.palm;
    linkB[i] = L.stump;
    wB[i] = smooth((-p[1]) / 0.5);
    continue;
  }
  // nearest digit chain (fingers + thumb), else palm
  let best = null;
  const consider = (chain, ids) => {
    const dA = segDist(p, chain.root, chain.j1);
    const dB = segDist(p, chain.j1, chain.tip);
    const d = Math.min(dA.d, dB.d);
    if (!best || d < best.d) best = { d, chain, ids, dA, dB };
  };
  bindChains.forEach((c, k) => consider(c, [L['f' + k + 'a'], L['f' + k + 'b']]));
  if (bindThumb) consider(bindThumb, [L.thumbA, L.thumbB]);
  const digitR = 0.34; // ownership radius, handR units
  if (!best || best.d > digitR) continue; // stays palm-rigid
  const { ids, dA } = best;
  // radial feather: a palm-adjacent vertex that only grazes a digit chain
  // keeps most of its palm weight — a hard grab here yanked lone verts into
  // spikes when the thumb wrap rotated (dwarf capture, 2026-08-21)
  const feather = smooth((digitR - best.d) / 0.14);
  // axial coordinate along the whole digit, 0 at root, 1 at j1, 2 at tip
  const u = dA.t < 1 && dA.d <= best.dB.d ? dA.t : 1 + best.dB.t;
  if (u < 0.3) {
    // root weld zone: palm → proximal link
    linkA[i] = L.palm;
    linkB[i] = ids[0];
    wB[i] = smooth((u + 0.1) / 0.4) * feather;
  } else if (u < 0.8) {
    // the feather keeps grazing palm verts palm-weighted here too
    linkA[i] = L.palm;
    linkB[i] = ids[0];
    wB[i] = feather;
  } else if (u < 1.2) {
    // knuckle blend: proximal → distal (true digit verts by now — thin
    // tubes put every real digit vertex well inside the feather)
    linkA[i] = ids[0];
    linkB[i] = ids[1];
    wB[i] = smooth((u - 0.8) / 0.4);
  } else {
    linkA[i] = ids[1];
    linkB[i] = ids[1];
    wB[i] = 0;
  }
}

// ---------- emit TS ----------
const fmt = (n) => {
  const r = Math.round(n * 10000) / 10000;
  return Object.is(r, -0) ? '0' : String(r);
};
const posStr = Array.from({ length: nOut * 3 }, (_, i) => fmt(outPos[i])).join(',');
const idxStr = outIdx.join(',');
const laStr = linkA.join(',');
const lbStr = linkB.join(',');
const wbStr = wB.map((w) => fmt(w)).join(',');
const chainTs = (c) => `{ root: [${c.root.map(fmt)}], j1: [${c.j1.map(fmt)}], tip: [${c.tip.map(fmt)}] }`;

const ts = `/**
 * @file referenceHandMesh.ts — the humanoid hand of the entity engine.
 *
 * GENERATED by tools/entities3d/bakeReferenceHand.mjs — do not hand-edit.
 *
 * Source mesh: "Low Poly Hand" by ronildo.facanha (Sketchfab), licensed
 * CC-BY 4.0 (https://creativecommons.org/licenses/by/4.0/). The credit line
 * below MUST ship wherever this mesh ships (game credits, docs).
 *
 * Space: the engine's palm-local canonical frame for the sgn=+1 (RIGHT)
 * hand — +Y along the fingers, +X toward the thumb, +Z out of the palm face,
 * wrist at the origin. Unit: 1 = handR. The mesh carries a straight-fingered
 * open pose plus a short forearm stump (y < 0) for burial in the forearm
 * loft; smoothBipedGeometry wraps the digits onto the bipedHandDigits rest
 * layout per race at merge time (the digit-wrap), mirroring x for the left
 * hand.
 */

/** Ship this line wherever the mesh ships. */
export const REFERENCE_HAND_CREDIT =
  '"Low Poly Hand" by ronildo.facanha (Sketchfab), CC-BY 4.0';

/** Digit-wrap link ids, per vertex (REF_HAND_LINK_A/B + REF_HAND_WB). */
export const REF_HAND_LINKS = {
  palm: 0,
  stump: 1,
  thumbA: 2,
  thumbB: 3,
  f0a: 4, f0b: 5,
  f1a: 6, f1b: 7,
  f2a: 8, f2b: 9,
  f3a: 10, f3b: 11,
} as const;

export interface RefHandChain {
  root: readonly [number, number, number];
  j1: readonly [number, number, number];
  tip: readonly [number, number, number];
}

/** Straight bind chains of the mesh digits, pinky → index (FINGER_COLS order). */
export const REF_HAND_BIND_FINGERS: readonly RefHandChain[] = [
${bindChains.map((c) => '  ' + chainTs(c) + ',').join('\n')}
];
export const REF_HAND_BIND_THUMB: RefHandChain = ${bindThumb ? chainTs(bindThumb) : 'null as never'};

export const REF_HAND_POS: readonly number[] = [${posStr}];
export const REF_HAND_IDX: readonly number[] = [${idxStr}];
export const REF_HAND_LINK_A: readonly number[] = [${laStr}];
export const REF_HAND_LINK_B: readonly number[] = [${lbStr}];
export const REF_HAND_WB: readonly number[] = [${wbStr}];
`;
fs.writeFileSync(OUT_TS, ts);
console.log('wrote %s (%d verts, %d tris)', OUT_TS, nOut, outIdx.length / 3);
console.log('diagnostics in %s', DIAG);
