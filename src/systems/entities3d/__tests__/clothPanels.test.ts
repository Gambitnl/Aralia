/**
 * Cloth garment panels (character cloth+armor slice 1b, 2026-11-04).
 *
 * A panel must start CLEAR of the body it hangs on (or the solver pops it on
 * the first frame), pin along the shoulder line, and size itself from the
 * body so one cut fits every race. These checks run on four frames that span
 * the stature range: halfling, dwarf, human, half-orc.
 */
import { describe, expect, it } from 'vitest';
import { generateEntityBlueprint } from '../generateEntityBlueprint';
import { buildBipedSkeleton } from '../three/skeletonBuilder';
import { buildSmoothBipedGeometry } from '../three/smoothBipedGeometry';
import { heightM } from '../types';
import { CLOTH_COLLIDER_STRIDE, bipedClothColliders, colliderClearance, defaultClothMargins, packRestColliders } from '../three/cloth/bodyColliders';
import { capePanel, type CapeLength } from '../three/cloth/garmentPanels';

function body(raceId: string) {
  const frame = generateEntityBlueprint({ kind: 'humanoid', raceId, classId: 'fighter', seed: 'cloth-panels' }).frame;
  const skel = buildBipedSkeleton(frame);
  const skin = buildSmoothBipedGeometry(skel.restPose, skel.index, frame);
  const colliders = bipedClothColliders(frame, skel.restPose, skel.index, skin, defaultClothMargins(heightM(frame)));
  return { h: heightM(frame), colliders };
}

describe('cape panel', () => {
  it.each(['lightfoot_halfling', 'hill_dwarf', 'human', 'half_orc'])('starts clear of the %s body and pins the shoulder line', (raceId) => {
    const { h, colliders } = body(raceId);
    const cape = capePanel(colliders, h, { length: 'calf' });
    expect(cape.rows).toBeGreaterThanOrEqual(13);
    expect(cape.cols).toBeGreaterThanOrEqual(13);
    expect(cape.rest.length).toBe(cape.rows * cape.cols * 3);
    // clear of every collider it touches
    const used = colliders.filter((c) => cape.colliders.includes(c.id));
    expect(used.length).toBe(cape.colliders.length);
    const caps = new Float32Array(used.length * CLOTH_COLLIDER_STRIDE);
    packRestColliders(used, caps);
    let worst = Infinity;
    for (let i = 0; i < cape.rows * cape.cols; i++) {
      worst = Math.min(worst, colliderClearance(caps, used.length, cape.rest[i * 3], cape.rest[i * 3 + 1], cape.rest[i * 3 + 2]));
    }
    expect(worst).toBeGreaterThanOrEqual(0);
    // the whole top row is pinned, left third to the left clavicle
    expect(cape.pins.map((p) => p.index)).toEqual([...Array(cape.cols).keys()]);
    expect(cape.pins[0].bone).toBe('clavicleL');
    expect(cape.pins[cape.cols - 1].bone).toBe('clavicleR');
    expect(cape.pins[Math.floor(cape.cols / 2)].bone).toBe('chest');
    // it hangs at the BACK: every point behind the chest axis
    const chest = colliders.find((c) => c.id === 'torso.chest')!;
    for (let i = 0; i < cape.rows * cape.cols; i++) expect(cape.rest[i * 3 + 2]).toBeLessThan(chest.a[2]);
    // the hem is above the floor and below the waist
    const hemY = cape.rest[((cape.rows - 1) * cape.cols) * 3 + 1];
    expect(hemY).toBeGreaterThan(0);
    expect(hemY).toBeLessThan(0.5 * h);
  });

  it('orders the hem heights hip > knee > calf > ankle', () => {
    const { h, colliders } = body('human');
    const hem = (length: CapeLength) => {
      const c = capePanel(colliders, h, { length });
      return c.rest[((c.rows - 1) * c.cols) * 3 + 1];
    };
    expect(hem('hip')).toBeGreaterThan(hem('knee'));
    expect(hem('knee')).toBeGreaterThan(hem('calf'));
    expect(hem('calf')).toBeGreaterThan(hem('ankle'));
  });

  it('scales with the body: a half-orc cape is wider than a halfling cape', () => {
    const width = (raceId: string) => {
      const { h, colliders } = body(raceId);
      const c = capePanel(colliders, h, { length: 'calf' });
      return c.rest[(c.cols - 1) * 3] - c.rest[0];
    };
    expect(width('half_orc')).toBeGreaterThan(width('lightfoot_halfling') * 1.5);
  });
});
