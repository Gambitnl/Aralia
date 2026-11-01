import { describe, expect, it } from 'vitest';
import observations from '../../interior/__tests__/fixtures/observedBuildingSources.json';
import yard from './fixtures/nellYardGeometry.json';
import { buildingPlanSignature, readObservedBuildingSource, type ObservedBuildingSource } from '../../interior/buildingSource';
import { metersToHeight } from '../../../world3d/config';
import type { GroundWorld } from '../../bridge/groundChunkLoader';
import { makeGroundWorldProbe, runPropPlacementGate } from '../../bridge/propPlacementGate';
import { propSourceId, type PropInstance } from '../propSchema';
import { exteriorRevisionContext, exteriorRevisionChain, exteriorPropBaseline, freezeExteriorPropRevision,
  propDataSignature, replayExteriorPropRevisions, type ExteriorPropRevision } from '../exteriorPropRevision';
import { proposeExteriorPropRepair } from '../exteriorPropRepair';
import { woodpileShapeV1 } from '../generators/woodpileGeometry';
import { verifyRenderedPropSupport } from '@/components/World3D/groundPropSupport';
import type { RenderedGroundPropBounds } from '@/components/World3D/groundPropGeometry';
import { townReducer } from '@/state/reducers/townReducer';
import type { GameState } from '@/types';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
function rows(props: PropInstance[]): RenderedGroundPropBounds[] {
  return props.map(p => { const shape = woodpileShapeV1(p), radius = Math.max(...shape.triangles.flat().map(v => Math.hypot(v[0], v[2])));
    return { sourceId: propSourceId(p), defId: p.defId, xM: p.xM, zM: p.zM, rotationRad: p.rotationRad,
      scale: p.variation.scale, variant: p.variation.variant, radiusM: radius, minXM: p.xM-radius, maxXM:p.xM+radius,
      minZM:p.zM-radius,maxZM:p.zM+radius,minYM:4.6,maxYM:5.5,pieces:6,vertices:276 }; });
}
function fixture(two = false) {
  const source = { ...clone(observations.poorHome), householdRevision: clone(observations.poorHouseholdRevision) } as unknown as ObservedBuildingSource;
  const original: PropInstance = { ...clone(yard.prop), surface: { ...yard.prop.surface,
    tiltAxis: [yard.prop.surface.tiltAxis[0], yard.prop.surface.tiltAxis[1]] } };
  const resolved = readObservedBuildingSource({ worldSeed: source.worldSeed, burgId: source.burgId, source }, source.plotId, JSON.parse(source.historySignature) ?? undefined);
  const own = `wf-plot-${source.burgId}-${source.plotId}`;
  const buildings = yard.exclusions.filter(x=>x.kind==='building').map(b=>({ id:b.id, cornersM:clone(b.points),
    xM:b.points.reduce((sum,p)=>sum+p.x,0)/b.points.length,zM:b.points.reduce((sum,p)=>sum+p.z,0)/b.points.length,
    blueprintSignature:b.id===own?buildingPlanSignature(resolved.plan):undefined,parts:[],wallWidthM:7.62,wallDepthM:4.572,heightM:3.048,role:'house' }));
  const ground = { cols:2,rows:2,heights:new Array(4).fill(metersToHeight(source.site.surfaceY)),extentMetersX:914.4,extentMetersZ:914.4,
    buildings,roads:[],props:[original,...(two?[{...clone(original),xM:original.xM+.6}]:[])] } as unknown as GroundWorld;
  const position = {tileX:source.cellId,tileY:0,xM:477.353295555244,zM:485.91232295117925,yM:source.site.surfaceY};
  const state = {worldSeed:source.worldSeed,playerCell:{cellId:source.cellId},playerGroundPos:position,
    party:[{id:'nell',name:'Nell'}],gameTime:new Date('0351-01-01T08:26:00.000Z'),
    townSim:{[source.burgId]:{burgId:source.burgId,layoutRevision:2,buildingSources:{[source.plotId]:source},
      buildingEvents:{[source.plotId]:JSON.parse(source.historySignature)}}}} as unknown as GameState;
  return {source,original,ground,state,position};
}
function freeze(f: ReturnType<typeof fixture>, original = f.original, sources = {[f.source.burgId]:{[f.source.plotId]:f.source}}) {
  const neighbours=rows(f.ground.props),ctx=exteriorRevisionContext(f.ground,original,neighbours),probe=makeGroundWorldProbe(f.ground)!;
  const shape=woodpileShapeV1(original);
  const proposal=proposeExteriorPropRepair(original,ctx,{seatCandidate(candidate){
    const gate=runPropPlacementGate([candidate],probe,{surface:'town',groundMutable:false,report:()=>{}});
    return gate.result?.report.passedCount===1&&!gate.result.report.failures.length
      &&verifyRenderedPropSupport(gate.props[0],shape,probe).passed?gate.props[0]:undefined;
  }});
  if(proposal.status!=='proposed')throw Error('No supported fixture site');
  return freezeExteriorPropRevision({source:f.source,ground:f.ground,original,revised:proposal.proposed,captured:shape,neighbours,
    position:f.position,bodyRadiusM:.5,characterSignature:propDataSignature(f.state.party[0]),
    admittedAt:new Date(f.state.gameTime).toISOString(),predecessors:exteriorRevisionChain(f.ground,sources).map(x=>x.receipt.signature)});
}
function sourceWith(f: ReturnType<typeof fixture>, receipt: ExteriorPropRevision) {
  return {...f.source,exteriorPropRevisions:{...f.source.exteriorPropRevisions,[propSourceId(receipt.original)]:receipt}};
}
function resign(r: ExteriorPropRevision) { const {signature:_,...body}=r; r.signature=propDataSignature(body); return r; }

