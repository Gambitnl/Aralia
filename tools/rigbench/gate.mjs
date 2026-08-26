/**
 * @file gate.mjs — Rig Bench stage 3: measured pass/fail checks on a rigged
 * GLB. Rulers, not vibes: every convention the pipeline relies on becomes a
 * number with a threshold. Reads the GLB directly (header + JSON chunk +
 * BIN chunk) — no three.js, no Blender.
 *
 * Checks:
 *   root-at-origin      the root joint binds at (0, 0, 0)
 *   joints-inside-mesh  every deform joint sits near mesh vertices
 *   symmetry            _l/_r joint pairs mirror across x within tolerance
 *   bone-lengths        named bones stay inside anatomical ranges (unit height)
 *   weights-normalized  vertex weights sum to 1; no orphan vertices
 *   torso-ownership     the dominant bone per height band is the right one
 *                       (a neck that owns the ribcage fails here)
 *
 * TWO SKELETON FAMILIES (GG-154, fixed 2026-09-09 by board task agora-ceb7).
 * The bench used to key every ruler on PACK-skeleton bone names (spine_01,
 * neck_01, thigh_l), so the 39-bone contract rigs the engine actually ships
 * (<id>.rigged.glb, <id>.authorrig.glb — pelvis, chest, neck, clavicleL,
 * thighR) matched NOTHING: bone-lengths and torso-ownership had no rows to
 * check and symmetry found no `_l` joints, so a contract rig scored a silent
 * 6/6 without a single measurement. Every ruler now resolves a FAMILY first
 * and reads that family's names. Adding a third skeleton means adding a
 * FAMILIES entry, not editing six checks.
 *
 * HEADLESS BODIES (the lowpoly no-gender base ends at a neck stump). Its
 * skeleton is fitted to the VIRTUAL full figure — shoulders sit at 0.85 of a
 * whole body, so the rig job stretches proportions over H / 0.85 and the head
 * bone legitimately floats above the stump (rig_basemesh.py, same rule as
 * rigbench_intake.py). The gate now applies the same correction instead of
 * reading the stump height as the figure height: head-owned joints and the
 * head torso band are skipped, and heights/lengths are normalized against the
 * virtual figure. Pass `{ headless: true|false }` to force it (rigbench.mjs
 * feeds the workspace's intake.json flag); otherwise it is re-measured here.
 */
import { readFileSync } from 'node:fs';

