/**
 * @file authorBoneRemap.mjs — the bone-name adapter between the lowpoly-2026
 * pack's OWN author armatures and our 39-bone biped contract.
 *
 * Remy's pick 2026-08-28 (board task agora-2560): replace the bone-heat rigs
 * with the pack's hand-painted author rigs. "BASEMESH ARMATURE FEMALE" (70
 * joints) and "BASEMESH ARMATURE MALE" (68 joints) live inside
 * public/references/basemesh/original/lowpoly-2026.glb. Their joint layout is
 * NOT ours, so the FK drive seam (createSkinnedFromRig / frameFromRig, which
 * addresses bones by our names) needs this translation.
 *
 * WHY the remap runs at BUILD time and not in the renderer: the seam's
 * alignBindFramesToSink re-aims each of our 39 bones' rest rotation while
 * holding its world position. Any author bone left hanging BELOW one of ours
 * keeps its old local offset and is therefore displaced by that re-aim, which
 * would tear the flesh weighted to it. So authorRigBaseMeshes.mjs emits a rig
 * that is exactly the 39-bone contract, and every author joint that has no
 * contract slot FOLDS its hand-painted weight into its nearest mapped
 * ancestor. The seam then needs no change at all and `pack:` rigs stay
 * untouched. The author armature itself is preserved: the untouched pack file
 * stays in the repo and the emitted GLB records this map in its extras.
 *
 * Name keys: the pack's exporter suffixes every joint with `_<n>` and the
 * numbering differs between the two armatures (the male even carries
 * `HAND MIDLE.L_00`), so match on the name with that suffix stripped.
 * three's GLTFLoader also sanitizes node names (spaces and dots dropped), so
 * `authorBoneKey` accepts both the raw and the sanitized spelling.
 */

/**
 * Author joint (suffix-stripped) -> our contract bone name.
 *
 * Spine: the author armature carries THREE spine joints (PELVIS CENTRAL ->
 * BELLY -> CHEST CENTRAL) where our contract has two (pelvis -> chest), so
 * one must fold. `chest` takes BELLY, not CHEST CENTRAL: measured on the
 * pack's own weights (torso-weights.mjs, 2026-09-09) the pelvis owns up to
 * 0.58 h and BELLY owns 0.58-0.68 h, so folding CHEST CENTRAL upward
 * reproduces the healthy pack-rig profile (pelvis to 0.58, spine 0.58-0.80,
 * neck from 0.82), while folding BELLY downward would have handed the pelvis
 * the whole belly to 0.68 h.
 *
 * Legs: the author chain is PELVIS.x -> THIGH.x -> KNEE.x -> CALF.x ->
 * FOOT.x -> TOE.x. THIGH is the hip joint, KNEE the knee, FOOT the ankle;
 * CALF is a shin twist joint and folds into `shin`.
 *
 * Hands: each finger is metacarpal (`HAND POINTER.x`) + three phalanges. Our
 * contract carries two links per finger, so the metacarpal folds into the
 * hand and the distal phalanx folds into the `b` link. The thumb is already
 * two joints (TUMBBASE + TUMB1) and maps straight across.
 */
export const AUTHOR_BONE_REMAP = Object.freeze({
  _rootJoint: 'root',
  'PELVIS CENTRAL': 'pelvis',
  BELLY: 'chest',
  NECK: 'neck',
  HEAD: 'head',

  'SHOULDER.L': 'clavicleL',
  'ARM.L': 'upperArmL',
  'FOREARM.L': 'foreArmL',
  'HAND_MAIN.L': 'handL',
  'POINTER1.L': 'fingerL0a', 'POINTER2.L': 'fingerL0b',
  'MIDLE1.L': 'fingerL1a', 'MIDLE2.L': 'fingerL1b',
  'RING1.L': 'fingerL2a', 'RING2.L': 'fingerL2b',
  'PINKY1.L': 'fingerL3a', 'PINKY2.L': 'fingerL3b',
  'TUMBBASE.L': 'thumbLa', 'TUMB1.L': 'thumbLb',

  'SHOULDER.R': 'clavicleR',
  'ARM.R': 'upperArmR',
  'FOREARM.R': 'foreArmR',
  'HAND_MAIN.R': 'handR',
  'POINTER1.R': 'fingerR0a', 'POINTER2.R': 'fingerR0b',
  'MIDLE1.R': 'fingerR1a', 'MIDLE2.R': 'fingerR1b',
  'RING1.R': 'fingerR2a', 'RING2.R': 'fingerR2b',
  'PINKY1.R': 'fingerR3a', 'PINKY2.R': 'fingerR3b',
  'TUMBBASE.R': 'thumbRa', 'TUMB1.R': 'thumbRb',

  'THIGH.L': 'thighL', 'KNEE.L': 'shinL', 'FOOT.L': 'footL',
  'THIGH.R': 'thighR', 'KNEE.R': 'shinR', 'FOOT.R': 'footR',
});