describe('frozen observed-building exterior prop revisions',()=>{
  it('replays the frozen supported object through JSON and preserves the whole original observation',()=>{
    const f=fixture(),before=JSON.stringify(f.source),props=JSON.stringify(f.ground.props),receipt=freeze(f);
    const replay=replayExteriorPropRevisions(f.ground,f.ground.props,{[f.source.burgId]:{[f.source.plotId]:sourceWith(f,clone(receipt))}});
    expect(replay).toEqual([receipt.revised]); expect(propSourceId(replay[0])).toBe(propSourceId(f.original));
    expect(replay[0].retainedRenderRecipe).toBe('woodpile-v1');expect(JSON.stringify(f.source)).toBe(before);
    expect(JSON.stringify(f.ground.props)).toBe(props);expect(receipt.original).toEqual(f.original);
  });
  it('commits only the receipt into TownSim, leaving character, feet and property exact; repeat is a no-op',()=>{
    const f=fixture(),receipt=freeze(f),before=JSON.stringify(f.state);
    const patch=townReducer(f.state,{type:'ADMIT_EXTERIOR_PROP_REVISION',payload:{receipt,ground:f.ground}});
    expect(Object.keys(patch)).toEqual(['townSim']);expect(JSON.stringify(f.state)).toBe(before);
    const next={...f.state,...patch};expect(next.playerGroundPos).toBe(f.state.playerGroundPos);expect(next.party).toBe(f.state.party);
    const retained=clone(next.townSim[f.source.burgId].buildingSources![f.source.plotId]);delete retained.exteriorPropRevisions;
    expect(retained).toEqual(f.source);
    expect(townReducer(next,{type:'ADMIT_EXTERIOR_PROP_REVISION',payload:{receipt,ground:f.ground}})).toEqual({});
  });
  it.each(['position','world','character','history','time'] as const)('refuses stale live %s before committing',kind=>{
    const f=fixture(),receipt=freeze(f);
    if(kind==='position')f.state.playerGroundPos!.xM+=.1;
    if(kind==='world')f.state.worldSeed!++;
    if(kind==='character')f.state.party[0].name='Changed';
    if(kind==='history')f.state.townSim[f.source.burgId].buildingEvents![f.source.plotId]={events:[]} as never;
    if(kind==='time')f.state.gameTime=new Date('0351-01-01T08:27:00.000Z');
    expect(townReducer(f.state,{type:'ADMIT_EXTERIOR_PROP_REVISION',payload:{receipt,ground:f.ground}})).toEqual({});
  });
  it.each(['identity','appearance','source','baseline','support','body','recipe'] as const)('refuses rehashed %s corruption without a fresh fallback',kind=>{
    const f=fixture(),r=clone(freeze(f));
    if(kind==='identity')r.revised.retainedSourceId='prop:woodpile:1:2:3';
    if(kind==='appearance')r.revised.variation.variant++;
    if(kind==='source')r.mountedSignature='changed';
    if(kind==='baseline')r.baselineSignature='changed';
    if(kind==='support')r.revised.surface!.groundYM+=1;
    if(kind==='body')r.position={...r.position,xM:r.revised.xM,zM:r.revised.zM};
    if(kind==='recipe')r.recipe='future-recipe' as never;
    resign(r);
    expect(()=>replayExteriorPropRevisions(f.ground,f.ground.props,{[f.source.burgId]:{[f.source.plotId]:sourceWith(f,r)}})).toThrow();
  });
  it('refuses a stale generated baseline instead of dropping or regenerating accepted property',()=>{
    const f=fixture(),r=freeze(f);
    expect(()=>replayExteriorPropRevisions(f.ground,[...f.ground.props,{...clone(f.original),xM:f.original.xM+10}],{[f.source.burgId]:{[f.source.plotId]:sourceWith(f,r)}})).toThrow('baseline changed');
  });
  it('keeps unrelated far-away prop changes independent of an accepted yard',()=>{
    const f=fixture(),r=freeze(f),far={...clone(f.original),xM:100};
    const replay=replayExteriorPropRevisions(f.ground,[...f.ground.props,far],{[f.source.burgId]:{[f.source.plotId]:sourceWith(f,r)}});
    expect(replay).toEqual([r.revised,far]);
  });
  it('supports ordered independent repairs and reverses a mounted copy for admission preflight',()=>{
    const f=fixture(true),first=freeze(f),firstSource=sourceWith(f,first),sources1={[f.source.burgId]:{[f.source.plotId]:firstSource}};
    const mounted1={...f.ground,props:replayExteriorPropRevisions(f.ground,f.ground.props,sources1)};
    const second=freeze({...f,source:firstSource,ground:mounted1},f.ground.props[1],sources1);
    const sources2={[f.source.burgId]:{[f.source.plotId]:sourceWith({...f,source:firstSource},second)}};
    const mounted2={...f.ground,props:replayExteriorPropRevisions(f.ground,f.ground.props,sources2)};
    expect(mounted2.props).toEqual([first.revised,second.revised]);
    expect(exteriorPropBaseline(mounted2,sources2)).toEqual(f.ground.props);
    expect(exteriorRevisionChain(mounted2,sources2).map(x=>x.receipt.signature)).toEqual([first.signature,second.signature]);
  });
  it('does not accept an altered rendered model merely because its supplied radius is plausible',()=>{
    const f=fixture(),r=freeze(f),shape=woodpileShapeV1(f.original);shape.triangles.pop();
    expect(()=>freezeExteriorPropRevision({source:f.source,ground:f.ground,original:f.original,revised:r.revised,captured:shape,
      neighbours:rows(f.ground.props),position:f.position,bodyRadiusM:.5,characterSignature:'same',admittedAt:r.admittedAt})).toThrow('recipe');
  });
});
