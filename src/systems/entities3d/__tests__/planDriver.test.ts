/**
 * @file planDriver.test.ts — the 'plan' gait driver (text-to-creature bodies).
 * Fixtures are the reference creatures; no test calls the LLM.
 */
import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { compilePlan } from '../textPlan/compilePlan';
import { PLAN_FIXTURES } from '../textPlan/fixtures';
import { createGaitDriver, type LocomotionState } from '../three/gaits';
import { ANCHORS, type BodySegment } from '../types';
import { registerAllParts } from '../parts';
import { generateEntityBlueprint } from '../generateEntityBlueprint';
import { CreatureType } from '../../../types/creatures';

registerAllParts();

const WALK: LocomotionState = { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 1.2 };
const IDLE: LocomotionState = { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 0 };

interface Collected {
  segs: Map<string, BodySegment>;
  balls: Map<string, { x: number; y: number; z: number; r: number }>;
}

function collect(driver: ReturnType<typeof createGaitDriver>): Collected {
  const segs = new Map<string, BodySegment>();
  const balls = new Map<string, { x: number; y: number; z: number; r: number }>();
  driver.buildBody({
    seg: (id, ax, ay, az, bx, by, bz, r0, r1) => segs.set(id, { id, ax, ay, az, bx, by, bz, r0, r1 }),
    ball: (id, x, y, z, r) => balls.set(id, { x, y, z, r }),
    // box slabs count as segments for coverage purposes
    box: (id, ax, ay, az, bx, by, bz, w, h) => segs.set(id, { id, ax, ay, az, bx, by, bz, r0: w / 2, r1: h / 2 }),
  });
  return { segs, balls };
}

function driverFor(fixture: keyof typeof PLAN_FIXTURES) {
  const compiled = compilePlan(PLAN_FIXTURES[fixture]);
  return createGaitDriver('plan', compiled.frame, compiled.planSpec);
}

function allFinite(c: Collected): boolean {
  for (const s of c.segs.values()) {
    for (const v of [s.ax, s.ay, s.az, s.bx, s.by, s.bz, s.r0, s.r1]) {
      if (!Number.isFinite(v)) return false;
    }
    if (s.r0 <= 0 || s.r1 <= 0) return false;
  }
  for (const b of c.balls.values()) {
    for (const v of [b.x, b.y, b.z, b.r]) if (!Number.isFinite(v)) return false;
    if (b.r <= 0) return false;
  }
  return true;
}

