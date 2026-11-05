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
 *   - thumbs: a tube TRACE from the in-mesh thumb_01, link by link.
 *   - the four fingers (index..pinky): a tip-inward TRACE gives each
 *     finger's own centerline; the chain is then STRAIGHTENED — knuckle
 *     (rig row station, traced cross-section, dorsal bias) to tip, the two
 *     middle joints on that straight line (agora-e758, 2026-11-05). Too few
 *     samples = the finger keeps its joints and the report says so.
 *
 * Output goes through the Skeleton Lab's landmark door:
 * <id>.landmarks.json { joints, auto } — the rig job pins these on its
 * next --pack run. MERGE RULE: joints already in the file and NOT listed
 * in `auto` are manual (lab drags) and are never touched; re-runs update
 * only their own `auto` entries. NOTE: a later lab "Save + re-rig"
 * re-saves every pin as manual (the lab has no provenance) — rerun this
 * tool after manual sessions if you want geometry to re-vote.
 *
 * Run: node tools/entities3d/centerlineFit.mjs <id> [...] [--dry] [--no-fingers]
 *   --no-fingers  skip the finger trace (a stale finger fit then drops out
 *                 of the landmarks file on write, and the rig job falls back
 *                 to its heuristic finger chains)
 *   CENTERLINE_DEBUG=1  print the arm radius profile and every finger's
 *                 per-slice trace (x:radius:y,z in mm) for diagnosis
 * Then: node tools/entities3d/rigBaseMeshes.mjs --pack <id> (+ bump
 * BASE_MESH_RIG_VERSION in baseMeshCatalog.ts) to bake the result.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '')), '..', '..');
