import { describe, expect, it } from 'vitest';
import { RiverFloaters, RIVER_FLOATERS, wrapAngle, type FloaterWaterSampler } from '../riverFloaters';

/** A uniform current over deep water. */
const uniform = (u: number, v: number, depth = 1): FloaterWaterSampler => ({
  velocity: (_x, _z, out) => { out[0] = u; out[1] = v; },
  depth: () => depth,
});

/** A solid-body vortex of angular rate `omega` about (cx, cz): curl = 2 omega. */
const vortex = (omega: number, cx: number, cz: number): FloaterWaterSampler => ({
  velocity: (x, z, out) => { out[0] = -omega * (z - cz); out[1] = omega * (x - cx); },
  depth: () => 1,
});

const base = {
  seed: 7,
  rocks: [],
  ducks: [],
  domain: { x0: -500, z0: -500, x1: 500, z1: 500 },
};

describe('riverFloaters', () => {
  it('the paper boat relaxes to the surface velocity (tau 0.45 s)', () => {
    const f = new RiverFloaters({ ...base, water: uniform(0.8, 0.1), boatSpawn: { x: 0, z: 0, heading: 0 } });
    const s = f.at(3);
    expect(Math.hypot(s.boat.vx - 0.8, s.boat.vz - 0.1)).toBeLessThan(0.8 * 0.01);
    // After one time constant it has 1 - 1/e of the way.
    const g = new RiverFloaters({ ...base, water: uniform(1, 0), boatSpawn: { x: 0, z: 0, heading: 0 } });
    const t = Math.round(RIVER_FLOATERS.boatTauS / RIVER_FLOATERS.dt) * RIVER_FLOATERS.dt;
    expect(g.at(t).boat.vx).toBeCloseTo(1 - Math.exp(-t / RIVER_FLOATERS.boatTauS), 3);
  });

  it('spins with half the curl of the flow', () => {
    const omega = 0.6;
    const f = new RiverFloaters({ ...base, water: vortex(omega, 0, 0), boatSpawn: { x: 0, z: 0, heading: 0.3 } });
    const s = f.at(2);
    expect(s.boat.halfCurl).toBeCloseTo(omega, 6);
    // At the center the water does not move, so no turn into the current:
    // the heading turns at exactly half the curl.
    expect(s.boat.spin).toBeCloseTo(omega, 6);
    expect(wrapAngle(s.boat.heading - (0.3 + omega * 2))).toBeCloseTo(0, 3);
  });

  it('a duck moves at its paddle velocity plus the water velocity, facing its paddle heading', () => {
    const f = new RiverFloaters({
      ...base,
      water: uniform(0.4, 0),
      boatSpawn: { x: 50, z: 50, heading: 0 },
      ducks: [{ x: 0, z: 0, heading: Math.PI / 2, paddle: 0.5, drake: true }],
    });
    const d = f.at(1).ducks[0];
    expect(d.gx - d.wx).toBeCloseTo(0.5 * Math.cos(d.heading), 9);
    expect(d.gz - d.wz).toBeCloseTo(0.5 * Math.sin(d.heading), 9);
    // Across a 0.4 m/s current at 0.5 m/s: the track is 38.7 degrees off the heading.
    const crab = Math.abs(wrapAngle(Math.atan2(d.gz, d.gx) - d.heading));
    expect(crab).toBeGreaterThan(0.5);
  });

  it('is deterministic from the seed and the clock, forward or back', () => {
    const mk = (): RiverFloaters => new RiverFloaters({
      ...base,
      water: vortex(0.2, 3, 1),
      boatSpawn: { x: 0, z: 0, heading: 0 },
      ducks: [
        { x: 1, z: 1, heading: 0, paddle: 0.5, drake: true },
        { x: -1, z: 2, heading: 2, paddle: 0.6, drake: false },
      ],
    });
    const a = mk().at(12.3);
    const f = mk();
    f.at(20);
    const b = f.at(12.3);
    expect(b).toEqual(a);
  });

  it('slides round a rock and never enters it', () => {
    const rock = { x: 2, z: 0, r: 0.5 };
    const f = new RiverFloaters({ ...base, water: uniform(0.7, 0.02), rocks: [rock], boatSpawn: { x: 0, z: 0, heading: 0 } });
    for (let t = 0; t < 8; t += 0.1) {
      const b = f.at(t).boat;
      expect(Math.hypot(b.x - rock.x, b.z - rock.z)).toBeGreaterThanOrEqual(rock.r + RIVER_FLOATERS.boatRadiusM - 1e-6);
    }
    // It got past the rock.
    expect(f.at(8).boat.x).toBeGreaterThan(3);
  });

  it('runs aground in water shallower than its draft and starts again upstream', () => {
    const f = new RiverFloaters({ ...base, water: uniform(0.5, 0, 0.005), boatSpawn: { x: 0, z: 0, heading: 0 } });
    expect(f.at(0.2).boat.aground).toBe(true);
    expect(f.at(RIVER_FLOATERS.boatGroundedS + 0.2).boat.launches).toBe(2);
  });
});