describe('plan gait driver', () => {
  it('throws without a planSpec — no fallback', () => {
    const { frame } = compilePlan(PLAN_FIXTURES.dragon);
    expect(() => createGaitDriver('plan', frame)).toThrow(/planSpec/);
  });

  it('every fixture emits a full, finite skeleton', () => {
    for (const key of Object.keys(PLAN_FIXTURES) as Array<keyof typeof PLAN_FIXTURES>) {
      const compiled = compilePlan(PLAN_FIXTURES[key]);
      const driver = createGaitDriver('plan', compiled.frame, compiled.planSpec);
      driver.update(0.5, 1 / 60, WALK);
      const c = collect(driver);
      const expectedLinks = compiled.planSpec!.chains.reduce((n, ch) => n + ch.links.length, 0);
      expect(c.segs.size, `${key} segments`).toBeGreaterThanOrEqual(
        compiled.planSpec!.spine.segments + expectedLinks,
      );
      // formed heads render as sculpted assembler meshes, not driver balls
      const unformedHeads = compiled.planSpec!.heads.filter((h) => !h.form).length;
      expect(c.balls.size, `${key} head balls`).toBeGreaterThanOrEqual(unformedHeads);
      expect(allFinite(c), `${key} finite`).toBe(true);
    }
  });

  it('chain links CONNECT: each link starts where the previous ended', () => {
    const driver = driverFor('dragon');
    driver.update(0.7, 1 / 60, WALK);
    const c = collect(driver);
    const compiled = compilePlan(PLAN_FIXTURES.dragon);
    for (const chain of compiled.planSpec!.chains) {
      for (let j = 1; j < chain.links.length; j++) {
        const prev = c.segs.get(`${chain.id}.${j - 1}`)!;
        const cur = c.segs.get(`${chain.id}.${j}`)!;
        expect(prev, `${chain.id}.${j - 1} missing`).toBeTruthy();
        expect(cur, `${chain.id}.${j} missing`).toBeTruthy();
        expect(Math.hypot(cur.ax - prev.bx, cur.ay - prev.by, cur.az - prev.bz)).toBeLessThan(1e-6);
      }
    }
  });

  it('segment ids are stable across frames', () => {
    const driver = driverFor('dragon');
    driver.update(0.3, 1 / 60, WALK);
    const a = collect(driver);
    driver.update(0.9, 1 / 60, WALK);
    const b = collect(driver);
    expect([...a.segs.keys()].sort()).toEqual([...b.segs.keys()].sort());
  });

  it('dragon legs alternate mid-stride while walking', () => {
    const driver = driverFor('dragon');
    driver.setPhase(0.25);
    driver.update(1.0, 0, WALK);
    const c = collect(driver);
    const fl = c.balls.get('leg0L.foot')!;
    const fr = c.balls.get('leg0R.foot')!;
    expect(fl, 'leg0L.foot missing').toBeTruthy();
    expect(fr, 'leg0R.foot missing').toBeTruthy();
    expect(Math.abs(fl.z - fr.z)).toBeGreaterThan(0.05);
  });

  // round 2 (creature-anatomy): a serpentine creature REARS — the front third
  // rises into a vertical S carrying the head high while the rear body stays
  // grounded and undulates (replaces the round-1 "whole spine at ground
  // height" pin, which enforced the fallen-leek posture the critic named).
  it('serpentine spine rears: front high, rear grounded, taller at idle', () => {
    const compiled = compilePlan(PLAN_FIXTURES.threeHeadedSerpent);
    const spec = compiled.planSpec!;
    const groundCeil = spec.bodyRadM * 2.4;
    const driver = createGaitDriver('plan', compiled.frame, compiled.planSpec);
    for (const phase of [0, 0.25, 0.5, 0.75]) {
      driver.setPhase(phase);
      driver.update(phase * 3, 0, WALK);
      const c = collect(driver);
      const front = c.segs.get('spine.0')!;
      expect(front, 'spine.0 missing').toBeTruthy();
      expect(front.ay, 'front of spine rears well above the body tube').toBeGreaterThan(groundCeil);
      for (let i = Math.ceil(spec.spine.segments * 0.5); i < spec.spine.segments; i++) {
        const s = c.segs.get(`spine.${i}`)!;
        expect(s, `spine.${i} missing`).toBeTruthy();
        expect(s.by, `spine.${i} rear stays grounded`).toBeLessThan(groundCeil);
        expect(s.by).toBeGreaterThan(0);
      }
    }
    // speed-aware rise: the idle coil carries the head TALLER than the lunge
    const idle = createGaitDriver('plan', compiled.frame, compiled.planSpec);
    idle.update(0, 0, IDLE);
    const idleFront = collect(idle).segs.get('spine.0')!;
    driver.setPhase(0);
    driver.update(0, 0, WALK);
    const walkFront = collect(driver).segs.get('spine.0')!;
    expect(idleFront.ay).toBeGreaterThan(walkFront.ay);
  });

  it('floating eye hovers — nothing dips near the ground', () => {
    const driver = driverFor('floatingEye');
    for (const t of [0, 1.3, 2.7]) {
      driver.update(t, 1 / 60, IDLE);
      const c = collect(driver);
      for (const s of c.segs.values()) {
        expect(Math.min(s.ay, s.by), `${s.id} at t=${t}`).toBeGreaterThan(0.1);
      }
    }
  });

  it('every fixture refreshes all 15 anchors with finite positions', () => {
    for (const key of Object.keys(PLAN_FIXTURES) as Array<keyof typeof PLAN_FIXTURES>) {
      const driver = driverFor(key);
      driver.update(0.6, 1 / 60, WALK);
      for (const a of ANCHORS) {
        const p = driver.pose.anchors[a].pos;
        expect(Number.isFinite(p.x + p.y + p.z), `${key} anchor ${a}`).toBe(true);
      }
    }
  });

  it('exposes head sockets: serpent has three, bound to necks, above the body', () => {
    const driver = driverFor('threeHeadedSerpent');
    driver.update(0.4, 1 / 60, WALK);
    const sockets = driver.headSockets!();
    expect(sockets).toHaveLength(3);
    const xs = new Set(sockets.map((s) => Math.round(s.x * 100)));
    expect(xs.size, 'heads spread apart').toBeGreaterThan(1);
    for (const s of sockets) {
      expect(s.r).toBeGreaterThan(0);
      expect(s.eyes.count).toBe(2);
    }
  });

  it('v1.1: hand tips, joint rings, and eye cilia all emit', () => {
    const compiled = compilePlan({
      name: 'Ring Bearer',
      frame: { heightFt: 10, bulk: 0.6, stance: 'floating' },
      spine: { segments: 3, taper: 0.8, arch: 0 },
      appendages: [
        {
          kind: 'arm', attach: 0.5, perSide: true, count: 1, tips: 'hand', jointRings: true,
          chain: [
            { lenFt: 3, r: 0.12 },
            { lenFt: 2.5, r: 0.09 },
            { lenFt: 2, r: 0.07 },
          ],
        },
      ],
      heads: [{ sizeScale: 1.4, eyes: { count: 1, sizeScale: 1.8 }, cilia: true }],
      palette: { bodyHex: '#3a1c52', accentHex: '#ff2ea6', eyeHex: '#d8b03a' },
    });
    // compile carries the flags
    expect(compiled.planSpec!.chains[0].tips).toBe('hand');
    expect(compiled.planSpec!.chains[0].jointRings).toBe(true);
    expect(compiled.planSpec!.heads[0].cilia).toBe(true);

    const driver = createGaitDriver('plan', compiled.frame, compiled.planSpec);
    driver.update(0.4, 1 / 60, IDLE);
    const segs = new Map<string, BodySegment>();
    const balls = new Map<string, { r: number }>();
    const rings: string[] = [];
    driver.buildBody({
      seg: (id, ax, ay, az, bx, by, bz, r0, r1) => segs.set(id, { id, ax, ay, az, bx, by, bz, r0, r1 }),
      ball: (id, _x, _y, _z, r) => balls.set(id, { r }),
      ring: (id) => rings.push(id),
    });
    // hands: a palm BLOCK, two fingers and an opposed thumb at each arm tip.
    // 2026-08-15 (Remy, live eyeball on a generated gnoll — "oddly
    // proportioned and a strange 'ball' for a palm"): the palm used to be a
    // sphere with three pencils in it, and a sphere has no front, no back and
    // no knuckle line. `<chain>.palm` is now the block segment — still the
    // skeleton's hand terminal, now carrying an orientation.
    expect(segs.has('arm0L.palm'), 'left palm block').toBe(true);
    expect(balls.has('arm0L.palm'), 'palm must no longer be a ball').toBe(false);
    expect(segs.has('arm0L.finger0'), 'left finger 0').toBe(true);
    expect(segs.has('arm0R.finger1'), 'right finger 1').toBe(true);
    expect(segs.has('arm0R.thumb'), 'right opposed thumb').toBe(true);
    // the palm widens from the wrist toward the knuckle line: a wedge, not a
    // tube and not a ball
    expect(segs.get('arm0L.palm')!.r1).toBeGreaterThan(segs.get('arm0L.palm')!.r0 * 1.2);
    // and the arm now pinches at its interior joints, so the elbow and the
    // wrist are silhouette events rather than seams
    expect(segs.get('arm0L.0')!.r1, 'elbow must pinch below the upper-arm gauge')
      .toBeLessThan(segs.get('arm0L.0')!.r0 * 0.9);
    expect(segs.get('arm0L.2')!.r0, 'wrist must be the narrowest point on the arm')
      .toBeLessThan(segs.get('arm0L.1')!.r0);
    // rings: one per INTERIOR joint (3 links → 2 interior joints per arm)
    expect(rings.filter((id) => id.startsWith('arm0L.ring'))).toHaveLength(2);
    // cilia: a ring of short lash segments around the eye socket
    expect([...segs.keys()].filter((id) => id.startsWith('head0.cilia')).length).toBeGreaterThanOrEqual(8);
  });

  it('v1.2 tauric: the torso rises above the spine; parented arms root near its top; the head rides it', () => {
    const compiled = compilePlan({
      name: 'Test Centaur',
      frame: { heightFt: 6, lengthFt: 8, bulk: 0.7, stance: 'horizontal' },
      spine: { segments: 4, taper: 0.75, arch: 0.05 },
      appendages: [
        { kind: 'leg', attach: 0.2, perSide: true, count: 1, chain: [{ lenFt: 2, r: 0.2 }, { lenFt: 1.8, r: 0.14 }] },
        { kind: 'leg', attach: 0.8, perSide: true, count: 1, chain: [{ lenFt: 2, r: 0.2 }, { lenFt: 1.8, r: 0.14 }] },
        { kind: 'torso', attach: 0.08, count: 1, chain: [{ lenFt: 1.5, r: 0.55 }, { lenFt: 1.3, r: 0.45 }] },
        { kind: 'arm', attach: 0.08, parent: 2, perSide: true, count: 1, chain: [{ lenFt: 1.4, r: 0.12 }, { lenFt: 1.2, r: 0.09 }] },
      ],
      heads: [{ neckIndex: 2, sizeScale: 1, eyes: { count: 2, sizeScale: 1 } }],
      palette: { bodyHex: '#7a5236', eyeHex: '#2e2418' },
    });
    const driver = createGaitDriver('plan', compiled.frame, compiled.planSpec);
    driver.update(0.5, 1 / 60, WALK);
    const c = collect(driver);
    const torsoTip = c.segs.get('torso0.1')!;
    const spineFront = c.segs.get('spine.0')!;
    expect(torsoTip, 'torso segments missing').toBeTruthy();
    // torso rises well above the horizontal spine line
    expect(torsoTip.by).toBeGreaterThan(spineFront.ay + 0.5);
    // arms root near the torso tip, not down at the spine
    const armRoot = c.segs.get('arm0L.0')!;
    expect(armRoot.ay).toBeGreaterThan(torsoTip.by - 0.6);
    // the head socket sits above the torso tip
    const sockets = driver.headSockets!();
    expect(sockets[0].y).toBeGreaterThan(torsoTip.by - 0.1);
  });

  it('smooth mode: tube-capable sinks get ONE spine tube + organic chain tubes; limbs stay rigid', () => {
    const compiled = compilePlan(PLAN_FIXTURES.dragon);
    const driver = createGaitDriver('plan', compiled.frame, compiled.planSpec);
    driver.update(0.5, 1 / 60, WALK);
    const tubes = new Map<string, { pts: number[]; radii: number[] }>();
    const segs: string[] = [];
    driver.buildBody({
      seg: (id) => segs.push(id),
      ball: () => {},
      tube: (id, pts, radii) => tubes.set(id, { pts, radii }),
    });
    expect([...tubes.keys()]).toContain('spine');
    expect([...tubes.keys()]).toContain('tail0');
    // legs remain rigid segments for crisp IK
    expect(segs.some((id) => id.startsWith('leg0L.'))).toBe(true);
    // the spine profile carries the muscle bulge: mid radius > end radii
    const spine = tubes.get('spine')!;
    const mid = spine.radii[Math.floor(spine.radii.length / 2)];
    expect(mid).toBeGreaterThan(spine.radii[0]);
    expect(spine.pts.length / 3).toBe(spine.radii.length);
  });

  it('wings flap: the wing tip moves between phases while walking', () => {
    // chain wings live in the language even though the dragon fixture uses the
    // membrane wing PART for its look — cover the chain math with a wyvern-ish plan
    const compiled = compilePlan({
      name: 'Test Wyvern',
      frame: { heightFt: 6, lengthFt: 12, bulk: 0.6, stance: 'horizontal' },
      spine: { segments: 4, taper: 0.6, arch: 0.1 },
      appendages: [
        { kind: 'wing', attach: 0.3, heightFrac: 0.95, perSide: true, count: 1, chain: [{ lenFt: 4, r: 0.2 }, { lenFt: 3, r: 0.1 }, { lenFt: 2, r: 0.06 }] },
      ],
      heads: [{ sizeScale: 1, eyes: { count: 2, sizeScale: 1 } }],
      palette: { bodyHex: '#557755', eyeHex: '#222222' },
    });
    const driver = createGaitDriver('plan', compiled.frame, compiled.planSpec);
    driver.update(0.2, 1 / 60, WALK);
    const tip1 = collect(driver).segs.get('wing0L.2')!;
    driver.update(0.65, 1 / 60, WALK);
    const tip2 = collect(driver).segs.get('wing0L.2')!;
    expect(Math.abs(tip1.by - tip2.by)).toBeGreaterThan(0.02);
  });
});

