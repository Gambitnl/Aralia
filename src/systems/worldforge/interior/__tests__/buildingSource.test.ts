import {describe, expect, it} from 'vitest';
import {buildingPlanSignature, captureObservedBuildingSource, observedBuildingSourceIsCurrent} from '../buildingSource';
import {generateBuilding} from '../generateBuilding';
import {rootSeedPath} from '../../seedPath';
import {generateHousehold} from '../../town/household';

function fixture() {
  const plan = structuredClone(generateBuilding({buildingId: 35, type: 'inn', seedPath: rootSeedPath(17), storeys: 2}));
  const position = {tileX: 4337, tileY: 0, xM: 434, zM: 432, yM: 6.279};
  const input = {worldSeed: 17, burgId: 675, plotId: 35, cellId: 4337, observedAt: '0351-01-06T23:49:02.000Z',
    position, site: {xM: 436, zM: 434, surfaceY: 3, rotationY: 0, doorZSign: -1},
    historySignature: 'null', plan, workplaceOnly: true,
    household: generateHousehold(rootSeedPath(17), 'home-34', 4, 'townhouse'),
    manifests: [{level: 1, furnishingIndex: 1, kind: 'chest', ownerHomeId: 'home-34', entries: [{itemId: 'silver_piece', qty: 3}]}]};
  return {input, context: {worldSeed: 17, cellId: 4337, position, historySignature: 'null'}};
}

describe('retained observed building source', () => {
  it('retains exact plan, contents, ownership and accepted feet through JSON without claiming historical origin', () => {
    const {input, context} = fixture(), before = structuredClone(input);
    const source = captureObservedBuildingSource(input, buildingPlanSignature(input.plan));
    expect(source.provenance).toBe('observed');
    expect(observedBuildingSourceIsCurrent(JSON.parse(JSON.stringify(source)), context)).toBe(true);
    expect(source.plan).toEqual(before.plan); expect(source.manifests).toEqual(before.manifests);
    expect(source.position).toEqual(before.position); expect(input).toEqual(before);
    input.plan.floors[0].rooms[0].purpose = 'storage'; input.manifests[0].entries[0].qty = 999;
    input.household.members[0].name = 'Changed later';
    expect(source.plan).toEqual(before.plan); expect(source.manifests).toEqual(before.manifests);
    expect(source.household).toEqual(before.household);
  });

  it('refuses absent or changed mounted source instead of capturing a new reconstruction over the played building', () => {
    const {input} = fixture();
    expect(() => captureObservedBuildingSource(input, undefined)).toThrow('rendered building source');
    const mounted = buildingPlanSignature(input.plan); input.plan.widthFt += 5;
    expect(() => captureObservedBuildingSource(input, mounted)).toThrow('rendered building source');
  });

  it('never overwrites the first record and refuses another world, cell, history, altered plan or departed body', () => {
    const {input, context} = fixture(), source = captureObservedBuildingSource(input, buildingPlanSignature(input.plan));
    for (const changed of [{existing: source}, {worldSeed: 99}, {cellId: 1}, {historySignature: 'new'},
      {position: {...context.position, xM: 435}}, {position: null}]) {
      expect(observedBuildingSourceIsCurrent(source, {...context, ...changed})).toBe(false);
    }
    const altered = structuredClone(source); altered.plan.widthFt += 5;
    expect(observedBuildingSourceIsCurrent(altered, context)).toBe(false);
  });

  it('rejects wrong plot identity and nonfinite geometry before JSON can erase their meaning', () => {
    const {input} = fixture(); input.plotId = 36;
    expect(() => captureObservedBuildingSource(input, buildingPlanSignature(input.plan))).toThrow('Invalid observed');
    input.plotId = 35; input.plan.widthFt = NaN;
    expect(() => captureObservedBuildingSource(input, buildingPlanSignature(input.plan))).toThrow('Invalid observed');
  });
});
