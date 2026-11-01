/** Checks that diagnostic cost excludes expired work and retains frequent-call counts. */
import { afterEach, expect, it } from 'vitest';
import { clearPerfOverhead, perfOverheadSnapshot, recordPerfOverhead } from '../perfOverhead';
afterEach(clearPerfOverhead);
it('combines frequent calls without losing their elapsed cost or count', () => {
  recordPerfOverhead('probe', 1, 100);
  recordPerfOverhead('probe', 3, 150);
  recordPerfOverhead('inventory', 8, 150);
  expect(perfOverheadSnapshot(200)).toEqual([
    { kind: 'probe', totalMs: 4, calls: 2, meanMs: 2, windowMs: 10000 },
    { kind: 'inventory', totalMs: 8, calls: 1, meanMs: 8, windowMs: 10000 },
  ]);
});
it('excludes expired observations and rejects invalid durations', () => {
  recordPerfOverhead('React render', 4, 0);
  recordPerfOverhead('React render', Number.NaN, 1);
  recordPerfOverhead('React render', -5, 2);
  recordPerfOverhead('React render', 2, 10001);
  expect(perfOverheadSnapshot(10001)[0]).toMatchObject({ totalMs: 2, calls: 1, meanMs: 2 });
  expect(perfOverheadSnapshot(20002)[0]).toMatchObject({ totalMs: 0, calls: 0, meanMs: 0 });
});
