/** Check buoyancy, different current responses, bank/rock contact and expiry
 * against controlled water, rather than merely counting generated meshes. */
import { describe, expect, it } from 'vitest';
import { RiverDroppedObjects, RIVER_DROP_PROFILES, type DropWater } from '../riverDroppedObjects';
const water: DropWater = { depth: () => 3, surface: () => 8, velocity: (_x, _z, out) => { out[0] = 1; out[1] = 0; } };
const domain = { x0: -100, z0: -100, x1: 100, z1: 100 };
const make = (w = water) => new RiverDroppedObjects(w, [], 7, domain);
describe('user-dropped river objects', () => {
  it('lands on water, settles to its draft, and responds differently to current', () => {
    const sim = make(); sim.drop('rubber-duck', 0, 0); sim.drop('rowboat', 0, 4);
    sim.advance(2);
    const [duck, boat] = sim.bodies;
    expect(duck.x).toBeGreaterThan(boat.x + 0.4);
    sim.advance(3);
    expect(duck.y).toBeCloseTo(7.93, 2); expect(boat.y).toBeCloseTo(7.76, 2);
    expect(duck.vx).toBeCloseTo(1, 2); expect(boat.vx).toBeGreaterThan(0.85);
  });
  it('makes individual leaves which disperse instead of staying in a rigid batch', () => {
    const sim = make(); expect(sim.drop('leaves', 0, 0)).toBe(24);
    const relative = sim.bodies.map((b) => b.z);
    sim.advance(5);
    expect(new Set(sim.bodies.map((b) => b.id)).size).toBe(24);
    expect(sim.bodies.some((b, i) => Math.abs(b.z - relative[i]) > 0.05)).toBe(true);
    expect(sim.bodies.every((b) => Math.abs(b.y - 7.998) < 0.01)).toBe(true);
  });
  it('gives foam varied lifetimes, pops it, and keeps persistent objects', () => {
    const sim = make(); sim.drop('foam', 0, 0); sim.drop('stick', 0, 6);
    expect(new Set(sim.bodies.filter((b) => b.kind === 'foam').map((b) => b.lifetime)).size).toBeGreaterThan(25);
    sim.advance(12); expect(sim.bodies.filter((b) => b.kind === 'foam').length).toBeGreaterThan(0);
    expect(sim.bodies.filter((b) => b.kind === 'foam').length).toBeLessThan(32);
    sim.advance(7); expect(sim.bodies.map((b) => b.kind)).toEqual(['stick']);
  });
  it('rejects dry placements and grounds a deeper-draft boat before a leaf', () => {
    const w: DropWater = { ...water, depth: (x) => x > 1 ? 0.08 : 1 };
    const sim = make(w); expect(sim.drop('rowboat', 2, 0)).toBe(0);
    sim.drop('rowboat', 0, 0); sim.drop('leaves', 0, 4); sim.advance(8);
    expect(sim.bodies[0].x).toBeLessThanOrEqual(1);
    expect(sim.bodies[0].grounded).toBe(true);
    expect(sim.bodies.some((b) => b.kind === 'leaves' && b.x > 2)).toBe(true);
  });
  it('slides around exposed rocks and removes objects that leave the domain', () => {
    const sim = new RiverDroppedObjects(water, [{ x: 2, z: 0, r: 0.5 }], 9, domain);
    sim.drop('stick', 0, 0.1); sim.advance(5);
    expect(Math.hypot(sim.bodies[0].x - 2, sim.bodies[0].z)).toBeGreaterThanOrEqual(0.85 - 0.001);
    const exit = new RiverDroppedObjects(water, [], 1, { ...domain, x1: 2 });
    exit.drop('rubber-duck', 0, 0); exit.advance(6); expect(exit.bodies).toHaveLength(0);
  });
  it('releases a grounded duck only after local floodwater clears the rock plus its draft', () => {
    let level = 8;
    let crestLevel = level;
    const rock = { x: 2, z: 0, r: 0.5, topY: 8.1 };
    const w: DropWater = { ...water, surface: (x) => Math.abs(x - rock.x) < 0.01 ? crestLevel : level };
    const sim = new RiverDroppedObjects(w, [rock], 7, domain);
    sim.drop('rubber-duck', 1, 0);
    const duck = sim.bodies[0];
    // Start settled at the exposed rock's upstream contact, then change
    // the live sampler without rebuilding the obstacles or respawning.
    duck.x = rock.x - rock.r - RIVER_DROP_PROFILES['rubber-duck'].radius;
    duck.y = level - RIVER_DROP_PROFILES['rubber-duck'].draft;
    sim.advance(1);
    expect(duck.grounded).toBe(true);
    const strandedX = duck.x;
    level = crestLevel = 8.15;
    sim.advance(1);
    expect(duck.grounded).toBe(true);
    expect(duck.x).toBeCloseTo(strandedX, 6);
    // The duck's body extends 5 cm below its model origin. Clearing only
    // that origin would let its visible belly cut through the crest.
    level = crestLevel = 8.2;
    sim.advance(1);
    expect(duck.grounded).toBe(true);
    expect(duck.x).toBeCloseTo(strandedX, 6);
    // A flood elsewhere must not free the duck while the rock's own local
    // surface still leaves too little room for the immersed body.
    level = 8.4; crestLevel = 8.15;
    sim.advance(1);
    expect(duck.grounded).toBe(true);
    expect(duck.x).toBeCloseTo(strandedX, 6);
    crestLevel = level;
    sim.advance(3);
    expect(duck.grounded).toBe(false);
    expect(duck.x).toBeGreaterThan(rock.x + rock.r);
    expect(duck.vx).toBeCloseTo(1, 2);
    expect(duck.y).toBeCloseTo(level - RIVER_DROP_PROFILES['rubber-duck'].draft, 2);
    expect(duck.id).toBe(1);
  });
  it('keeps a deeper rowboat on a submerged rock that a duck can clear, and restores contact on recession', () => {
    let level = 8.25;
    let current = 1;
    const rock = { x: 2, z: 0, r: 0.5, topY: 8.1 };
    const w: DropWater = { ...water, surface: () => level, velocity: (_x, _z, out) => { out[0] = current; out[1] = 0; } };
    const sim = new RiverDroppedObjects(w, [rock], 7, domain);
    sim.drop('rubber-duck', 1, 0); sim.drop('rowboat', 0, 0);
    const [duck, boat] = sim.bodies;
    duck.x = rock.x - rock.r - RIVER_DROP_PROFILES['rubber-duck'].radius;
    duck.y = level - RIVER_DROP_PROFILES['rubber-duck'].draft;
    boat.x = rock.x - rock.r - RIVER_DROP_PROFILES.rowboat.radius;
    boat.y = level - RIVER_DROP_PROFILES.rowboat.draft;
    sim.advance(2);
    expect(duck.x).toBeGreaterThan(rock.x + rock.r);
    expect(duck.grounded).toBe(false);
    expect(boat.x).toBeCloseTo(rock.x - rock.r - RIVER_DROP_PROFILES.rowboat.radius, 6);
    expect(boat.grounded).toBe(true);
    // Reversing the controlled current sends the same duck back toward
    // the rock after the flood recedes; it must not retain a bypass flag.
    level = 8.15; current = -1;
    sim.advance(3);
    expect(duck.grounded).toBe(true);
    expect(duck.x).toBeGreaterThanOrEqual(rock.x + rock.r + RIVER_DROP_PROFILES['rubber-duck'].radius - 1e-6);
    expect(duck.vx).toBeCloseTo(0, 6);
  });
});
