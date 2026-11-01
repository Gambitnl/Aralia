/** Source ownership tests. GPU motion/contact require the advancing browser proof. */
import { describe, expect, it } from 'vitest';
import { buildFiniteSource, captureFiniteExports, finiteSourceInventory, planFiniteSource, type FiniteWaterPacket } from '../flipFiniteSource';
import { createFlipBuffers, simSecondsPerUnit } from '../flipCompute';
import { physicalFlipUnits, readFlipContactObservations } from '../flipContactAccounting';

const params = { n: 32, dx: 0.25, origin: [10, -2, 20] as [number, number, number], count: 3 };
const packet = (id: string, birthStep = 0): FiniteWaterPacket => ({
  id, birthStep, volumeM3: 0.00390625,
  positionM: [12, 1, 22], velocityMps: [2, -3, 0],
});

describe('finite GPU water admission', () => {
  it('keeps exported water distinct from pending water and rejects impossible lifecycle pairs', () => {
    const plan = planFiniteSource(params, [packet('exported'), packet('resident'), packet('pending', 100)]);
    const masses = [0, plan.masses[1], 0];
    const inventory = finiteSourceInventory(plan, masses, [2, 1, 0]);
    expect(inventory.admittedPackets).toBe(2);
    expect(inventory.exportedPackets).toBe(1);
    expect(inventory.ownedRestVolumeM3 + inventory.exportedVolumeM3 + inventory.pendingVolumeM3).toBe(plan.representedVolumeM3);
    for (const states of [[1, 1, 0], [2, 2, 0], [2, 1, 3], [2, 1]]) {
      expect(() => finiteSourceInventory(plan, masses, states)).toThrow();
    }
  });

  it('copies actual exported motion and requires an exact named receiver acknowledgment', () => {
    const plan = planFiniteSource(params, [packet('a')]);
    const motion = new Float32Array(12); motion.set([8, 12, 8, 0]);
    const columns: [Float32Array, Float32Array, Float32Array] = [new Float32Array(12), new Float32Array(12), new Float32Array(12)];
    columns[0][1] = -2;
    const snapshot = { step: 1, masses: plan.masses, states: [1, 0, 0], positions: motion, velocities: motion, affineColumns: columns };
    const batch = captureFiniteExports(plan, snapshot, [0]);
    expect(batch.records[0].positionM).toEqual([12, 1, 22]);
    expect(batch.records[0].affinePerSecond[1]).toBeCloseTo(-2 / simSecondsPerUnit(params.dx));
    motion[0] = 999;
    expect(batch.records[0].positionM[0]).toBe(12);
    const source = buildFiniteSource(createFlipBuffers(params), plan);
    const ack = { owner: 'downstream', receiptId: 'receipt-1', packetIds: ['a'] };
    expect(source.acknowledgeExports(batch, ack).batch).toBe(batch);
    expect(() => source.acknowledgeExports(batch, { ...ack, packetIds: [] })).toThrow(/acknowledgment/);
    expect(() => source.acknowledgeExports(batch, { ...ack, owner: '' })).toThrow(/acknowledgment/);
    const other = buildFiniteSource(createFlipBuffers(params), planFiniteSource(params, [packet('a')]));
    expect(() => other.acknowledgeExports(batch, ack)).toThrow(/another source/);
    expect(() => captureFiniteExports(plan, snapshot, [0, 0])).toThrow(/duplicate/);
    expect(() => captureFiniteExports(plan, { ...snapshot, step: 0 }, [0])).toThrow(/completed/);
    expect(() => captureFiniteExports(plan, { ...snapshot, masses: [0, 0, 0], states: [2, 0, 0] }, [0])).toThrow(/resident/);
    motion[1] = NaN;
    expect(() => captureFiniteExports(plan, snapshot, [0])).toThrow(/Nonfinite/);
  });

  it('preserves physical affine columns without aliasing source state', () => {
    const original = { ...packet('affine'), affinePerSecond: [0, -45.78, 0, 1, 0, 2, 0, 3, 0] as [number, number, number, number, number, number, number, number, number] };
    const plan = planFiniteSource(params, [original]);
    for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) {
      expect(plan.affine[col * 4 + row] / simSecondsPerUnit(params.dx)).toBeCloseTo(original.affinePerSecond[col * 3 + row], 5);
    }
    original.affinePerSecond[1] = 999;
    expect(plan.packets[0].affinePerSecond?.[1]).toBe(-45.78);
    expect(() => planFiniteSource(params, [{ ...original, affinePerSecond: [0, NaN, 0, 0, 0, 0, 0, 0, 0] }])).toThrow(/affine/);
  });

  it('converts physical viscosity and keeps opposing correction errors visible', () => {
    const units = physicalFlipUnits(.25);
    expect(units.viscosity).toBeCloseTo(.000005595982, 10);
    const p = { ...params, n: 2, count: 2 };
    const grid = new Float32Array(32); grid.set([1, 2, 3, -4]); grid.set([-1, -2, -3, 4], 4);
    const particle = new Float32Array(8);
    const position = new Float32Array([0, 1, 0, .3, 0, -1, 0, -.3]);
    const receipt = readFlipContactObservations(p, { grid, particle, position });
    expect(receipt.grid.momentumNs).toEqual([0, 0, 0]);
    expect(receipt.grid.kineticJ).toBe(0);
    expect(receipt.grid.absoluteKineticJ).toBeCloseTo(8 * units.energy);
    expect(receipt.position.maximumDisplacementM).toBe(.25);
    expect(receipt.position.absolutePotentialJ).toBeCloseTo(2 * units.mass * 9.81 * .25, 5);
    grid[0] = NaN;
    expect(() => readFlipContactObservations(p, { grid, particle, position })).toThrow(/Nonfinite/);
  });
  it('retains both delayed source ownership and a non-unit final packet', () => {
    const second = { ...packet('second', 100), volumeM3: 0.001 };
    const plan = planFiniteSource(params, [packet('first'), second]);
    const before = finiteSourceInventory(plan, new Float32Array(3));
    expect(before.admittedPackets).toBe(0);
    expect(before.pendingVolumeM3).toBeCloseTo(0.00490625, 10);
    const partial = finiteSourceInventory(plan, new Float32Array([plan.masses[0], 0, 0]));
    expect(partial.admittedPackets).toBe(1);
    expect(partial.admittedVolumeM3 + partial.pendingVolumeM3).toBe(plan.representedVolumeM3);
    const end = finiteSourceInventory(plan, plan.masses);
    expect(end.admittedPackets).toBe(2);
    expect(end.pendingVolumeM3).toBe(0);
    expect(end.ownedRestVolumeM3).toBe(plan.representedVolumeM3);
    expect(end.exportedVolumeM3).toBe(0);
  });

  it('converts declared world momentum consistently with grid mass and time', () => {
    const plan = planFiniteSource(params, [packet('moving')]);
    expect([...plan.positions.slice(0, 3)]).toEqual([8, 12, 8]);
    const volume = plan.masses[0] * plan.particleVolumeUnitM3;
    const time = simSecondsPerUnit(params.dx);
    for (let axis = 0; axis < 3; axis++) {
      expect(1000 * volume * plan.velocities[axis] * params.dx / time)
        .toBeCloseTo(1000 * packet('moving').volumeM3 * packet('moving').velocityMps[axis], 5);
    }
  });

  it('rejects overcapacity, repeated provenance and source within wall support', () => {
    expect(() => planFiniteSource({ ...params, count: 1 }, [packet('a'), packet('b')])).toThrow(/capacity/);
    expect(() => planFiniteSource(params, [packet('a'), packet('a', 10)])).toThrow(/Duplicate/);
    expect(() => planFiniteSource(params, [{ ...packet('a'), positionM: [10, 1, 22] }])).toThrow(/wall/);
  });

  it('rejects corrupt or unexplained ownership instead of calling it conservation', () => {
    const plan = planFiniteSource(params, [packet('a')]);
    for (const masses of [[NaN, 0, 0], [0.5, 0, 0], [1, 0, 1], [1]]) {
      expect(() => finiteSourceInventory(plan, masses)).toThrow();
    }
  });

  it('does not mutate the source request or alias its coordinate arrays', () => {
    const original = packet('a');
    const plan = planFiniteSource(params, [original]);
    original.positionM[0] = 999;
    expect(plan.packets[0].positionM[0]).toBe(12);
    expect(plan.birthSteps[1]).toBe(0xffffffff);
    expect(plan.masses[1]).toBe(0);
  });

  it('rejects a second owner, nonempty water and a mismatched grid before dispatch', () => {
    const plan = planFiniteSource(params, [packet('a')]);
    const bufs = createFlipBuffers(params);
    buildFiniteSource(bufs, plan);
    expect(() => buildFiniteSource(bufs, plan)).toThrow(/already/);
    expect(() => buildFiniteSource(createFlipBuffers({ ...params, dx: .5 }), plan)).toThrow(/domain/);
    const occupied = createFlipBuffers(params);
    occupied.pos.array[1] = 1;
    expect(() => buildFiniteSource(occupied, plan)).toThrow(/fresh empty/);
  });
});
