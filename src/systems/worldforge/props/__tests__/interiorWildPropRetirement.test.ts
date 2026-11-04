/** Legacy wilderness dressing may obstruct a reached Temple. These fixtures
 * exercise retained-source retirement, ordering and refusal; native gameplay
 * separately proves the mounted objects and the safe outside admission. */
import { describe, expect, it } from 'vitest';
import observations from '../../interior/__tests__/fixtures/observedBuildingSources.json';
import { buildingPlanSignature, type ObservedBuildingSource } from '../../interior/buildingSource';
import { blueprintSiteOrigin } from '../../interior/blueprintTypes';
import type { GroundWorld } from '../../bridge/groundChunkLoader';
import { metersToHeight } from '../../../world3d/config';
import type { RenderedGroundPropBounds } from '../groundPropGeometry';
import { propSourceId, type PropInstance } from '../propSchema';
import { exteriorPropBaseline, freezeInteriorWildPropRetirement, isInteriorWildPropCandidate,
  propDataSignature, replayExteriorPropRevisions, type ExteriorPropRevision } from '../exteriorPropRevision';
import { townReducer } from '@/state/reducers/townReducer';
import type { GameState } from '@/types';

const clone = <T>(value:T):T => JSON.parse(JSON.stringify(value));
function fixture() {
  // A synthetic Temple uses a retained fixture's valid room schema. It does
  // not claim to be the production Temple or a new historical observation.
  const source=clone(observations.inn) as unknown as ObservedBuildingSource;
  delete source.circulationRepair; delete source.furnishingRepair;
  source.plan.type='temple'; source.planSignature=buildingPlanSignature(source.plan);
  source.site={xM:100,zM:100,surfaceY:2,rotationY:0,doorZSign:-1};
  const origin=blueprintSiteOrigin(source.plan),cell=source.plan.floors.find(f=>f.level===0)!.rooms[0].cells[0];
  const x=(cell.cx*5+2.5-origin.x)*.3048,z=(cell.cy*5+2.5-origin.y)*.3048;
  const original:PropInstance={defId:'bush',xM:100+x,zM:100+z,rotationRad:.3,variation:{scale:1,variant:2}};
  const second={...clone(original),defId:'boulder',xM:original.xM+.3};
  const outdoor={...clone(original),xM:original.xM+30};
  const ground={cols:2,rows:2,heights:new Array(4).fill(metersToHeight(2)),extentMetersX:914.4,extentMetersZ:914.4,
    roads:[],buildings:[{id:`wf-plot-${source.burgId}-${source.plotId}`,xM:100,zM:100,
      blueprintSignature:source.planSignature,cornersM:[{x:90,z:90},{x:110,z:90},{x:110,z:110},{x:90,z:110}],
      parts:[{x,z,w:1.524,d:1.524,h:.12,baseY:0,walkSurface:'floor'}]}],props:[outdoor,original,second]} as unknown as GroundWorld;
  const position={tileX:source.cellId,tileY:0,xM:70,zM:70,yM:2};
  const state={worldSeed:source.worldSeed,playerCell:{cellId:source.cellId},playerGroundPos:position,
    party:[{id:'fixture',name:'Fixture'}],gameTime:new Date('0351-01-07T08:40:00.000Z'),
    townSim:{[source.burgId]:{burgId:source.burgId,layoutRevision:2,buildingSources:{[source.plotId]:source}}}} as unknown as GameState;
  return {source,ground,original,second,outdoor,position,state};
}
function freeze(f:ReturnType<typeof fixture>,original=f.original,predecessors:string[]=[]) {
  const measured={sourceId:propSourceId(original),defId:original.defId,xM:original.xM,zM:original.zM,
    rotationRad:original.rotationRad,scale:original.variation.scale,variant:original.variation.variant,
    radiusM:1,minXM:original.xM-1,maxXM:original.xM+1,minZM:original.zM-1,maxZM:original.zM+1,
    minYM:2,maxYM:3,pieces:1,vertices:24} as RenderedGroundPropBounds;
  return freezeInteriorWildPropRetirement({source:f.source,ground:f.ground,original,measured,
    position:f.position,bodyRadiusM:.5,characterSignature:propDataSignature(f.state.party[0]),
    admittedAt:new Date(f.state.gameTime).toISOString(),predecessors});
}
function sources(f:ReturnType<typeof fixture>,...receipts:ExteriorPropRevision[]) {
  return {[f.source.burgId]:{[f.source.plotId]:{...f.source,exteriorPropRevisions:Object.fromEntries(receipts.map(r=>[propSourceId(r.original),r]))}}};
}
function resign(r:ExteriorPropRevision) {const {signature:_,...body}=r;r.signature=propDataSignature(body);return r;}

