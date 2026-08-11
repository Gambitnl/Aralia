/**
 * The droplet window, as arithmetic.
 *
 * Whether the droplets LOOK like water is a judgment for the page. What has to
 * hold on paper is the thing the campaign has had to fix four times: the water
 * is all still there. So the identity is asserted on EVERY frame of a full
 * spring-fall-pool-drain cycle, not only at the end — a leak that cancels out
 * over a run is still a leak.
 */
import { describe, expect, it } from 'vitest';
import { ShallowWaterField } from '../shallowWater';
import {
  DROPLET_GRAVITY_MS2,
  createDropletWindow,
  drainWindow,
  dropletTimestep,
  effectiveGravityMS2,
  feedPool,
  feedSpout,
  newSpringCarry,
  pourThroughSpout,
  retireAtEdge,
  spoutVelocityMS,
  stepDropletWindow,
  windowFootprint,
} from '../dropletWater';
import { handoffResidualM3, newHandoffLedger } from '../waterHandoff';
import { MPM_REST_DENSITY, createDomain, spawnBall, stepDomain } from '../mpmDomain';

function rng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A bowl: a flat floor with a shallow depression in the middle. */
function bowl(n: number, cellM: number): Float32Array {
  const bed = new Float32Array(n * n);
  const mid = (n - 1) / 2;
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const r = Math.hypot(x - mid, z - mid) / mid;
      bed[z * n + x] = 20 + 8 * Math.min(1, r) ** 2;
    }
  }
  void cellM;
  return bed;
}

interface Scene {
  sheet: ShallowWaterField;
  bed: Float32Array;
  originM: [number, number, number];
  win: ReturnType<typeof createDropletWindow>;
  ledger: ReturnType<typeof newHandoffLedger>;
  carry: ReturnType<typeof newSpringCarry>;
}

function scene(opts: { n?: number; cellM?: number; dxM?: number; nodes?: number; capacity?: number } = {}): Scene {
  const n = opts.n ?? 48;
  const cellM = opts.cellM ?? 1;
  const dxM = opts.dxM ?? 1.5;
  const nodes = opts.nodes ?? 24;
  const bed = bowl(n, cellM);
  const sheet = new ShallowWaterField(n, cellM);
  sheet.bed.set(bed);
  const originM: [number, number, number] = [0, 0, 0];
  const span = nodes * dxM;
  const mid = (n * cellM) / 2;
  let lowest = Infinity;
  for (let i = 0; i < bed.length; i++) if (bed[i] < lowest) lowest = bed[i];
  const win = createDropletWindow({
    nodes,
    dxM,
    substeps: 2,
    originM: [mid - span / 2, lowest - dxM * 1.5, mid - span / 2],
    capacity: opts.capacity ?? 400,
    anchorCell: 0,
    floorYAt: (xM, zM) => {
      const x = Math.min(n - 1, Math.max(0, Math.floor((xM - originM[0]) / cellM)));
      const z = Math.min(n - 1, Math.max(0, Math.floor((zM - originM[2]) / cellM)));
      return bed[z * n + x];
    },
  });
  return { sheet, bed, originM, win, ledger: newHandoffLedger(), carry: newSpringCarry() };
}

/**
 * Everything the world holds: the sheet, the droplets, what is waiting at the
 * spout, and what ran off. This is the page's printed identity, in one line.
 */
function totalM3(s: Scene): number {
  return s.sheet.volume() + s.ledger.inFlightM3 + s.carry.m3 + s.sheet.boundaryLedgerM3;
}