describe('junction blend collars (slice 1)', () => {
  it('emits one collar per chain with blendM, at the chain root, with reach = blendM', () => {
    const compiled = compilePlan(PLAN_FIXTURES.dragon);
    const driver = createGaitDriver('plan', compiled.frame, compiled.planSpec);
    driver.update(0.5, 1 / 60, WALK);
    const collars = new Map<string, { x: number; y: number; z: number; limbR: number; reach: number }>();
    const segs = new Map<string, BodySegment>();
    driver.buildBody({
      seg: (id, ax, ay, az, bx, by, bz, r0, r1) => segs.set(id, { id, ax, ay, az, bx, by, bz, r0, r1 }),
      ball: () => {},
      collar: (id, x, y, z, _ax, _ay, _az, limbR, reach) => collars.set(id, { x, y, z, limbR, reach }),
    });
    const spec = compiled.planSpec!;
    for (const chain of spec.chains) {
      const collar = collars.get(`${chain.id}.collar`);
      // round 20 (creature-anatomy): hull-proud leg roots compile blendM 0 —
      // the haunch ball IS the junction, so no collar is emitted for them.
      if (chain.blendM <= 0.02) {
        expect(collar, `${chain.id} collar (blendM ${chain.blendM})`).toBeUndefined();
        continue;
      }
      expect(collar, `${chain.id} collar`).toBeTruthy();
      expect(collar!.reach).toBeCloseTo(chain.blendM, 6);
      expect(collar!.limbR).toBeCloseTo(chain.links[0].rM, 6);
      // sits at the chain's root joint = the first emitted segment start
      const rootSeg = segs.get(`${chain.id}.0`);
      if (rootSeg) {
        expect(collar!.x).toBeCloseTo(rootSeg.ax, 6);
        expect(collar!.y).toBeCloseTo(rootSeg.ay, 6);
        expect(collar!.z).toBeCloseTo(rootSeg.az, 6);
      }
    }
  });

  it('blend 0 emits no collar; sinks without collar() are untouched', () => {
    const plan = JSON.parse(JSON.stringify(PLAN_FIXTURES.dragon));
    plan.skin = { blend: 0 };
    const compiled = compilePlan(plan);
    const driver = createGaitDriver('plan', compiled.frame, compiled.planSpec);
    driver.update(0.5, 1 / 60, WALK);
    const collars: string[] = [];
    driver.buildBody({
      seg: () => {},
      ball: () => {},
      collar: (id) => collars.push(id),
    });
    expect(collars).toEqual([]);
    // and a sink without collar() must not crash
    driver.buildBody({ seg: () => {}, ball: () => {} });
  });

  /**
   * 2026-08-15, Remy, live eyeball: "all bipedal creatures seem to have this
   * weird 'lean forward'".
   *
   * `attachZ` maps a chain's attach fraction onto the body's LENGTH axis,
   * which is +z on a horizontal body. An UPRIGHT body's length axis is Y — the
   * spine runs hips to crown and leaves z to `spine.arch` — but the leg treads
   * still took their rest position from `attachZ(attach)`. A leg attached at
   * the hips planted its foot (0.5 − attach) × bodyLenM BEHIND the column: on
   * plan 19f48ed2 the crown sat 0.74 m ahead of the feet over 2.60 m of
   * height, a 16° tip, and the creature read as falling forward.
   *
   * The gate is the FOOT against the hip it hangs from, because that is the
   * relationship the bug broke. `spine.arch` is deliberately left free to move
   * the spine: an arch bows the back (sin(u·pi), zero at BOTH ends) and must
   * never be mistaken for this.
   */
  it('an upright plan stands upright: feet plant under the hips, not behind them', () => {
    const upright = (arch: number) =>
      compilePlan({
        name: 'Upright Walker',
        frame: { heightFt: 8, bulk: 0.8, stance: 'upright' },
        spine: { segments: 4, taper: 0.85, arch },
        appendages: [
          {
            kind: 'leg', attach: 0.9, perSide: true, count: 1,
            chain: [{ lenFt: 2.2, r: 0.16 }, { lenFt: 2.0, r: 0.12 }],
          },
        ],
        heads: [{ sizeScale: 1.1, eyes: { count: 2, sizeScale: 1 } }],
        palette: { bodyHex: '#7a6a44', accentHex: '#c8b070', eyeHex: '#e8d070' },
      });

    for (const arch of [0, 0.28, 0.6]) {
      const compiled = upright(arch);
      const spec = compiled.planSpec!;
      const driver = createGaitDriver('plan', compiled.frame, spec);
      driver.update(0.5, 1 / 60, IDLE);
      const { segs } = collect(driver);
      for (const side of ['L', 'R'] as const) {
        const thigh = segs.get(`leg0${side}.0`);
        const shin = segs.get(`leg0${side}.1`);
        expect(thigh, `leg0${side} thigh missing`).toBeTruthy();
        expect(shin, `leg0${side} shin missing`).toBeTruthy();
        // hip = the thigh's root joint; foot = the shin's tip
        const drift = Math.abs(shin!.bz - thigh!.az);
        expect(
          drift,
          `arch ${arch}, leg0${side}: foot is ${drift.toFixed(3)} m off its hip in z — ` +
            `body length ${spec.bodyLenM.toFixed(3)} m. A foot that lands a body-length ` +
            'behind its hip is the lean-forward bug.',
        ).toBeLessThan(spec.bodyRadM * 0.5);
      }
    }

    // and the same gate across every GENERATED archetype that stands upright —
    // this defect was never one creature's, it was every plan-driven biped's.
    let uprightArchetypes = 0;
    for (const type of Object.values(CreatureType)) {
      const bp = generateEntityBlueprint({ kind: 'creature', creatureType: type, size: 'Large', seed: 'stance' });
      const spec = bp.planSpec;
      if (!spec || spec.stance !== 'upright') continue;
      const legs = spec.chains.filter((c) => c.kind === 'leg');
      if (!legs.length) continue;
      uprightArchetypes++;
      const driver = createGaitDriver('plan', bp.frame, spec);
      driver.update(0.5, 1 / 60, IDLE);
      const { segs } = collect(driver);
      for (const leg of legs) {
        const root = segs.get(`${leg.id}.0`);
        const tip = segs.get(`${leg.id}.${leg.links.length - 1}`);
        if (!root || !tip) continue;
        expect(
          Math.abs(tip.bz - root.az),
          `${type} / ${leg.id}: foot planted off its hip in z`,
        ).toBeLessThan(spec.bodyRadM * 0.5);
      }
    }
    expect(uprightArchetypes, 'no upright archetypes swept — the gate would pass vacuously').toBeGreaterThan(0);
  });
});
