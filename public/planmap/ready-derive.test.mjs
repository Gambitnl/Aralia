import { describe, it, expect } from 'vitest';
import { slug, isDead, isActionable, topicReadiness } from './ready-derive.mjs';

// byId factory
const index = (topics) => Object.fromEntries(topics.map((t) => [t.id, t]));

describe('isDead', () => {
  it('is true for done and superseded, false otherwise', () => {
    expect(isDead({ status: 'done' })).toBe(true);
    expect(isDead({ status: 'superseded' })).toBe(true);
    expect(isDead({ status: 'active' })).toBe(false);
    expect(isDead({ status: 'parked' })).toBe(false);
  });
});

describe('topicReadiness', () => {
  it('keeps a dependency-ready featureless topic READY', () => {
    const t = { id: 'a', status: 'active', deps: [] };
    expect(topicReadiness(t, index([t]))).toEqual({
      ready: true,
      hasFeatures: false,
      pendingFeatureCount: 0,
      readyFeatureCount: 0,
    });
  });

  it('withholds READY when every unfinished feature is parked', () => {
    const t = {
      id: 'a', status: 'active', deps: [], features: [
        { title: 'Shipped', status: 'done' },
        { title: 'Deferred', status: 'parked' },
      ],
    };
    expect(topicReadiness(t, index([t]))).toEqual({
      ready: false,
      hasFeatures: true,
      pendingFeatureCount: 1,
      readyFeatureCount: 0,
    });
  });

  it('reports available child work without treating stored order as a dependency', () => {
    const t = {
      id: 'a', status: 'active', deps: [], features: [
        { title: 'Deferred first', status: 'parked' },
        { title: 'Available later', status: 'specced' },
      ],
    };
    expect(topicReadiness(t, index([t]))).toMatchObject({
      ready: true,
      pendingFeatureCount: 2,
      readyFeatureCount: 1,
    });
  });
});

describe('isActionable', () => {
  it('a dead topic is never actionable', () => {
    const t = { id: 'a', status: 'done', deps: [] };
    expect(isActionable(t, index([t]))).toBe(false);
  });

  it('alive with no deps is actionable', () => {
    const t = { id: 'a', status: 'parked', deps: [] };
    expect(isActionable(t, index([t]))).toBe(true);
  });

  it('a hard dep pointing at a done topic is satisfied', () => {
    const dep = { id: 'dep', status: 'done' };
    const t = { id: 'a', status: 'parked', deps: [{ id: 'dep', kind: 'hard' }] };
    expect(isActionable(t, index([t, dep]))).toBe(true);
  });

  it('a hard dep at superseded is satisfied', () => {
    const dep = { id: 'dep', status: 'superseded' };
    const t = { id: 'a', status: 'parked', deps: [{ id: 'dep', kind: 'hard' }] };
    expect(isActionable(t, index([t, dep]))).toBe(true);
  });

  it('a hard dep still open blocks', () => {
    const dep = { id: 'dep', status: 'active' };
    const t = { id: 'a', status: 'parked', deps: [{ id: 'dep', kind: 'hard' }] };
    expect(isActionable(t, index([t, dep]))).toBe(false);
  });

  it('a chosen dep never blocks even when open', () => {
    const dep = { id: 'dep', status: 'active' };
    const t = { id: 'a', status: 'parked', deps: [{ id: 'dep', kind: 'chosen' }] };
    expect(isActionable(t, index([t, dep]))).toBe(true);
  });

  it('a string dep is treated as hard', () => {
    const dep = { id: 'dep', status: 'active' };
    const t = { id: 'a', status: 'parked', deps: ['dep'] };
    expect(isActionable(t, index([t, dep]))).toBe(false);
  });

  it('a feature-targeted hard dep is satisfied when that feature is dead', () => {
    const dep = { id: 'dep', status: 'active', features: [{ title: 'Ship It', status: 'done' }] };
    const t = { id: 'a', status: 'parked', deps: [{ id: 'dep', kind: 'hard', feature: slug('Ship It') }] };
    expect(isActionable(t, index([t, dep]))).toBe(true);
  });

  it('unresolved feature slug falls back to whole-topic deadness', () => {
    const dep = { id: 'dep', status: 'active', features: [{ title: 'Ship It', status: 'done' }] };
    const t = { id: 'a', status: 'parked', deps: [{ id: 'dep', kind: 'hard', feature: 'no-such-feature' }] };
    // dep topic is alive → not satisfied
    expect(isActionable(t, index([t, dep]))).toBe(false);
  });

  it('a dep with an unknown id does not block', () => {
    const t = { id: 'a', status: 'parked', deps: [{ id: 'ghost', kind: 'hard' }] };
    expect(isActionable(t, index([t]))).toBe(true);
  });
});
