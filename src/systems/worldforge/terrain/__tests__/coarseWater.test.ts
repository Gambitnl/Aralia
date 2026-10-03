/**
 * The coarse exterior store. Conservation across the HANDOFF is the point.
 *
 * The interior solver already proves it does not leak. This file proves the
 * boundary between the two models does not leak either, which is the harder
 * half and the one the research singled out: an exterior that is merely a level
 * is an infinite reservoir, and no amount of interior care fixes that.
 */
import { describe, it, expect } from 'vitest';
import { CoarseWaterStore } from '../coarseWater';
import { ShallowWaterField } from '../shallowWater';

/** A basin with walls, so the interior only loses water where we choose. */
function basin(n: number, cellM: number, wall = 2): ShallowWaterField {
  const f = new ShallowWaterField(n, cellM);
  f.bed.fill(0);
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      if (x < wall || z < wall || x >= n - wall || z >= n - wall) f.bed[f.idx(x, z)] = 10;
    }
  }
  return f;
}

describe('the ledger handoff', () => {
  it('moves the whole ledger and clears it, so nothing is banked twice', () => {
    const f = new ShallowWaterField(16, 0.25);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) f.bed[f.idx(x, z)] = -x * 0.2;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 3; x++) f.add(x, z, 0.5);
    for (let s = 0; s < 200; s++) f.step(f.maxStableStep());

    const ledger = f.boundaryLedgerM3;
    expect(ledger).toBeGreaterThan(0);

    const store = new CoarseWaterStore({ cellM: 32 });
    const moved = store.drainLedger(f, 100, 100);

    expect(moved).toBeCloseTo(ledger, 9);
    expect(f.boundaryLedgerM3).toBe(0);
    expect(store.totalVolumeM3()).toBeCloseTo(ledger, 9);

    // Draining again moves nothing. The receipt is not a second deposit.
    expect(store.drainLedger(f, 100, 100)).toBe(0);
    expect(store.totalVolumeM3()).toBeCloseTo(ledger, 9);
  });

  it('conserves the world total across interior loss plus exterior gain', () => {
    const f = new ShallowWaterField(20, 0.25);
    for (let z = 0; z < 20; z++) for (let x = 0; x < 20; x++) f.bed[f.idx(x, z)] = -x * 0.25;
    for (let z = 0; z < 20; z++) for (let x = 0; x < 5; x++) f.add(x, z, 0.6);
    const started = f.volume();

    const store = new CoarseWaterStore({ cellM: 32 });
    for (let s = 0; s < 400; s++) {
      f.step(f.maxStableStep());
      store.drainLedger(f, 50, 50);
    }
    // Nothing anywhere else. The world total is exactly what we poured.
    expect(f.volume() + store.totalVolumeM3()).toBeCloseTo(started, 4);
  });
});

describe('demote and promote', () => {
  it('a round trip loses nothing', () => {
    // The bubble moves away and comes back. This is the transfer that silently
    // erodes a world's water if either direction is sloppy.
    const f = basin(16, 0.5);
    for (let z = 4; z < 12; z++) for (let x = 4; x < 12; x++) f.add(x, z, 0.8);
    const started = f.volume();

    const store = new CoarseWaterStore({ cellM: 8 });
    const taken = store.demoteFrom(f, 0, 0);

    expect(taken).toBeCloseTo(started, 6);
    expect(f.volume()).toBe(0);
    expect(store.totalVolumeM3()).toBeCloseTo(started, 6);

    const placed = store.promoteInto(f, 0, 0);
    expect(placed).toBeGreaterThan(0);
    // Field plus whatever stayed banked equals what we started with.
    expect(f.volume() + store.totalVolumeM3()).toBeCloseTo(started, 4);
  });

  it('promotion fills LOW ground first, not evenly', () => {
    // An even spread puts water on ridges, where it runs off again and looks
    // like a leak. Water handed back must land where water would be.
    const f = new ShallowWaterField(8, 1);
    for (let z = 0; z < 8; z++) {
      for (let x = 0; x < 8; x++) f.bed[f.idx(x, z)] = x < 4 ? 0 : 5;
    }
    const store = new CoarseWaterStore({ cellM: 32 });
    store.deposit(4, 4, 20);
    store.promoteInto(f, 0, 0);

    let low = 0;
    let high = 0;
    for (let z = 0; z < 8; z++) {
      for (let x = 0; x < 8; x++) {
        if (x < 4) low += f.depth[f.idx(x, z)];
        else high += f.depth[f.idx(x, z)];
      }
    }
    expect(low).toBeGreaterThan(0);
    expect(high).toBe(0);
  });

  it('keeps a residual rather than dropping what will not fit', () => {
    const f = new ShallowWaterField(4, 1);
    f.bed.fill(0);
    const store = new CoarseWaterStore({ cellM: 64 });
    store.deposit(2, 2, 500); // far more than a 4x4 metre patch should swallow
    const before = store.totalVolumeM3();
    const placed = store.promoteInto(f, 0, 0);
    // Whatever the field took plus whatever stayed banked is still 500.
    expect(placed + store.totalVolumeM3()).toBeCloseTo(before, 4);
  });
});

