/**
 * Heroic body preset (character cloth+armor campaign, 2026-11-05).
 *
 * The proportion gate from the campaign's sculpt spec (anatomy.json, measured
 * on the target lineup Remy chose): the heroic human must read as 5.15
 * head-units tall with a 2.8 HU shoulder span, 1.94 HU hip-to-floor, hands
 * 0.8 HU long and feet 1.0 HU long, each within 12 percent. Today's body
 * must NOT pass the same gate (it is the look Remy rejected), which proves
 * the preset acts. The heroic skin must still be covered by the cloth
 * colliders, because the cape will hang on this body.
 */
import { describe, expect, it } from 'vitest';
import { generateEntityBlueprint } from '../generateEntityBlueprint';
import { bipedBodyRadii, bipedSkullRadiusM, buildBipedSkeleton, heroicFrame } from '../three/skeletonBuilder';
import { buildSmoothBipedGeometry } from '../three/smoothBipedGeometry';
import { heightM, type Frame } from '../types';
import { CLOTH_COLLIDER_STRIDE, bipedClothColliders, colliderClearance, defaultClothMargins, packRestColliders } from '../three/cloth/bodyColliders';

const TARGET = { heads: 5.15, shoulders: 2.8, legs: 1.94, hand: 0.8, foot: 1.0 };

function measure(frame: Frame) {
  const skel = buildBipedSkeleton(frame);
  const pose = skel.restPose;
  const seg = (id: string) => {
    const s = pose.segments.find((g) => g.id === id);
    if (!s) throw new Error(`no segment ${id}`);
    return s;
  };
  const len = (s: { a: readonly number[]; b: readonly number[] }) => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]);
  const head = pose.balls.find((b) => b.id === 'head')!;
  const deltoid = pose.balls.find((b) => b.id === 'deltoidL')!;
  const skullR = bipedSkullRadiusM(frame);
  // the sculpted head spans crown +0.88 R to chin -0.59 R (headForms)
  const hu = skullR * 1.47;
  const crown = head.center[1] + skullR * 0.88;
  const radii = bipedBodyRadii(frame);
  return {
    heightM: crown,
    heads: crown / hu,
    shoulders: (2 * (Math.abs(deltoid.center[0]) + deltoid.r)) / hu,
    legs: seg('legL.thigh').a[1] / hu,
    hand: (radii.palmLen + radii.fingerLen) / hu,
    foot: (radii.heelBack + radii.toeFwd) / hu,
    wristOverElbow: radii.wristR / radii.elbowR,
    skel,
  };
}

const within = (v: number, target: number, tol = 0.12) => Math.abs(v - target) <= target * tol;

describe('heroic body preset', () => {
  const base = generateEntityBlueprint({ kind: 'humanoid', raceId: 'human', classId: 'paladin', seed: '2' }).frame;

  it('hits the target proportions on the human', () => {
    const m = measure(heroicFrame(base));
    console.log(`[heroic body] heads ${m.heads.toFixed(2)} shoulders ${m.shoulders.toFixed(2)} legs ${m.legs.toFixed(2)} hand ${m.hand.toFixed(2)} foot ${m.foot.toFixed(2)} wrist/elbow ${m.wristOverElbow.toFixed(2)} crown ${m.heightM.toFixed(2)} m (frame ${heightM(base).toFixed(2)} m)`);
    expect(within(m.heads, TARGET.heads)).toBe(true);
    expect(within(m.shoulders, TARGET.shoulders)).toBe(true);
    expect(within(m.legs, TARGET.legs)).toBe(true);
    expect(within(m.hand, TARGET.hand)).toBe(true);
    expect(within(m.foot, TARGET.foot)).toBe(true);
    // club forearm: the wrist keeps most of the elbow
    expect(m.wristOverElbow).toBeGreaterThan(0.78);
    // the figure keeps roughly its stated stature (the head grew, the legs shrank)
    expect(within(m.heightM, heightM(base), 0.15)).toBe(true);
  });

  it("today's body fails the same gate (the preset acts)", () => {
    const m = measure(base);
    console.log(`[current body] heads ${m.heads.toFixed(2)} shoulders ${m.shoulders.toFixed(2)} legs ${m.legs.toFixed(2)} hand ${m.hand.toFixed(2)} foot ${m.foot.toFixed(2)}`);
    expect(within(m.heads, TARGET.heads)).toBe(false);
    expect(within(m.hand, TARGET.hand) && within(m.foot, TARGET.foot)).toBe(false);
  });

  it('keeps every heroic skin vertex inside the cloth colliders', () => {
    const frame = heroicFrame(base);
    const skel = buildBipedSkeleton(frame);
    const skin = buildSmoothBipedGeometry(skel.restPose, skel.index, frame);
    const colliders = bipedClothColliders(frame, skel.restPose, skel.index, skin, defaultClothMargins(heightM(frame)));
    const caps = new Float32Array(colliders.length * CLOTH_COLLIDER_STRIDE);
    packRestColliders(colliders, caps);
    const pos = skin.getAttribute('position');
    const si = skin.getAttribute('skinIndex');
    const sw = skin.getAttribute('skinWeight');
    const names = [...skel.index.keys()];
    let worst = -Infinity;
    for (let v = 0; v < pos.count; v++) {
      let best = 0;
      for (let k = 1; k < 4; k++) if (sw.getComponent(v, k) > sw.getComponent(v, best)) best = k;
      if (/^(thumb|finger|root)/.test(names[si.getComponent(v, best)])) continue;
      worst = Math.max(worst, colliderClearance(caps, colliders.length, pos.getX(v), pos.getY(v), pos.getZ(v)));
    }
    expect(colliders.length).toBe(20);
    expect(worst).toBeLessThanOrEqual(0);
  });
});
