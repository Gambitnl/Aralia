/**
 * @file digitBandGate.mjs — the gate that judges R1 (straightened finger
 * chains) and R2 (banded digit weights) TOGETHER, on the pack rig.
 *
 * WHY ONE GATE FOR TWO TASKS. The two changes are not separable by eye.
 * bandWeights only redistributes weight ALONG the chains centerlineFit gives
 * it, so a band on a bad chain is a bad band, and a good chain with diffused
 * bone-heat weights still reads blotchy. The 2026-08-24 history is the whole
 * argument: the traced chains (24e) were static-perfect and crumpled the hand
 * on a Walk clip, the bands were blamed, and a heat-only A/B cleared them.
 * That A/B is what this file automates so nobody has to remember to run it.
 *
 * THE STANDING LESSON IT ENFORCES: Remy's spec is "natural when ANIMATED".
 * Every check below that can only be measured in motion IS measured in motion,
 * on the pack `Walk` clip, and a T-pose render is never accepted as proof.
 *
 * SCOPE. Pack rigs only (`<id>.packrig.glb`). The author rig
 * (`<id>.authorrig.glb`, the default for lowpoly-male/female since 2026-09-09)
 * carries two links per finger and no metacarpals, so it has no phalanx bands
 * to gate — see the header of bandWeights.mjs.
 *
 * ---------------------------------------------------------------------------
 * CHECKS
 * ---------------------------------------------------------------------------
 * STATIC (read straight out of the GLB, no browser):
 *   S1a interior-in-tube [R1] the two INTERIOR phalanx joints of every digit sit
 *                      centered in their own finger: distance from the joint to
 *                      the centroid of that finger's local flesh, over the local
 *                      radius. The pro reference measures 0.02-0.56 here. The
 *                      24d failure was chains cutting diagonally across splayed
 *                      fingers, which this number sees.
 *   S1b knuckle-dorsal [R1] the knuckle row is off-center ON PURPOSE — a pro
 *                      places it at the metacarpal head, on the BACK of the
 *                      hand, at 1.0-3.1 of the local radius. Gating it with one
 *                      combined threshold would either fail every correct rig or
 *                      pass a chain flung out of the finger, so it is its own
 *                      band. thumb_01 is excluded: it is a palm joint and the
 *                      tube metric is meaningless in the flat palm.
 *   S2 axis spread     [R1] the four finger chains of one hand must point the
 *                      same way. Splayed chains give splayed FLEXION axes, and
 *                      that — not the weights — is what scissored the fingers
 *                      in 24e. Reported as the max pairwise angle between the
 *                      knuckle->tip directions of index/middle/ring/pinky.
 *   S3 band purity     [R2] on a banded file every digit vertex draws only on
 *                      its own chain (below-bone + three phalanges).
 *   S3 palm phalanx    [R2] no vertex that is in the hand and OUTSIDE every
 *                      finger tube may keep a phalanx influence. Fingers
 *                      dragging palm flesh is the defect this pass exists to
 *                      remove. The test is geometric, not weight-based, so it
 *                      does not mistake the blend zone under a knuckle for it.
 *
 * MOTION (headless Chrome, Part Lab `pose=pack:<clip>`, sampled at CLIP_T):
 *   M0 digit motion    the curl clip must actually rotate the digit bones.
 *                      Measured: of the eight Part Lab clips only `Greeting`
 *                      does (quaternion range 0.644); Walk, Idle_A, Jog,
 *                      Dance_Simple, Bow, Victory and Head Nod are all exactly
 *                      0 — they carry finger CHANNELS but constant tracks. The
 *                      campaign's standing instruction to gate on `pack:Walk`
 *                      therefore cannot see a finger crumple at all, and Walk
 *                      is kept only for the posture read.
 *   M1 neighbor order  [R1+R2] over the curl clip, every finger's NEAREST other
 *                      finger must be the one anatomically beside it. A pinky
 *                      that ends up nearer the middle than the ring has crossed
 *                      over — the 24e scissor. Deliberately an ORDER test and
 *                      not a distance one: `Greeting` closes the idle hand into
 *                      a fist, so raw finger gaps fall to fractions of a
 *                      millimeter on a 5k-triangle hand with no fault at all.
 *                      This is the check the 24e proofs could not make, because
 *                      they were all T-pose.
 *   M2 frame sheet     one canvas PNG per sampled frame per variant, so the
 *                      number always ships with a picture.
 *
 * ---------------------------------------------------------------------------
 * USAGE
 *   node tools/entities3d/digitBandGate.mjs <id> [...] [options]
 *
 *   --banded <dir>   also gate the banded copies in <dir> (produced by
 *                    `node tools/entities3d/bandWeights.mjs --out <dir> <id>`).
 *                    This is what runs the heat-vs-band A/B in MOTION: the
 *                    banded file is swapped into public/ for the capture and
 *                    restored (hash-verified) afterwards, so the A/B costs no
 *                    live flip. Without the flag the gate reports the PUBLISHED
 *                    rig only, which is the honest thing to do while R2 is
 *                    parked.
 *   --out <dir>      where the PNGs and report.json land. Default
 *                    .agent/scratch/digit-band-gate (gitignored).
 *   --static-only    skip the browser stage (no dev server needed).
 *
 * The motion stage needs the shared Vite dev server already running; nothing
 * here starts one. Override its origin with CAPTURE_ORIGIN. Every capture
 * convention (headless system Chrome with the GPU default-args removed, pixels
 * via renderer.render() + canvas.toDataURL() and never page.screenshot, the
 * hot-reload liveness check) lives in ./capture/captureLib.mjs.
 *
 * EXIT CODE is 0 when every gated check passes and 1 otherwise, so this can be
 * the thing a nightly loop runs. A check with no data reports `n/a` and FAILS
 * — an unmeasured check is never a pass.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  baseUrl, launchCaptureBrowser, newCapturePage, gotoScene, assertLive,
  grabCanvasPng, inkFraction, aimPartLab, writePng, sleep,
} from './capture/captureLib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const BASE_DIR = path.join(ROOT, 'public', 'references', 'basemesh');

/** Clip fractions sampled. The first entry is the M1 baseline. */
const CLIP_T = [0, 0.2, 0.4, 0.6, 0.8];
/**
 * WHICH CLIP CAN SEE A SCISSOR. Measured 2026-09-09 straight out of the pack
 * animation GLBs (max per-channel quaternion range over the digit bones):
 *
 *   Greeting 0.644   <- the ONLY Part Lab clip that curls the fingers
 *   Walk 0   Idle_A 0   Jog 0   Dance_Simple 0   Bow 0   Victory 0   Head Nod 0
 *
 * Every clip carries 90 digit channels, so "the clip has finger tracks" is not
 * the question — those tracks are CONSTANT on all but Greeting. A finger
 * crumple is a FLEXION failure, so a gate run on Walk reports a pass it never
 * tested. Walk is still captured, for the posture/whole-hand read the campaign
 * has always used, but the scissor verdict comes from Greeting. M0 enforces
 * this: a curl clip whose digits do not actually move FAILS.
 */
