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

// ---------------------------------------------------------------- the gate
const LENGTH_RANGES = {
  upperarm: [0.09, 0.24], lowerarm: [0.09, 0.24], thigh: [0.14, 0.30],
  calf: [0.14, 0.30], clavicle: [0.05, 0.20], neck_01: [0.02, 0.12],
  head: [0.06, 0.18],
};
// dominant owner per torso band, unit height (side pairs count as one name)
const TORSO_BANDS = [
  { band: [0.44, 0.56], allow: ['pelvis', 'thigh'] },
  { band: [0.58, 0.68], allow: ['spine_01', 'spine_02'] },
  { band: [0.68, 0.78], allow: ['spine_02', 'spine_03'] },
  { band: [0.86, 0.99], allow: ['head', 'neck_01'] },
];

export function runGate(glbPath) {
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

  const checks = [];
  const check = (name, pass, detail) => checks.push({ name, pass, detail });

  // root at origin
  const root = joints.find((j) => j.name === 'root') ?? joints[0];
  const rootDist = Math.hypot(...root.pos);
  check('root-at-origin', rootDist < 1e-3, `${root.name} at [${root.pos.map((v) => v.toFixed(4)).join(', ')}]`);

  // joints near the mesh (leaf helpers included — they deform too)
  const far = [];
  for (const j of joints) {
    let best = Infinity;
    for (let v = 0; v < nVerts; v++) {
      const d = Math.hypot(pos.data[v * 3] - j.pos[0], pos.data[v * 3 + 1] - j.pos[1], pos.data[v * 3 + 2] - j.pos[2]);
      if (d < best) best = d;
      if (best < 0.02) break;
    }
    if (best > 0.09 && j.name !== 'root') far.push(`${j.name}=${best.toFixed(3)}`);
  }
  check('joints-inside-mesh', far.length === 0, far.length ? `far: ${far.join(' ')}` : `all ${joints.length} joints within 0.09 of the mesh`);

  // symmetry
  const byName = new Map(joints.map((j) => [j.name, j]));
  const asym = [];
  for (const j of joints) {
    if (!j.name.endsWith('_l')) continue;
    const r = byName.get(j.name.slice(0, -2) + '_r');
    if (!r) continue;
    const d = Math.hypot(j.pos[0] + r.pos[0], j.pos[1] - r.pos[1], j.pos[2] - r.pos[2]);
    if (d > 0.025) asym.push(`${j.name}~${d.toFixed(3)}`);
  }
  check('symmetry', asym.length === 0, asym.length ? asym.join(' ') : 'all _l/_r pairs mirror within 0.025');

  // bone lengths: joint -> its skeleton child (same-name chains via node tree)
  const nodeIndexOf = new Map(skin.joints.map((j, i) => [j, i]));
  const badLen = [];
  for (const [ni, w] of worlds.entries()) {
    if (!w || !nodeIndexOf.has(ni)) continue;
    const base = w.name.replace(/_[lr]$/, '');
    const range = LENGTH_RANGES[base] ?? LENGTH_RANGES[w.name];
    if (!range) continue;
    for (const c of glb.json.nodes[ni].children ?? []) {
      if (!nodeIndexOf.has(c)) continue;
      const L = Math.hypot(...worlds[c].pos.map((v, k) => v - w.pos[k]));
      if (L < range[0] || L > range[1]) badLen.push(`${w.name}=${L.toFixed(3)} (want ${range[0]}-${range[1]})`);
      break;
    }
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

  // torso ownership: dominant joint of the near-axis verts per height band
  const bandFails = [];
  for (const { band, allow } of TORSO_BANDS) {
    const tally = new Map();
    for (let v = 0; v < nVerts; v++) {
      const y = pos.data[v * 3 + 1];
      const x = pos.data[v * 3];
      if (y < band[0] || y > band[1] || Math.abs(x) > 0.14) continue;
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
    const base = top[0].replace(/_[lr]$/, '');
    if (!allow.includes(base)) bandFails.push(`${band[0]}-${band[1]}h owned by ${top[0]} (want ${allow.join('|')})`);
  }
  check('torso-ownership', bandFails.length === 0, bandFails.length ? bandFails.join('; ') : 'every torso band owned by an allowed bone');

  return { pass: checks.every((c) => c.pass), checks };
}
