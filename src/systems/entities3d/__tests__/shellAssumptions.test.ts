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
 *   VARIANT C — an OPEN shell rendered single-sided. A mesh with boundary
 *   edges (an edge used by exactly one triangle) is not a volume, it is a
 *   sheet. Drawn FrontSide it is visible from outside and CULLED TO NOTHING
 *   from behind, so it flickers in and out as the camera orbits. Seen as: the
 *   junction-blend collars, whose lathe profile never touched the lathe axis
 *   at either end — 112 triangles and 28 boundary edges each, FrontSide, on
 *   `neck0`/`arm0L`/`arm0R`/`tail0` of plan 19f48ed2. Remy read them as
 *   "piece-connecting sheets" that "become invisible on one side"
 *   (2026-08-15). Fixed by closing the lathe profile into a solid ring, not by
 *   flipping the material to DoubleSide: the campaign's `DoubleSide
 *   both-windings` lesson is that duplicated windings z-fight.
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
import { Box3, CylinderGeometry, FrontSide, LatheGeometry, Mesh, MeshBasicMaterial, PlaneGeometry, SphereGeometry, Vector2, Vector3 } from 'three';
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

/**
 * Boundary-edge count: edges used by exactly ONE triangle.
 *
 * Vertices are welded BY POSITION first. Three's primitives duplicate vertices
 * at the UV seam and at sphere poles, so an index-only edge count reports every
 * closed sphere and cylinder in the scene as open. The quantizer rounds to 1e-5
 * m and normalises negative zero: `(-1e-17).toFixed(5)` is `"-0.00000"` while
 * `(0).toFixed(5)` is `"0.00000"`, and that one character split every seam that
 * lands on an axis. (This probe reported 18 "open" edges on a plain
 * SphereGeometry before the fix, which is why the guard below asserts against a
 * known-closed primitive as well.)
 */
function boundaryEdges(mesh: Mesh): number {
  const g = mesh.geometry;
  const pos = g.attributes.position;
  const idx = g.index;
  if (!pos) return 0;
  const q = (v: number): number => {
    const r = Math.round(v * 1e5);
    return r === 0 ? 0 : r;
  };
  const weld = new Map<string, number>();
  const wid = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const k = `${q(pos.getX(i))},${q(pos.getY(i))},${q(pos.getZ(i))}`;
    let id = weld.get(k);
    if (id === undefined) {
      id = weld.size;
      weld.set(k, id);
    }
    wid[i] = id;
  }
  const at = (i: number): number => wid[idx ? idx.getX(i) : i];
  const count = idx ? idx.count : pos.count;
  const uses = new Map<string, number>();
  for (let i = 0; i + 2 < count; i += 3) {
    const t = [at(i), at(i + 1), at(i + 2)];
    for (let e = 0; e < 3; e++) {
      const a = t[e];
      const b = t[(e + 1) % 3];
      if (a === b) continue; // degenerate edge: not a boundary, just collapsed
      const k = a < b ? `${a}_${b}` : `${b}_${a}`;
      uses.set(k, (uses.get(k) ?? 0) + 1);
    }
  }
  let open = 0;
  for (const n of uses.values()) if (n === 1) open++;
  return open;
}

interface OpenShell {
  subject: string;
  mesh: string;
  open: number;
  triangles: number;
  geometry: string;
}

/**
 * Variant C: every mesh that is BOTH open and single-sided.
 *
 * FrontSide is `THREE.FrontSide` (0). A mesh that is deliberately a sheet may
 * still ship — it just has to say so by rendering DoubleSide (2), the way the
 * blob shadow's ground disc does. What may never ship is an open shell drawn
 * FrontSide, because that shell simply is not there from half the orbit.
 */
/**
 * KNOWN, UNPAID members of variant C, by `<geometry type>/<mesh or nearest
 * named ancestor>`. This list may only ever SHRINK: anything not on it fails.
 *
 * The gate went in for the collars (2026-08-15) and immediately found these
 * older ones, all on the sculpted humanoid head plus two plan decorations.
 * They are left standing deliberately — closing them is its own visual pass on
 * pieces Remy has not called out, and doing it inside a five-defect fix would
 * change faces nobody asked to change. Each is genuinely half-buried in the
 * surface it decorates, which is why they have gone unnoticed where an
 * eight-inch collar sheet floating at a shoulder did not.
 */
const KNOWN_OPEN_SHELLS = new Set([
  // Sculpted biped eye furniture: partial spheres (phi/theta ranges) hugging
  // the eyeball. Their rims sit inside the socket recess.
  'SphereGeometry/eyeLLid',
  'SphereGeometry/eyeRLid',
  'SphereGeometry/eyeLLowerLid',
  'SphereGeometry/eyeRLowerLid',
  'SphereGeometry/eyeLLash',
  'SphereGeometry/eyeRLash',
  // The eyeball's socket filler — a partial sphere plugging the orbit behind
  // the white, seen only through the aperture the lids leave.
  'SphereGeometry/eyeL',
  'SphereGeometry/eyeR',
  // The lip line: an open-ended swept tube laid into the mouth groove.
  'TubeGeometry/mouthLine',
  // Registry parts: the helmet is a hemisphere (its rim sits on the skull),
  // and both horn parts are partial tori swept along an arc, capped at
  // neither end. The horn rims are buried in the skull; the tips are not, and
  // a horn seen from behind IS the standing example of why this gate exists —
  // it is the next one to pay off.
  'SphereGeometry/part:helmet',
  'TorusGeometry/part:hornsRam',
  'BufferGeometry/part:hornsCurved',
]);

/** Nearest named ancestor, for meshes the builders leave unnamed. */
function labelOf(m: Mesh): string {
  if (m.name) return m.name;
  let p = m.parent;
  while (p) {
    if (p.name) return p.name;
    p = p.parent;
  }
  return '(unnamed)';
}

function openSingleSidedShells(root: Object3D, subject: string): OpenShell[] {
  const found: OpenShell[] = [];
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || !m.visible) return;
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as
      | { side?: number }
      | undefined;
    if (!mat || mat.side !== FrontSide) return;
    const open = boundaryEdges(m);
    if (open === 0) return;
    const g = m.geometry;
    const label = labelOf(m);
    if (KNOWN_OPEN_SHELLS.has(`${g.type}/${label}`)) return;
    const tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
    found.push({ subject, mesh: label, open, triangles: tris, geometry: g.type });
  });
  return found;
}

/** Build one subject, hand it to the checks, and always dispose. */
function sweep(subject: string, build: () => ReturnType<typeof assembleEntity>) {
  const handle = build();
  try {
    handle.update(0.5, 1 / 60);
    return {
      ink: inkOffenders(handle.group, subject),
      mouths: openMouthWithoutGullet(handle.group, subject),
      open: openSingleSidedShells(handle.group, subject),
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

  // The detector has to be right before its verdict means anything: a naive
  // index-only edge count calls a plain sphere open (three duplicates the seam
  // and pole vertices), and a naive weld splits any seam that lands on an axis
  // over negative zero. Pin both ends — closed primitives read 0, a genuine
  // sheet reads its whole rim — so a future "0 offenders" cannot be the
  // detector quietly going blind.
  it('VARIANT C: the boundary-edge probe agrees with known geometry', () => {
    const mat = new MeshBasicMaterial();
    expect(boundaryEdges(new Mesh(new SphereGeometry(0.4, 12, 9), mat))).toBe(0);
    expect(boundaryEdges(new Mesh(new CylinderGeometry(0.2, 0.3, 1, 10, 1), mat))).toBe(0);
    // an open lathe skirt — the exact shape the collars used to be
    const skirt = new LatheGeometry([new Vector2(0.3, 0), new Vector2(0.2, 0.1)], 14);
    expect(boundaryEdges(new Mesh(skirt, mat))).toBe(28);
    // a closed lathe ring — the shape they are now
    const ring = new LatheGeometry(
      [new Vector2(0.3, 0), new Vector2(0.2, 0.1), new Vector2(0.15, 0.1), new Vector2(0.25, 0), new Vector2(0.3, 0)],
      14,
    );
    expect(boundaryEdges(new Mesh(ring, mat))).toBe(0);
    expect(boundaryEdges(new Mesh(new PlaneGeometry(1, 1), mat))).toBe(4);
  });

  it('VARIANT C: no open shell is rendered single-sided', () => {
    const offenders: OpenShell[] = [];

    for (const raceId of RACES) {
      const r = sweep(`humanoid:${raceId}`, () =>
        assembleEntity(generateEntityBlueprint({ kind: 'humanoid', raceId, classId: 'fighter', seed: 'shell' }), {
          renderMode: 'solid',
        }),
      );
      offenders.push(...r.open);
    }

    for (const [key, plan] of Object.entries(PLAN_FIXTURES)) {
      const r = sweep(`fixture:${key}`, () =>
        assembleEntity(generateEntityBlueprint({ kind: 'planned', plan, seed: 'shell' }), { renderMode: 'solid' }),
      );
      offenders.push(...r.open);
    }

    for (const type of Object.values(CreatureType)) {
      const r = sweep(`archetype:${type}`, () =>
        assembleEntity(generateEntityBlueprint({ kind: 'creature', creatureType: type, size: 'Large', seed: 'shell' }), {
          renderMode: 'solid',
        }),
      );
      offenders.push(...r.open);
    }

    expect(
      offenders,
      'open shells drawn FrontSide — each one vanishes when the camera orbits behind it.\n' +
        'Close the geometry into a volume, or say it is a sheet by rendering it DoubleSide:\n' +
        offenders
          .map((o) => `  ${o.subject} / ${o.mesh}: ${o.geometry}, ${o.triangles} tris, ${o.open} boundary edges`)
          .join('\n'),
    ).toEqual([]);
  });
});
