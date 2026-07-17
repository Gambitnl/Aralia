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

  it('serpentine spine stays at ground height across phases', () => {
    const compiled = compilePlan(PLAN_FIXTURES.threeHeadedSerpent);
    const driver = createGaitDriver('plan', compiled.frame, compiled.planSpec);
    for (const phase of [0, 0.25, 0.5, 0.75]) {
      driver.setPhase(phase);
      driver.update(phase * 3, 0, WALK);
      const c = collect(driver);
      for (let i = 0; i < compiled.planSpec!.spine.segments; i++) {
        const s = c.segs.get(`spine.${i}`)!;
        expect(s, `spine.${i} missing`).toBeTruthy();
        const maxR = compiled.planSpec!.bodyRadM * 2.4;
        expect(s.ay, `spine.${i} grounded`).toBeLessThan(maxR);
        expect(s.ay).toBeGreaterThan(0);
      }
    }
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
    // hands: palm ball + finger segments at each arm tip
    expect(balls.has('arm0L.palm'), 'left palm').toBe(true);
    expect(segs.has('arm0L.finger0'), 'left finger 0').toBe(true);
    expect(segs.has('arm0R.finger2'), 'right finger 2').toBe(true);
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