describe('the exterior keeps working while nobody watches', () => {
  it('routes water downhill between coarse cells, conservatively', () => {
    const store = new CoarseWaterStore({ cellM: 32, drainRate: 0.5 });
    for (let i = 0; i < 5; i++) store.setBed(i, 0, -i * 3);
    store.deposit(16, 16, 100); // cell (0,0), the high end

    const before = store.totalVolumeM3();
    for (let s = 0; s < 60; s++) store.step(1 / 30);

    expect(store.totalVolumeM3()).toBeCloseTo(before, 6);
    // It moved off the high cell toward the low end.
    expect(store.peek(0, 0)!.volumeM3).toBeLessThan(100);
    expect(store.peek(4, 0)?.volumeM3 ?? 0).toBeGreaterThan(0);
  });

  it('holds water in place when it does not know the ground', () => {
    // Without bed data the store cannot say which way is downhill. Holding is
    // the honest answer; guessing would move water uphill.
    const store = new CoarseWaterStore({ cellM: 32 });
    store.deposit(10, 10, 42);
    for (let s = 0; s < 100; s++) store.step(1 / 30);
    expect(store.totalVolumeM3()).toBeCloseTo(42, 9);
  });

  it('stays sparse: dry world costs nothing', () => {
    const store = new CoarseWaterStore();
    for (let s = 0; s < 100; s++) store.step(1 / 30);
    expect(store.wetCellCount()).toBe(0);
    expect(store.totalVolumeM3()).toBe(0);
  });
});

describe('the whole loop', () => {
  it('breach, drain, abandon, return — and the water is all still there', () => {
    // The scenario the research names: a dam breached and left behind keeps
    // emptying, and the player who walks back finds the result.
    const f = basin(20, 0.5);
    for (let z = 2; z < 18; z++) for (let x = 2; x < 18; x++) f.add(x, z, 0.9);
    const started = f.volume();
    const store = new CoarseWaterStore({ cellM: 16, drainRate: 0.3 });

    // Cut the wall and let it run. The basin wall is TWO cells thick, so both
    // must go — cutting only the outer one leaves the breach unconnected and
    // the test silently measures a sealed basin.
    for (let z = 9; z < 12; z++) {
      f.bed[f.idx(18, z)] = -1;
      f.bed[f.idx(19, z)] = -1;
    }
    for (let s = 0; s < 800; s++) {
      f.step(f.maxStableStep());
      store.drainLedger(f, 200, 200);
    }
    expect(store.totalVolumeM3()).toBeGreaterThan(0);

    // The player leaves. Everything left in the field goes to the store.
    store.demoteFrom(f, 0, 0);
    expect(f.volume()).toBe(0);
    expect(store.totalVolumeM3()).toBeCloseTo(started, 3);

    // Time passes with nobody there.
    for (let s = 0; s < 200; s++) store.step(1 / 30);
    expect(store.totalVolumeM3()).toBeCloseTo(started, 3);

    // The player returns.
    store.promoteInto(f, 0, 0);
    expect(f.volume() + store.totalVolumeM3()).toBeCloseTo(started, 3);
  });
});