describe('the timestep is calibrated, not inherited', () => {
  it('makes a droplet fall at 9.81 m/s² whatever the spacing', () => {
    for (const dxM of [0.5, 1, 1.5, 2.5]) {
      for (const substeps of [1, 2, 4]) {
        const dt = dropletTimestep(dxM, substeps);
        expect(effectiveGravityMS2(dxM, dt, substeps)).toBeCloseTo(DROPLET_GRAVITY_MS2, 6);
      }
    }
  });

  it('a droplet in free fall covers the distance gravity says it should', () => {
    /* The reason the calibration exists, measured rather than argued. The
     * vendor cadence at this spacing applies about 35 g; this asks the domain
     * for the one number a waterfall can be judged against. */
    const dxM = 2.5;
    const substeps = 2;
    const nodes = 40;
    const win = createDropletWindow({
      nodes,
      dxM,
      substeps,
      originM: [0, 0, 0],
      capacity: 4,
      anchorCell: 0,
      floorYAt: () => -1e6, // no ground: pure ballistics
    });
    const startG = nodes - 4;
    spawnBall(win.domain, 1, [nodes / 2, startG, nodes / 2], 0, [0, 0, 0], rng(9));
    const seconds = 1.0;
    for (let f = 0; f < 60 * seconds; f++) stepDropletWindow(win);
    const droppedM = (startG - win.domain.pos[1]) * dxM;
    const wantM = 0.5 * DROPLET_GRAVITY_MS2 * seconds * seconds;
    // Explicit Euler over-integrates by half a step; a few percent is the
    // integrator, and anything larger would be the calibration being wrong.
    expect(droppedM).toBeGreaterThan(wantM * 0.9);
    expect(droppedM).toBeLessThan(wantM * 1.15);
  });

  it('the vendor cadence is what it is, and it is not gravity', () => {
    // Recorded so the header's claim can never quietly stop being true.
    expect(effectiveGravityMS2(0.5, 0.2, 2)).toBeCloseTo(86.4, 1);
    expect(effectiveGravityMS2(2.5, 0.2, 2)).toBeCloseTo(432, 0);
  });
});

describe('the spout', () => {
  it('aims a real projectile at the target', () => {
    const from: [number, number, number] = [0, 10, 0];
    const to: [number, number, number] = [30, 4, 0];
    const v = spoutVelocityMS(from, to, 9);
    // Integrate the ballistic arc and check where it lands.
    const t = Math.max(0.45, 30 / 9);
    const x = from[0] + v[0] * t;
    const y = from[1] + v[1] * t - 0.5 * DROPLET_GRAVITY_MS2 * t * t;
    const z = from[2] + v[2] * t;
    expect(x).toBeCloseTo(to[0], 6);
    expect(y).toBeCloseTo(to[1], 6);
    expect(z).toBeCloseTo(to[2], 6);
  });

  it('takes whole quanta from the spring cell and nothing else', () => {
    const s = scene();
    const n = s.sheet.n;
    const springCell = 6 * n + 6;
    const quantum = s.win.quantumM3;
    // Exactly 3.4 quanta of water sitting in the spring's cell.
    s.sheet.depth[springCell] = (3.4 * quantum) / (s.sheet.cellM * s.sheet.cellM);
    const before = totalM3(s);
    const feed = feedSpout(
      s.win, s.sheet, s.ledger, springCell, 1e9, 64,
      [10, 40, 10], [4, 2, 0], rng(1),
    );
    expect(feed.launched).toBe(3);
    expect(feed.takenM3).toBeCloseTo(3 * quantum, 9);
    // The 0.4 remainder never left the sheet.
    expect(s.sheet.depth[springCell] * s.sheet.cellM * s.sheet.cellM).toBeCloseTo(0.4 * quantum, 6);
    expect(totalM3(s)).toBeCloseTo(before, 9);
    expect(handoffResidualM3(s.ledger)).toBeCloseTo(0, 12);
  });

  it('returns what the budget refused, in the same frame', () => {
    const s = scene({ capacity: 5 });
    const n = s.sheet.n;
    const springCell = 6 * n + 6;
    const quantum = s.win.quantumM3;
    s.sheet.depth[springCell] = (40 * quantum) / (s.sheet.cellM * s.sheet.cellM);
    const before = totalM3(s);
    // Ask for 40 with room for 5: the ask is capped, so nothing is debited that
    // cannot be placed and the sheet keeps the other 35.
    const feed = feedSpout(
      s.win, s.sheet, s.ledger, springCell, 1e9, 40,
      [10, 40, 10], [0, 0, 0], rng(2),
    );
    expect(feed.launched).toBe(5);
    expect(s.win.domain.live).toBe(5);
    expect(totalM3(s)).toBeCloseTo(before, 9);
    expect(handoffResidualM3(s.ledger)).toBeCloseTo(0, 12);
    // A second ask with the budget full moves no water at all.
    const again = feedSpout(
      s.win, s.sheet, s.ledger, springCell, 1e9, 40,
      [10, 40, 10], [0, 0, 0], rng(3),
    );
    expect(again.launched).toBe(0);
    expect(totalM3(s)).toBeCloseTo(before, 9);
  });
});

