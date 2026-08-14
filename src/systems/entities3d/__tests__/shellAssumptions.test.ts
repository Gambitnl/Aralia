/**
 * @file shellAssumptions.test.ts — the SHELL-ASSUMPTION guard.
 *
 * Aralia's toon renderer assumes every surface is a THICK, CLOSED, OPAQUE
 * volume: meshes draw FrontSide, and an inverse-hull BackSide shell behind them
 * supplies the ink line. Geometry that is thin, hollow, or open breaks that
 * assumption, and it breaks it the same two ways every time.
 *
 *   VARIANT A — hollow interior exposed. A closed-but-hollow FrontSide volume
 *   with an opening. Backface culling discards the inside, so the camera sees
 *   THROUGH the mesh, or sees the dark BackSide ink hull where solid geometry
 *   should be. Seen as: the dragon wing that rendered as a "solid black sail"
 *   (mixed winding culled the front faces); the beast head you could "look
 *   inside the nose" of (jaw swung open, no gullet behind it, 2026-08-13).
 *
 *   VARIANT B — ink swallows the feature. The inverse hull offsets vertices a
 *   FIXED WORLD DISTANCE (`hM * 0.011`). On geometry whose own girth is
 *   comparable, the outline stops being a line and becomes the object. Seen as:
 *   `earsPointed` with ink at 45% of the ear radius, whose dark rim swallowed
 *   the ear toward the tip (Remy, 2026-08-13); the round-16 fist that inked its
 *   own knuckle creases shut into a "featureless sphere"; horn points and wing
 *   spars that read as "detached scribble wires".
 *
 * Each of those was fixed on its own — `userData.noOutline`, a per-vertex
 * `aInk` attribute, a per-face winding test, a gape threshold, a girth clamp.
 * Five mechanisms, two root causes, and until this file NO shared invariant, so
 * nothing stopped the next new part from reintroducing it. That is what this
 * test is for: it is not a regression gate on one bug, it is a gate on the
 * CLASS. It sweeps the fixtures AND the generated archetypes, because the
 * hand-authored fixtures are chunky and wide-gaped — it took a generated gnoll
 * with slim ears to expose both variants at once.
 */
import { describe, it, expect } from 'vitest';
import { Box3, Mesh, Vector3 } from 'three';
import type { Object3D } from 'three';
import { assembleEntity } from '../three/assembleEntity';
import { generateEntityBlueprint } from '../generateEntityBlueprint';
import { registerAllParts } from '../parts';
import { PLAN_FIXTURES } from '../textPlan/fixtures';
import { CreatureType } from '../../../types/creatures';

registerAllParts();

/**
 * Ink may not exceed this fraction of a mesh's own half-girth.
 *
 * At 0.5 the dark rim is as wide as the feature's radius and the feature is
 * gone. The clamp in assembleEntity targets 0.25; this gate allows headroom so
 * it fails on a real regression rather than on tuning.
 */
const MAX_INK_TO_GIRTH = 0.4;

interface InkOffender {
  subject: string;
  mesh: string;
  ink: number;
  girth: number;
  ratio: number;
}

function halfGirth(mesh: Mesh): number {
  const g = mesh.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  const bb = g.boundingBox;
  if (!bb) return Number.POSITIVE_INFINITY;
  const size = bb.getSize(new Vector3());
  // The girth is the SMALLEST cross-section, scaled into the mesh's own space —
  // that is the dimension an outward hull offset eats first.
  return Math.min(
    (size.x * Math.abs(mesh.scale.x)) / 2,
    (size.y * Math.abs(mesh.scale.y)) / 2,
    (size.z * Math.abs(mesh.scale.z)) / 2,
  );
}

/**
 * Every PART inverse-hull shell whose ink is large against its own geometry.
 *
 * Scoped to `partOutline` deliberately. Body segments (`segOutline`) are
 * cylinders and spheres that never taper to nothing, so a bold hull reads as
 * the intended heavy toon line and can't swallow them — measuring those flagged
 * 1043 intentional outlines and told us nothing. Decorative PARTS are where the
 * failure lives: ears, horns, spikes and spars taper to a point, and where the
 * radius approaches zero a fixed-width hull covers the feature completely.
 */
