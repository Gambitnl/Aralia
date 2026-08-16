/**
 * @file eyeSocketParity.test.ts — the eyeball sits in the socket its head
 * sculpts for it, on every planned creature.
 *
 * 2026-08-15, Remy, live eyeball on a generated gnoll: "the eyes are inside
 * the snout". Two places computed the same placement and had drifted apart —
 * `headForms.eyeSocketPair` built the orbit art in the head form's own local
 * frame, and `assembleEntity` built the eyeball from a hand-made frame of
 * (socket forward, horizontal right, WORLD up). Those two frames agree only
 * for a head that does not pitch, and every plan head pitches. Measured on
 * plan 19f48ed2, in the head form's local space:
 *
 *     socket art  (±0.360,  0.190, 0.585)
 *     eyeball     (±0.223, −0.202, 0.364)
 *
 * 38% too narrow, 0.39 too low, 0.22 too deep. Nothing caught it because each
 * half was internally consistent: the art was where the art meant to be and
 * the ball was where the ball meant to be. Only the assembled article shows
 * the gap, so this test measures the assembled article.
 *
 * `PLAN_EYE_STATION` is now THE station. The art is built from it and the
 * eyeball is placed by the head form's own live transform, the same way
 * `skeletonBuilder` mirrors the gait driver constant-for-constant. This test
 * is what keeps them mirrored.
 */
import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import type { Object3D } from 'three';
import { assembleEntity } from '../three/assembleEntity';
import { generateEntityBlueprint } from '../generateEntityBlueprint';
import { registerAllParts } from '../parts';
import { PLAN_FIXTURES } from '../textPlan/fixtures';
import { PLAN_EYE_STATION } from '../three/headForms';
import { CreatureType } from '../../../types/creatures';

registerAllParts();

/**
 * The station is a UNIT-head coordinate, and the head form is scaled by the
 * socket radius. A tolerance of 1e-4 unit-head is well under a tenth of a
 * millimetre on any creature we ship — this is an equality check with room for
 * float error, not a tuning window.
 */
const LOCAL_TOL = 1e-4;

interface Drift {
  subject: string;
  head: string;
  eye: string;
  local: [number, number, number];
  expected: [number, number, number];
  offBy: number;
}

/** Socket-art piece names, per side, in the order eyeSocketPair emits them. */
const ART = {
  L: ['orbitHoodL', 'lidLineL', 'lowerLidL'],
  R: ['orbitHoodR', 'lidLineR', 'lowerLidR'],
} as const;

function checkSubject(subject: string, root: Object3D): { drift: Drift[]; heads: number } {
  const drift: Drift[] = [];
  const forms: Object3D[] = [];
  root.traverse((o) => {
    if (/^head\d+:form$/.test(o.name)) forms.push(o);
  });

  for (const form of forms) {
    form.updateWorldMatrix(true, true);
    const headIndex = Number(/^head(\d+):form$/.exec(form.name)![1]);
    const eyes: Object3D[] = [];
    root.traverse((o) => {
      if (new RegExp(`^eyeP${headIndex}_\\d+$`).test(o.name)) eyes.push(o);
    });
    // Only a two-eye head has a left/right station to compare against; a
    // cyclops or a many-eyed head interpolates across the same span and has no
    // socket art to sit in.
    if (eyes.length !== 2) continue;

    for (const eye of eyes) {
      const local = form.worldToLocal(eye.getWorldPosition(new Vector3()));
      const sgn = Math.sign(local.x) || 1;
      const expected = new Vector3(sgn * PLAN_EYE_STATION.x, PLAN_EYE_STATION.y, PLAN_EYE_STATION.z);
      const offBy = local.distanceTo(expected);
      if (offBy > LOCAL_TOL) {
        drift.push({
          subject,
          head: form.name,
          eye: eye.name,
          local: [+local.x.toFixed(4), +local.y.toFixed(4), +local.z.toFixed(4)],
          expected: [+expected.x.toFixed(4), +expected.y.toFixed(4), +expected.z.toFixed(4)],
          offBy: +offBy.toFixed(4),
        });
      }
    }

    // and the art, where this head form carries any: the MEAN of the three
    // orbit pieces must land on the station. Their offsets sum to zero by
    // construction (EYE_ART_OFFSET), which is exactly what makes "the ball is
    // in the middle of its socket" a statement rather than an impression.
    for (const side of ['L', 'R'] as const) {
      const pieces = ART[side]
        .map((n) => form.getObjectByName(n))
        .filter((o): o is Object3D => !!o);
      if (pieces.length !== 3) continue;
      const mean = new Vector3();
      for (const p of pieces) mean.add(form.worldToLocal(p.getWorldPosition(new Vector3())));
      mean.multiplyScalar(1 / 3);
      const sgn = side === 'L' ? -1 : 1;
      const expected = new Vector3(sgn * PLAN_EYE_STATION.x, PLAN_EYE_STATION.y, PLAN_EYE_STATION.z);
      const offBy = mean.distanceTo(expected);
      if (offBy > LOCAL_TOL) {
        drift.push({
          subject,
          head: form.name,
          eye: `socket art ${side}`,
          local: [+mean.x.toFixed(4), +mean.y.toFixed(4), +mean.z.toFixed(4)],
          expected: [+expected.x.toFixed(4), +expected.y.toFixed(4), +expected.z.toFixed(4)],
          offBy: +offBy.toFixed(4),
        });
      }
    }
  }
  return { drift, heads: forms.length };
}

function sweep(subject: string, build: () => ReturnType<typeof assembleEntity>) {
  const handle = build();
  try {
    // Two updates at different times: the eye placement must hold through a
    // moving head, not just on the frame the scene was built.
    handle.update(0.5, 1 / 60);
    const first = checkSubject(subject, handle.group);
    handle.update(2.7, 1 / 60);
    const second = checkSubject(`${subject} @t2.7`, handle.group);
    return { drift: [...first.drift, ...second.drift], heads: first.heads };
  } finally {
    handle.dispose();
  }
}

describe('planned eyes seat in their sockets', () => {
  it('every formed head puts its eyeball and its orbit art on PLAN_EYE_STATION', () => {
    const drift: Drift[] = [];
    let headsSeen = 0;

    for (const [key, plan] of Object.entries(PLAN_FIXTURES)) {
      const r = sweep(`fixture:${key}`, () =>
        assembleEntity(generateEntityBlueprint({ kind: 'planned', plan, seed: 'eyes' }), { renderMode: 'solid' }),
      );
      drift.push(...r.drift);
      headsSeen += r.heads;
    }

    for (const type of Object.values(CreatureType)) {
      const r = sweep(`archetype:${type}`, () =>
        assembleEntity(generateEntityBlueprint({ kind: 'creature', creatureType: type, size: 'Large', seed: 'eyes' }), {
          renderMode: 'solid',
        }),
      );
      drift.push(...r.drift);
      headsSeen += r.heads;
    }

    // A green run means nothing if the sweep found no sculpted heads at all.
    expect(headsSeen, 'no formed heads in the sweep — this test would pass vacuously').toBeGreaterThan(0);
    expect(
      drift,
      'eyeballs adrift from the socket their head sculpts (head-local units):\n' +
        drift
          .map(
            (d) =>
              `  ${d.subject} / ${d.head} / ${d.eye}: at [${d.local}] want [${d.expected}], off by ${d.offBy}`,
          )
          .join('\n'),
    ).toEqual([]);
  });
});
