/**
 * @file World3DWrapper.throttle.test.ts
 * Documents and guards the ~10 Hz playerWorldPos dispatch budget (Plan 4 §Perf).
 */
import { describe, expect, it } from 'vitest';
import { POSITION_DISPATCH_INTERVAL_MS } from '../transitionTiming';

describe('World3DWrapper position dispatch throttle', () => {
  it('uses a 100ms interval (max 10 dispatches per second)', () => {
    expect(POSITION_DISPATCH_INTERVAL_MS).toBe(100);
    expect(1000 / POSITION_DISPATCH_INTERVAL_MS).toBe(10);
  });
});
