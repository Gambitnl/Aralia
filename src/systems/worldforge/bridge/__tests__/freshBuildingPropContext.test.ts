/** New yards follow the resolved home/workplace; existing sources retain their old projection. */
import { describe, expect, it } from 'vitest';
import { freshBuildingPropUse, groundToPlacementContext } from '../groundProps';
import type { GroundWorld } from '../groundChunkLoader';
import type { BlueprintPlan } from '../../interior/blueprintTypes';

type UsePlan = Pick<BlueprintPlan, 'type' | 'household' | 'style'>;
function plan(type: UsePlan['type'], wealth: 'poor' | 'common' | 'wealthy'): UsePlan {
  return {type, style: {wealth, cultureType:'Generic', climate:'temperate', ageBand:'new'}};
}

describe('fresh building prop purpose and household means', () => {
  it.each([
    ['cottage','poor','poor'], ['townhouse','common','house'],
    ['manor','wealthy','house'], ['farmstead','poor','farm'],
    ['smithy','common','smithy'], ['temple','wealthy','temple'],
    ['shrine','common','shrine'], ['granary','common','warehouse'],
    ['lumbermill','common','workshop'], ['shop','common','market'],
    ['keep','wealthy','keep'],
  ] as const)('%s at %s means retains its use as %s', (type, wealth, role) => {
    expect(freshBuildingPropUse(plan(type,wealth))).toEqual({role,wealthy:wealth==='wealthy'});
  });

  it('uses the proprietor household rather than a wealthy workplace district', () => {
    const workplace = plan('smithy','wealthy');
    workplace.household = {homeId:'family-1',slots:[],trade:'smith',worksAtHome:false,wealth:'poor'};
    expect(freshBuildingPropUse(workplace)).toEqual({role:'smithy',wealthy:false});
  });

  it('takes tavern purpose from the building even before economy registration', () => {
    expect(freshBuildingPropUse(plan('tavern','common'))).toEqual({role:'tavern',wealthy:false,businessType:'tavern'});
  });

  it('does not invent wealth, crops or agricultural land when facts are absent', () => {
    expect(freshBuildingPropUse({type:'farmstead'})).toEqual({role:'farm',wealthy:false});
  });

  it('keeps the legacy projection and only consumes resolved use for a new source', () => {
    const ground = {extentMetersX:100,extentMetersZ:100,cols:0,rows:0,
      heights:new Float32Array(),biomeIds:new Uint8Array(),
      buildings:[{id:'wf-plot-1-1',xM:10,zM:10,role:'workshop',propUse:freshBuildingPropUse(plan('smithy','common'))}],
      roads:[],decks:[],gatehouses:[],hiddenSites:[],walls:[],rivers:[],
    } as unknown as GroundWorld;
    const before=JSON.stringify(ground);
    expect(groundToPlacementContext(ground).buildings[0].role).toBe('workshop');
    expect(groundToPlacementContext(ground,undefined,true).buildings[0]).toEqual({id:'wf-plot-1-1',xM:10,zM:10,role:'smithy',businessType:undefined,wealthy:false});
    const businesses = {one:{id:'biz_burg_1_plot_1',businessType:'tavern'}} as unknown as Parameters<typeof groundToPlacementContext>[1];
    expect(groundToPlacementContext(ground,businesses,true).buildings[0].businessType).toBe('tavern');
    expect(JSON.stringify(ground)).toBe(before);
  });
});

// This packet is an identity fixture, not physical farm or tool acceptance.
describe('explicit fresh farm crop context',()=>{
  function fixture():GroundWorld {
    return {extentMetersX:100,extentMetersZ:100,cols:0,rows:0,heights:new Float32Array(),biomeIds:new Uint8Array(),
      buildings:[{id:'wf-plot-7-1000000',xM:10,zM:10,role:'farm',propUse:{role:'farm',wealthy:false}}],
      roads:[],decks:[],gatehouses:[],hiddenSites:[],walls:[],rivers:[],townPlans:[{burgId:7,plan:{plots:[
        {id:1000000,pop:{homeId:'f0',buildingType:'farmstead'}}],ruralSources:{layoutRecipe:'rural-family-v1',
        homesteads:{version:1,sites:[{plotId:1000000,farmId:'f0',farmParcelIndex:3,crop:'flax'}],declined:[]},
        fields:[{farmParcelIndex:3,crop:'flax'}]}}}]} as unknown as GroundWorld;
  }
  it('joins only the explicit source crop without mutating or changing old context',()=>{
    const ground=fixture(),before=JSON.stringify(ground);
    expect(groundToPlacementContext(ground,undefined,true).buildings[0].crop).toBe('flax');
    expect(groundToPlacementContext(ground).buildings[0].crop).toBeUndefined();
    expect(JSON.stringify(ground)).toBe(before);
  });
  it.each(['missing-field','wrong-crop','wrong-home','duplicate-site','duplicate-town'])(
    'declines an ambiguous or inconsistent %s crop join',kind=>{
      const ground=fixture(),town=ground.townPlans![0],sources=town.plan.ruralSources!;
      if(kind==='missing-field')sources.fields=[];
      if(kind==='wrong-crop')sources.fields[0].crop='grain';
      if(kind==='wrong-home')town.plan.plots[0].pop!.homeId='f1';
      if(kind==='duplicate-site')sources.homesteads.sites.push(structuredClone(sources.homesteads.sites[0]));
      if(kind==='duplicate-town')ground.townPlans!.push(structuredClone(town));
      expect(groundToPlacementContext(ground,undefined,true).buildings[0].crop).toBeUndefined();
    });
});
