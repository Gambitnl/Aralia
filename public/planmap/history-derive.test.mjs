import { describe, it, expect } from 'vitest';
import { flatNodes, diffDone, momentumByDay, stalenessDays, stateAt, synthesizeTimeline } from './history-derive.mjs';

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
  it('treats the first recorded day as a baseline (0) even if items are already done', () => {
    const timeline = [
      { date: '2026-07-01', topics: [T('a', 'done'), T('b', 'done')] },
      { date: '2026-07-02', topics: [T('a', 'done'), T('b', 'done'), T('c', 'done')] },
    ];
    expect(momentumByDay(timeline).map(d => d.count)).toEqual([0, 1]);
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

const TH = (id, status, history) => ({ id, title: id, status, features: [], history });

describe('stateAt (back-dating)', () => {
  it('is absent before designed, in-design between, done after built', () => {
    const live = [TH('a', 'done', { designed: '2026-05-13', built: '2026-06-29' })];
    expect(stateAt('2026-05-01', live, null)).toEqual([]);                       // before designed
    expect(stateAt('2026-06-01', live, null).map(t => t.status)).toEqual(['specced']); // in design
    expect(stateAt('2026-07-01', live, null).map(t => t.status)).toEqual(['done']);     // after built
  });
  it('undated nodes fall back to the git snapshot for that day', () => {
    const live = [T('u', 'active')];
    const gitSnap = { date: '2026-07-03', topics: [T('u', 'parked')] };
    expect(stateAt('2026-07-03', live, gitSnap).map(t => t.status)).toEqual(['parked']);
    expect(stateAt('2026-07-03', live, null)).toEqual([]); // no git → absent
  });
});

describe('synthesizeTimeline', () => {
  it('spans manual dates + git days + today, and momentum lands on the real built date', () => {
    const live = [TH('a', 'done', { designed: '2026-05-13', built: '2026-06-29' })];
    const tl = synthesizeTimeline([], live, '2026-07-04');
    expect(tl.map(d => d.date)).toEqual(['2026-05-13', '2026-06-29', '2026-07-04']);
    // baseline day 0, a bar on the real built date, 0 today
    expect(momentumByDay(tl).map(d => d.count)).toEqual([0, 1, 0]);
    // final point is the live map verbatim
    expect(tl[tl.length - 1].topics).toBe(live);
  });
});
