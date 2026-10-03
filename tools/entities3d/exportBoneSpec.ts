/**
 * @file exportBoneSpec.ts — write tools/entities3d/bipedBoneSpec.json: the
 * biped bone names, parents, and the rest-pose joint layout for a 6 ft
 * human frame, as height fractions. The Blender rig job
 * (tools/blender/rig_basemesh.py) reads it so a rigged base mesh carries
 * OUR skeleton — same names, same hierarchy — and the biped driver can pose
 * it directly. Run: npx tsx tools/entities3d/exportBoneSpec.ts
 */
import { writeFileSync } from 'node:fs';
import { deriveFrame, heightM } from '../../src/systems/entities3d/types';
import { BIPED_BONE_NAMES, BIPED_BONE_PARENT, SEGMENT_BONE, BALL_BONE, bipedRestPose } from '../../src/systems/entities3d/three/skeletonBuilder';

const frame = deriveFrame('biped', 6, 1, 1);
const h = heightM(frame);
const rest = bipedRestPose(frame);
// per bone: the segment it owns (a → b) or the ball center, as height fractions
const joints: Record<string, { a: number[]; b: number[] }> = {};
for (const seg of rest.segments) {
  const bone = SEGMENT_BONE[seg.id];
  if (!bone) continue;
  const f = (v: readonly number[]) => v.map((x) => +(x / h).toFixed(4));
  // the first segment a bone owns defines its head; the last its tail
  if (!joints[bone]) joints[bone] = { a: f(seg.a), b: f(seg.b) };
  else joints[bone].b = f(seg.b);
}
for (const ball of rest.balls) {
  const bone = BALL_BONE[ball.id];
  if (!bone || joints[bone]) continue;
  const c = ball.center.map((x) => +(x / h).toFixed(4));
  joints[bone] = { a: c, b: [c[0], +(c[1] + ball.r / h).toFixed(4), c[2]] };
}
const spec = {
  generatedBy: 'tools/entities3d/exportBoneSpec.ts',
  frame: { heightFt: 6, heightM: +h.toFixed(4) },
  bones: BIPED_BONE_NAMES,
  parent: BIPED_BONE_PARENT,
  /** head/tail per bone as fractions of body height, our rest pose (arms down). */
  restJoints: joints,
};
writeFileSync('tools/entities3d/bipedBoneSpec.json', JSON.stringify(spec, null, 2) + '\n');
console.log(`bones=${BIPED_BONE_NAMES.length} joints=${Object.keys(joints).length} missing=${BIPED_BONE_NAMES.filter((b) => !joints[b]).join(',') || 'none'}`);