/** The 39 contract bones, parent-first — mirrors BIPED_BONE_NAMES in
 * src/systems/entities3d/three/skeletonBuilder.ts. Kept here so the build
 * tool needs no TypeScript; authorRig.test.ts asserts the two agree. */
export const CONTRACT_BONES = Object.freeze([
  'root', 'pelvis', 'chest', 'neck', 'head',
  'clavicleL', 'upperArmL', 'foreArmL', 'handL',
  'clavicleR', 'upperArmR', 'foreArmR', 'handR',
  'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR',
  'thumbLa', 'thumbLb',
  'fingerL0a', 'fingerL0b', 'fingerL1a', 'fingerL1b',
  'fingerL2a', 'fingerL2b', 'fingerL3a', 'fingerL3b',
  'thumbRa', 'thumbRb',
  'fingerR0a', 'fingerR0b', 'fingerR1a', 'fingerR1b',
  'fingerR2a', 'fingerR2b', 'fingerR3a', 'fingerR3b',
]);

/** Parent of each contract bone — mirrors BIPED_BONE_PARENT. */
export const CONTRACT_PARENT = Object.freeze({
  root: null, pelvis: 'root', chest: 'pelvis', neck: 'chest', head: 'neck',
  clavicleL: 'chest', upperArmL: 'clavicleL', foreArmL: 'upperArmL', handL: 'foreArmL',
  clavicleR: 'chest', upperArmR: 'clavicleR', foreArmR: 'upperArmR', handR: 'foreArmR',
  thighL: 'pelvis', shinL: 'thighL', footL: 'shinL',
  thighR: 'pelvis', shinR: 'thighR', footR: 'shinR',
  thumbLa: 'handL', thumbLb: 'thumbLa',
  fingerL0a: 'handL', fingerL0b: 'fingerL0a', fingerL1a: 'handL', fingerL1b: 'fingerL1a',
  fingerL2a: 'handL', fingerL2b: 'fingerL2a', fingerL3a: 'handL', fingerL3b: 'fingerL3a',
  thumbRa: 'handR', thumbRb: 'thumbRa',
  fingerR0a: 'handR', fingerR0b: 'fingerR0a', fingerR1a: 'handR', fingerR1b: 'fingerR1a',
  fingerR2a: 'handR', fingerR2b: 'fingerR2a', fingerR3a: 'handR', fingerR3b: 'fingerR3a',
});

/** Strip the pack exporter's `_<n>` suffix. `HAND MIDLE.L_00` -> `HAND MIDLE.L`. */
export function authorBoneKey(name) {
  return name.replace(/_\d+$/, '');
}

/** Our contract name for one author joint, or null when it has no slot. */
export function contractNameFor(authorName) {
  const raw = authorBoneKey(authorName);
  if (raw in AUTHOR_BONE_REMAP) return AUTHOR_BONE_REMAP[raw];
  // three's GLTFLoader spelling: `HAND_MAIN.R` arrives as `HAND_MAINR`
  const flat = raw.replace(/[^A-Za-z0-9_]/g, '');
  for (const [k, v] of Object.entries(AUTHOR_BONE_REMAP)) {
    if (k.replace(/[^A-Za-z0-9_]/g, '') === flat) return v;
  }
  return null;
}

/**
 * The full fold for one author armature: every joint index resolves to the
 * contract bone that will carry its weight — itself when it maps, otherwise
 * its nearest mapped ancestor.
 *
 * @param {string[]} names   author joint names, in skin joint order
 * @param {number[]} parents parent index per joint (-1 for the armature root)
 * @returns {{ target: string[], mapped: (string|null)[] }}
 *   `target[i]` = contract bone owning joint i's weight; `mapped[i]` = the
 *   contract bone joint i IS, or null when it only folds.
 */
export function foldAuthorSkeleton(names, parents) {
  const mapped = names.map((n) => contractNameFor(n));
  const target = new Array(names.length).fill(null);
  const resolve = (i, seen = new Set()) => {
    if (target[i]) return target[i];
    if (mapped[i]) return (target[i] = mapped[i]);
    if (seen.has(i)) throw new Error(`foldAuthorSkeleton: cycle at joint "${names[i]}"`);
    seen.add(i);
    const p = parents[i];
    if (p < 0) throw new Error(`foldAuthorSkeleton: "${names[i]}" is a root with no contract slot`);
    return (target[i] = resolve(p, seen));
  };
  for (let i = 0; i < names.length; i++) resolve(i);
  const claimed = new Set(mapped.filter(Boolean));
  const missing = CONTRACT_BONES.filter((b) => !claimed.has(b));
  if (missing.length) throw new Error(`foldAuthorSkeleton: no author joint maps to ${missing.join(', ')}`);
  return { target, mapped };
}