describe('the pool', () => {
  it('buys from the deepest cell it can see and leaves it wet', () => {
    const s = scene();
    const n = s.sheet.n;
    const deep = 24 * n + 24;
    s.sheet.depth[deep] = 3;
    s.sheet.depth[deep + 1] = 0.4;
    const before = totalM3(s);
    const region = windowFootprint(s.win, s.originM, s.sheet, 5);
    const feed = feedPool(
      s.win, s.sheet, s.ledger, region, s.bed, s.originM, 8, 0.05, rng(4),
    );
    expect(feed.launched).toBeGreaterThan(0);
    expect(s.sheet.depth[deep]).toBeGreaterThan(0.05 - 1e-9);
    /* Half a quantum, not nine decimals. The sheet stores depth as Float32, so
     * a 48² field carries about 3e-8 m³ of storage noise; the smallest fault
     * that can exist here is one lost droplet, four orders larger. */
    expect(Math.abs(totalM3(s) - before)).toBeLessThan(s.win.quantumM3 * 0.5);
  });

  it('refuses a sheet that holds only a film', () => {
    const s = scene();
    for (let i = 0; i < s.sheet.depth.length; i++) s.sheet.depth[i] = 0.01;
    const region = windowFootprint(s.win, s.originM, s.sheet, 5);
    const feed = feedPool(
      s.win, s.sheet, s.ledger, region, s.bed, s.originM, 8, 0.05, rng(5),
    );
    expect(feed.launched).toBe(0);
  });

  it('never sources from the edge band a droplet retires into', () => {
    /* The loop this inset exists to prevent: retire at the edge, buy it back
     * from the same cell, at frame rate, moving nothing. */
    const s = scene();
    const full = windowFootprint(s.win, s.originM, s.sheet, 0);
    const inner = windowFootprint(s.win, s.originM, s.sheet, 5);
    expect(inner.x0).toBeGreaterThan(full.x0);
    expect(inner.x1).toBeLessThan(full.x1);
    expect(inner.z0).toBeGreaterThan(full.z0);
    expect(inner.z1).toBeLessThan(full.z1);
  });
});

