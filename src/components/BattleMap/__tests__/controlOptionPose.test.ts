/**
 * G7 — control-option pose contract (approach / flee / drop / grovel / halt).
 *
 * One shared, non-blocking contract drives BOTH combat surfaces: the 2D token
 * (CSS transform/filter channel) and the 3D actor (whole-body pitch/yOffset
 * channel). These tests pin the load-bearing logic:
 *   - resolution from the live status names UtilityCommand writes
 *   - cache (per statusEffects array identity — arrays are replaced immutably)
 *   - fallback (unknown or absent directives = base look, never a throw)
 *   - restore (status expiry resolves to null; the 3D easer returns to zero)
 */
import { describe, expect, it } from 'vitest';
import {
  CONTROL_POSES,
  easeActorPose,
  resolveControlPose,
  type AppliedActorPose,
} from '../controlOptionPose';

const status = (name: string) => ({ name });

describe('resolveControlPose — status → pose resolution', () => {
  it.each([
    ['Command: Approach', 'approach'],
    ['Command: Flee', 'flee'],
    ['Command: Drop', 'drop'],
    ['Command: Grovel', 'grovel'],
    ['Command: Halt', 'halt'],
  ])('maps status "%s" to pose "%s"', (statusName, poseId) => {
    const pose = resolveControlPose([status(statusName)]);
    expect(pose?.id).toBe(poseId);
  });

  it('fallback: unrelated or absent statuses resolve to null (base look)', () => {
    expect(resolveControlPose([])).toBeNull();
    expect(resolveControlPose([status('Prone'), status('Taunted')])).toBeNull();
    expect(resolveControlPose(undefined)).toBeNull();
  });

  it('precedence: grovel wins over other simultaneous directives', () => {
    const pose = resolveControlPose([
      status('Command: Halt'),
      status('Command: Grovel'),
    ]);
    expect(pose?.id).toBe('grovel');
  });

  it('cache: resolution is cached per statusEffects array identity', () => {
    const effects = [status('Command: Halt')];
    const first = resolveControlPose(effects);
    // Mutating the array after the first resolve must NOT change the cached
    // answer — proof the WeakMap cache keyed the array, not its contents.
    effects.push(status('Command: Grovel'));
    expect(resolveControlPose(effects)).toBe(first);
    // A replaced array (the immutable-update path) recomputes.
    expect(resolveControlPose([...effects])?.id).toBe('grovel');
  });

  it('restore: a new array without the directive resolves to null', () => {
    expect(resolveControlPose([status('Command: Flee')])?.id).toBe('flee');
    expect(resolveControlPose([])).toBeNull();
  });
});

describe('pose registry — both channels are authored for every directive', () => {
  it('every pose carries a 2D transform and a distinct id', () => {
    const ids = new Set<string>();
    for (const pose of Object.values(CONTROL_POSES)) {
      ids.add(pose.id);
      expect(pose.token2d.transform.length).toBeGreaterThan(0);
      expect(pose.statusName.startsWith('Command: ')).toBe(true);
    }
    expect(ids.size).toBe(5);
  });

  it('grovel reads as prone in 3D: pitched far forward, near flat', () => {
    expect(CONTROL_POSES.grovel.actor3d.pitch).toBeGreaterThan(1.2);
  });

  it('approach and flee lean in opposite directions in 3D', () => {
    expect(Math.sign(CONTROL_POSES.approach.actor3d.pitch)).toBe(1);
    expect(Math.sign(CONTROL_POSES.flee.actor3d.pitch)).toBe(-1);
  });
});

describe('easeActorPose — non-blocking apply and restore for the 3D surface', () => {
  const settle = (applied: AppliedActorPose, target: Parameters<typeof easeActorPose>[1], steps = 120) => {
    for (let i = 0; i < steps; i++) easeActorPose(applied, target, 1 / 60);
    return applied;
  };

  it('converges onto the grovel pose over successive frames', () => {
    const applied: AppliedActorPose = { pitch: 0, yOffset: 0 };
    settle(applied, CONTROL_POSES.grovel);
    expect(applied.pitch).toBeCloseTo(CONTROL_POSES.grovel.actor3d.pitch, 2);
    expect(applied.yOffset).toBeCloseTo(CONTROL_POSES.grovel.actor3d.yOffset, 2);
  });

  it('restores to zero when the pose ends (target null)', () => {
    const applied: AppliedActorPose = { pitch: 0, yOffset: 0 };
    settle(applied, CONTROL_POSES.grovel);
    settle(applied, null);
    expect(applied.pitch).toBeCloseTo(0, 2);
    expect(applied.yOffset).toBeCloseTo(0, 2);
  });

  it('moves monotonically toward the target (no overshoot from one step)', () => {
    const applied: AppliedActorPose = { pitch: 0, yOffset: 0 };
    easeActorPose(applied, CONTROL_POSES.halt, 1 / 60);
    const afterOne = applied.pitch;
    easeActorPose(applied, CONTROL_POSES.halt, 1 / 60);
    const target = CONTROL_POSES.halt.actor3d.pitch;
    expect(Math.abs(applied.pitch - target)).toBeLessThan(Math.abs(afterOne - target));
    // never past the target
    expect(Math.abs(applied.pitch)).toBeLessThanOrEqual(Math.abs(target));
  });

  it('a zero delta changes nothing', () => {
    const applied: AppliedActorPose = { pitch: 0.2, yOffset: 0.05 };
    easeActorPose(applied, CONTROL_POSES.drop, 0);
    expect(applied.pitch).toBe(0.2);
    expect(applied.yOffset).toBe(0.05);
  });
});