function inkOffenders(root: Object3D, subject: string): InkOffender[] {
  const found: InkOffender[] = [];
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    if (m.name !== 'partOutline') return;
    // The ink shells are the ShaderMaterial hulls carrying a `uT` thickness.
    const mat = m.material as { uniforms?: { uT?: { value: number } } } | undefined;
    const ink = mat?.uniforms?.uT?.value;
    if (typeof ink !== 'number' || ink <= 0) return;
    const girth = halfGirth(m);
    if (!Number.isFinite(girth) || girth <= 0) return;
    const ratio = ink / girth;
    if (ratio > MAX_INK_TO_GIRTH) {
      found.push({
        subject,
        mesh: m.name || m.parent?.name || '(unnamed)',
        ink: +ink.toFixed(4),
        girth: +girth.toFixed(4),
        ratio: +ratio.toFixed(2),
      });
    }
  });
  return found;
}

/**
 * Variant A: a head whose jaw is swung open but has no interior behind it.
 *
 * A hinged jaw that clears the skull leaves a hole into a hollow shell. The
 * fill is the `gullet` mesh; without it the camera looks straight through the
 * head. Only heads that actually gape can offend — a sealed jaw needs nothing.
 */
function openMouthWithoutGullet(root: Object3D, subject: string): string[] {
  const offenders: string[] = [];
  root.traverse((o) => {
    if (o.name !== 'jawGroup') return;
    const gape = Math.abs(o.rotation.x);
    if (gape <= 0.01) return; // sealed against the skull — nothing to see in
    let hasGullet = false;
    o.traverse((c) => {
      if (c.name === 'gullet') hasGullet = true;
    });
    if (!hasGullet) offenders.push(`${subject}: jawGroup gapes ${gape.toFixed(3)} rad with no gullet behind it`);
  });
  return offenders;
}

/** Build one subject, hand it to the checks, and always dispose. */
function sweep(subject: string, build: () => ReturnType<typeof assembleEntity>) {
  const handle = build();
  try {
    handle.update(0.5, 1 / 60);
    return {
      ink: inkOffenders(handle.group, subject),
      mouths: openMouthWithoutGullet(handle.group, subject),
    };
  } finally {
    handle.dispose();
  }
}

const RACES = ['human', 'orc', 'hill_dwarf'] as const;

describe('shell assumptions (the failure CLASS, not one bug)', () => {
  it('VARIANT B: no ink shell swallows its own feature', () => {
    const offenders: InkOffender[] = [];

    for (const raceId of RACES) {
      const r = sweep(`humanoid:${raceId}`, () =>
        assembleEntity(generateEntityBlueprint({ kind: 'humanoid', raceId, classId: 'fighter', seed: 'shell' }), {
          renderMode: 'solid',
        }),
      );
      offenders.push(...r.ink);
    }

    for (const [key, plan] of Object.entries(PLAN_FIXTURES)) {
      const r = sweep(`fixture:${key}`, () =>
        assembleEntity(generateEntityBlueprint({ kind: 'planned', plan, seed: 'shell' }), { renderMode: 'solid' }),
      );
      offenders.push(...r.ink);
    }

    // Generated archetypes matter MOST here: the fixtures are hand-authored and
    // chunky, so they hid this class for 25 review rounds.
    for (const type of Object.values(CreatureType)) {
      const r = sweep(`archetype:${type}`, () =>
        assembleEntity(generateEntityBlueprint({ kind: 'creature', creatureType: type, size: 'Large', seed: 'shell' }), {
          renderMode: 'solid',
        }),
      );
      offenders.push(...r.ink);
    }

    expect(
      offenders,
      `ink shells wider than ${MAX_INK_TO_GIRTH} of their own half-girth — the outline IS the feature:\n` +
        offenders.map((o) => `  ${o.subject} / ${o.mesh}: ink ${o.ink} vs girth ${o.girth} (${o.ratio}x)`).join('\n'),
    ).toEqual([]);
  });

  it('VARIANT A: no open jaw exposes a hollow head', () => {
    const offenders: string[] = [];

    for (const [key, plan] of Object.entries(PLAN_FIXTURES)) {
      const r = sweep(`fixture:${key}`, () =>
        assembleEntity(generateEntityBlueprint({ kind: 'planned', plan, seed: 'shell' }), { renderMode: 'solid' }),
      );
      offenders.push(...r.mouths);
    }

    for (const type of Object.values(CreatureType)) {
      const r = sweep(`archetype:${type}`, () =>
        assembleEntity(generateEntityBlueprint({ kind: 'creature', creatureType: type, size: 'Large', seed: 'shell' }), {
          renderMode: 'solid',
        }),
      );
      offenders.push(...r.mouths);
    }

    expect(offenders, `open jaws with no interior — you can see through the head:\n  ${offenders.join('\n  ')}`).toEqual(
      [],
    );
  });
});
