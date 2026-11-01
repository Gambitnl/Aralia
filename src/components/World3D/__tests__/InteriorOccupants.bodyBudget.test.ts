/** A nearby household must not disappear behind retained neighbors after a street walk. */
import {describe, expect, it} from 'vitest';
import {selectInteriorBodyKeys, type InteriorBodyCandidate} from '../InteriorOccupants';

const eye = {x: 0, y: 0, z: 0};
const resident = (key: string, x: number, extra: Partial<InteriorBodyCandidate> = {}): InteriorBodyCandidate =>
  ({key, x, y: 0, z: 0, interiorOwned: true, ...extra});

describe('nearby household body budget after walking between buildings', () => {
  it('admits the reached host before ten retained distant neighbors without raising the cap', () => {
    const neighbors = Array.from({length: 10}, (_, i) => resident('neighbor-' + i, 12 + i / 10));
    const selected = selectInteriorBodyKeys([...neighbors, resident('reached-host', 2)], eye,
      new Set(neighbors.map(person => person.key)));
    expect(selected.size).toBe(10);
    expect(selected.has('reached-host')).toBe(true);
    expect(selected.has('neighbor-9')).toBe(false);
  });

  it('gives a visible resident the final slot before an absent retained OUT placeholder', () => {
    const selected = selectInteriorBodyKeys([
      resident('absent-neighbor', 1, {interiorOwned: false}), resident('at-home', 3),
    ], eye, new Set(['absent-neighbor']), 1);
    expect([...selected]).toEqual(['at-home']);
  });

  it('retains a body through small distance jitter instead of swapping equally near people', () => {
    const selected = selectInteriorBodyKeys([resident('new-neighbor', 4.6), resident('held', 5)],
      eye, new Set(['held']), 1);
    expect([...selected]).toEqual(['held']);
  });

  it('keeps a real moving person identifiable ahead of idle residents while refusing absent motion', () => {
    const selected = selectInteriorBodyKeys([
      resident('idle', 2), resident('walking', 16, {moving: true}),
      resident('absent-motion', 1, {moving: true, interiorOwned: false}),
    ], eye, new Set(['idle', 'absent-motion']), 1);
    expect([...selected]).toEqual(['walking']);
  });
});


describe('current-view residents under a full body budget', () => {
  it('keeps the visible host instead of spending all slots on retained neighbors behind the camera', () => {
    const neighbors = Array.from({length: 7}, (_, i) => resident('behind-' + i, 7 + i / 10, {inView: false}));
    const family = Array.from({length: 3}, (_, i) => resident('family-' + i, 10 + i / 10, {inView: true}));
    const previous = new Set([...neighbors, ...family].map(person => person.key));
    const selected = selectInteriorBodyKeys([...neighbors, ...family, resident('visible-host', 12, {inView: true})], eye, previous);
    expect(selected.size).toBe(10);
    expect(selected.has('visible-host')).toBe(true);
    expect(family.every(person => selected.has(person.key))).toBe(true);
    expect(neighbors.filter(person => selected.has(person.key))).toHaveLength(6);
  });

  it('retains a real moving person ahead of idle visible people without admitting an absent placeholder', () => {
    const selected = selectInteriorBodyKeys([
      resident('visible-idle', 2, {inView: true}),
      resident('walking', 16, {inView: false, moving: true}),
      resident('absent', 1, {inView: true, interiorOwned: false}),
    ], eye, new Set(), 1);
    expect([...selected]).toEqual(['walking']);
  });

  it('keeps the existing enter and exit radii even for a visible resident', () => {
    const selected = selectInteriorBodyKeys([
      resident('visible-distant', 25, {inView: true}),
      resident('new-outside-enter-radius', 19, {inView: true}),
      resident('retained-within-exit-radius', 23, {inView: false}),
    ], eye, new Set(['retained-within-exit-radius']));
    expect([...selected]).toEqual(['retained-within-exit-radius']);
  });
});
