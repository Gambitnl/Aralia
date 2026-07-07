import { describe, expect, it } from 'vitest';
import { briefFromHousehold, briefForPlot } from '../householdBrief';
import { generateHousehold } from '../household';
import { rootSeedPath } from '../../seedPath';

describe('householdBrief', () => {
  it('slot tags are stable and cover every member', () => {
    const hh = generateHousehold(rootSeedPath(42), 'b7', 5, 'cottage');
    const brief = briefFromHousehold(hh, { wealth: 'common', worksAtHome: false });
    expect(brief.slots.length).toBe(hh.members.length);
    expect(brief.slots[0].tag).toBe('head');
    // tags unique
    expect(new Set(brief.slots.map((s) => s.tag)).size).toBe(brief.slots.length);
    // deterministic
    const again = briefFromHousehold(
      generateHousehold(rootSeedPath(42), 'b7', 5, 'cottage'),
      { wealth: 'common', worksAtHome: false },
    );
    expect(again).toEqual(brief);
  });

  it('wealthy briefs add servant slots; poor briefs never do', () => {
    const hh = generateHousehold(rootSeedPath(1), 'b1', 4, 'townhouse');
    const rich = briefFromHousehold(hh, { wealth: 'wealthy', worksAtHome: false });
    const poor = briefFromHousehold(hh, { wealth: 'poor', worksAtHome: false });
    expect(rich.slots.some((s) => s.role === 'servant')).toBe(true);
    expect(poor.slots.some((s) => s.role === 'servant')).toBe(false);
  });

  it('a workplace plot resolves to the proprietor family with worksAtHome', () => {
    const home = { homeId: 'b1', residential: true, occupants: 4, buildingType: 'cottage',
      district: 'common', workplaceId: 'b2', workRole: 'proprietor',
      polygon: [], frontageEdge: 0 } as never;
    const smithy = { homeId: 'b2', residential: false, occupants: 0, buildingType: 'smithy',
      district: 'common', proprietorHomeId: 'b1', polygon: [], frontageEdge: 0 } as never;
    const brief = briefForPlot(smithy, [home, smithy], rootSeedPath(3));
    expect(brief?.worksAtHome).toBe(true);
    expect(brief?.trade).toBe('blacksmith');
  });
});
