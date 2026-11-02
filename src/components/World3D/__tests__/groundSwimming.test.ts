// @vitest-environment node
/** Physical swimming checks use source-shaped fixtures only. No fixture moves
 * a campaign body, grants breath, removes a bridge or settles an unsupported
 * saved position. Existing walking and actor separation keep their tests. */
import {describe,it,expect} from 'vitest';
import {sweepActorVolumes,type ActorBody} from '../actorPersonalSpace';
import {resolveGroundSwim,swimTerrainClear,type GroundSwimBody} from '../groundSwimming';
import {groundBodyVolumeClear,type GroundWalkSurfaces} from '../groundBuildingMotion';
import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import {metersToHeight} from '@/systems/world3d/config';
import {GROUND_METERS_PER_CELL} from '@/systems/worldforge/bridge/groundWorldAdapter';
const shape={minXM:-.25,maxXM:.25,minZM:-.2,maxZM:.2,yawRad:0};
const swimmer:GroundSwimBody={heightM:1.5,mouthHeightM:1.3,radiusM:Math.hypot(.25,.2),footprint:shape};
const from={xM:64,yM:-2,zM:64},surface={...from,yM:.8};
const mounted:GroundWalkSurfaces={surfaceHeightsAt:()=>[],intersectsBody:()=>false,supportReadyAt:()=>true};
function world():GroundWorld {const cols=129,rows=129;return {cols,rows,heights:Array(cols*rows).fill(metersToHeight(-2)),biomeIds:Array(cols*rows).fill('plains'),extentMetersX:cols*GROUND_METERS_PER_CELL,extentMetersZ:rows*GROUND_METERS_PER_CELL,
  features:[],props:[],hostiles:[],hiddenSites:[],dungeonEntrances:[],roads:[],walls:[],waterBodies:[],decks:[],gatehouses:[],towns:[],buildings:[],rosters:[],occupants:[],
  rivers:[{sourceKind:'river',points:[{x:10,z:64},{x:120,z:64}],widthM:20,waterlineY:[2,2]}]};}
