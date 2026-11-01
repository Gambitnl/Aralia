import { describe, expect, it } from 'vitest';
import { resolveBuildingMotion } from '../groundBuildingMotion';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { PropInstance } from '@/systems/worldforge/props/propSchema';

const pile:PropInstance={defId:'woodpile',xM:5,zM:5,rotationRad:0,variation:{scale:1,variant:0},
  retainedSourceId:'prop:woodpile:400:400:0',retainedRenderRecipe:'woodpile-v1',surface:{groundYM:0,sinkM:0,tiltRad:0,tiltAxis:[1,0]}};
const ground=(prop:PropInstance)=>({buildings:[],props:[prop]}) as unknown as GroundWorld;
describe('admitted rendered woodpile walking envelopes',()=>{
  it('sweeps against the six rendered log envelopes instead of allowing passage through fuel',()=>{
    const result=resolveBuildingMotion(ground(pile),{xM:2,zM:5},{xM:8,zM:5},0);
    expect(result.blocked).toBe(true);expect(result.xM).toBeGreaterThan(4);expect(result.xM).toBeLessThan(4.4);
  });
  it('allows a clear route beside the pile and a body above it',()=>{
    expect(resolveBuildingMotion(ground(pile),{xM:2,zM:7},{xM:8,zM:7},0)).toMatchObject({blocked:false,xM:8});
    expect(resolveBuildingMotion(ground(pile),{xM:2,zM:5},{xM:8,zM:5},1.2)).toMatchObject({blocked:false,xM:8});
  });
  it('does not silently solidify unadmitted legacy scenery around existing accepted bodies',()=>{
    expect(resolveBuildingMotion(ground({...pile,retainedRenderRecipe:undefined}),{xM:2,zM:5},{xM:8,zM:5},0).blocked).toBe(false);
  });
  it('turns the actual log envelopes with the retained facing',()=>{
    const turned={...pile,rotationRad:Math.PI/2};
    const result=resolveBuildingMotion(ground(turned),{xM:5,zM:2},{xM:5,zM:8},0);
    expect(result.blocked).toBe(true);expect(result.zM).toBeGreaterThan(4);expect(result.zM).toBeLessThan(4.4);
  });
});
