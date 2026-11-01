// Plot numbers re-pinned 2026-10-31: the GG-541 road fix redrew the streets of
// towns on a world road (Remy chose to re-lay out every world).
// GG-552 (2026-11-01): the town-look rules re-lay out every NEW town (Remy's
// ruling q2, layout revision 2). This booked inn is a played save, so the
// ground view and registration both read the save's layout revision 1.
const LIFE = {layoutRevision: 1 as const, villagers: {}};
import { describe, expect, it } from 'vitest';
import { getWorldforgeLocalForCell } from '../../bridge/legacySubmapBridge';
import { makeGroundWorld } from '../../bridge/groundChunkLoader';
import { computeBurgMerchants } from '../registerBurgMerchants';

describe('the booked inn keeps its source identity in the ground view', () => {
  it('labels the original fitted inn with the same business name as registration', () => {
    // This is the source frame reached in actual play, not a replacement game.
    const seed = 1793244363464;
    const { local, region } = getWorldforgeLocalForCell(seed, 5608, { centerPx: [390.45, 412.86] });
    const ground = makeGroundWorld(local, seed, region, { skipProps: true, anchorCellId: 5608, townLife: { 3: LIFE } });
    const inn = ground.buildings.find(building => building.id === 'wf-plot-3-120');
    const registered = computeBurgMerchants(seed, 3, 1, {}, {}, LIFE).businesses
      .find(business => business.id === 'biz_burg_3_plot_120');
    expect(registered?.businessType).toBe('tavern');
    expect(registered?.name).toBe('The Laughing Boar');
    expect(inn?.name).toBe(registered?.name);
  }, 60000);

  it('keeps an already registered business name and stock authoritative', () => {
    const seed = 1793244363464;
    const { local, region } = getWorldforgeLocalForCell(seed, 5608, { centerPx: [390.45, 412.86] });
    const registered = computeBurgMerchants(seed, 3, 1, {}, {}, LIFE).businesses
      .find(business => business.id === 'biz_burg_3_plot_120')!;
    const previous = { ...registered, name: 'The Grand Wonders', businessType: 'enchanter_shop' as const };
    const before = JSON.stringify(previous);
    const ground = makeGroundWorld(local, seed, region, {
      skipProps: true, anchorCellId: 5608, townLife: { 3: LIFE }, worldBusinesses: { [previous.id]: previous },
    });
    expect(ground.buildings.find(building => building.id === 'wf-plot-3-120')?.name).toBe(previous.name);
    expect(JSON.stringify(previous)).toBe(before);
  }, 60000);
});