describe('the retirement rule', () => {
  it('keeps a resting droplet in the middle and hands back one at the edge', () => {
    const s = scene({ nodes: 24, dxM: 1.5, capacity: 200 });
    const d = s.win.domain;
    // One droplet parked in the middle, one parked in the edge band. Both are
    // marked long-settled by hand; this test is about the RULE, not the solver.
    spawnBall(d, 1, [12, 6, 12], 0, [0, 0, 0], rng(6));
    spawnBall(d, 1, [2, 6, 12], 0, [0, 0, 0], rng(7));
    d.still[0] = 255;
    d.still[1] = 255;
    const before = totalM3(s);
    const r = retireAtEdge(s.win, s.sheet, s.ledger, s.originM, 4);
    expect(r.retired).toBe(1);
    expect(d.live).toBe(1);
    expect(totalM3(s)).toBeCloseTo(before, 9);
    expect(handoffResidualM3(s.ledger)).toBeCloseTo(0, 12);
  });

  it('will not retire a droplet that is still moving, however far out it is', () => {
    const s = scene();
    const d = s.win.domain;
    spawnBall(d, 1, [2, 6, 12], 0, [0, 0, 0], rng(8));
    d.still[0] = 0;
    expect(retireAtEdge(s.win, s.sheet, s.ledger, s.originM, 4).retired).toBe(0);
  });

  it('gives every drop back when the window drains', () => {
    const s = scene();
    const n = s.sheet.n;
    const springCell = 24 * n + 24;
    s.sheet.depth[springCell] = 400;
    const before = totalM3(s);
    feedSpout(
      s.win, s.sheet, s.ledger, springCell, 1e9, 400,
      [36, 30, 36], [0, -2, 0], rng(10),
    );
    expect(s.win.domain.live).toBeGreaterThan(100);
    for (let f = 0; f < 20; f++) stepDropletWindow(s.win);
    const r = drainWindow(s.win, s.sheet, s.ledger, s.originM);
    s.sheet.boundaryLedgerM3 += r.strandedM3;
    expect(s.win.domain.live).toBe(0);
    expect(s.ledger.inFlightM3).toBeCloseTo(0, 9);
    expect(totalM3(s)).toBeCloseTo(before, 6);
  });
});

describe('a whole spring-to-pool cycle', () => {
  it('holds the identity on every frame, then gives it all back', () => {
    const s = scene({ n: 48, cellM: 1, dxM: 1.5, nodes: 24, capacity: 500 });
    const n = s.sheet.n;
    const area = s.sheet.cellM * s.sheet.cellM;
    const springCell = 16 * n + 16;
    const landCell = 24 * n + 24;
    const spout: [number, number, number] = [16.5, s.bed[springCell] + 3, 16.5];
    const aim: [number, number, number] = [24.5, s.bed[landCell], 24.5];
    const vel = spoutVelocityMS(spout, aim);
    const rand = rng(11);

    let pouredM3 = 0;
    let sawDroplets = false;
    let sawRetired = false;
    let sawPassedOn = false;
    let peakLive = 0;
    const inner = windowFootprint(s.win, s.originM, s.sheet, 5);

    for (let frame = 0; frame < 900; frame++) {
      // Pour for the first two thirds, then let it settle and drain.
      if (frame < 600) {
        const addM = 0.35;
        pouredM3 += addM * area;
        const feed = pourThroughSpout(
          s.win, s.sheet, s.ledger, s.carry, springCell, addM * area, landCell,
          12, spout, vel, rand,
        );
        if (feed.launched > 0) sawDroplets = true;
        if (feed.passedOnM3 > 0) sawPassedOn = true;
      }
      feedPool(s.win, s.sheet, s.ledger, inner, s.bed, s.originM, 6, 0.08, rand);
      stepDropletWindow(s.win);
      const r = retireAtEdge(s.win, s.sheet, s.ledger, s.originM, 4);
      s.sheet.boundaryLedgerM3 += r.strandedM3;
      if (r.retired > 0) sawRetired = true;
      peakLive = Math.max(peakLive, s.win.domain.live);
      s.sheet.step(s.sheet.maxStableStep());

      // THE IDENTITY, every frame. Half a quantum: four orders above the
      // float32 noise of summing the depth field, and below the cheapest
      // possible fault, which is one lost droplet.
      expect(Math.abs(totalM3(s) - pouredM3)).toBeLessThan(s.win.quantumM3 * 0.5);
      expect(Math.abs(handoffResidualM3(s.ledger))).toBeLessThan(1e-9);
    }

    /* A conservation test with no traffic through it is a green light wired to
     * nothing — the exact fault that let the first crossing test pass on an
     * empty crossing. */
    expect(sawDroplets).toBe(true);
    expect(sawRetired).toBe(true);
    expect(peakLive).toBeGreaterThan(50);
    // This budget is never exhausted, so the overflow path is not what this
    // test covers; `the budget fills` below is where that lives.
    expect(sawPassedOn).toBe(false);

    const r = drainWindow(s.win, s.sheet, s.ledger, s.originM);
    s.sheet.boundaryLedgerM3 += r.strandedM3;
    expect(s.win.domain.live).toBe(0);
    expect(s.ledger.inFlightM3).toBeCloseTo(0, 8);
    expect(Math.abs(totalM3(s) - pouredM3)).toBeLessThan(s.win.quantumM3 * 0.5);
  });
});

