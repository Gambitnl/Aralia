/**
 * @file authorRigBaseMeshes.mjs — build `<id>.authorrig.glb` for the lowpoly
 * base meshes from the pack's OWN author armature and hand-painted weights.
 *
 * Remy's pick 2026-08-28 (board agora-2560): "replace our bone-heat rigs
 * outright with the pack's author armatures". The bone-heat rigs
 * (`<id>.rigged.glb`) put the NECK bone in charge of the ribcage
 * (0.64-0.76 h, measured); the pack's painted weights do not. This tool takes
 * the skinned meshes out of public/references/basemesh/original/lowpoly-2026.glb
 * and re-expresses them on our 39-bone contract via
 * tools/entities3d/authorBoneRemap.mjs.
 *
 * NO Blender: the geometry and the weights are the author's, already correct.
 * The only work is renaming, folding the joints the contract has no slot for,
 * and normalizing to the Part Lab convention (feet on y = 0, centered on x/z,
 * height 1) that splitBaseMeshes.mjs established.
 *
 * Traps handled (both recorded in the campaign notes):
 *  - a Sketchfab FBX export's node tree holds a POSED rest, so bind world
 *    matrices come from the INVERTED inverseBindMatrices, never the nodes;
 *  - a skinned mesh's own node matrix does not apply to it (glTF spec), so
 *    the skin space IS the geometry space and the node's -90 deg X rotation
 *    is correctly ignored.
 *
 * Run: node tools/entities3d/authorRigBaseMeshes.mjs [id ...]
 * Inputs:  public/references/basemesh/original/lowpoly-2026.glb (the untouched pack)
 * Outputs: public/references/basemesh/<id>.authorrig.glb
 */
import fs from 'node:fs';
import path from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { AUTHOR_BONE_REMAP, CONTRACT_BONES, CONTRACT_PARENT, authorBoneKey, foldAuthorSkeleton } from './authorBoneRemap.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '')), '..', '..');
const BASE_DIR = path.join(ROOT, 'public', 'references', 'basemesh');
const PACK = path.join(BASE_DIR, 'original', 'lowpoly-2026.glb');

/**
 * Which pack armature belongs to which catalog id. `lowpoly-nogender` is NOT
 * here on purpose: the pack ships that body UNSKINNED (no author armature),
 * so it keeps its bone-heat `<id>.rigged.glb`.
 */
const MODELS = [
  { id: 'lowpoly-female', mesh: 'Object_79', armature: 'BASEMESH ARMATURE FEMALE', joints: 70 },
  { id: 'lowpoly-male', mesh: 'Object_151', armature: 'BASEMESH ARMATURE MALE', joints: 68 },
];

