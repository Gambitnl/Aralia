import { describe, expect, it } from 'vitest';
import { RiverFlowTextureDeltaTracker, validFlowDelta, riverFlowDirtyRect } from '../riverFlowTextureDelta';

describe('worker-owned exact flow deltas', () => {
  it('retains fixed independent buffers across transfer, signed-zero and NaN payload changes', () => {
    const tracker = new RiverFlowTextureDeltaTracker('worker-1');
    const fields = Array.from({ length: 3 }, () => new Uint16Array(6 * 4 * 4)) as [Uint16Array, Uint16Array, Uint16Array];
    expect(tracker.capture(6, 4, fields).baseRevision).toBeNull();
    const next = fields.map(a => a.slice()) as typeof fields;
    structuredClone(fields, { transfer: fields.map(a => a.buffer) });
    expect(fields[0].byteLength).toBe(0);
    next[0][3] = 0x8000; next[1][next[1].length - 1] = 0x7e01;
    const delta = tracker.capture(6, 4, next);
    expect(delta).toMatchObject({ revision: 2, baseRevision: 1, rectangles: [
      { x: 0, y: 0, width: 1, height: 1 }, { x: 5, y: 3, width: 1, height: 1 }, null,
    ] });
    expect(tracker.retainedBytes).toBe(6 * 4 * 4 * 2 * 3);
    expect(tracker.capture(6, 4, next).rectangles).toEqual([null, null, null]);
    next[0][3] = 0; next[1][next[1].length - 1] = 0x7e02;
    expect(tracker.capture(6, 4, next).rectangles.every(Boolean)).toBe(false);
    expect(tracker.retainedBytes).toBe(6 * 4 * 4 * 2 * 3);
  });
  it('resets lineage for a changed grid and rejects malformed rectangles', () => {
    const tracker = new RiverFlowTextureDeltaTracker('worker-2');
    const fields = [new Uint16Array(16), new Uint16Array(16), new Uint16Array(16)] as const;
    const first = tracker.capture(2, 2, [...fields]);
    const resized = tracker.capture(4, 1, [...fields]);
    expect(resized.baseRevision).toBeNull();
    expect(validFlowDelta(first, 2, 2)).toBe(true);
    expect(validFlowDelta(first, 4, 1)).toBe(false);
    expect(validFlowDelta({ ...first, rectangles: [{ x: 1, y: 0, width: 2, height: 1 }, null, null] }, 2, 2)).toBe(false);
    expect(() => tracker.capture(3, 2, [...fields])).toThrow();
    expect(riverFlowDirtyRect(fields[0], fields[1], 2, 2)).toBeNull();
  });
});
