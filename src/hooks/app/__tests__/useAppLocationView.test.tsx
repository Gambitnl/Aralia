/** A town's saved keepers remain alive and owned without appearing beside a distant traveler. */
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,renderHook} from '@testing-library/react';
import {createMockGameState} from '../../../utils/core/factories';
import {FEET_PER_FMG_PIXEL} from '../../../systems/worldforge/adapter/atlasArtifact';
import {useAppLocationView} from '../useAppLocationView';
vi.mock('../../../systems/worldforge/bridge/legacySubmapBridge',()=>({getBridgeAtlas:()=>({pack:{cells:{burg:{42:1}},burgs:[null,{i:1,x:10,y:20,population:10}]}})}));
vi.mock('../../../systems/worldforge/local/biomeForCell',()=>({biomeIdForCell:()=> 'forest'}));
afterEach(cleanup);
function state(offset:number){return createMockGameState({
 worldSeed:7,currentLocationId:'cell_42',playerCell:{cellId:42,localeCoords:null},
 atlasGroundAddress:{worldSeed:7,atlasCellId:42,localBounds:{x:10*FEET_PER_FMG_PIXEL-1500+offset,y:20*FEET_PER_FMG_PIXEL-1500,width:3000,height:3000}} as never,
 playerGroundPos:{tileX:42,tileY:0,xM:457.2,zM:457.2,yM:4},
 currentLocationActiveDynamicNpcIds:['source_stranger'],
 generatedNpcs:{keeper:{id:'keeper',name:'Saved Keeper'},source_stranger:{id:'source_stranger',name:'Placed Stranger'}} as never,
 worldBusinesses:{smith:{id:'smith',ownerId:'keeper',burgId:1,businessType:'smithy'}} as never,
});}
describe('accepted Local NPC projection',()=>{
 it('omits remote town keepers without deleting them or suppressing independently placed NPCs',()=>{
  const s=state(10000),before=JSON.stringify(s.generatedNpcs);
  const {result}=renderHook(()=>useAppLocationView(s));
  expect(result.current.getCurrentNPCs().map(n=>n.id)).toEqual(['source_stranger']);
  expect(JSON.stringify(s.generatedNpcs)).toBe(before);
  expect(s.worldBusinesses.smith.ownerId).toBe('keeper');
 });
 it('restores the same saved keeper at accepted town coordinates',()=>{
  const {result}=renderHook(()=>useAppLocationView(state(0)));
  expect(result.current.getCurrentNPCs().map(n=>n.id)).toEqual(['source_stranger','keeper']);
 });
});