/** invert a column-major 4x4 */
function inv4(a) {
  const o = new Array(16);
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return o;
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
if (!fs.existsSync(PACK)) throw new Error(`authorRigBaseMeshes: missing ${PACK}`);
const pack = await io.read(PACK);
const packRoot = pack.getRoot();

const argv = process.argv.slice(2);
const ids = argv.length ? argv : MODELS.map((m) => m.id);
for (const id of ids) if (!MODELS.some((m) => m.id === id)) {
  throw new Error(`authorRigBaseMeshes: "${id}" has no author armature in the pack (available: ${MODELS.map((m) => m.id).join(', ')}). lowpoly-nogender ships UNSKINNED.`);
}

const report = [];
for (const model of MODELS.filter((m) => ids.includes(m.id))) {
  const node = packRoot.listNodes().find((n) => n.getName() === model.mesh && n.getSkin());
  if (!node) throw new Error(`authorRigBaseMeshes: pack has no skinned node "${model.mesh}"`);
  const skin = node.getSkin();
  const joints = skin.listJoints();
  if (joints.length !== model.joints) throw new Error(`authorRigBaseMeshes: "${model.id}" expected ${model.joints} author joints, found ${joints.length}`);

  // --- bind world positions: INVERTED inverse-bind matrices, never the nodes
  const ibm = skin.getInverseBindMatrices();
  const bindPos = joints.map((_, i) => {
    const w = inv4(ibm.getElement(i, []));
    return [w[12], w[13], w[14]];
  });

  // --- the fold: which contract bone carries each author joint's weight
  const jointIndex = new Map(joints.map((j, i) => [j, i]));
  const names = joints.map((j) => j.getName());
  const parents = joints.map((j) => {
    const p = j.getParentNode();
    return p && jointIndex.has(p) ? jointIndex.get(p) : -1;
  });
  const { target, mapped } = foldAuthorSkeleton(names, parents);
  const slot = new Map(CONTRACT_BONES.map((b, i) => [b, i]));
  const foldTo = target.map((t) => slot.get(t));
  const bindOf = new Array(CONTRACT_BONES.length);
  for (let i = 0; i < joints.length; i++) if (mapped[i]) bindOf[slot.get(mapped[i])] = bindPos[i];

  // --- geometry, normalized the way splitBaseMeshes.mjs normalizes: feet on
  // y = 0, centered on x/z, height 1. The mesh node's own matrix does NOT
  // apply to a skinned mesh, so this is a pure geometry+bind transform.
  const prim = node.getMesh().listPrimitives()[0];
  const pos = prim.getAttribute('POSITION');
  const nrm = prim.getAttribute('NORMAL');
  const idx = prim.getIndices();
  const lo = pos.getMin([]), hi = pos.getMax([]);
  const s = 1 / (hi[1] - lo[1]);
  const off = [-((lo[0] + hi[0]) / 2) * s, -lo[1] * s, -((lo[2] + hi[2]) / 2) * s];
  const xf = (p) => [p[0] * s + off[0], p[1] * s + off[1], p[2] * s + off[2]];

  const outPos = new Float32Array(pos.getCount() * 3);
  const p3 = [];
  for (let v = 0; v < pos.getCount(); v++) {
    const q = xf(pos.getElement(v, p3));
    outPos[v * 3] = q[0]; outPos[v * 3 + 1] = q[1]; outPos[v * 3 + 2] = q[2];
  }

  // --- weights: fold every author joint onto its contract bone, then keep
  // the four heaviest and renormalize. Nothing is invented — this is the
  // author's painted weight, summed where the contract merges joints.
  const jiA = prim.getAttribute('JOINTS_0');
  const jwA = prim.getAttribute('WEIGHTS_0');
  const outJ = new Uint16Array(pos.getCount() * 4);
  const outW = new Float32Array(pos.getCount() * 4);
  let clipped = 0;
  let clippedMax = 0;
  const j4 = [], w4 = [];
  for (let v = 0; v < pos.getCount(); v++) {
    jiA.getElement(v, j4);
    jwA.getElement(v, w4);
    const acc = new Map();
    for (let k = 0; k < 4; k++) {
      if (!(w4[k] > 0)) continue;
      const b = foldTo[j4[k]];
      if (b === undefined) throw new Error(`authorRigBaseMeshes: vertex ${v} references joint ${j4[k]} with no fold target`);
      acc.set(b, (acc.get(b) ?? 0) + w4[k]);
    }
    const sorted = [...acc.entries()].sort((a, b) => b[1] - a[1]);
    const keep = sorted.slice(0, 4);
    const dropped = sorted.slice(4).reduce((t, e) => t + e[1], 0);
    if (dropped > 1e-6) { clipped++; clippedMax = Math.max(clippedMax, dropped); }
    const sum = keep.reduce((t, e) => t + e[1], 0) || 1;
    for (let k = 0; k < 4; k++) {
      outJ[v * 4 + k] = keep[k] ? keep[k][0] : 0;
      outW[v * 4 + k] = keep[k] ? keep[k][1] / sum : 0;
    }
  }

  // --- the output document: exactly the 39 contract bones, contract-parented
  const out = new Document();
  const buf = out.createBuffer();
  const bones = CONTRACT_BONES.map((name, i) => {
    if (!bindOf[i]) throw new Error(`authorRigBaseMeshes: no bind position for "${name}"`);
    return out.createNode(name);
  });
  // Our contract puts `root` at the ENTITY origin (between the feet, on the
  // ground) — createSkinnedFromRig throws on a root that binds anywhere else,
  // because the driver writes that bone at the origin every frame. The pack's
  // `_rootJoint` binds at the armature origin, which normalization moves off
  // the ground plane. Re-seating it is exact: a bone's bind is defined by its
  // inverse-bind matrix, which is written from these same world transforms.
  const worldT = CONTRACT_BONES.map((_, i) => (i === 0 ? [0, 0, 0] : xf(bindOf[i])));
  for (const [i, name] of CONTRACT_BONES.entries()) {
    const parent = CONTRACT_PARENT[name];
    // bones carry translation only: the seam's alignBindFramesToSink rewrites
    // every rest rotation anyway, and glTF stores no bone tails, so an
    // invented roll here would only mislead a later reader.
    const pw = parent ? worldT[slot.get(parent)] : [0, 0, 0];
    bones[i].setTranslation([worldT[i][0] - pw[0], worldT[i][1] - pw[1], worldT[i][2] - pw[2]]);
    if (parent) bones[slot.get(parent)].addChild(bones[i]);
  }
  const rootBone = bones[0];


  const acc = (name, arr, type) => out.createAccessor(name).setType(type).setArray(arr).setBuffer(buf);
  const outMesh = out.createMesh('body');
  const outPrim = out.createPrimitive()
    .setAttribute('POSITION', acc('POSITION', outPos, 'VEC3'))
    .setAttribute('JOINTS_0', acc('JOINTS_0', outJ, 'VEC4'))
    .setAttribute('WEIGHTS_0', acc('WEIGHTS_0', outW, 'VEC4'));
  if (nrm) {
    // normals are rotation-free here (uniform scale + translation), so they
    // carry across untouched
    outPrim.setAttribute('NORMAL', acc('NORMAL', nrm.getArray().slice(), 'VEC3'));
  }
  if (idx) outPrim.setIndices(acc('indices', idx.getArray().slice(), 'SCALAR'));
  outMesh.addPrimitive(outPrim);

  const ibmOut = new Float32Array(CONTRACT_BONES.length * 16);
  for (let i = 0; i < CONTRACT_BONES.length; i++) {
    // bind world is a pure translation, so its inverse is the negated one
    ibmOut.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -worldT[i][0], -worldT[i][1], -worldT[i][2], 1], i * 16);
  }
  const outSkin = out.createSkin('authorRig')
    .setSkeleton(rootBone)
    .setInverseBindMatrices(acc('ibm', ibmOut, 'MAT4'));
  for (const b of bones) outSkin.addJoint(b);

  const meshNode = out.createNode('body').setMesh(outMesh).setSkin(outSkin);
  out.createScene(model.id).addChild(meshNode).addChild(rootBone);
  // preserve the author armature's own naming: the fold is recorded so a
  // later task can restore breasts, toes, calf twists and metacarpals from
  // the untouched pack file without re-deriving this map.
  out.getRoot().setExtras({
    authorArmature: model.armature,
    authorJoints: names,
    source: 'public/references/basemesh/original/lowpoly-2026.glb',
    remap: Object.fromEntries(names.map((n, i) => [n, mapped[i] ?? `fold:${target[i]}`])),
  });

  const dest = path.join(BASE_DIR, `${model.id}.authorrig.glb`);
  await io.write(dest, out);
  const folded = names.filter((_, i) => !mapped[i]).map((n) => authorBoneKey(n));
  report.push({ id: model.id, dest, verts: pos.getCount(), folded, clipped, clippedMax });
  console.log(`${model.id}: ${joints.length} author joints -> 39 contract bones (${folded.length} folded: ${folded.join(', ')})`);
  console.log(`  ${pos.getCount()} verts, ${clipped} needed >4 influences after the fold (max weight dropped ${clippedMax.toFixed(4)}), ${(fs.statSync(dest).size / 1024).toFixed(0)} KB -> ${path.relative(ROOT, dest)}`);
}

if (Object.keys(AUTHOR_BONE_REMAP).length !== CONTRACT_BONES.length) {
  throw new Error(`authorRigBaseMeshes: the remap has ${Object.keys(AUTHOR_BONE_REMAP).length} entries for ${CONTRACT_BONES.length} contract bones`);
}
console.log(`\ndone: ${report.length} author rig(s). Bump BASE_MESH_RIG_VERSION in src/systems/entities3d/three/baseMeshCatalog.ts so open tabs reload.`);