describe('retained Temple interior wilderness props',()=>{
  it('retires only the exact source through JSON, retaining originals and reversing order exactly',()=>{
    const f=fixture(),before=JSON.stringify(f),first=freeze(f),s1=sources(f,first);
    const mounted1={...f.ground,props:replayExteriorPropRevisions(f.ground,f.ground.props,clone(s1))};
    expect(mounted1.props).toEqual([f.outdoor,f.second]);
    const second=freeze({...f,source:s1[f.source.burgId][f.source.plotId],ground:mounted1},f.second,[first.signature]);
    const s2=sources(f,first,second),mounted2={...f.ground,props:replayExteriorPropRevisions(f.ground,f.ground.props,clone(s2))};
    expect(mounted2.props).toEqual([f.outdoor]);expect(exteriorPropBaseline(mounted2,s2)).toEqual(f.ground.props);
    expect(first.original).toEqual(f.original);expect(second.original).toEqual(f.second);
    expect(JSON.stringify(f)).toBe(before);
  });
  it('commits only the retained receipt; accepted feet, party and observed plan remain exact',()=>{
    const f=fixture(),receipt=freeze(f),before=JSON.stringify(f.state);
    const patch=townReducer(f.state,{type:'ADMIT_EXTERIOR_PROP_REVISION',payload:{receipt,ground:f.ground}});
    expect(Object.keys(patch)).toEqual(['townSim']);expect(JSON.stringify(f.state)).toBe(before);
    const next={...f.state,...patch};expect(next.playerGroundPos).toBe(f.position);expect(next.party).toBe(f.state.party);
    expect(next.townSim[f.source.burgId].buildingSources![f.source.plotId].plan).toEqual(f.source.plan);
    expect(townReducer(next,{type:'ADMIT_EXTERIOR_PROP_REVISION',payload:{receipt,ground:f.ground}})).toEqual({});
  });
  it.each(['outdoor','owned','retained','furniture','floor','mounted','other-building'] as const)('refuses %s dressing',kind=>{
    const f=fixture();
    if(kind==='outdoor')f.original.xM+=30;
    if(kind==='owned')f.original.affiliation={} as never;
    if(kind==='retained')f.original.retainedSourceId=propSourceId(f.original);
    if(kind==='furniture')f.original.defId='woodpile';
    if(kind==='floor')f.ground.buildings[0].parts=[];
    if(kind==='mounted')f.ground.buildings[0].blueprintSignature='changed';
    if(kind==='other-building'){f.source.plan.type='inn';f.source.planSignature=buildingPlanSignature(f.source.plan);}
    expect(isInteriorWildPropCandidate(f.source,f.ground,f.original)).toBe(false);
    expect(()=>freeze(f)).toThrow();
  });
  it.each(['appearance','index','baseline','body','bounds','source'] as const)('refuses rehashed %s drift',kind=>{
    const f=fixture(),r=clone(freeze(f));
    if(kind==='appearance')r.revised.variation.variant++;
    if(kind==='index')r.originalIndex=0;
    if(kind==='baseline')r.baselineSignature='changed';
    if(kind==='body')r.position={...r.position,xM:r.original.xM,zM:r.original.zM};
    if(kind==='bounds')r.neighbours[0].radiusM=4;
    if(kind==='source')r.mountedSignature='changed';
    expect(()=>replayExteriorPropRevisions(f.ground,f.ground.props,sources(f,resign(r)))).toThrow();
  });
  it.each(['position','party','time','history'] as const)('refuses stale live %s at admission',kind=>{
    const f=fixture(),receipt=freeze(f);
    if(kind==='position')f.position.xM+=.1;
    if(kind==='party')f.state.party.push(clone(f.state.party[0]));
    if(kind==='time')f.state.gameTime=new Date('0351-01-07T08:41:00.000Z');
    if(kind==='history')f.state.townSim[f.source.burgId].buildingEvents={[f.source.plotId]:{events:[]} as never};
    expect(townReducer(f.state,{type:'ADMIT_EXTERIOR_PROP_REVISION',payload:{receipt,ground:f.ground}})).toEqual({});
  });
});
