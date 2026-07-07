import { describe, expect, it } from 'vitest';
import { programForBrief } from '../briefProgram';
import type { HouseholdBrief } from '../blueprintTypes';

const brief = (over: Partial<HouseholdBrief>): HouseholdBrief => ({
  homeId: 'b1', trade: 'labourer', worksAtHome: false, wealth: 'common',
  slots: [
    { tag: 'head', role: 'head', ageBand: 'adult' },
    { tag: 'spouse', role: 'spouse', ageBand: 'adult' },
    { tag: 'child:0', role: 'child', ageBand: 'child' },
    { tag: 'child:1', role: 'child', ageBand: 'child' },
    { tag: 'child:2', role: 'child', ageBand: 'child' },
  ],
  ...over,
});

describe('programForBrief', () => {
  it('a smith with three kids: forge demanded, 3 bedrooms (couple, 2 kids, 1 kid)', () => {
    const p = programForBrief('cottage', brief({ trade: 'blacksmith', worksAtHome: true }));
    expect(p.tradeDemands).toEqual([{ purpose: 'forge', streetFacing: true }]);
    expect(p.bedrooms).toEqual([
      { slotTags: ['head', 'spouse'] },
      { slotTags: ['child:0', 'child:1'] },
      { slotTags: ['child:2'] },
    ]);
  });

  it('drops a trade demand the building headline already provides (smithy forge)', () => {
    const p = programForBrief('smithy', brief({ trade: 'blacksmith', worksAtHome: true }));
    // The smithy's HEADLINE purpose is 'forge' (the main room), so the
    // blacksmith's forge demand is redundant — no second forge.
    expect(p.tradeDemands.some((d) => d.purpose === 'forge')).toBe(false);
    expect(p.groundExtra.some((s) => s.purpose === 'forge')).toBe(false);
  });

  it('wealthy household adds solar + servant-room; servants never get bedrooms', () => {
    const p = programForBrief('manor', brief({
      wealth: 'wealthy',
      slots: [
        { tag: 'head', role: 'head', ageBand: 'adult' },
        { tag: 'servant:0', role: 'servant', ageBand: 'adult' },
        { tag: 'servant:1', role: 'servant', ageBand: 'adult' },
      ],
    }));
    expect(p.groundExtra.some((s) => s.purpose === 'solar' && s.min === 1)).toBe(true);
    expect(p.groundExtra.some((s) => s.purpose === 'servant-room' && s.min === 1)).toBe(true);
    expect(p.bedrooms).toEqual([{ slotTags: ['head'] }]);
  });

  it('is pure and RNG-free: identical calls produce identical (deep-equal) output', () => {
    const a = programForBrief('cottage', brief({}));
    const b = programForBrief('cottage', brief({}));
    expect(a).toEqual(b);
  });

  it('counting-room slot is deterministic (min===max===1) for wealthy briefs', () => {
    const p = programForBrief('manor', brief({ wealth: 'wealthy' }));
    const counting = p.groundExtra.find((s) => s.purpose === 'counting-room');
    expect(counting).toEqual({ purpose: 'counting-room', min: 1, max: 1 });
  });
});
