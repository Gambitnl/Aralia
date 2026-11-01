import { describe, expect, it } from 'vitest';
import { decodeWaterfallSnapshot, encodeWaterfallSnapshot } from '../waterfallSnapshotTransfer';

function roundTrip<T>(value: T): T {
  return decodeWaterfallSnapshot(structuredClone(encodeWaterfallSnapshot(value)));
}

describe('waterfall snapshot transport', () => {
  it('preserves number values, absent/undefined fields and sparse arrays', () => {
    const holes = new Array(3); holes[1] = undefined; holes[2] = -0;
    const value = { q: 1.5, tiny: Number.MIN_VALUE, large: Number.MAX_VALUE,
      zero: -0, nan: NaN, positive: Infinity, negative: -Infinity,
      support: undefined, id: 9n, holes };
    const next = roundTrip(value);
    expect(next).toStrictEqual(value);
    expect(Object.is(next.zero, -0)).toBe(true);
    expect('support' in next).toBe(true);
    expect('absent' in next).toBe(false);
    expect(0 in next.holes).toBe(false);
    expect(1 in next.holes).toBe(true);
  });

  it('preserves shared diagnostic records and cycles without touching the source', () => {
    const release: Record<string, unknown> = { volume: .0125 };
    const value = { first: release, second: release, list: [release] };
    release.owner = value;
    const next = roundTrip(value);
    expect(next.first).toBe(next.second);
    expect(next.list[0]).toBe(next.first);
    expect(next.first.owner).toBe(next);
    expect(next.first).not.toBe(release);
    expect(release.owner).toBe(value);
  });

  it('transfers prepared geometry exactly with shared buffer identity intact', () => {
    const buffer = new ArrayBuffer(24);
    const positions = new Float32Array(buffer, 0, 3); positions.set([1.25, -0, 3.5]);
    const other = new Float32Array(buffer, 12, 3); other.set([4, 5, 6]);
    const packet = encodeWaterfallSnapshot({ positions, alias: positions, other });
    const next = decodeWaterfallSnapshot(structuredClone(packet, { transfer: [buffer] }));
    expect(buffer.byteLength).toBe(0);
    expect(Array.from(next.positions)).toStrictEqual([1.25, -0, 3.5]);
    expect(next.alias).toBe(next.positions);
    expect(next.other.buffer).toBe(next.positions.buffer);
  });

  it('preserves own prototype-named fields without prototype mutation', () => {
    const value = JSON.parse('{"__proto__":null,"constructor":1}');
    value.__proto__ = undefined;
    const next = roundTrip(value);
    expect(Object.getPrototypeOf(next)).toBe(Object.prototype);
    expect(Object.hasOwn(next, '__proto__')).toBe(true);
    expect(next.__proto__).toBeUndefined();
  });

  it('keeps new non-JSON record types on ordinary structured clone', () => {
    const array = [1, 2] as number[] & { note: string }; array.note = 'preserve';
    for (const value of [{ date: new Date(0) }, { map: new Map([['water', 1]]) }, { array }]) {
      expect(encodeWaterfallSnapshot(value).format).toBe('waterfall-structured-v1');
      expect(roundTrip(value)).toStrictEqual(structuredClone(value));
    }
  });

  it('preserves special root values', () => {
    for (const value of [undefined, -0, NaN, Infinity, 3n]) expect(Object.is(roundTrip(value), value)).toBe(true);
  });
});
