/**
 * @file centerlineFit.mjs — tree-log joint refinement (Remy 2026-08-23:
 * "each finger/arm slice has an exact center point").
 *
 * Reads a pack-rigged base mesh (<id>.packrig.glb — the Blender export;
 * the SPLIT GLBs keep an FBX rotation + non-tight buffers and parse wrong),
 * samples the mesh SURFACE (area-weighted — raw vertices bias slice
 * centroids on low-poly limbs), and refines joints from the geometry:
 *
 *   - elbow + wrist, knee + ankle: the joint's axis station snaps to the
 *     tube's radius pinch inside an anchored window; the perpendicular
 *     position re-centers on the slice centroid. No pinch in window = the
 *     station stays (honest: geometry gets a vote, not a veto).
 *   - every digit joint: re-centered inside its own finger tube by a local
 *     centroid, moved perpendicular to the chain only. Too few local
 *     samples = the joint stays and the report says so.
 *
 * Output goes through the Skeleton Lab's landmark door:
 * <id>.landmarks.json { joints, auto } — the rig job pins these on its
 * next --pack run. MERGE RULE: joints already in the file and NOT listed
 * in `auto` are manual (lab drags) and are never touched; re-runs update
 * only their own `auto` entries. NOTE: a later lab "Save + re-rig"
 * re-saves every pin as manual (the lab has no provenance) — rerun this
 * tool after manual sessions if you want geometry to re-vote.
 *
 * Run: node tools/entities3d/centerlineFit.mjs <id> [...] [--dry]
 * Then: node tools/entities3d/rigBaseMeshes.mjs --pack <id> (+ bump
 * BASE_MESH_RIG_VERSION in baseMeshCatalog.ts) to bake the result.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '')), '..', '..');
const BASE_DIR = path.join(ROOT, 'public', 'references', 'basemesh');

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const ids = argv.filter((a) => a !== '--dry');
if (!ids.length) throw new Error('usage: node tools/entities3d/centerlineFit.mjs <id> [...] [--dry]');

// ---------------------------------------------------------------- glb parse
function parseGlb(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: not a GLB`);
  let off = 12;
  let json = null;
  let bin = null;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const chunk = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    else if (type === 0x004e4942) bin = chunk;
    off += 8 + len;
  }
  const acc = (i) => {
    const a = json.accessors[i];
    const bv = json.bufferViews[a.bufferView];
    if (bv.byteStride && bv.byteStride !== { SCALAR: 4, VEC3: 12 }[a.type] * 1) throw new Error('interleaved buffer — parse the Blender export, not the split GLB');
    const Arr = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }[a.componentType];
    const comp = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
    const start = bin.byteOffset + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return new Arr(bin.buffer.slice(start, start + a.count * comp * Arr.BYTES_PER_ELEMENT));
  };
  return { json, acc };
}

// quaternion helpers (x,y,z,w)
const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qRot = (q, v) => {
  const u = [q[0], q[1], q[2]];
  const s = q[3];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const c1 = cross(u, v);
  const c2 = cross(u, c1);
  return [v[0] + 2 * (s * c1[0] + c2[0]), v[1] + 2 * (s * c1[1] + c2[1]), v[2] + 2 * (s * c1[2] + c2[2])];
};

/** World position of every named node (translation+rotation compose). */
function nodeWorlds(json) {
  const nodes = json.nodes;
  const world = new Map();
  const walk = (i, pos, rot, scale) => {
    const n = nodes[i];
    const t = n.translation ?? [0, 0, 0];
    const r = n.rotation ?? [0, 0, 0, 1];
    const s = n.scale ?? [1, 1, 1];
    // uniform scale composes as a scalar; a non-uniform rig node would
    // shear the joint math and must fail loudly
    // Blender exports carry 1 ± 1e-7 float noise on bone scales
    if (Math.abs(s[0] - s[1]) > 1e-3 || Math.abs(s[0] - s[2]) > 1e-3) throw new Error(`non-uniform scale on node "${n.name}" — unsupported`);
    const p = qRot(rot, [t[0] * scale, t[1] * scale, t[2] * scale]);
    const wp = [pos[0] + p[0], pos[1] + p[1], pos[2] + p[2]];
    const wr = qMul(rot, r);
    world.set(n.name, wp);
    for (const c of n.children ?? []) walk(c, wp, wr, scale * s[0]);
  };
  for (const scene of json.scenes ?? []) for (const r of scene.nodes ?? []) walk(r, [0, 0, 0], [0, 0, 0, 1], 1);
  return world;
}