const BASE_DIR = path.join(ROOT, 'public', 'references', 'basemesh');

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
// The tip-inward finger trace. History: PARKED 2026-08-24 behind
// --fingers — it placed chains inside each finger at REST, but the chains
// followed the traced curve, so the flexion axes splayed and the pack clips
// (authored for PARALLEL fingers) scissored the curls under Walk/Idle.
// UN-PARKED 2026-11-05 (agora-e758, Remy's ruling on sheet "Board Sweep
// Decisions" q12): the chains are now STRAIGHTENED (see the finger block),
// and the trace is the DEFAULT. Proof on the three lowpoly bodies: gate
// S1a passes on every finger joint, Walk and Idle t=0.5 captures are
// coherent, and Greeting finger-only crossings fell 27 -> 13.
// --fingers is still accepted (it was the old opt-in) and changes nothing.
const FINGERS = !argv.includes('--no-fingers');
const ids = argv.filter((a) => a !== '--dry' && a !== '--fingers' && a !== '--no-fingers');
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
    if (process.env.CENTERLINE_DEBUG) console.log(`    dbg arm_${side} x:r`, prof.filter((s) => s.a > 0.3 * H).map((s) => `${(s.a * 1000).toFixed(0)}:${(s.r * 1000).toFixed(1)}`).join(' '));
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
  for (const side of FINGERS ? ['l', 'r'] : []) {
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
    // Floor 0.9mm, was 1.1mm. Re-swept on the SCULPTS 2026-09-09 (board task
    // agora-ceb7 — they had never been measured): figure B splits at 2.0mm /
    // 1.6mm, figure A's right hand at 1.2mm, and figure A's LEFT hand needs
    // 1.0mm — one step below the old floor, so it reported "tip band never
    // split into 4, best 3" and silently kept its heuristic landmarks. The
    // loop stops at the FIRST gap that yields four clusters, so every body
    // that already split is untouched; only a hand that found nothing walks
    // into the new steps.
    for (let gap = 0.0026; gap >= 0.0009; gap -= 0.0002) {
      clusters = clusterAt(gap * H);
      usedGap = gap;
      if (clusters.length >= 4) break;
    }
    if (clusters.length < 4) {
      report.push(`  fingers_${side}: kept (tip band never split into 4, best ${clusters.length})`);
      continue;
    }
    // each tip carries its cluster centroid AND the finger's own outer end
    // (max x of the cluster): the straightened chain runs through the
    // centroid and stops just inside that end (agora-e758)
    const tipGroups = clusters
      .sort((a, b) => b.length - a.length)
      .slice(0, 4)
      .map((g) => ({ c: [0, 1, 2].map((k) => g.reduce((s, p) => s + p[k], 0) / g.length), end: Math.max(...g.map((p) => p[0])) }));
    report.push(`  fingers_${side}: 4 tips at gap ${(usedGap * 1000).toFixed(1)}mm`);
    // assign tips to fingers by ANATOMY, not by the (wrong) old joints:
    // palm-down T-pose, thumb forward (+z) — so index..pinky order by z
    // descending. The thumb itself never reaches the tip band.
    const fingerNames = ['index', 'middle', 'ring', 'pinky'];
    tipGroups.sort((a, b) => b.c[2] - a.c[2]);
    const tips = tipGroups.map((t) => t.c);
    // SLICE-WALK from the tips inward (Remy's "...what?!" 2026-08-24: a
    // plain search ball spans the 2mm inter-finger gap, centroids drift
    // into the crack, chains cross). Per x-slice, cluster at the SAME gap
    // that separated the tips; each finger follows its own cluster by
    // continuity; a cluster claimed by two fingers is the WEB — those
    // fingers end there, and the knuckle sits a little INSIDE the palm
    // from the web (the pro rig's MCP placement).
    // These fingers TOUCH below the outer 1.5cm (sub-2mm gaps close fully;
    // measured 2026-08-24) — no clustering separates them. But they are
    // PARALLEL tubes, so a VORONOI partition per slice works at zero gap:
    // every point joins the nearest finger's running center, each finger's
    // radius comes from ITS OWN partition, and a radius jump (the palm
    // spreading beyond the finger tube) ends that finger at its knuckle.
    const SLICE = 0.006 * H;
    const fingers = fingerNames.map((name, i) => ({ name, line: [tips[i].slice()], radii: [], done: false }));
    for (let x1 = tipX - 0.015 * H; x1 > wristX + 0.005 * H; x1 -= SLICE) {
      const slice = handPts.filter((p) => p[0] >= x1 - SLICE && p[0] < x1);
      if (slice.length < 3) continue; // sparse slice: hold continuity
      const active = fingers.filter((f) => !f.done);
      if (!active.length) break;
      const parts = new Map(active.map((f) => [f, []]));
      for (const p of slice) {
        let best = null;
        let bd = 0.013 * H;
        for (const f of active) {
          const tail = f.line[f.line.length - 1];
          const d = Math.hypot(p[1] - tail[1], p[2] - tail[2]);
          if (d < bd) {
            bd = d;
            best = f;
          }
        }
        if (best) parts.get(best).push(p);
      }
      for (const f of active) {
        const g = parts.get(f);
        if (g.length < 3) continue; // hold this slice
        const c = [0, 1, 2].map((k) => g.reduce((s, p) => s + p[k], 0) / g.length);
        const r = g.reduce((s, p) => s + Math.hypot(p[1] - c[1], p[2] - c[2]), 0) / g.length;
        const med = f.radii.length >= 4 ? [...f.radii].sort((a, b) => a - b)[Math.floor(f.radii.length / 2)] : null;
        if (med && r > 1.55 * med) {
          f.done = true; // the palm spreads past the finger tube: knuckle
          continue;
        }
        f.line.push(c);
        f.radii.push(r);
      }
    }
    if (process.env.CENTERLINE_DEBUG) for (const f of fingers) console.log(`    dbg ${f.name}_${side} x/r/n:`, f.line.slice(1).map((c, i) => `${(c[0] * 1000).toFixed(0)}:${(f.radii[i] * 1000).toFixed(1)}:${((c[1]) * 1000).toFixed(0)},${(c[2] * 1000).toFixed(0)}`).join(' '));
    for (const f of fingers) {
      const line = f.line;
      if (line.length < 6) {
        report.push(`  ${f.name}_${side}: kept (trace only ${line.length} slices)`);
        continue;
      }
      // STRAIGHTENED CHAIN (agora-e758, Remy's ruling 2026-09-28 on sheet
      // "Board Sweep Decisions" q12: straighten the chains in Aralia).
      //
      // What changed, and why:
      //  1. The two middle joints used to sit ON the traced curve (45% and
      //     75% of its arc). A curve has small kinks, so the bones of one
      //     finger pointed in different directions and their flexion axes
      //     turned away from each other. The pack clips curl the fingers
      //     about PARALLEL axes, so the curls scissored (Walk crumple, 24e).
      //     Now the middle joints sit on the STRAIGHT line from the knuckle
      //     center to the tip, at the same 45% and 75% stations. This is the
      //     convention of the pro reference rig (GabrielNeias hand).
      //  2. The knuckle STATION (how far along the finger) now comes from
      //     the rig's own knuckle row, not from the radius jump. Measured
      //     2026-11-05 on the three lowpoly bodies: the lowpoly fingers
      //     TAPER into the palm, so a 1.55x jump fired anywhere from 57 mm
      //     to 128 mm from the tip (the long ones ran almost to the wrist).
      //     The rig's row (hand proportions) matched the visible bump in the
      //     radius profile on the male, and it is the row that is already
      //     motion-good. The knuckle CROSS-SECTION (where in the finger) is
      //     still detected: the traced centerline at that station, plus the
      //     dorsal bias. The trace ends at the jump; when the jump fires
      //     before the station, the line extends straight from its last
      //     slices (the finger is a straight tube by then).
      //  3. The tip is the line through the tip-band centroid, stopped 3 mm
      //     inside the finger's own outer end. The old tip sat ~7 mm short
      //     of the end, and the heuristic leaf sat OUTSIDE the mesh.
      // Preserved: tip detection, the Voronoi slice-walk, the dorsal bias.
      // Uncertain: a mesh with a strongly CURLED rest finger would put the
      // straight line outside the flesh — the report prints the distance
      // from the chord to the trace at both middle stations to show it.
      const stationJ = joints.get(`${f.name}_01_${side}`);
      if (!stationJ) {
        report.push(`  ${f.name}_${side}: kept (no ${f.name}_01_${side} in the rig)`);
        continue;
      }
      const kx = stationJ[0] * sgn;
      // the centerline point at x = kx: interpolate inside the trace, else
      // extend the last slices in a straight line
      const centerAtX = (x) => {
        for (let i = 0; i < line.length - 1; i++) {
          const p = line[i];
          const q = line[i + 1];
          if ((p[0] - x) * (q[0] - x) <= 0 && p[0] !== q[0]) {
            const t = (x - p[0]) / (q[0] - p[0]);
            return p.map((v, k) => v + (q[k] - v) * t);
          }
        }
        const tail = line[line.length - 1];
        const prev = line[Math.max(0, line.length - 4)];
        const dx = tail[0] - prev[0];
        if (Math.abs(dx) < 1e-6) throw new Error(`${id}/${f.name}_${side}: trace has no x run to extend`);
        const t = (x - tail[0]) / dx;
        return tail.map((v, k) => v + (tail[k] - prev[k]) * t);
      };
      const knuckleC = centerAtX(kx);
      const traceEnd = line[line.length - 1][0];
      const meanR = f.radii.reduce((a, b) => a + b, 0) / f.radii.length;
      const back = (p) => [p[0] * sgn, p[1], p[2]];
      // straight line: knuckle center -> tip-band centroid, extended to 3 mm
      // inside the finger's outer end
      const tipC = line[0];
      const dir = tipC.map((v, k) => v - knuckleC[k]);
      if (dir[0] <= 0) throw new Error(`${id}/${f.name}_${side}: tip centroid is not outward of the knuckle station`);
      const endX = tipGroups[fingers.indexOf(f)].end - 0.003 * H;
      const tipJ = knuckleC.map((v, k) => v + dir[k] * ((endX - knuckleC[0]) / dir[0]));
      const onChord = (frac) => knuckleC.map((v, k) => v + (tipJ[k] - v) * frac);
      const knuckleJ = [knuckleC[0], knuckleC[1] + 0.33 * meanR, knuckleC[2]];
      // honest report: distance from the straight chain to the traced curve
      // at each middle station (a large number means a bent finger mesh)
      const dev = [0.45, 0.75].map((fr) => {
        const b = onChord(fr);
        const a = centerAtX(b[0]);
        return Math.hypot(a[1] - b[1], a[2] - b[2]);
      });
      const chordLen = Math.hypot(tipJ[0] - knuckleC[0], tipJ[1] - knuckleC[1], tipJ[2] - knuckleC[2]);
      report.push(`  ${f.name}_${side}: straightened; length ${(chordLen * 1000).toFixed(1)}mm, chord vs trace ${dev.map((d) => (d * 1000).toFixed(1)).join('/')}mm, r=${(meanR * 1000).toFixed(1)}mm, trace ${kx >= traceEnd ? 'reached' : `extended ${((traceEnd - kx) * 1000).toFixed(0)}mm to`} the knuckle row`);
      move(`${f.name}_01_${side}`, back(knuckleJ), 'finger trace knuckle (rig row station), dorsal-biased');
      move(`${f.name}_02_${side}`, back(onChord(0.45)), 'finger trace straightened 45%');
      move(`${f.name}_03_${side}`, back(onChord(0.75)), 'finger trace straightened 75%');
      move(`${f.name}_04_leaf_${side}`, back(tipJ), 'finger trace tip');
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
