import { describe, it, expect } from 'vitest';
import { flatNodes, diffDone, momentumByDay, stalenessDays } from './history-derive.mjs';

const T = (id, status, features = []) => ({ id, title: id, status, features });
const F = (title, status) => ({ title, status });

describe('flatNodes', () => {
  it('flattens topics and their features with stable keys', () => {
    const nodes = flatNodes([T('a', 'active', [F('Do X', 'done')])]);
    expect(nodes.map(n => n.key)).toEqual(['a', 'a::do-x']);
  });
});

describe('diffDone', () => {
  it('reports nodes that newly became done', () => {
    const prev = [T('a', 'active', [F('Do X', 'active')])];
    const next = [T('a', 'active', [F('Do X', 'done')])];
    expect(diffDone(prev, next).map(n => n.key)).toEqual(['a::do-x']);
  });
  it('counts a node that first appears already done', () => {
    expect(diffDone([], [T('a', 'done')]).map(n => n.key)).toEqual(['a']);
  });
  it('does not re-report something already done', () => {
    expect(diffDone([T('a', 'done')], [T('a', 'done')])).toEqual([]);
  });
});

describe('momentumByDay', () => {
  it('counts done-transitions per day', () => {
    const timeline = [
      { date: '2026-07-01', topics: [T('a', 'active')] },
      { date: '2026-07-02', topics: [T('a', 'done')] },
      { date: '2026-07-03', topics: [T('a', 'done'), T('b', 'done')] },
    ];
    expect(momentumByDay(timeline).map(d => d.count)).toEqual([0, 1, 1]);
  });
});

describe('stalenessDays', () => {
  it('dates age from the day the status last changed', () => {
    const timeline = [
      { date: '2026-07-01', topics: [T('a', 'parked')] },
      { date: '2026-07-03', topics: [T('a', 'specced')] },
    ];
    const m = stalenessDays(timeline, '2026-07-05');
    expect(m.get('a')).toEqual({ days: 2, floored: false });
  });
  it('floors age when the status never changed in visible history', () => {
    const timeline = [
      { date: '2026-07-01', topics: [T('a', 'parked')] },
      { date: '2026-07-03', topics: [T('a', 'parked')] },
    ];
    const m = stalenessDays(timeline, '2026-07-05');
    expect(m.get('a')).toEqual({ days: 4, floored: true });
  });
  it('excludes done and superseded nodes', () => {
    const timeline = [{ date: '2026-07-01', topics: [T('a', 'done'), T('b', 'superseded')] }];
    expect(stalenessDays(timeline, '2026-07-02').size).toBe(0);
  });
});
