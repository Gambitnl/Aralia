/**
 * @file bandWeights.mjs — pro-style BANDED digit weights (Remy 2026-08-24:
 * "see these bone map weights? why can't we do something like that?").
 *
 * Bone heat DIFFUSES: every vertex takes a soup of nearby bone influences,
 * so digits read blotchy. A pro rig BANDS: each phalanx owns its ring of
 * flesh outright, with a soft blend only in a narrow zone at the joint.
 * This post-pass rewrites the skin attributes of a pack-rigged GLB for the
 * DIGIT tubes (fingers + thumbs) using the joint chains already fitted by
 * centerlineFit + the Blender job:
 *
 *   - a vertex belongs to a digit when it sits within the tube radius of
 *     that digit's joint polyline (Voronoi across digits — the same rule
 *     that traced them, works at zero finger gap)
 *   - its arc position along the chain picks the phalanx bone; a smooth
 *     ramp over the blend width crosses at each interior joint; below the
 *     knuckle it ramps into the metacarpal (hand for the thumb)
 *   - palm vertices (beyond the wrist, not in a tube) keep their heat
 *     weights but DROP phalanx influences (renormalized) — fingers must
 *     never drag palm flesh (the pro palm belongs to metacarpals + hand)
 *
 * Everything else keeps its bone-heat weights. Run AFTER rigBaseMeshes
 * --pack; re-run whenever the rigs rebuild. Bump BASE_MESH_RIG_VERSION.
 *
 * Run: node tools/entities3d/bandWeights.mjs <id> [...]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '')), '..', '..');
const BASE_DIR = path.join(ROOT, 'public', 'references', 'basemesh');
const ids = process.argv.slice(2);
if (!ids.length) throw new Error('usage: node tools/entities3d/bandWeights.mjs <id> [...]');

const qMul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qRot = (q, v) => {
  const u = [q[0], q[1], q[2]];
  const s = q[3];
  const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const c1 = cr(u, v);
  const c2 = cr(u, c1);
  return [v[0] + 2 * (s * c1[0] + c2[0]), v[1] + 2 * (s * c1[1] + c2[1]), v[2] + 2 * (s * c1[2] + c2[2])];
};
const smoothstep = (t) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

for (const id of ids) {
  const file = path.join(BASE_DIR, `${id}.packrig.glb`);
  if (!existsSync(file)) throw new Error(`no pack rig: ${file}`);
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: not a GLB`);
  let off = 12;
  let json = null;
  let binOff = -1;
  let binLen = 0;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    if (type === 0x4e4f534a) json = JSON.parse(buf.subarray(off + 8, off + 8 + len).toString('utf8'));
    else if (type === 0x004e4942) {
      binOff = off + 8;
      binLen = len;
    }
    off += 8 + len;
  }
  const accInfo = (i) => {
    const a = json.accessors[i];
    const bv = json.bufferViews[a.bufferView];
    if (bv.byteStride) throw new Error('interleaved buffer — unsupported');
    return { a, start: binOff + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0) };
  };
  const prim = json.meshes[0].primitives[0];
  const P = accInfo(prim.attributes.POSITION);
  const J = accInfo(prim.attributes.JOINTS_0);
  const W = accInfo(prim.attributes.WEIGHTS_0);
  if (J.a.componentType !== 5121 || W.a.componentType !== 5126) throw new Error('expected ubyte JOINTS_0 + float WEIGHTS_0 (Blender export)');
  const nVerts = P.a.count;
  const pos = (v, k) => buf.readFloatLE(P.start + (v * 3 + k) * 4);

  // joint worlds from the node tree (clean Blender space)
  const world = new Map();
  const walk = (i, p0, rot, sc) => {
    const n = json.nodes[i];
    const t = n.translation ?? [0, 0, 0];
    const r = n.rotation ?? [0, 0, 0, 1];
    const s = n.scale ?? [1, 1, 1];
    const p = qRot(rot, [t[0] * sc, t[1] * sc, t[2] * sc]);
    const wp = [p0[0] + p[0], p0[1] + p[1], p0[2] + p[2]];
    world.set(n.name, wp);
    for (const c of n.children ?? []) walk(c, wp, qMul(rot, r), sc * s[0]);
  };
  for (const sc of json.scenes ?? []) for (const r of sc.nodes ?? []) walk(r, [0, 0, 0], [0, 0, 0, 1], 1);
  const jointIndex = new Map(json.skins[0].joints.map((j, i) => [json.nodes[j].name, i]));
  const H = 1.0; // pack rigs are unit height

  // digit chains per side: stations + the bone below the knuckle
  const digits = [];
  for (const side of ['l', 'r']) {
    for (const f of ['index', 'middle', 'ring', 'pinky']) {
      const names = ['01', '02', '03', '04_leaf'].map((s) => `${f}_${s}_${side}`);
      if (names.every((n) => world.has(n)) && world.has(`metacarp_${f}_${side}`)) {
        digits.push({ names, chain: names.map((n) => world.get(n)), bones: [names[0], names[1], names[2]], below: `metacarp_${f}_${side}` });
      }
    }
    const tn = ['01', '02', '03', '04_leaf'].map((s) => `thumb_${s}_${side}`);
    if (tn.every((n) => world.has(n)) && world.has(`hand_${side}`)) {
      digits.push({ names: tn, chain: tn.map((n) => world.get(n)), bones: [tn[0], tn[1], tn[2]], below: `hand_${side}` });
    }
  }
  // per-digit arc stations
  for (const d of digits) {
    d.arc = [0];
    for (let i = 1; i < d.chain.length; i++) d.arc.push(d.arc[i - 1] + Math.hypot(d.chain[i][0] - d.chain[i - 1][0], d.chain[i][1] - d.chain[i - 1][1], d.chain[i][2] - d.chain[i - 1][2]));
  }
  const wristL = world.get('hand_l');
  const wristR = world.get('hand_r');
  const TUBE_R = 0.016 * H;
  const BLEND = 0.006 * H; // soft seam width at each joint
  const phalanxNames = new Set(digits.flatMap((d) => [d.bones[1], d.bones[2]]));

  // project a point onto a digit chain: arc position + perp distance
  const project = (d, p) => {
    let best = null;
    for (let i = 0; i < d.chain.length - 1; i++) {
      const a = d.chain[i];
      const b = d.chain[i + 1];
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1e-12;
      let t = ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / L2;
      t = Math.max(i === 0 ? -0.35 : 0, Math.min(1, t)); // allow reach below the knuckle
      const q = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
      const dist = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      const u = d.arc[i] + Math.sqrt(L2) * t;
      if (!best || dist < best.dist) best = { dist, u };
    }
    return best;
  };

  // digit MEMBERSHIP comes from bone heat (it solved connectivity: fingers
  // colored correctly per finger even when blotchy along their length) —
  // a pure distance Voronoi stole crack-side vertices for the neighbor
  // chain and crumpled the curl (first band attempt, 2026-08-24). The band
  // only redistributes ALONG the owned chain.
  // vote on the chain's OWN bones only — putting `below` in the family let
  // every palm vertex (hand-weighted) vote THUMB and curl with it
  const familyOf = new Map();
  digits.forEach((d, i) => {
    for (const b of d.names) familyOf.set(b, i);
  });
  let banded = 0;
  let palmed = 0;
  for (let v = 0; v < nVerts; v++) {
    const p = [pos(v, 0), pos(v, 1), pos(v, 2)];
    const side = p[0] >= 0 ? 'l' : 'r';
    const wrist = side === 'l' ? wristL : wristR;
    if (!wrist || Math.abs(p[0]) <= Math.abs(wrist[0])) continue; // not the hand region
    // family vote from the CURRENT (heat) influences
    const famW = new Map();
    for (let k = 0; k < 4; k++) {
      const w = buf.readFloatLE(W.start + (v * 4 + k) * 4);
      if (w <= 0) continue;
      const name = json.nodes[json.skins[0].joints[buf.readUInt8(J.start + v * 4 + k)]].name;
      const fam = familyOf.get(name);
      if (fam !== undefined) famW.set(fam, (famW.get(fam) ?? 0) + w);
    }
    let bestD = null;
    let bestW = 0.3; // membership threshold
    for (const [fam, w] of famW) {
      if (w > bestW) {
        bestW = w;
        bestD = digits[fam];
      }
    }
    const bestPr = bestD ? project(bestD, p) : null;
    const jIdx = (name) => {
      const i = jointIndex.get(name);
      if (i === undefined) throw new Error(`no skin joint "${name}"`);
      return i;
    };
    const writeWeights = (entries) => {
      // top-4 influences, normalized, into the buffers
      entries.sort((a, b) => b[1] - a[1]);
      const four = entries.slice(0, 4);
      const sum = four.reduce((s, e) => s + e[1], 0) || 1;
      for (let k = 0; k < 4; k++) {
        buf.writeUInt8(four[k] ? jIdx(four[k][0]) : 0, J.start + v * 4 + k);
        buf.writeFloatLE(four[k] ? four[k][1] / sum : 0, W.start + (v * 4 + k) * 4);
      }
    };
    if (bestD && bestPr) {
      // digit vertex: banded weights along the chain
      const [s0, s1, s2, s3] = bestD.arc;
      const u = bestPr.u;
      const [b1, b2, b3] = bestD.bones;
      const below = bestD.below;
      const entries = [];
      const ramp = (station) => smoothstep((u - (station - BLEND)) / (2 * BLEND));
      const r0 = ramp(s0);
      const r1 = ramp(s1);
      const r2 = ramp(s2);
      entries.push([below, 1 - r0]);
      entries.push([b1, r0 * (1 - r1)]);
      entries.push([b2, r1 * (1 - r2)]);
      entries.push([b3, r2]);
      writeWeights(entries.filter((e) => e[1] > 1e-4));
      banded++;
    } else {
      // palm vertex: keep heat weights, drop phalanx influences
      const entries = [];
      let dropped = 0;
      for (let k = 0; k < 4; k++) {
        const ji = buf.readUInt8(J.start + v * 4 + k);
        const w = buf.readFloatLE(W.start + (v * 4 + k) * 4);
        if (w <= 0) continue;
        const name = json.nodes[json.skins[0].joints[ji]].name;
        if (phalanxNames.has(name)) {
          dropped += w;
          continue;
        }
        entries.push([name, w]);
      }
      if (dropped > 1e-4 && entries.length) {
        writeWeights(entries);
        palmed++;
      }
    }
  }
  writeFileSync(file, buf);
  console.log(`${id}: banded ${banded} digit vertices, cleaned ${palmed} palm vertices -> ${path.relative(ROOT, file)}`);
}