const actor=(p=from):ActorBody=>({...p,...swimmer});
describe('continuous measured actor volumes',()=>{
  it('detects a thin ceiling between endpoints during vertical ascent',()=>{const other={...actor({xM:64,yM:.1,zM:64}),heightM:.02};expect(sweepActorVolumes(from,surface,actor(),other)).toMatchObject({hit:true,inside:false});});
  it('allows motion below another floor without a planar false collision',()=>{expect(sweepActorVolumes(from,surface,actor(),actor({xM:64,yM:3,zM:64}))).toMatchObject({hit:false});});
  it('allows leaving floor contact without ignoring actual overlap',()=>{const floor={...actor({xM:64,yM:-2.1,zM:64}),heightM:.1};expect(sweepActorVolumes(from,surface,actor(),floor)?.hit).toBe(false);expect(sweepActorVolumes(from,surface,actor(),{...floor,heightM:.2})).toMatchObject({hit:true,inside:true});});
  it('intersects horizontal and vertical time intervals rather than their independent hulls',()=>{const to={xM:68,yM:2,zM:64};const beforeAbove={...actor({xM:64,yM:2,zM:64}),heightM:.1};expect(sweepActorVolumes(from,to,actor(),beforeAbove)?.hit).toBe(false);});
  it('rejects malformed dimensions instead of treating them as empty volume',()=>{expect(sweepActorVolumes(from,surface,actor(),{...actor(),heightM:NaN})).toBeNull();expect(sweepActorVolumes(from,surface,{...actor(),marginM:NaN},actor())).toBeNull();});
});
describe('ordinary swimming movement',()=>{
  it('moves continuously to a breathing stance at twice normal movement cost without altering the world',()=>{const g=world(),before=JSON.stringify(g),r=resolveGroundSwim(g,from,surface,5.6,swimmer,mounted);expect(r).toMatchObject({xM:surface.xM,zM:surface.zM,blocked:false,mouthSubmerged:false});expect(r.yM).toBeCloseTo(surface.yM,10);expect(r.distanceM).toBeCloseTo(2.8);expect(r.spentMovementM).toBeCloseTo(5.6);expect(JSON.stringify(g)).toBe(before);});
  it('spends a partial budget without jumping to the requested height',()=>{const r=resolveGroundSwim(world(),from,surface,1,swimmer,mounted);expect(r.yM).toBeCloseTo(-1.5);expect(r.spentMovementM).toBeCloseTo(1);expect(r.mouthSubmerged).toBe(true);});
  it('uses a separately supplied native swim speed without inventing one',()=>{const r=resolveGroundSwim(world(),from,surface,1,swimmer,mounted,undefined,undefined,'player',true);expect(r.yM).toBeCloseTo(-1);expect(r.spentMovementM).toBeCloseTo(1);});
  it('requires actual source water and mounted structural evidence',()=>{expect(resolveGroundSwim(world(),from,surface,1,swimmer,undefined)).toMatchObject({...from,blocked:true,reason:'unknown-water'});const g=world();delete g.rivers[0].waterlineY;expect(resolveGroundSwim(g,from,surface,1,swimmer,mounted).reason).toBe('unknown-water');});
  it('does not let a swimming mode authorize flying or a dry-ground route',()=>{expect(resolveGroundSwim(world(),from,{...surface,yM:4},20,swimmer,mounted).reason).toBe('above-water');expect(resolveGroundSwim(world(),{...from,zM:100},{...surface,zM:100},20,swimmer,mounted).reason).toBe('shore');});
  it('blocks a mounted bridge slab before the body crosses it',()=>{const bridge={...mounted,intersectsBody:(p:{yM:number},_r:number,h:number)=>p.yM<.12&&p.yM+h>.1};const r=resolveGroundSwim(world(),from,surface,20,swimmer,bridge);expect(r).toMatchObject({blocked:true,reason:'structure'});expect(r.yM+swimmer.heightM).toBeLessThanOrEqual(.1+1e-7);});
  it('keeps source furniture and closed doors solid throughout ascent',()=>{const g=world();g.buildings=[{id:'beam',xM:64,zM:64,cornersM:[{x:62,z:62},{x:66,z:62},{x:66,z:66},{x:62,z:66}],parts:[{x:0,z:0,w:3,d:3,h:.02,baseY:2.1,colorHex:'#654321'}]}] as GroundWorld['buildings'];expect(groundBodyVolumeClear(g,from,surface,actor())).toBe(false);const r=resolveGroundSwim(g,from,surface,20,swimmer,mounted);expect(r.reason).toBe('structure');expect(r.yM+swimmer.heightM).toBeLessThanOrEqual(.1+1e-7);});
  it('checks the full source-bed footprint instead of just the center point',()=>{const g=world();g.heights[42*g.cols+42]=metersToHeight(1);expect(swimTerrainClear(g,from,surface,swimmer)).toBe(false);expect(resolveGroundSwim(g,from,surface,20,swimmer,mounted)).toMatchObject({...from,blocked:true,reason:'terrain',spentMovementM:0});});
  it('checks people along the same three-dimensional segment',()=>{const space=new Map([['npc',actor({xM:64,yM:.2,zM:64})]]);const r=resolveGroundSwim(world(),from,surface,20,swimmer,mounted,undefined,space);expect(r.reason).toBe('person');expect(r.yM+swimmer.heightM).toBeLessThanOrEqual(.2+1e-7);});
  it('does not move an idle accepted pose or grant any breath resource',()=>{const r=resolveGroundSwim(world(),from,surface,0,swimmer,mounted);expect(r).toMatchObject({...from,spentMovementM:0,distanceM:0});expect(r).not.toHaveProperty('breathRemaining');});
});