describe('the budget fills, and the mode says so instead of losing water', () => {
  it('sends the spring on to the landing cell once no droplet can be bought', () => {
    const s = scene({ capacity: 3 });
    const n = s.sheet.n;
    const springCell = 16 * n + 16;
    const landCell = 24 * n + 24;
    const rand = rng(21);
    let pouredM3 = 0;
    let passedOnTotal = 0;
    for (let f = 0; f < 60; f++) {
      const m3 = 2;
      pouredM3 += m3;
      const feed = pourThroughSpout(
        s.win, s.sheet, s.ledger, s.carry, springCell, m3, landCell,
        12, [36, 40, 36], [0, -1, 0], rand,
      );
      passedOnTotal += feed.passedOnM3;
      expect(Math.abs(totalM3(s) - pouredM3)).toBeLessThan(s.win.quantumM3 * 0.5);
    }
    expect(s.win.domain.live).toBe(3);
    expect(passedOnTotal).toBeGreaterThan(100);
    // Every cubic meter the droplets refused is standing in the landing cell,
    // which is exactly where the thin layer would have put it.
    const area = s.sheet.cellM * s.sheet.cellM;
    expect(s.sheet.depth[landCell] * area).toBeCloseTo(passedOnTotal, 3);
    expect(handoffResidualM3(s.ledger)).toBeCloseTo(0, 12);
  });

  it('carries less than one droplet, never more', () => {
    const s = scene({ capacity: 400 });
    const n = s.sheet.n;
    const rand = rng(22);
    for (let f = 0; f < 200; f++) {
      pourThroughSpout(
        s.win, s.sheet, s.ledger, s.carry, 16 * n + 16, 0.3, 24 * n + 24,
        12, [36, 40, 36], [0, -1, 0], rand,
      );
      expect(s.carry.m3).toBeLessThan(s.win.quantumM3 + 1e-9);
      expect(s.carry.m3).toBeGreaterThanOrEqual(-1e-12);
    }
  });
});

describe('the budget arithmetic the page prints', () => {
  it('a droplet carries dx³ over the rest density, and the window is n·dx across', () => {
    for (const dxM of [0.5, 1.5, 2.5]) {
      const win = createDropletWindow({
        nodes: 40,
        dxM,
        substeps: 2,
        originM: [0, 0, 0],
        capacity: 1200,
        anchorCell: 0,
        floorYAt: () => 0,
      });
      expect(win.quantumM3).toBeCloseTo(dxM ** 3 / MPM_REST_DENSITY, 9);
      expect(win.spanM).toBeCloseTo(40 * dxM, 9);
    }
  });

  it('an empty grid is nearly free, which is why the window may be large', () => {
    /* The measurement the whole design rests on. Not a timing assertion — a
     * bench belongs in a bench — but the structural fact behind it: a node with
     * no mass is skipped, so an empty 40³ grid does the same work as an empty
     * 24³ one plus a larger clear. */
    const big = createDomain({ n: 40, dxM: 1, originM: [0, 0, 0], capacity: 1, floorYAt: () => 0 });
    stepDomain(big);
    let touched = 0;
    for (let i = 0; i < big.gMass.length; i++) if (big.gMass[i] !== 0) touched++;
    expect(touched).toBe(0);
  });
});