const MOTION_CLIPS = [
  { name: 'Greeting', role: 'curl' },
  { name: 'Walk', role: 'posture' },
];
/** Thresholds. Each is a measured number, not a taste call — see the notes. */
const GATE = {
  // The pro reference centers its two INTERIOR phalanx joints at off/R
  // 0.02-0.56 (hand-groundtruth.mjs, 2026-08-24); 0.7 is that with slack.
  interiorInTubeMax: 0.7,
  // ...and places the KNUCKLE row dorsally, off-center by design, at off/R
  // 1.0-3.1. A knuckle inside the tube is as wrong as one flung outside it.
  knuckleDorsalBand: [0.8, 3.4],
  // Parallel-enough flexion. The pack clips are authored for parallel fingers;
  // the 24e splay that scissored them measured well past a radian.
  axisSpreadMaxDeg: 35,
  // A banded digit vertex may draw ONLY on its own chain.
  bandPurityMin: 0.98,
  // ...and no palm vertex may keep a phalanx influence.
  palmPhalanxMax: 0,
  // A curl clip must actually rotate the digit bones. 0.05 of quaternion range
  // is far below Greeting's measured 0.64 and far above the 0 of every clip
  // whose finger tracks are constant.
  digitMotionMin: 0.05,
};

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const bandedDir = flag('--banded') ? path.resolve(ROOT, flag('--banded')) : null;
const outDir = path.resolve(ROOT, flag('--out') ?? '.agent/scratch/digit-band-gate');
const staticOnly = argv.includes('--static-only');
const ids = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--banded' && argv[i - 1] !== '--out');
if (!ids.length) {
  console.error('usage: node tools/entities3d/digitBandGate.mjs <id> [...] [--banded <dir>] [--out <dir>] [--static-only]');
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------------------
// GLB reading. Deliberately the same minimal reader bandWeights.mjs uses (raw
// chunk walk + node-tree compose) rather than a loader: the split basemesh
// GLBs carry an FBX -90 X node rotation and non-tight buffers, so a naive
// accessor read returns garbage axes, and a Blender-exported pack rig is the
// only shape this reader claims to handle.
// ---------------------------------------------------------------------------
const qMul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qRot = (q, v) => {
  const u = [q[0], q[1], q[2]];
  const s = q[3];
  const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const c1 = cr(u, v);
  const c2 = cr(u, c1);
  return [v[0] + 2 * (s * c1[0] + c2[0]), v[1] + 2 * (s * c1[1] + c2[1]), v[2] + 2 * (s * c1[2] + c2[2])];
};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => {
  const L = len(a) || 1e-12;
  return [a[0] / L, a[1] / L, a[2] / L];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function readPackRig(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: not a GLB`);
  let off = 12;
  let json = null;
  let binOff = -1;
  while (off < buf.length) {
    const l = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    if (type === 0x4e4f534a) json = JSON.parse(buf.subarray(off + 8, off + 8 + l).toString('utf8'));
    else if (type === 0x004e4942) binOff = off + 8;
    off += 8 + l;
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
  const jointName = (k) => json.nodes[json.skins[0].joints[k]].name;
  const nVerts = P.a.count;
  const pos = (v) => [buf.readFloatLE(P.start + v * 12), buf.readFloatLE(P.start + v * 12 + 4), buf.readFloatLE(P.start + v * 12 + 8)];
  const infl = (v) => {
    const out = [];
    for (let k = 0; k < 4; k++) {
      const w = buf.readFloatLE(W.start + (v * 4 + k) * 4);
      if (w > 1e-4) out.push([jointName(buf.readUInt8(J.start + v * 4 + k)), w]);
    }
    return out;
  };
  return { world, nVerts, pos, infl };
}

/** The digit chains a pack rig exposes: three phalanges + the bone below. */
function digitChains(world) {
  const digits = [];
  for (const side of ['l', 'r']) {
    for (const f of ['index', 'middle', 'ring', 'pinky']) {
      const names = ['01', '02', '03', '04_leaf'].map((s) => `${f}_${s}_${side}`);
      if (names.every((n) => world.has(n)) && world.has(`metacarp_${f}_${side}`)) {
        digits.push({ key: `${f}_${side}`, side, finger: f, names, chain: names.map((n) => world.get(n)), below: `metacarp_${f}_${side}` });
      }
    }
    const tn = ['01', '02', '03', '04_leaf'].map((s) => `thumb_${s}_${side}`);
    if (tn.every((n) => world.has(n)) && world.has(`hand_${side}`)) {
      digits.push({ key: `thumb_${side}`, side, finger: 'thumb', names: tn, chain: tn.map((n) => world.get(n)), below: `hand_${side}` });
    }
  }
  return digits;
}

// ---------------------------------------------------------------------------
// STATIC CHECKS
// ---------------------------------------------------------------------------
function staticChecks(file) {
  const { world, nVerts, pos, infl } = readPackRig(file);
  const digits = digitChains(world);
  if (!digits.length) return { error: 'no digit chains on this rig' };
  const byKey = new Map(digits.map((d) => [d.key, d]));
  const phalanx = new Set(digits.flatMap((d) => [d.names[0], d.names[1], d.names[2]]));
  /** Perpendicular distance from a point to a digit's joint polyline. Same
   *  tube radius bandWeights uses, so the two agree on what "in a finger" is. */
  const TUBE_R = 0.016; // pack rigs are unit height
  const perpDist = (d, p) => {
    let best = Infinity;
    for (let i = 0; i < d.chain.length - 1; i++) {
      const a = d.chain[i];
      const ab = sub(d.chain[i + 1], a);
      const L2 = dot(ab, ab) || 1e-12;
      const t = Math.max(i === 0 ? -0.35 : 0, Math.min(1, dot(sub(p, a), ab) / L2));
      best = Math.min(best, len(sub(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t])));
    }
    return best;
  };

  // MEMBERSHIP IS bandWeights' OWN RULE, not a re-invention: the hand region
  // is everything outboard of the wrist, and a vertex joins the digit whose
  // four joints hold more than 0.3 of its weight. Matching the rule matters —
  // an earlier version of this gate grouped by the single DOMINANT bone, which
  // put every blend-zone vertex (dominant on the metacarpal) outside the digit
  // and then reported it as palm bleed. 136 false failures on lowpoly-male.
  const wristL = world.get('hand_l');
  const wristR = world.get('hand_r');
  const vertsOf = new Map(digits.map((d) => [d.key, []]));
  let palmPhalanx = 0;
  let bandPure = 0;
  let bandTotal = 0;
  for (let v = 0; v < nVerts; v++) {
    const inf = infl(v);
    if (!inf.length) continue;
    const p = pos(v);
    const wrist = p[0] >= 0 ? wristL : wristR;
    if (!wrist || Math.abs(p[0]) <= Math.abs(wrist[0])) continue;
    let best = null;
    let bestW = 0.3;
    for (const d of digits) {
      const own = new Set(d.names);
      const w = inf.reduce((s, e) => s + (own.has(e[0]) ? e[1] : 0), 0);
      if (w > bestW) { bestW = w; best = d; }
    }
    if (best) {
      vertsOf.get(best.key).push(p);
      bandTotal++;
      const allowed = new Set([...best.names, best.below]);
      if (inf.every((e) => allowed.has(e[0]))) bandPure++;
    } else if (inf.some((e) => phalanx.has(e[0])) && digits.every((d) => perpDist(d, p) > TUBE_R)) {
      // PALM BLEED, defined GEOMETRICALLY on purpose. A weight-only test ("no
      // phalanx influence outside the family vote") counts the blend-zone
      // vertices just below each knuckle, whose weight legitimately sits
      // mostly on the metacarpal — it reported 112 false failures on a
      // correctly banded lowpoly-male. A vertex that is in the hand, outside
      // every finger tube, and still dragged by a phalanx is the real defect.
      palmPhalanx++;
    }
  }

  // S1 chain-in-tube, split at the knuckle because the PRO REFERENCE splits
  // there (hand-groundtruth.mjs on GabrielNeias' 27-joint hand, 2026-08-24):
  // a pro CENTERS the two interior phalanx joints (off/R 0.02-0.56) and places
  // the knuckle row DORSALLY, off the tube center by design (off/R 1.0-3.1).
  // One combined threshold therefore cannot be right; measured separately, the
  // interior number is the real placement gate and the knuckle number only has
  // to stay inside the pro band. thumb_01 is excluded from both: it is a palm
  // joint, and the same ground truth found the tube metric meaningless in the
  // flat palm region.
  const tubeRatio = (d, i) => {
    const pts = vertsOf.get(d.key);
    if (pts.length < 8) return null;
    const j = d.chain[i];
    const span = len(sub(d.chain[i + 1], d.chain[i])) || 1e-6;
    const near = pts.filter((q) => len(sub(q, j)) < span * 1.2);
    if (near.length < 4) return null;
    const c = near.reduce((a, q) => [a[0] + q[0] / near.length, a[1] + q[1] / near.length, a[2] + q[2] / near.length], [0, 0, 0]);
    const radius = near.reduce((s, q) => s + len(sub(q, c)), 0) / near.length || 1e-6;
    return len(sub(j, c)) / radius;
  };
  // The whole distribution is kept, not just the worst: on a 5k-triangle hand
  // the distal station carries few vertices and one noisy joint should never be
  // mistaken for a chain that is wrong everywhere.
  const interiorAll = [];
  let interior = { ratio: 0, joint: null };
  let knuckle = { lo: Infinity, hi: 0, loJoint: null, hiJoint: null };
  for (const d of digits) {
    for (const i of [1, 2]) {
      const r = tubeRatio(d, i);
      if (r === null) continue;
      interiorAll.push([d.names[i], r]);
      if (r > interior.ratio) interior = { ratio: r, joint: d.names[i] };
    }
    if (d.finger === 'thumb') continue;
    const r = tubeRatio(d, 0);
    if (r === null) continue;
    if (r < knuckle.lo) knuckle = { ...knuckle, lo: r, loJoint: d.names[0] };
    if (r > knuckle.hi) knuckle = { ...knuckle, hi: r, hiJoint: d.names[0] };
  }

  // S2 axis spread: the four fingers of a hand, knuckle -> tip.
  const spread = {};
  for (const side of ['l', 'r']) {
    const dirs = digits.filter((d) => d.side === side && d.finger !== 'thumb').map((d) => norm(sub(d.chain[3], d.chain[0])));
    let maxDeg = 0;
    for (let i = 0; i < dirs.length; i++) {
      for (let k = i + 1; k < dirs.length; k++) {
        maxDeg = Math.max(maxDeg, (Math.acos(Math.max(-1, Math.min(1, dot(dirs[i], dirs[k])))) * 180) / Math.PI);
      }
    }
    if (dirs.length >= 2) spread[side] = maxDeg;
  }

  return {
    digits: digits.length,
    digitVerts: bandTotal,
    S1a_interiorInTube: {
      value: interior.ratio,
      worstJoint: interior.joint,
      median: interiorAll.length ? interiorAll.map((e) => e[1]).sort((a, b) => a - b)[Math.floor(interiorAll.length / 2)] : null,
      overMax: interiorAll.filter((e) => e[1] > GATE.interiorInTubeMax).map((e) => `${e[0]}=${e[1].toFixed(2)}`),
      joints: interiorAll.length,
      max: GATE.interiorInTubeMax,
      pass: interior.joint !== null && interior.ratio <= GATE.interiorInTubeMax,
    },
    S1b_knuckleDorsal: { value: [knuckle.lo, knuckle.hi], joints: [knuckle.loJoint, knuckle.hiJoint], band: GATE.knuckleDorsalBand, pass: knuckle.loJoint !== null && knuckle.lo >= GATE.knuckleDorsalBand[0] && knuckle.hi <= GATE.knuckleDorsalBand[1] },
    S2_axisSpreadDeg: { value: spread, max: GATE.axisSpreadMaxDeg, pass: Object.keys(spread).length > 0 && Object.values(spread).every((v) => v <= GATE.axisSpreadMaxDeg) },
    S3_bandPurity: { value: bandTotal ? bandPure / bandTotal : null, min: GATE.bandPurityMin, pass: bandTotal > 0 && bandPure / bandTotal >= GATE.bandPurityMin },
    S3_palmPhalanx: { value: palmPhalanx, max: GATE.palmPhalanxMax, pass: palmPhalanx <= GATE.palmPhalanxMax },
  };
}

// ---------------------------------------------------------------------------
// MOTION CHECK. Per sampled clip frame: photograph the hand, and measure the
// closest approach between two different fingers on the SKINNED mesh. The
// finger a vertex belongs to is read from its dominant skin influence in the
// page, so heat and banded files are measured by the same rule.
// ---------------------------------------------------------------------------
const measureFingerGap = () => {
  const lab = window.__partlab;
  let mesh = null;
  lab.scene.traverse((o) => { if (!mesh && o.isSkinnedMesh) mesh = o; });
  if (!mesh) return { error: 'no SkinnedMesh in the Part Lab scene' };
  const names = mesh.skeleton.bones.map((b) => b.name);
  const re = /^(index|middle|ring|pinky|thumb)_(01|02|03|04_leaf)_(l|r)$/;
  const skin = mesh.geometry.getAttribute('skinIndex');
  const wgt = mesh.geometry.getAttribute('skinWeight');
  const groups = new Map();
  const v = new mesh.position.constructor();
  for (let i = 0; i < skin.count; i++) {
    let bi = -1;
    let bw = 0;
    for (let k = 0; k < 4; k++) {
      const w = wgt.getComponent(i, k);
      if (w > bw) { bw = w; bi = skin.getComponent(i, k); }
    }
    const m = bi >= 0 ? re.exec(names[bi] ?? '') : null;
    if (!m) continue;
    const key = `${m[3]}:${m[1]}`;
    mesh.getVertexPosition(i, v);
    mesh.localToWorld(v);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push([v.x, v.y, v.z]);
  }
  const out = { digitQuats: {} };
  for (const b of mesh.skeleton.bones) {
    if (re.test(b.name)) out.digitQuats[b.name] = [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w];
  }
  for (const side of ['l', 'r']) {
    const keys = [...groups.keys()].filter((k) => k.startsWith(`${side}:`));
    const dist = {};
    for (let a = 0; a < keys.length; a++) {
      for (let b = a + 1; b < keys.length; b++) {
        const A = groups.get(keys[a]);
        const B = groups.get(keys[b]);
        let m = Infinity;
        for (const p of A) for (const q of B) {
          const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
          if (d < m) m = d;
        }
        dist[`${keys[a]}|${keys[b]}`] = m;
      }
    }
    let min = Infinity;
    let pair = null;
    const nearest = {};
    for (const k of keys) {
      let best = Infinity;
      let who = null;
      for (const k2 of keys) {
        if (k2 === k) continue;
        const d = dist[`${k}|${k2}`] ?? dist[`${k2}|${k}`];
        if (d < best) { best = d; who = k2.split(':')[1]; }
      }
      nearest[k.split(':')[1]] = { finger: who, dist: best };
      if (best < min) { min = best; pair = `${k}|${side}:${who}`; }
    }
    if (pair) out[side] = { min, pair, fingers: keys.length, nearest };
  }
  return out;
};

async function motionChecks(id, label, clip, pngDir) {
  const results = [];
  const { browser, context } = await launchCaptureBrowser({ width: 1100, height: 900 });
  try {
    const { page, errors } = await newCapturePage(context);
    for (const t of CLIP_T) {
      const url = `${baseUrl()}?step=partlab&body=${id}&pose=pack:${encodeURIComponent(clip.name)}&skin=weights&turn=1&speed=0&t=${t}`;
      const nonce = await gotoScene(page, url, { hook: 'window.__partlab', settleMs: 3500 });
      await assertLive(page, nonce);
      // frame the right hand; the default camera makes a hand ~40 px wide and
      // every hand regression of this campaign was invisible at that size.
      await aimPartLab(page, ['hand_r', 0, 0], [0.14, 0.06, 0.18]);
      await sleep(400);
      const gap = await page.evaluate(measureFingerGap);
      const ink = await inkFraction(page, { handle: '__partlab' });
      const png = await grabCanvasPng(page, { handle: '__partlab' });
      const file = path.join(pngDir, `${id}-${label}-${clip.name}-t${String(t).replace('.', '')}.png`);
      writePng(file, png);
      results.push({ t, gap, ink, png: path.relative(ROOT, file) });
      console.log(`  ${label}/${clip.name} t=${t}  gapR=${gap?.r ? gap.r.min.toFixed(5) : 'n/a'}  ink=${(ink * 100).toFixed(1)}%  ${path.relative(ROOT, file)}`);
    }
    if (errors.length) console.log('  page errors: ' + [...new Set(errors)].slice(0, 4).join(' | '));
  } finally {
    await browser.close();
  }
  // M1 IS AN ORDER CHECK, NOT A DISTANCE ONE. The first version compared the
  // closest finger-to-finger approach against the same number at rest and
  // failed the published rig at 0.13. The capture said why: `Greeting` closes
  // the idle hand into a FIST, so a real finger gap of 0.33 mm on a 5k-triangle
  // hand is a fist, not a fault, and the threshold was measuring poly count.
  // The scissor signature survives the fist: it is a finger whose NEAREST
  // neighbor is not the finger anatomically beside it — a pinky nearer the
  // middle than the ring has crossed over. That is what 24e did and what a
  // straightened chain must not do.
  // ...and it is a DELTA against the clip's own first frame, because the bind
  // pose already breaks the order on these bodies: measured on the published
  // lowpoly-male, the REST hand alone reports `pinky->thumb` and `pinky->index`
  // (the pack's rest thumb folds across the palm, and a 5k-triangle hand's
  // fingers share flesh). Gating the raw count would fail a rig the campaign
  // has verified as motion-good. What a scissor does is CREATE a crossing that
  // the rest pose did not have, so only new violations count.
  const NEIGHBORS = { thumb: ['index'], index: ['thumb', 'middle'], middle: ['index', 'ring'], ring: ['middle', 'pinky'], pinky: ['ring'] };
  const crossingsAt = (r) => {
    const out = [];
    for (const side of ['l', 'r']) {
      const near = r.gap?.[side]?.nearest;
      if (!near) continue;
      for (const [finger, hit] of Object.entries(near)) {
        if (hit.finger && !(NEIGHBORS[finger] ?? []).includes(hit.finger)) out.push(`${side}:${finger}->${hit.finger}`);
      }
    }
    return out;
  };
  const baseline = new Set(crossingsAt(results[0] ?? {}));
  const violations = [];
  for (const r of results.slice(1)) {
    for (const c of crossingsAt(r)) if (!baseline.has(c)) violations.push(`${c}@t=${r.t}`);
  }
  const measured = results.some((r) => r.gap?.l?.nearest || r.gap?.r?.nearest);
  // M0: did the digits actually MOVE? Without this a clip with constant finger
  // tracks (Walk, Idle_A, Jog, ...) hands back a perfect scissor ratio it never
  // earned, which is how "gate on pack:Walk" survived as an instruction.
  let digitDelta = 0;
  const base = results[0]?.gap?.digitQuats ?? {};
  for (const r of results) {
    for (const [name, q] of Object.entries(r.gap?.digitQuats ?? {})) {
      const b = base[name];
      if (b) for (let k = 0; k < 4; k++) digitDelta = Math.max(digitDelta, Math.abs(q[k] - b[k]));
    }
  }
  return {
    clip: clip.name,
    role: clip.role,
    frames: results.map((r) => ({ ...r, gap: { ...r.gap, digitQuats: undefined } })),
    M0_digitMotion: { value: digitDelta, min: GATE.digitMotionMin, pass: digitDelta >= GATE.digitMotionMin },
    M1_neighborOrder: {
      value: violations.length,
      violations: [...new Set(violations)].slice(0, 20),
      restBaseline: [...baseline],
      minGap: Object.fromEntries(['l', 'r'].map((sd) => [sd, Math.min(...results.map((r) => r.gap?.[sd]?.min ?? Infinity))])),
      pass: measured && violations.length === 0,
    },
  };
}

// ---------------------------------------------------------------------------
const report = { generated: new Date().toISOString(), gate: GATE, clipT: CLIP_T, bodies: {} };
let failed = false;
const verdict = (name, c) => {
  const ok = c && c.pass;
  if (!ok) failed = true;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(c?.value ?? 'n/a')}`);
};

for (const id of ids) {
  console.log(`\n=== ${id} ===`);
  const body = {};
  const variants = [{ label: 'published', file: path.join(BASE_DIR, `${id}.packrig.glb`) }];
  if (bandedDir) variants.push({ label: 'banded', file: path.join(bandedDir, `${id}.packrig.glb`) });
  for (const vt of variants) {
    if (!existsSync(vt.file)) throw new Error(`missing ${vt.file}`);
    console.log(`- static [${vt.label}] ${path.relative(ROOT, vt.file)}`);
    const s = staticChecks(vt.file);
    body[vt.label] = { file: path.relative(ROOT, vt.file), static: s };
    // R2's two checks only bind on a file that CLAIMS to be banded; on the
    // published heat rig they are reported for contrast, not gated.
    verdict('S1a interior-in-tube', s.S1a_interiorInTube);
    verdict('S1b knuckle dorsal', s.S1b_knuckleDorsal);
    verdict('S2 axis spread', s.S2_axisSpreadDeg);
    if (vt.label === 'banded') {
      verdict('S3 band purity', s.S3_bandPurity);
      verdict('S3 palm phalanx', s.S3_palmPhalanx);
    } else {
      console.log(`  info  S3 band purity (not gated on the heat rig)  ${s.S3_bandPurity.value?.toFixed(3)}`);
      console.log(`  info  S3 palm phalanx (not gated on the heat rig)  ${s.S3_palmPhalanx.value}`);
    }
  }
  if (!staticOnly) {
    // The motion stage photographs whatever the dev server is SERVING, so it
    // can only judge the published file. Point it at a banded rig by swapping
    // that file in deliberately (and bumping BASE_MESH_RIG_VERSION) — that is
    // the live flip, and it is exactly what R2 is waiting on R1 to earn.
    const runMotion = async (label) => {
      const out = {};
      for (const clip of MOTION_CLIPS) {
        console.log(`- motion [${label}] pack:${clip.name} (${clip.role})`);
        const m = await motionChecks(id, label, clip, outDir);
        out[clip.name] = m;
        if (clip.role === 'curl') {
          verdict(`M0 digit motion [${label}]`, m.M0_digitMotion);
          verdict(`M1 neighbor order [${label}]`, m.M1_neighborOrder);
        } else {
          console.log(`  info  M0 digit motion (posture clip, no finger tracks)  ${m.M0_digitMotion.value.toFixed(5)}`);
          console.log(`  info  M1 neighbor order (not gated on a posture clip)  ${m.M1_neighborOrder.value} violations`);
        }
      }
      return out;
    };
    body.published.motion = await runMotion('published');
    if (bandedDir) {
      // THE HEAT-vs-BAND A/B, IN MOTION. The dev server photographs whatever is
      // on disk, so the only way to see banded weights animate without doing
      // the live flip is to swap the file in, capture, and put it back. The
      // restore is in a finally and is verified by hash — a half-run that
      // leaves a banded GLB published would be a silent live flip, and the
      // published rig is version-stamped so nobody would notice.
      const live = path.join(BASE_DIR, `${id}.packrig.glb`);
      const backup = path.join(outDir, `${id}.packrig.glb.restore`);
      const before = createHash('sha256').update(readFileSync(live)).digest('hex');
      copyFileSync(live, backup);
      try {
        copyFileSync(path.join(bandedDir, `${id}.packrig.glb`), live);
        body.banded.motion = await runMotion('banded');
      } finally {
        copyFileSync(backup, live);
        const after = createHash('sha256').update(readFileSync(live)).digest('hex');
        if (after !== before) throw new Error(`RESTORE FAILED for ${live}: ${before} -> ${after}`);
        rmSync(backup, { force: true });
        console.log(`  restored ${path.relative(ROOT, live)} (sha256 ${before.slice(0, 12)} verified)`);
      }
    }
  }
  report.bodies[id] = body;
}

const reportFile = path.join(outDir, 'report.json');
writeFileSync(reportFile, JSON.stringify(report, null, 2));
console.log(`\nreport -> ${path.relative(ROOT, reportFile)}`);
console.log(failed ? 'GATE: FAIL' : 'GATE: PASS');
process.exit(failed ? 1 : 0);
