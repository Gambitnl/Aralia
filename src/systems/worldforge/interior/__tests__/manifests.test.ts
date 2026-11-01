import { describe, it, expect } from 'vitest';
import { rootSeedPath, childSeedPath } from '../../seedPath';
import { generateBuilding } from '../generateBuilding';
import { briefFromHousehold } from '../../town/householdBrief';
import { generateHousehold } from '../../town/household';
import { containerManifests, CONTAINER_KINDS } from '../manifests';
import { ALL_ITEMS } from '../../../../data/items/index';
import { townBuildingVisit } from '@/components/Worldforge/townBuildingVisit';
import { canonicalTownSeedPath } from '../../town/canonicalTown';

function fixture(seed: number) {
  const town = rootSeedPath(seed);
  const homeId = `b${seed}`;
  const occupants = 3 + (seed % 4);
  const household = generateHousehold(town, homeId, occupants, 'townhouse');
  const brief = briefFromHousehold(household, { wealth: 'common', worksAtHome: false });
  const plan = generateBuilding({
    buildingId: seed + 1,
    type: 'townhouse',
    seedPath: town,
    storeys: 2,
    basement: true,
    household: brief,
  });
  // The manifests seed off the same building path the plan was generated from.
  const path = childSeedPath(town, `building:${seed + 1}`);
  return { plan, brief, path };
}

function smithFixture(seed: number) {
  const town = rootSeedPath(seed);
  const homeId = `s${seed}`;
  const household = generateHousehold(town, homeId, 4, 'smithy', {
    role: 'proprietor',
    workplaceType: 'smithy',
  });
  const brief = briefFromHousehold(household, { wealth: 'common', worksAtHome: true });
  const plan = generateBuilding({
    buildingId: seed + 100,
    type: 'smithy',
    seedPath: town,
    storeys: 2,
    household: brief,
  });
  const path = childSeedPath(town, `building:${seed + 100}`);
  return { plan, brief, path };
}

describe('containerManifests', () => {
  it('gives the reached library owned books while preserving every existing goods row and container identity', () => {
    // GG-552 (2026-11-01): the town-look rules re-lay out every NEW town
    // (Remy's ruling q2, layout revision 2). This reached library keeps the
    // layout its save was made with, so it reads layout revision 1.
    const {plan} = townBuildingVisit(1793432134128,40,56,undefined,undefined,1);
    const path = childSeedPath(canonicalTownSeedPath(1793432134128,40),'interior:56');
    const actual = containerManifests(plan,plan.household!,path);
    const previous = containerManifests({...plan,type:'civic'},plan.household!,path);
    let shelves = 0;
    for (const [index,manifest] of actual.entries()) {
      const floor = plan.floors.find(f=>f.level===manifest.level)!;
      const piece = floor.furnishings[manifest.furnishingIndex];
      const study = floor.rooms.find(r=>r.id===piece.roomId)?.purpose==='study';
      expect({...manifest,entries:previous[index].entries}).toEqual(previous[index]);
      if (piece.kind==='shelf' && study) {
        shelves++;
        expect(manifest.entries.slice(0,-1)).toEqual(previous[index].entries);
        expect(manifest.entries.at(-1)?.itemId).toBe('book');
        expect(manifest.entries.at(-1)?.qty).toBeGreaterThanOrEqual(6);
        expect(manifest.entries.at(-1)?.qty).toBeLessThanOrEqual(12);
        expect(ALL_ITEMS.book).toBeDefined();
      } else expect(manifest).toEqual(previous[index]);
    }
    expect(shelves).toBeGreaterThan(0);
    expect(actual).toEqual(containerManifests(plan,plan.household!,path));
  });

  it('every container gets an owned manifest; every itemId resolves in ALL_ITEMS — 25 seeds', () => {
    for (let seed = 0; seed < 25; seed++) {
      const { plan, brief, path } = fixture(seed);
      const ms = containerManifests(plan, brief, path);
      const containers = plan.floors.flatMap((f) =>
        f.furnishings.filter((fu) => CONTAINER_KINDS.has(fu.kind)));
      expect(ms.length).toBe(containers.length);
      for (const m of ms) {
        expect(m.ownerHomeId).toBe(brief.homeId);
        expect(m.entries.length).toBeGreaterThan(0);
        for (const e of m.entries) expect(ALL_ITEMS[e.itemId]).toBeDefined();
      }
    }
  });

  it("a smith's workshop chest holds smith goods; deterministic per path", () => {
    const { plan, brief, path } = smithFixture(3);
    const a = containerManifests(plan, brief, path);
    const b = containerManifests(plan, brief, path);
    expect(a).toEqual(b);
    const forgeFloorIdx = plan.floors.findIndex((f) => f.rooms.some((r) => r.purpose === 'forge'));
    if (forgeFloorIdx >= 0) {
      const forgeRoom = plan.floors[forgeFloorIdx].rooms.find((r) => r.purpose === 'forge')!;
      const forgeManifests = a.filter((m) => {
        const fu = plan.floors[forgeFloorIdx].furnishings[m.furnishingIndex];
        return m.level === plan.floors[forgeFloorIdx].level && fu?.roomId === forgeRoom.id;
      });
      if (forgeManifests.length > 0) {
        const ids = forgeManifests.flatMap((m) => m.entries.map((e) => e.itemId));
        expect(ids.some((id) => id === 'smiths_hammer' || id === 'iron_bar')).toBe(true);
      }
    }
  });
});
