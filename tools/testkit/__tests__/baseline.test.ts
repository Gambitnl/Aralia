import { describe, it, expect } from 'vitest';
import { compareRuns } from '../baseline.mjs';

const base = {
  surfaces: {
    atlas: { consoleErrors: 0, heapMB: 100, lcpMs: 1000 },
  },
};

describe('compareRuns', () => {
  it('reports clean when metrics are within thresholds', () => {
    const run = { surfaces: { atlas: { consoleErrors: 0, heapMB: 110, lcpMs: 1100 } } };
    const result = compareRuns(base, run);
    expect(result.regressions).toEqual([]);
  });

  it('flags any console-error increase', () => {
    const run = { surfaces: { atlas: { consoleErrors: 1, heapMB: 100, lcpMs: 1000 } } };
    const result = compareRuns(base, run);
    expect(result.regressions).toHaveLength(1);
    expect(result.regressions[0]).toContain('consoleErrors');
  });

  it('flags heap growth over 15%', () => {
    const run = { surfaces: { atlas: { consoleErrors: 0, heapMB: 116, lcpMs: 1000 } } };
    expect(compareRuns(base, run).regressions[0]).toContain('heapMB');
  });

  it('flags generic metrics over 20% but not under', () => {
    const over = { surfaces: { atlas: { consoleErrors: 0, heapMB: 100, lcpMs: 1201 } } };
    const under = { surfaces: { atlas: { consoleErrors: 0, heapMB: 100, lcpMs: 1199 } } };
    expect(compareRuns(base, over).regressions).toHaveLength(1);
    expect(compareRuns(base, under).regressions).toEqual([]);
  });

  it('notes surfaces new to this run and surfaces missing from it', () => {
    const run = { surfaces: { combat: { consoleErrors: 0 } } };
    const result = compareRuns(base, run);
    expect(result.notes.join(' ')).toContain('combat');
    expect(result.notes.join(' ')).toContain('atlas');
  });

  it('reports improvements when a metric drops 20% or more', () => {
    const run = { surfaces: { atlas: { consoleErrors: 0, heapMB: 100, lcpMs: 700 } } };
    expect(compareRuns(base, run).improvements[0]).toContain('lcpMs');
  });
});