// ---------------------------------------------------------------- GLB reader
export function readGlb(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path}: not a GLB`);
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
  if (!json || !bin) throw new Error(`${path}: missing JSON or BIN chunk`);
  return { json, bin };
}

const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

export function readAccessor(glb, index) {
  const acc = glb.json.accessors[index];
  const view = glb.json.bufferViews[acc.bufferView];
  const T = COMP[acc.componentType];
  const n = SIZE[acc.type];
  const byteOff = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const stride = view.byteStride ?? n * T.BYTES_PER_ELEMENT;
  const out = new Float64Array(acc.count * n);
  for (let i = 0; i < acc.count; i++) {
    for (let c = 0; c < n; c++) {
      const at = glb.bin.byteOffset + byteOff + i * stride + c * T.BYTES_PER_ELEMENT;
      out[i * n + c] = new T(glb.bin.buffer, at, 1)[0];
    }
  }
  const norm = acc.normalized ? (T === Uint8Array ? 255 : T === Uint16Array ? 65535 : 1) : 1;
  if (norm !== 1) for (let i = 0; i < out.length; i++) out[i] /= norm;
  return { data: out, count: acc.count, size: n };
}

// quaternion * vector, then + translation — enough for rigid node trees
function xform(t, q, v) {
  const [x, y, z] = v;
  const [qx, qy, qz, qw] = q;
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy + t[0],
    iy * qw + iw * -qy + iz * -qx - ix * -qz + t[1],
    iz * qw + iw * -qz + ix * -qy - iy * -qx + t[2],
  ];
}
function qmul(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by + ay * bw + az * bx - ax * bz,
    aw * bz + az * bw + ax * by - ay * bx,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/** World position + name per node, composed down the scene tree. */
export function nodeWorlds(glb) {
  const nodes = glb.json.nodes;
  const world = new Array(nodes.length);
  const visit = (i, t, q) => {
    const nd = nodes[i];
    const nt = nd.translation ?? [0, 0, 0];
    const nq = nd.rotation ?? [0, 0, 0, 1];
    const wt = xform(t, q, nt);
    const wq = qmul(q, nq);
    world[i] = { name: nd.name ?? `node${i}`, pos: wt };
    for (const c of nd.children ?? []) visit(c, wt, wq);
  };
  for (const scene of glb.json.scenes) for (const root of scene.nodes) visit(root, [0, 0, 0], [0, 0, 0, 1]);
  return world;
}

// ---------------------------------------------------------------- families
/**
 * A skeleton family names the same anatomy differently, so each ruler that
 * mentions a bone lives HERE, once, beside the family it belongs to.
 *
 *   sideSuffix  strips the side marker to a base name (`thigh_l` -> `thigh`,
 *               `thighL` -> `thigh`). Symmetry pairs on the same rule.
 *   chainChild  the spine-chain bone to measure a length against, when the
 *               node's first skinned child is not it. On the contract rig
 *               `chest` lists clavicleL first, and measuring chest->clavicle
 *               is measuring a shoulder, not a chest.
 *   headJoints  joints that only exist because a head does — skipped whole on
 *               a headless body, where they float above the neck stump.
 *   bands       dominant owner per height band, in FIGURE height.
 *
 * Lengths and bands are figure-normalized (feet 0, crown 1). Ranges are
 * measured, not guessed: see the widened contract `foreArm` note below.
 */
const FAMILIES = {
  // 66/74-joint Mesh2Motion pack armature — <id>.packrig.glb
  pack: {
    probe: 'spine_01',
    sideSuffix: /_[lr]$/,
    chainChild: {},
    headJoints: ['neck_01', 'head', 'head_leaf'],
    lengths: {
      upperarm: [0.09, 0.24], lowerarm: [0.09, 0.24], thigh: [0.14, 0.30],
      calf: [0.14, 0.30], clavicle: [0.05, 0.20], neck_01: [0.02, 0.12],
      head: [0.06, 0.18],
    },
    bands: [
      { band: [0.44, 0.56], allow: ['pelvis', 'thigh'] },
      { band: [0.58, 0.68], allow: ['spine_01', 'spine_02'] },
      { band: [0.68, 0.78], allow: ['spine_02', 'spine_03'] },
      { band: [0.86, 0.99], allow: ['head', 'neck_01'], head: true },
    ],
  },
  // our 39-bone biped contract — <id>.rigged.glb (bone heat) and
  // <id>.authorrig.glb (the pack author's painted weights, folded on)
  contract: {
    probe: 'chest',
    sideSuffix: /[LR]$/,
    chainChild: { chest: 'neck', neck: 'head' },
    headJoints: ['neck', 'head'],
    lengths: {
      // chest floor 0.12, not the author rigs' measured 0.21-0.24: the
      // bone-heat rigs lay the spine out from the ENGINE's biped rest spec
      // (bipedBoneSpec.json), which gives a shorter chest and a longer neck
      // (0.138 / 0.150 on every bone-heat body). That placement is the
      // contract, not a defect — what the short chest COSTS (the neck bone
      // then owns the ribcage) is a weight property, and torso-ownership is
      // the ruler that judges it.
      pelvis: [0.06, 0.16], chest: [0.12, 0.28], neck: [0.02, 0.20],
      clavicle: [0.05, 0.20], upperArm: [0.09, 0.24],
      // 0.25, not the pack's 0.24: stylized-figure-b measures 0.242 (the
      // sculpts are deliberately long-armed). The ruler is here to catch a
      // bone off by a limb, not by 1% of body height.
      foreArm: [0.09, 0.25],
      thigh: [0.14, 0.30], shin: [0.14, 0.30],
    },
    // The contract spine is coarser than the pack's (pelvis-chest-neck-head
    // vs six links), so `chest` legitimately owns two bands. The 0.78-0.86
    // shoulder yoke is deliberately ungated in BOTH families: the pack
    // author's own painted weights hand it to the clavicles (measured on
    // lowpoly-male.authorrig, 0.29 mass per side), so it is not a defect.
    bands: [
      { band: [0.44, 0.56], allow: ['pelvis', 'thigh'] },
      { band: [0.58, 0.68], allow: ['chest', 'pelvis'] },
      { band: [0.68, 0.78], allow: ['chest'] },
      { band: [0.86, 0.99], allow: ['head', 'neck'], head: true },
    ],
  },
};

/** Which family a skin belongs to, by probing for a name only it carries. */
export function skeletonFamily(jointNames) {
  const set = new Set(jointNames);
  for (const [name, fam] of Object.entries(FAMILIES)) if (set.has(fam.probe)) return name;
  throw new Error(`gate: unknown skeleton family — no ${Object.values(FAMILIES).map((f) => `"${f.probe}"`).join(' or ')} joint among ${jointNames.length} joints`);
}

/** Shoulders above this fraction of the mesh mean the head is missing.
 * Same constant and rule as rigbench_intake.py and rig_basemesh.py. */
const HEADLESS_SHOULDER_H = 0.85;

/** Re-measure the intake's `headless` flag from the mesh: T-pose arm flesh
 * (|x| past 0.28h in the 0.55-0.95h slab) whose median height clears 0.85. */
export function measureHeadless(pos, yMin, H) {
  const arm = [];
  for (let v = 0; v < pos.count; v++) {
    const y = (pos.data[v * 3 + 1] - yMin) / H;
    if (y < 0.55 || y > 0.95) continue;
    if (Math.abs(pos.data[v * 3]) / H > 0.28) arm.push(y);
  }
  if (arm.length < 20) return false; // arms down: the intake cannot tell, so it does not claim
  arm.sort((a, b) => a - b);
  return arm[Math.floor(arm.length / 2)] > HEADLESS_SHOULDER_H;
}

// ---------------------------------------------------------------- the gate
/**
 * @param {string} glbPath
 * @param {{ headless?: boolean }} [opts] `headless` from the workspace's
 *   intake.json when the caller has one; omitted = re-measured here.
 */
export function runGate(glbPath, opts = {}) {
  const glb = readGlb(glbPath);
  const skin = (glb.json.skins ?? [])[0];
  if (!skin) throw new Error(`${glbPath}: no skin`);
  const worlds = nodeWorlds(glb);
  const joints = skin.joints.map((j) => worlds[j]);
  const mesh = glb.json.meshes.find((m) => m.primitives.some((p) => p.attributes.JOINTS_0 !== undefined));
  const prim = mesh.primitives.find((p) => p.attributes.JOINTS_0 !== undefined);
  const pos = readAccessor(glb, prim.attributes.POSITION);
  const jidx = readAccessor(glb, prim.attributes.JOINTS_0);
  const wgt = readAccessor(glb, prim.attributes.WEIGHTS_0);
  const nVerts = pos.count;

  // ---- family + headless calibration, before any ruler reads a bone name
  const fam = FAMILIES[skeletonFamily(joints.map((j) => j.name))];
  let yMin = Infinity;
  let yMax = -Infinity;
  for (let v = 0; v < nVerts; v++) {
    const y = pos.data[v * 3 + 1];
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  const meshH = yMax - yMin;
  const headless = opts.headless ?? measureHeadless(pos, yMin, meshH);
  // A headless mesh is only 0.85 of the figure its skeleton was fitted to, so
  // every height and length converts through the virtual figure height.
  const figureH = headless ? meshH / HEADLESS_SHOULDER_H : meshH;
  const yFig = (y) => (y - yMin) / figureH; // mesh y -> figure fraction
  const headSkip = headless ? new Set(fam.headJoints) : new Set();

  const checks = [];
  const check = (name, pass, detail) => checks.push({ name, pass, detail });

  // root at origin
  const root = joints.find((j) => j.name === 'root') ?? joints[0];
  const rootDist = Math.hypot(...root.pos);
  check('root-at-origin', rootDist < 1e-3, `${root.name} at [${root.pos.map((v) => v.toFixed(4)).join(', ')}]`);

  // joints near the mesh (leaf helpers included — they deform too). On a
  // headless body the head chain has no flesh to sit in by construction.
  const far = [];
  for (const j of joints) {
    if (headSkip.has(j.name)) continue;
    let best = Infinity;
    for (let v = 0; v < nVerts; v++) {
      const d = Math.hypot(pos.data[v * 3] - j.pos[0], pos.data[v * 3 + 1] - j.pos[1], pos.data[v * 3 + 2] - j.pos[2]);
      if (d < best) best = d;
      if (best < 0.02) break;
    }
    if (best > 0.09 && j.name !== 'root') far.push(`${j.name}=${best.toFixed(3)}`);
  }
  const skipNote = headless ? ` (headless: head chain ${fam.headJoints.join('/')} not checked)` : '';
  check('joints-inside-mesh', far.length === 0, far.length ? `far: ${far.join(' ')}${skipNote}` : `all ${joints.length - headSkip.size} joints within 0.09 of the mesh${skipNote}`);

  // symmetry — the side suffix is family-specific (`_l`/`_r` vs `L`/`R`)
  const byName = new Map(joints.map((j) => [j.name, j]));
  const asym = [];
  let pairs = 0;
  for (const j of joints) {
    const m = j.name.match(fam.sideSuffix);
    if (!m || !/l/i.test(m[0])) continue;
    const r = byName.get(j.name.slice(0, -m[0].length) + m[0].replace(/l/i, (c) => (c === 'l' ? 'r' : 'R')));
    if (!r) continue;
    pairs++;
    const d = Math.hypot(j.pos[0] + r.pos[0], j.pos[1] - r.pos[1], j.pos[2] - r.pos[2]);
    if (d > 0.025) asym.push(`${j.name}~${d.toFixed(3)}`);
  }
  check('symmetry', asym.length === 0, asym.length ? asym.join(' ') : `all ${pairs} side pairs mirror within 0.025`);

  // bone lengths: joint -> its chain child (a named one where the node's
  // first skinned child is a branch, e.g. contract chest lists clavicleL)
  const nodeIndexOf = new Map(skin.joints.map((j, i) => [j, i]));
  const badLen = [];
  for (const [ni, w] of worlds.entries()) {
    if (!w || !nodeIndexOf.has(ni)) continue;
    if (headSkip.has(w.name)) continue;
    const base = w.name.replace(fam.sideSuffix, '');
    const range = fam.lengths[base] ?? fam.lengths[w.name];
    if (!range) continue;
    const kids = (glb.json.nodes[ni].children ?? []).filter((c) => nodeIndexOf.has(c));
    const wanted = fam.chainChild[base];
    const child = (wanted && kids.find((c) => worlds[c].name === wanted)) ?? kids[0];
    if (child === undefined) continue;
    if (headSkip.has(worlds[child].name)) continue;
    const L = Math.hypot(...worlds[child].pos.map((v, k) => v - w.pos[k])) / figureH;
    if (L < range[0] || L > range[1]) badLen.push(`${w.name}=${L.toFixed(3)} (want ${range[0]}-${range[1]})`);
  }
  check('bone-lengths', badLen.length === 0, badLen.length ? badLen.join(' ') : 'all ranged bones inside anatomical bounds');

  // weights normalized + orphans
  let orphans = 0;
  let badSum = 0;
  for (let v = 0; v < nVerts; v++) {
    const s = wgt.data[v * 4] + wgt.data[v * 4 + 1] + wgt.data[v * 4 + 2] + wgt.data[v * 4 + 3];
    if (s < 1e-6) orphans++;
    else if (Math.abs(s - 1) > 0.02) badSum++;
  }
  check('weights-normalized', orphans === 0 && badSum === 0, `${orphans} orphans, ${badSum} bad sums of ${nVerts} verts`);

  // torso ownership: dominant joint of the near-axis verts per height band.
  // Bands are FIGURE height, so a headless body's bands land where its
  // skeleton was actually fitted; its head band has no flesh and is skipped.
  const bandFails = [];
  let skippedBands = 0;
  for (const { band, allow, head } of fam.bands) {
    if (head && headless) {
      skippedBands++;
      continue;
    }
    const tally = new Map();
    for (let v = 0; v < nVerts; v++) {
      const y = yFig(pos.data[v * 3 + 1]);
      const x = pos.data[v * 3];
      if (y < band[0] || y > band[1] || Math.abs(x) > 0.14 * figureH) continue;
      let bi = 0;
      let bw = -1;
      for (let k = 0; k < 4; k++) {
        if (wgt.data[v * 4 + k] > bw) {
          bw = wgt.data[v * 4 + k];
          bi = jidx.data[v * 4 + k];
        }
      }
      const nm = joints[bi]?.name ?? `j${bi}`;
      tally.set(nm, (tally.get(nm) ?? 0) + 1);
    }
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!top) continue;
    const base = top[0].replace(fam.sideSuffix, '');
    if (!allow.includes(base)) bandFails.push(`${band[0]}-${band[1]}h owned by ${top[0]} (want ${allow.join('|')})`);
  }
  const bandNote = skippedBands ? ` (headless: ${skippedBands} head band skipped)` : '';
  check('torso-ownership', bandFails.length === 0, (bandFails.length ? bandFails.join('; ') : 'every torso band owned by an allowed bone') + bandNote);

  return { pass: checks.every((c) => c.pass), checks, family: skeletonFamily(joints.map((j) => j.name)), headless };
}
