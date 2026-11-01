import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { RiverFloaters, RIVER_FLOATERS, wrapAngle, type FloaterWaterSampler } from '../riverFloaters';
import { mainBoulderShape } from '../riverReach';
import { RiverFloatersView, waterlineRocks } from '../../../../components/World3D/water/riverFloatersView';
import type { RiverReachData } from '../riverWorker';
import type { RiverSurfaceMirror } from '../../../../components/World3D/water/riverSurfaceMirror';

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
  it('a flood clears a retained boat rock and recession restores collision without a new launch', () => {
    let level = 8, current = .7;
    const water: FloaterWaterSampler = { depth: () => 1, surface: () => level, velocity: (_x, _z, out) => { out[0] = current; out[1] = 0; } };
    const f = new RiverFloaters({ ...base, water, rocks: [{ x: 2, z: 0, r: .5, topY: 8 }], boatSpawn: { x: 0, z: 0, heading: 0 } });
    expect(f.at(3).boat.x).toBeCloseTo(1.4, 8);
    level = 8.2;
    expect(f.at(6).boat.x).toBeGreaterThan(3);
    level = 8; current = -.7;
    const returned = f.at(10).boat;
    expect(returned.x).toBeCloseTo(2.6, 8);
    expect(returned.launches).toBe(1);
  });

  it('requires local crest water and hull clearance, not only high water under the boat', () => {
    let rockLevel = 8;
    const water: FloaterWaterSampler = { ...uniform(.7, 0), surface: x => Math.abs(x - 2) < .01 ? rockLevel : 8.3 };
    const f = new RiverFloaters({ ...base, water, rocks: [{ x: 2, z: 0, r: .5, topY: 8 }], boatSpawn: { x: 0, z: 0, heading: 0 } });
    expect(f.at(3).boat.x).toBeCloseTo(1.4, 8);
    rockLevel = 8.02; // Water covers the crest but not the boat's draft plus clearance.
    expect(f.at(4).boat.x).toBeCloseTo(1.4, 8);
    rockLevel = 8.3;
    expect(f.at(7).boat.x).toBeGreaterThan(3);
  });

  it('mallard steering and contact use the same deeper draft gate', () => {
    const make = (level: number, rocks = [{ x: 0, z: 0, r: .5, topY: 8 }]) => new RiverFloaters({ ...base, rocks, water: { ...uniform(0, 0), surface: () => level }, boatSpawn: { x: 20, z: 20, heading: 0 }, ducks: [{ x: -.6, z: .04, heading: Math.PI / 2, paddle: .5, drake: true }] });
    const open = make(8.2), reference = make(8.2, []), blocked = make(8.04);
    expect(open.at(.5).ducks).toEqual(reference.at(.5).ducks);
    const low = blocked.at(.5).ducks[0];
    expect(Math.hypot(low.x, low.z)).toBeGreaterThanOrEqual(.5 + RIVER_FLOATERS.duckRadiusM - 1e-6);
    expect(low.heading).not.toBeCloseTo(reference.at(.5).ducks[0].heading, 6);
    // Timestamped water schedules replay exactly when the clock is rewound.
    const scheduled = () => new RiverFloaters({ ...base, rocks: [{ x: 0, z: 0, r: .5, topY: 8 }], water: { ...uniform(0, 0), surface: (_x, _z, t) => t < 1 ? 8 : 8.2 }, boatSpawn: { x: 20, z: 20, heading: 0 }, ducks: [{ x: -.6, z: .04, heading: Math.PI / 2, paddle: .5, drake: true }] });
    const replay = scheduled(); replay.at(4);
    expect(replay.at(2)).toEqual(scheduled().at(2));
  });

  it('retains initially submerged drawn rocks and measures the mallard hull from its real mesh', () => {
    const b = { x: 2, z: 0, y: 0, rx: .5, ry: .5, rz: .5, rot: .3, seed: 7, inChannel: true };
    let level = 5, slope = 0;
    const mirror = { flow: (_t: number, _x: number, _z: number, out: number[]) => { out[3] = level; return out; }, surfaceAt: (x: number, z: number) => level + slope * (x + z), depth: () => 1, velocity: (_x: number, _z: number, out: number[]) => { out[0] = .7; out[1] = 0; } } as unknown as RiverSurfaceMirror;
    const data = { seed: 7, boulders: [b, { ...b, inChannel: false }], course: new Float32Array(300 * 5), grid: { nx: 4, nz: 4, dx: 1, x0: -100, z0: -100 } } as unknown as RiverReachData;
    const rocks = waterlineRocks(data, mirror), shape = mainBoulderShape(b);
    expect(rocks).toHaveLength(1);
    expect(rocks[0].topY).toBe(shape.bounds.maxY);
    const f = new RiverFloaters({ ...base, rocks, water: { ...uniform(.7, 0), surface: () => level }, boatSpawn: { x: 0, z: 0, heading: 0 } });
    expect(f.at(5).boat.x).toBeGreaterThan(3);
    level = 0;
    // A fresh pass uses the retained rock after recession; it was not culled at construction.
    const pass = new RiverFloaters({ ...base, rocks, water: { ...uniform(-.7, 0), surface: () => level }, boatSpawn: { x: 4, z: 0, heading: Math.PI } });
    expect(pass.at(5).boat.x).toBeCloseTo(2 + rocks[0].r + RIVER_FLOATERS.boatRadiusM, 8);
    const view = new RiverFloatersView(data, mirror);
    const options = (view.sim as unknown as { o: import('../riverFloaters').RiverFloatersOptions }).o;
    const duckTilt = view.group.children[1].children[0], body = duckTilt.children[0] as THREE.Mesh;
    body.geometry.computeBoundingBox();
    const flatDraft = -body.geometry.boundingBox!.min.y;
    expect(options.hullDraft!('duck', 0, 0, 0, 0)).toBe(flatDraft);
    expect(options.hullDraft!('boat', 0, 0, 0, 0)).toBeCloseTo(RIVER_FLOATERS.boatDraftM, 8);
    slope = .3; view.update(0);
    const positions = body.geometry.getAttribute('position'), vertex = new THREE.Vector3();
    let actualLower = Infinity;
    for (let k = 0; k < positions.count; k++) actualLower = Math.min(actualLower, vertex.fromBufferAttribute(positions, k).applyEuler(duckTilt.rotation).y);
    const pose = view.last!.ducks[0];
    expect(options.hullDraft!('duck', pose.x, pose.z, pose.heading, 0)).toBeGreaterThanOrEqual(-actualLower);
    expect(options.hullDraft!('duck', pose.x, pose.z, pose.heading, 0)).toBeGreaterThan(flatDraft);
    expect(options.hullDraft!('boat', 0, 0, 0, 0)).toBeGreaterThan(RIVER_FLOATERS.boatDraftM);
  });
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

  it('rising live depth lifts the same boat in place and recession starts a fresh grounding timer', () => {
    let depth = 1;
    const dt = RIVER_FLOATERS.dt;
    const water = { ...uniform(0.5, 0), depth: () => depth };
    const f = new RiverFloaters({ ...base, water, boatSpawn: { x: 0, z: 0, heading: 0 } });
    f.at(1);
    depth = 0.005;
    const grounded = f.at(1 + dt).boat;
    expect(grounded.aground).toBe(true);
    const held = f.at(2).boat;
    expect(held.x).toBe(grounded.x);
    expect(held.vx).toBe(0);

    // Exactly the existing draft is enough: no extra flood threshold is imposed.
    depth = RIVER_FLOATERS.boatDraftM;
    const lifted = f.at(2 + dt).boat;
    const resumedVelocity = 0.5 * (1 - Math.exp(-dt / RIVER_FLOATERS.boatTauS));
    expect(lifted.aground).toBe(false);
    expect(lifted.agroundS).toBe(0);
    expect(lifted.launches).toBe(grounded.launches);
    expect(lifted.vx).toBeCloseTo(resumedVelocity, 12);
    expect(lifted.x).toBeCloseTo(held.x + resumedVelocity * dt, 12);
    expect(lifted.z).toBe(held.z);
    expect(f.at(3).boat.x).toBeGreaterThan(lifted.x);

    depth = 0.005;
    const regrounded = f.at(3 + dt).boat;
    expect(regrounded.aground).toBe(true);
    expect(regrounded.agroundS).toBe(0);
    const waiting = f.at(5.5).boat;
    expect(waiting.launches).toBe(1);
    expect(waiting.x).toBe(regrounded.x);
    expect(f.at(3 + dt + RIVER_FLOATERS.boatGroundedS + 2 * dt).boat.launches).toBe(2);
  });

  it('refloats before checking the restart timeout when water rises on the deadline step', () => {
    let depth = 0.005;
    const dt = RIVER_FLOATERS.dt;
    const f = new RiverFloaters({ ...base, water: { ...uniform(0.5, 0), depth: () => depth }, boatSpawn: { x: 0, z: 0, heading: 0 } });
    const waiting = f.at(RIVER_FLOATERS.boatGroundedS).boat;
    expect(waiting.aground).toBe(true);
    expect(waiting.agroundS).toBeCloseTo(RIVER_FLOATERS.boatGroundedS - dt, 12);
    depth = 1;
    const lifted = f.at(RIVER_FLOATERS.boatGroundedS + dt).boat;
    expect(lifted.launches).toBe(1);
    expect(lifted.aground).toBe(false);
    expect(lifted.agroundS).toBe(0);
    expect(lifted.x).toBeGreaterThan(waiting.x);
  });

  it.each([NaN, Infinity, -Infinity, undefined])('does not refloat on unknown live depth %s', invalidDepth => {
    // Undefined represents missing runtime water data despite the sampler's numeric contract.
    let depth: number | undefined = 0.005;
    const water: FloaterWaterSampler = { ...uniform(0.5, 0), depth: () => depth as number };
    const f = new RiverFloaters({ ...base, water, boatSpawn: { x: 0, z: 0, heading: 0 } });
    const grounded = f.at(0.2).boat;
    depth = invalidDepth;
    const waiting = f.at(1).boat;
    expect(waiting.aground).toBe(true);
    expect(waiting.launches).toBe(1);
    expect(waiting.x).toBe(grounded.x);
    expect(waiting.vx).toBe(0);
    expect(waiting.agroundS).toBeGreaterThan(grounded.agroundS);
  });
});
