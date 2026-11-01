/** The town marker must reverse the existing town bake's placement, retain
 * accepted footing and refuse a different world, town or ground window. */
import {describe,it,expect,vi} from 'vitest';
import type {GameState} from '../../../../types/state';
import {townMapPosition} from '../townMapPosition';
import {FEET_PER_FMG_PIXEL} from '../../adapter/atlasArtifact';
import {townSpanFtForBurg} from '../canonicalTown';
import {CANON_TOWN_SPAN,POPULATION_RATE,townEnvelopeHalfFtForPeople} from '../townScale';
const {atlas}=vi.hoisted(()=>({atlas:{pack:{burgs:{7:{i:7,cell:5,x:100,y:200,population:1},8:{i:8,cell:6,x:300,y:400,population:1}}}}}));
vi.mock('../../bridge/legacySubmapBridge',()=>({getBridgeAtlas:()=>atlas,getWorldforgeLocalForCell:()=>{throw Error('Retained window should be used');}}));

function fixture():GameState {
 const center=[100*FEET_PER_FMG_PIXEL,200*FEET_PER_FMG_PIXEL];
 const scale=townSpanFtForBurg(atlas as never,7)/CANON_TOWN_SPAN;
 return {worldSeed:42,playerCell:{cellId:5,localeCoords:null},
  playerGroundPos:{tileX:5,tileY:0,xM:(5000+125*scale)*0.3048,zM:(5000-60*scale)*0.3048,yM:4},
  atlasGroundAddress:{worldSeed:42,atlasCellId:5,localBounds:{x:center[0]-5000,y:center[1]-5000,width:10000,height:10000}}} as GameState;
}

describe('accepted town-map footing',()=>{
 it('round-trips real window meters through canonical town placement without changing source state',()=>{
  const state=fixture(),before=JSON.stringify(state),world=JSON.stringify(atlas);
  const result=townMapPosition(state,42,7);
  expect(result?.[0]).toBeCloseTo(125,7);
  expect(result?.[1]).toBeCloseTo(-60,7);
  expect(JSON.stringify(state)).toBe(before);expect(JSON.stringify(atlas)).toBe(world);
 });
 it('does not invent a marker in a standalone preview',()=>expect(townMapPosition(undefined,42,7)).toBeNull());
 it('refuses a different viewed world',()=>expect(townMapPosition(fixture(),99,7)).toBeNull());
 it('refuses a different town rather than moving the marker there',()=>expect(townMapPosition(fixture(),42,8)).toBeNull());
 it('refuses absent accepted feet',()=>{
  const state=fixture();state.playerGroundPos=null;
  expect(townMapPosition(state,42,7)).toBeNull();
 });
 it('refuses a mismatched retained window identity',()=>{
  const state=fixture();state.atlasGroundAddress={...state.atlasGroundAddress!,worldSeed:99};
  expect(townMapPosition(state,42,7)).toBeNull();
 });
 it('refuses invalid footing',()=>{
  const state=fixture();state.playerGroundPos={...state.playerGroundPos!,xM:Number.NaN};
  expect(townMapPosition(state,42,7)).toBeNull();
 });
 it('refuses a wilderness point in the same cell outside the town envelope',()=>{
  const state=fixture(),half=townEnvelopeHalfFtForPeople(POPULATION_RATE);
  state.playerGroundPos={...state.playerGroundPos!,xM:(5000+half+1)*0.3048};
  expect(townMapPosition(state,42,7)).toBeNull();
 });
});
