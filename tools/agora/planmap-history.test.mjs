import { describe, it, expect } from 'vitest';
import { parseSnapshot, collapseDaily, buildHistory } from './planmap-history.mjs';

describe('parseSnapshot', () => {
  it('returns the topics array for valid json', () => {
    expect(parseSnapshot('{"topics":[{"id":"a"}]}')).toEqual([{ id: 'a' }]);
  });
  it('returns null for garbage or missing topics', () => {
    expect(parseSnapshot('not json')).toBeNull();
    expect(parseSnapshot('{"nope":1}')).toBeNull();
  });
});

describe('collapseDaily', () => {
  it('keeps the LAST commit of each calendar day, sorted ascending', () => {
    const commits = [
      { hash: 'c1', dateISO: '2026-07-01T09:00:00Z', topics: [{ id: 'x', status: 'parked' }] },
      { hash: 'c2', dateISO: '2026-07-01T22:00:00Z', topics: [{ id: 'x', status: 'specced' }] },
      { hash: 'c3', dateISO: '2026-07-02T02:00:00Z', topics: [{ id: 'x', status: 'active' }] },
    ];
    const days = collapseDaily(commits);
    expect(days.map(d => d.date)).toEqual(['2026-07-01', '2026-07-02']);
    expect(days[0].commit).toBe('c2');
    expect(days[0].topics[0].status).toBe('specced');
  });
  it('skips commits whose snapshot failed to parse (null topics)', () => {
    const days = collapseDaily([{ hash: 'c1', dateISO: '2026-07-01T09:00:00Z', topics: null }]);
    expect(days).toEqual([]);
  });
});

describe('buildHistory', () => {
  it('wraps days with a generatedAt stamp', () => {
    const h = buildHistory([{ hash: 'c1', dateISO: '2026-07-01T09:00:00Z', topics: [{ id: 'x' }] }]);
    expect(h.days).toHaveLength(1);
    expect(typeof h.generatedAt).toBe('string');
  });
});
