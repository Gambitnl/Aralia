/**
 * @file archetypes.test.ts
 * @description Task 2 tests — builder-archetype data module for the
 * history-first dungeon generator.
 */

import { describe, it, expect } from 'vitest';
import { ARCHETYPES, THEME_ARCHETYPE, FURNITURE } from '../archetypes';

describe('archetypes', () => {
  it('covers every theme and every archetype has entry + repeat units', () => {
    for (const arch of Object.values(THEME_ARCHETYPE)) {
      const a = ARCHETYPES[arch];
      expect(a.core.some((s) => s.anchor === 'entry')).toBe(true);
      expect(a.repeat.length).toBeGreaterThan(0);
      expect(a.namePool.length).toBeGreaterThanOrEqual(6);
      expect(Object.keys(a.eventWeights).length).toBeGreaterThanOrEqual(4);
    }
  });
  it('every core/repeat purpose with furniture uses known layouts', () => {
    for (const specs of Object.values(FURNITURE)) {
      for (const f of specs!) expect(['rows', 'walls', 'center', 'scatter']).toContain(f.layout);
    }
  });
  it('maps every theme to an archetype per the approved mocks', () => {
    expect(THEME_ARCHETYPE).toEqual({
      crypt: 'mausoleum',
      cavern: 'mine',
      frost: 'fortress',
      sewer: 'waterworks',
      fungal: 'mausoleum',
    });
  });
  it('carries the approved event weights verbatim', () => {
    expect(ARCHETYPES.mausoleum.eventWeights).toEqual({
      seal: 3, collapse: 2, tunnel: 2, plunder: 2, awaken: 3, 'brick-off': 2, reoccupy: 1, fire: 1, bloom: 1,
    });
    expect(ARCHETYPES.mine.eventWeights).toEqual({
      flood: 3, collapse: 2, tunnel: 2, den: 3, plunder: 1, bloom: 1,
    });
    expect(ARCHETYPES.fortress.eventWeights).toEqual({
      fire: 2, 'brick-off': 2, collapse: 1, den: 3, plunder: 2, flood: 1, bloom: 1,
    });
    expect(ARCHETYPES.waterworks.eventWeights).toEqual({
      'brick-off': 2, tunnel: 2, collapse: 2, flood: 3, den: 3, bloom: 2,
    });
  });
  it('name pools have >= 8 grounded stems, never apostrophe-gibberish', () => {
    for (const a of Object.values(ARCHETYPES)) {
      expect(a.namePool.length).toBeGreaterThanOrEqual(8);
      for (const n of a.namePool) {
        expect(n).not.toMatch(/['’]/);
        expect(n).toMatch(/^[A-Z][A-Za-z]*( [A-Z][A-Za-z]*)*$/);
      }
    }
  });
  it('room programs follow the approved layouts', () => {
    const purposes = (specs: readonly { purpose: string }[]) => specs.map((s) => s.purpose);
    // mausoleum: processional core, galleries repeat off the spine
    expect(purposes(ARCHETYPES.mausoleum.core)).toEqual([
      'stair', 'antechamber', 'chapel', 'treasury', 'ossuary', 'embalming',
    ]);
    expect(ARCHETYPES.mausoleum.core.find((s) => s.purpose === 'ossuary')!.anchor).toBe('spine');
    expect(ARCHETYPES.mausoleum.repeat[0]).toMatchObject({ purpose: 'burial-gallery', anchor: 'spine' });
    // mine: surface rooms first, sump last, vein galleries chase the flow
    const mineCore = purposes(ARCHETYPES.mine.core);
    expect(mineCore[0]).toBe('adit');
    expect(mineCore[mineCore.length - 1]).toBe('sump');
    expect(ARCHETYPES.mine.repeat[0]).toMatchObject({ purpose: 'vein-gallery', dir: 'flow' });
    // fortress: gatehouse funnel into the great-hall hub, chapel wing at the back
    expect(purposes(ARCHETYPES.fortress.core)[0]).toBe('gatehouse');
    expect(ARCHETYPES.fortress.core.find((s) => s.purpose === 'chapel-wing')).toMatchObject({
      anchor: 'great-hall', dir: 'back',
    });
    // waterworks: two cisterns off the junction in opposite directions
    const cisterns = ARCHETYPES.waterworks.core.filter((s) => s.purpose === 'cistern');
    expect(cisterns).toHaveLength(2);
    expect(new Set(cisterns.map((s) => s.dir))).toEqual(new Set(['left', 'right']));
    expect(cisterns.every((s) => s.anchor === 'junction')).toBe(true);
  });
  it('flags low-lying purposes as floodable', () => {
    expect(ARCHETYPES.mine.floodable).toContain('sump');
    expect(ARCHETYPES.waterworks.floodable).toContain('cistern');
    for (const a of Object.values(ARCHETYPES)) expect(a.floodable.length).toBeGreaterThan(0);
  });
  it('archetype with {T} tokens must have townPlaceholder defined', () => {
    for (const a of Object.values(ARCHETYPES)) {
      const hasTokenT = [
        ...a.builderPatterns,
        ...a.titlePatterns,
      ].some((s) => s.includes('{T}'));

      if (hasTokenT) {
        expect(a.townPlaceholder).toBeDefined();
        expect(typeof a.townPlaceholder).toBe('string');
        expect(a.townPlaceholder!.length).toBeGreaterThan(0);
      }
    }
  });
});