/** Deterministic area-weighted surface samples. `filter(cx,cy,cz)` limits
 * to triangles whose centroid passes — the finger trace resamples the hand
 * densely (body-wide spacing ~5mm equals the finger gap and defeats
 * clustering, 2026-08-24). */
function surfaceSamples(pos, idx, target = 60000, filter = null) {
  let total = 0;
  const areas = new Float64Array(idx.length / 3);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3;
    const b = idx[t + 1] * 3;
    const c = idx[t + 2] * 3;
    if (filter && !filter((pos[a] + pos[b] + pos[c]) / 3, (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3, (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3)) continue;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    areas[t / 3] = 0.5 * Math.hypot(cx, cy, cz);
    total += areas[t / 3];
  }
  let seed = 42;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [];
  for (let t = 0; t < idx.length; t += 3) {
    if (!areas[t / 3]) continue; // filtered out (or degenerate)
    const n = Math.max(1, Math.round((areas[t / 3] / total) * target));
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    for (let k = 0; k < n; k++) {
      let r1 = rnd(), r2 = rnd();
      if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
      const w0 = 1 - r1 - r2;
      out.push([
        w0 * pos[a] + r1 * pos[b] + r2 * pos[c],
        w0 * pos[a + 1] + r1 * pos[b + 1] + r2 * pos[c + 1],
        w0 * pos[a + 2] + r1 * pos[b + 2] + r2 * pos[c + 2],
      ]);
    }
  }
  return out;
}

/** Radius profile of a tube along `axis` (0=x,1=y): slice, centroid, mean
 * radial distance. Returns stations sorted along the axis. */
function tubeProfile(samples, axis, lo, hi, step) {
  const st = [];
  for (let a0 = lo; a0 < hi; a0 += step) {
    const g = samples.filter((p) => p[axis] >= a0 && p[axis] < a0 + step);
    if (g.length < 8) continue;
    const c = [0, 1, 2].map((k) => g.reduce((s, p) => s + p[k], 0) / g.length);
    const [u, v] = axis === 0 ? [1, 2] : [0, 2];
    const r = g.reduce((s, p) => s + Math.hypot(p[u] - c[u], p[v] - c[v]), 0) / g.length;
    st.push({ a: a0 + step / 2, c, r, n: g.length });
  }
  return st;
}

/** Snap a joint: axis station to the pinch inside the window (edge hit =
 * keep), perpendicular position to the slice centroid. */
function pinchSnap(profile, axis, current, windowHalf) {
  const inWin = profile.filter((s) => Math.abs(s.a - current[axis]) <= windowHalf);
  if (inWin.length < 3) return { moved: false, p: current, why: 'few stations' };
  let best = inWin[0];
  for (const s of inWin) if (s.r < best.r) best = s;
  const isEdge = best === inWin[0] || best === inWin[inWin.length - 1];
  const station = isEdge ? inWin.reduce((x, s) => (Math.abs(s.a - current[axis]) < Math.abs(x.a - current[axis]) ? s : x), inWin[0]) : best;
  const p = current.slice();
  p[axis] = isEdge ? current[axis] : station.a;
  const [u, v] = axis === 0 ? [1, 2] : [0, 2];
  p[u] = station.c[u];
  p[v] = station.c[v];
  return { moved: true, p, why: isEdge ? 'centered (no pinch in window)' : 'pinch + centered' };
}

// ---------------------------------------------------------------- per body
for (const id of ids) {
  const rigFile = path.join(BASE_DIR, `${id}.packrig.glb`);
  if (!existsSync(rigFile)) throw new Error(`no pack rig: ${rigFile} — run rigBaseMeshes.mjs --pack ${id} first`);
  const { json, acc } = parseGlb(rigFile);
  const prim = json.meshes[0].primitives[0];
  const pos = acc(prim.attributes.POSITION);
  const idx = acc(prim.indices);
  const joints = nodeWorlds(json);
  const samples = surfaceSamples(pos, idx);
  let yMin = Infinity, yMax = -Infinity;
  for (let i = 1; i < pos.length; i += 3) { yMin = Math.min(yMin, pos[i]); yMax = Math.max(yMax, pos[i]); }
  const H = yMax - yMin;
  console.log(`\n${id}: samples=${samples.length} H=${H.toFixed(3)}`);

  const out = {}; // joint -> [x,y,z]
  const outWhy = {};
  const report = [];
  const move = (name, next, why) => {
    const cur = joints.get(name);
    const d = Math.hypot(next[0] - cur[0], next[1] - cur[1], next[2] - cur[2]);
    out[name] = [next[0], next[1], next[2]];
    outWhy[name] = why;
    report.push(`  ${name}: moved ${(d * 1000).toFixed(1)}mm (${why})`);
  };

  // arms: axis x per side. Tube = samples near the arm line, outside the torso.
  for (const side of ['l', 'r']) {
    const sgn = joints.get(`hand_${side}`)[0] >= 0 ? 1 : -1;
    const sh = joints.get(`upperarm_${side}`);
    const hand = joints.get(`hand_${side}`);
    const tip = joints.get(`middle_04_leaf_${side}`) ?? hand;
    const tube = samples.filter((p) => p[0] * sgn > Math.abs(sh[0]) + 0.02 * H && Math.abs(p[1] - sh[1]) < 0.13 * H);
    const flip = tube.map((p) => [p[0] * sgn, p[1], p[2]]); // work in +x
    const prof = tubeProfile(flip, 0, Math.abs(sh[0]) + 0.02 * H, Math.abs(tip[0]) + 0.01, 0.008 * H);
    for (const [bone, win] of [[`lowerarm_${side}`, 0.05], [`hand_${side}`, 0.04]]) {
      const cur = joints.get(bone);
      const r = pinchSnap(prof, 0, [Math.abs(cur[0]) * 1, cur[1], cur[2]], win * H);
      if (r.moved) move(bone, [r.p[0] * sgn, r.p[1], r.p[2]], r.why);
      else report.push(`  ${bone}: kept (${r.why})`);
    }
  }

  // legs: axis y per side (tip -> hip runs DOWN, profile along y works as-is)
  for (const side of ['l', 'r']) {
    const hip = joints.get(`thigh_${side}`);
    const ankle = joints.get(`foot_${side}`);
    const sgn = hip[0] >= 0 ? 1 : -1;
    const tube = samples.filter((p) => p[1] < hip[1] - 0.01 * H && p[0] * sgn > 0 && Math.abs(p[0] - hip[0]) < 0.10 * H && p[1] > yMin + 0.01 * H);
    const prof = tubeProfile(tube, 1, yMin + 0.01 * H, hip[1], 0.008 * H);
    for (const [bone, win] of [[`calf_${side}`, 0.05], [`foot_${side}`, 0.035]]) {
      const cur = joints.get(bone);
      const r = pinchSnap(prof, 1, [cur[0], cur[1], cur[2]], win * H);
      if (r.moved) move(bone, r.p, r.why);
      else report.push(`  ${bone}: kept (${r.why})`);
    }
  }

  // thumbs: the heuristic chain angles off the mesh (tips 33mm out on the
  // male, 2026-08-24) — TRACE the tube instead. thumb_01 sits in-mesh; walk
  // outward one link at a time, each step re-aimed at the local tube
  // centroid, link lengths preserved (bones are rigid).
  for (const side of ['l', 'r']) {
    const chain = ['01', '02', '03', '04_leaf'].map((s) => `thumb_${s}_${side}`);
    if (!chain.every((n) => joints.get(n))) continue;
    const hand = joints.get(`hand_${side}`);
    const base = joints.get(chain[0]);
    const lens = chain.slice(1).map((n, i) => {
      const a = joints.get(chain[i]);
      const b = joints.get(n);
      return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    });
    // keep-out: a step must not steal the index finger's tube
    const indexRoot = joints.get(`index_01_${side}`);
    const ball = samples.filter((p) => Math.hypot(p[0] - base[0], p[1] - base[1], p[2] - base[2]) < 0.022 * H && (!indexRoot || Math.hypot(p[0] - indexRoot[0], p[1] - indexRoot[1], p[2] - indexRoot[2]) > 0.008 * H));
    if (ball.length < 10) {
      report.push(`  thumb_${side}: kept (only ${ball.length} base samples)`);
      continue;
    }
    // principal axis of the base ball = the thumb's own direction; sign
    // points away from the wrist
    const mean = [0, 1, 2].map((k) => ball.reduce((s, p) => s + p[k], 0) / ball.length);
    let axis = [1, 0, 0];
    for (let it = 0; it < 12; it++) {
      const next = [0, 0, 0];
      for (const p of ball) {
        const d = [p[0] - mean[0], p[1] - mean[1], p[2] - mean[2]];
        const dot = d[0] * axis[0] + d[1] * axis[1] + d[2] * axis[2];
        next[0] += dot * d[0];
        next[1] += dot * d[1];
        next[2] += dot * d[2];
      }
      const l = Math.hypot(...next) || 1;
      axis = next.map((v) => v / l);
    }
    const away = [base[0] - hand[0], base[1] - hand[1], base[2] - hand[2]];
    if (axis[0] * away[0] + axis[1] * away[1] + axis[2] * away[2] < 0) axis = axis.map((v) => -v);
    let last = base.slice();
    let dir = axis;
    let blind = 0;
    chain.slice(1).forEach((name, i) => {
      // a blind step means the tube ENDS before the assumed link length —
      // this mesh's thumb is shorter than the heuristic chain. At fit time
      // the length is ours: shorten until the tube answers.
      const probe = (len) => {
        const t = [last[0] + dir[0] * len, last[1] + dir[1] * len, last[2] + dir[2] * len];
        const local = samples.filter((p) => Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2]) < 0.011 * H && (!indexRoot || Math.hypot(p[0] - indexRoot[0], p[1] - indexRoot[1], p[2] - indexRoot[2]) > 0.008 * H));
        return { t, local };
      };
      let len = lens[i];
      let hit = probe(len);
      for (const f of [0.8, 0.65, 0.5]) {
        if (hit.local.length >= 5) break;
        len = lens[i] * f;
        hit = probe(len);
      }
      let point = hit.t;
      let why = 'thumb trace';
      if (hit.local.length >= 5) {
        const c = [0, 1, 2].map((k) => hit.local.reduce((s, p) => s + p[k], 0) / hit.local.length);
        const to = [c[0] - last[0], c[1] - last[1], c[2] - last[2]];
        const tl = Math.hypot(...to) || 1;
        point = [last[0] + (to[0] / tl) * len, last[1] + (to[1] / tl) * len, last[2] + (to[2] / tl) * len];
        if (len < lens[i]) why = `thumb trace (link ${(len / lens[i] * 100).toFixed(0)}%)`;
      } else {
        blind++;
        why = 'thumb trace (blind step)';
      }
      move(name, point, why);
      dir = [point[0] - last[0], point[1] - last[1], point[2] - last[2]].map((v) => v / (len || 1));
      last = point;
    });
    if (blind) report.push(`  thumb_${side}: ${blind} blind step(s) — check the proof`);
  }

  // FINGERS: full tip-inward TRACE per finger (Remy 2026-08-24: the T-pose
  // top view showed chains cutting diagonally across splayed fingers — a
  // perpendicular-only refinement cannot fix a chain that starts in the
  // wrong finger). Fingertips are unambiguous: cluster the outermost hand
  // samples into per-finger tips, walk each tube INWARD with local-centroid
  // re-aim, stop where the tube merges into the palm (radius jump) — that
  // merge is the knuckle. Joints then sit at anatomical arc-length
  // fractions of the finger's OWN traced centerline (proximal 45%, middle
  // 30%, distal 25%), knuckle dorsal-biased per the pro reference.
  for (const side of ['l', 'r']) {
    const handJ = out[`hand_${side}`] ?? joints.get(`hand_${side}`);
    if (!handJ) continue;
    const sgn = handJ[0] >= 0 ? 1 : -1;
    const flip = (p) => [p[0] * sgn, p[1], p[2]];
    // dense hand-only resample: ~1mm spacing so 5mm finger gaps cluster
    const wristX = handJ[0] * sgn;
    const handPts = surfaceSamples(pos, idx, 30000, (cx, cy, cz) => cx * sgn > wristX && Math.abs(cy - handJ[1]) < 0.12 * H).map(flip);
    if (handPts.length < 500) {
      report.push(`  fingers_${side}: kept (${handPts.length} hand samples)`);
      continue;
    }
    const tipX = Math.max(...handPts.map((p) => p[0]));
    // tip band: the outer slice of the fingers; the thumb is shorter and
    // stays outside it (it keeps its own trace above)
    // 1.5cm tip band; the inter-finger separation varies per mesh and per
    // pair (2-3mm on the lowpoly bodies, one pair under 2mm), so SEARCH the
    // cluster gap from loose to tight until four fingers separate
    const band = handPts.filter((p) => p[0] > tipX - 0.015 * H);
    const clusterAt = (gap) => {
      const parent = band.map((_, i) => i);
      const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
      for (let i = 0; i < band.length; i++)
        for (let j = i + 1; j < band.length; j++) {
          const d2 = (band[i][0] - band[j][0]) ** 2 + (band[i][1] - band[j][1]) ** 2 + (band[i][2] - band[j][2]) ** 2;
          if (d2 < gap * gap) parent[find(i)] = find(j);
        }
      const groups = new Map();
      for (let i = 0; i < band.length; i++) {
        const r = find(i);
        if (!groups.has(r)) groups.set(r, []);
        groups.get(r).push(band[i]);
      }
      return [...groups.values()].filter((g) => g.length >= 12);
    };
    let clusters = [];
    let usedGap = 0;
    for (let gap = 0.0026; gap >= 0.0011; gap -= 0.0002) {
      clusters = clusterAt(gap * H);
      usedGap = gap;
      if (clusters.length >= 4) break;
    }
    if (clusters.length < 4) {
      report.push(`  fingers_${side}: kept (tip band never split into 4, best ${clusters.length})`);
      continue;
    }
    const tips = clusters
      .sort((a, b) => b.length - a.length)
      .slice(0, 4)
      .map((g) => [0, 1, 2].map((k) => g.reduce((s, p) => s + p[k], 0) / g.length));
    report.push(`  fingers_${side}: 4 tips at gap ${(usedGap * 1000).toFixed(1)}mm`);
    // assign tips to fingers by ANATOMY, not by the (wrong) old joints:
    // palm-down T-pose, thumb forward (+z) — so index..pinky order by z
    // descending. The thumb itself never reaches the tip band.
    const fingerNames = ['index', 'middle', 'ring', 'pinky'];
    tips.sort((a, b) => b[2] - a[2]);
    const claim = new Map(fingerNames.map((f, i) => [f, { tip: tips[i] }]));
    for (const f of fingerNames) {
      const claimed = claim.get(f);
      if (!claimed) {
        report.push(`  ${f}_${side}: kept (no tip cluster claimed it)`);
        continue;
      }
      // walk inward: local ball centroid re-aims each step; the knuckle is
      // where the tube radius jumps (palm merge) or the walk hits the palm
      const line = [claimed.tip.slice()];
      let dir = [-1, 0, 0]; // inward; re-aimed after the first step
      const STEP = 0.008 * H;
      const RB = 0.009 * H;
      const radii = [];
      for (let step = 0; step < 40; step++) {
        const guess = line[line.length - 1].map((v, k) => v + dir[k] * STEP);
        const local = handPts.filter((p) => Math.hypot(p[0] - guess[0], p[1] - guess[1], p[2] - guess[2]) < RB);
        if (local.length < 4) break;
        const c = [0, 1, 2].map((k) => local.reduce((s, p) => s + p[k], 0) / local.length);
        const r = local.reduce((s, p) => s + Math.hypot(p[1] - c[1], p[2] - c[2]), 0) / local.length;
        const med = radii.length >= 4 ? [...radii].sort((a, b) => a - b)[Math.floor(radii.length / 2)] : null;
        if (med && r > 1.75 * med) break; // palm merge: the knuckle is behind us
        radii.push(r);
        const last = line[line.length - 1];
        const to = [c[0] - last[0], c[1] - last[1], c[2] - last[2]];
        const tl = Math.hypot(...to) || 1;
        const next = [last[0] + (to[0] / tl) * STEP, last[1] + (to[1] / tl) * STEP, last[2] + (to[2] / tl) * STEP];
        dir = [(next[0] - last[0]) / STEP, (next[1] - last[1]) / STEP, (next[2] - last[2]) / STEP];
        line.push(next);
        if (next[0] < handJ[0] * sgn + 0.01 * H) break; // reached the palm
      }
      if (line.length < 6) {
        report.push(`  ${f}_${side}: kept (trace only ${line.length} steps)`);
        continue;
      }
      // arc-length stations tip -> knuckle; joints at knuckle 0 / 45 / 75 / tip
      const arc = [0];
      for (let i = 1; i < line.length; i++) arc.push(arc[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1], line[i][2] - line[i - 1][2]));
      const L = arc[arc.length - 1];
      const at = (fracFromKnuckle) => {
        const want = L * (1 - fracFromKnuckle); // arc runs from the TIP
        let i = 0;
        while (i < arc.length - 1 && arc[i + 1] < want) i++;
        const t = (want - arc[i]) / Math.max(arc[i + 1] - arc[i], 1e-9);
        return line[i].map((v, k) => v + (line[Math.min(i + 1, line.length - 1)][k] - v) * t);
      };
      const knuckle = line[line.length - 1];
      const meanR = radii.reduce((a, b) => a + b, 0) / radii.length;
      const back = (p) => [p[0] * sgn, p[1], p[2]];
      // dorsal bias at the knuckle only (+y, palms-down T-pose)
      move(`${f}_01_${side}`, back([knuckle[0], knuckle[1] + 0.33 * meanR, knuckle[2]]), 'finger trace knuckle, dorsal-biased');
      move(`${f}_02_${side}`, back(at(0.45)), 'finger trace 45%');
      move(`${f}_03_${side}`, back(at(0.75)), 'finger trace 75%');
      move(`${f}_04_leaf_${side}`, back(at(1 - 0.03)), 'finger trace tip');
    }
  }

  // sanity: refinements stay near their origin; TRACE joints replace wrong
  // chains outright and are anchored on detected geometry, so they get a
  // wider (but still bounded) leash
  for (const [name, p] of Object.entries(out)) {
    const cur = joints.get(name);
    const d = Math.hypot(p[0] - cur[0], p[1] - cur[1], p[2] - cur[2]);
    const cap = /trace/.test(outWhy[name] ?? '') ? 0.09 * H : 0.06 * H;
    if (d > cap) throw new Error(`${id}/${name}: refinement moved ${(d * 1000).toFixed(0)}mm — implausible, aborting`);
  }

  for (const line of report) console.log(line);
  const moved = Object.keys(out).length;
  console.log(`${id}: ${moved} joints refined${DRY ? ' (dry — nothing written)' : ''}`);
  if (DRY) continue;

  // merge through the Skeleton Lab door: manual pins win, auto entries renew
  const lmFile = path.join(BASE_DIR, `${id}.landmarks.json`);
  const prior = existsSync(lmFile) ? JSON.parse(readFileSync(lmFile, 'utf8')) : { joints: {} };
  const priorAuto = new Set(prior.auto ?? []);
  const merged = { ...prior.joints };
  const auto = [];
  for (const [name, p] of Object.entries(out)) {
    const manual = name in merged && !priorAuto.has(name);
    if (manual) {
      console.log(`  ${name}: manual pin wins — auto skipped`);
      continue;
    }
    merged[name] = [Number(p[0].toFixed(5)), Number(p[1].toFixed(5)), Number(p[2].toFixed(5))];
    auto.push(name);
  }
  // stale auto entries (from an earlier run, not refreshed) drop out
  for (const name of priorAuto) if (!auto.includes(name)) delete merged[name];
  writeFileSync(lmFile, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), joints: merged, auto }, null, 2) + '\n');
  console.log(`${id}: wrote ${path.relative(ROOT, lmFile)} (${auto.length} auto, ${Object.keys(merged).length - auto.length} manual kept)`);
}
