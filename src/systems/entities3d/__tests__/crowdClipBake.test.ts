/**
 * @file crowdClipBake.test.ts — NPC life (2026-11-02): the crowd's activity
 * frames come from the clip system. A hand-built clip (no GLTF) poses the
 * game's skinned body; the bake freezes each sampled pose into a static,
 * vertex-colored geometry that stands on y = 0, and head parts move with the
 * head bone.
 */
import { describe, it, expect } from 'vitest';
import { AnimationClip, Box3, Quaternion, QuaternionKeyframeTrack, Vector3, type BufferGeometry } from 'three';
import { registerAllParts } from '../parts';
import { recipeFromOccupant } from '../recipeFromOccupant';
import { generateEntityBlueprint } from '../generateEntityBlueprint';
import { bakeCrowdClipFrames } from '../three/crowdBake';

registerAllParts();

/** A clip that turns one bone by `deg` about X over one second. */
function turnClip(name: string, bone: string, deg: number): AnimationClip {
  const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), (deg * Math.PI) / 180);
  const track = new QuaternionKeyframeTrack(`${bone}.quaternion`, [0, 0.5, 1], [0, 0, 0, 1, q.x, q.y, q.z, q.w, 0, 0, 0, 1]);
  return new AnimationClip(name, 1, [track]);
}

const box = (g: BufferGeometry) => new Box3().setFromBufferAttribute(g.attributes.position as never);

describe('bakeCrowdClipFrames', () => {
  const blueprint = generateEntityBlueprint(recipeFromOccupant({ id: 4242, ageBand: 'adult', race: 'Dwarf' }));
  const clips = new Map([
    ['Talk', turnClip('Talk', 'upperArmR', -80)],
    ['Nod', turnClip('Nod', 'head', 35)],
  ]);
  const frames = bakeCrowdClipFrames(blueprint, clips, [{ clip: 'Talk', frames: 4 }, { clip: 'Nod', frames: 4 }]);

  it('bakes the requested frames with position, normal and color', () => {
    expect(frames.get('Talk')).toHaveLength(4);
    expect(frames.get('Nod')).toHaveLength(4);
    for (const g of frames.get('Talk')!) {
      expect(g.attributes.position.count).toBeGreaterThan(300);
      expect(g.attributes.normal).toBeDefined();
      expect(g.attributes.color).toBeDefined();
    }
  });

  it('stands on the ground like the idle and walk frames', () => {
    const b = box(frames.get('Talk')![0]);
    expect(b.min.y).toBeGreaterThan(-0.08);
    expect(b.min.y).toBeLessThan(0.08);
    expect(b.max.y).toBeGreaterThan(0.8);
  });

  it('changes the pose through the clip', () => {
    const [rest, , mid] = frames.get('Talk')!;
    const a = box(rest), b = box(mid);
    expect(a.equals(b)).toBe(false);
  });

  it('keeps head parts on the head when the head moves', () => {
    // At the nod's peak the head (and the beard on it) tips forward, so the
    // whole figure reaches farther forward than at rest. Parts left at the
    // rest anchor would not move; the box would stay the same in front.
    const [rest, , peak] = frames.get('Nod')!;
    const a = rest.attributes.position, b = peak.attributes.position;
    expect(a.count).toBe(b.count); // same vertex order frame to frame
    const moved = (i: number) => Math.hypot(a.getX(i) - b.getX(i), a.getY(i) - b.getY(i), a.getZ(i) - b.getZ(i));
    // Parts merge after the skinned fill, so the last vertices are head parts.
    let partMove = 0;
    for (let i = a.count - 60; i < a.count; i++) partMove = Math.max(partMove, moved(i));
    expect(partMove).toBeGreaterThan(0.02);
    // The feet do not move with a nod.
    let lowMove = 0;
    for (let i = 0; i < a.count; i++) if (a.getY(i) < 0.1) lowMove = Math.max(lowMove, moved(i));
    expect(lowMove).toBeLessThan(0.01);
  });

  it('fails loudly on a missing clip', () => {
    expect(() => bakeCrowdClipFrames(blueprint, clips, [{ clip: 'Idle_Talking', frames: 2 }])).toThrow(/no clip/);
  });
});
