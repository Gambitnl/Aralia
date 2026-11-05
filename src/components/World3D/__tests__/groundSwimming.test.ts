// @vitest-environment node
/** Physical swimming checks use source-shaped fixtures only. No fixture moves
 * a campaign body, grants breath, removes a bridge or settles an unsupported
 * saved position. Existing walking and actor separation keep their tests. */
import {describe,it,expect} from 'vitest';
import {sweepActorVolumes,type ActorBody} from '../actorPersonalSpace';
import {resolveGroundSwim,swimTerrainClear,type GroundSwimBody} from '../groundSwimming';
import {groundBodyVolumeClear,groundBodyVolumeRecoveryClear,resolveGroundWalk,type GroundWalkSurfaces} from '../groundBuildingMotion';
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
// Captured Elara footprint and solid 611 collision transform, translated to a
// small fixture; the label deliberately makes no claim about the source prop.
const recoveryBody:ActorBody={xM:0,yM:0,zM:0,radiusM:1.1067661386474665,heightM:1.6990186824142461,footprint:{minXM:-.8853124104451738,maxXM:.5356869834219912,minZM:-.22150185704231262,maxZM:.6641936626981464,yawRad:-Math.PI/2}};
function overlapWorld(extraObstacle=false):GroundWorld{
 const g=world();g.heights.fill(metersToHeight(0));
 const yaw=-1.2490457723786217,localX=-.93256,localZ=-1.91544,solidX=-.4205044509338,solidZ=-1.4489428057238;
 const cos=Math.cos(yaw),sin=Math.sin(yaw),buildingX=solidX-(localX*cos+localZ*sin),buildingZ=solidZ-(-localX*sin+localZ*cos);
 const ux=Math.cos(-yaw),uz=Math.sin(-yaw),vx=-uz,vz=ux,half=4;
 const c0={x:buildingX-half*ux-half*vx,z:buildingZ-half*uz-half*vz},c1={x:c0.x+2*half*ux,z:c0.z+2*half*uz},c3={x:c0.x+2*half*vx,z:c0.z+2*half*vz};
 const c2={x:c1.x+2*half*vx,z:c1.z+2*half*vz};
 const furnishing={level:0,roomId:0,index:0,kind:'collision-fixture'};
 const envelope={heightM:3,role:'fixture',wallWidthM:8,wallDepthM:8};
 const parts=[{x:localX,z:localZ,w:1,d:.6,h:.6,baseY:-.12192,furnishing,colorHex:'#654321'}];
 g.buildings=[{...envelope,id:'recovery-fixture',xM:buildingX,zM:buildingZ,cornersM:[c0,c1,c2,c3],parts},
  ...(extraObstacle?[{...envelope,id:'new-obstacle-fixture',xM:0,zM:.8,cornersM:[{x:-4,z:-3.2},{x:4,z:-3.2},{x:4,z:4.8},{x:-4,z:4.8}],parts:[{x:0,z:0,w:1.2,d:.4,h:.6,baseY:0,furnishing,colorHex:'#765432'}]}]:[])];
 return g;
}
describe('continuous measured actor volumes',()=>{
  it('detects a thin ceiling between endpoints during vertical ascent',()=>{const other={...actor({xM:64,yM:.1,zM:64}),heightM:.02};expect(sweepActorVolumes(from,surface,actor(),other)).toMatchObject({hit:true,inside:false});});
  it('allows motion below another floor without a planar false collision',()=>{expect(sweepActorVolumes(from,surface,actor(),actor({xM:64,yM:3,zM:64}))).toMatchObject({hit:false});});
  it('allows leaving floor contact without ignoring actual overlap',()=>{const floor={...actor({xM:64,yM:-2.1,zM:64}),heightM:.1};expect(sweepActorVolumes(from,surface,actor(),floor)?.hit).toBe(false);expect(sweepActorVolumes(from,surface,actor(),{...floor,heightM:.2})).toMatchObject({hit:true,inside:true});});
  it('intersects horizontal and vertical time intervals rather than their independent hulls',()=>{const to={xM:68,yM:2,zM:64};const beforeAbove={...actor({xM:64,yM:2,zM:64}),heightM:.1};expect(sweepActorVolumes(from,to,actor(),beforeAbove)?.hit).toBe(false);});
  it('rejects malformed dimensions instead of treating them as empty volume',()=>{expect(sweepActorVolumes(from,surface,actor(),{...actor(),heightM:NaN})).toBeNull();expect(sweepActorVolumes(from,surface,{...actor(),marginM:NaN},actor())).toBeNull();});
  it('keeps strict volume checks while walking recovery exits measured source overlap monotonically',()=>{
   const g=overlapWorld(),straight={...recoveryBody,zM:.12},diagonal={...recoveryBody,xM:-.08485281374237,zM:.08485281374237};
   expect(groundBodyVolumeClear(g,recoveryBody,recoveryBody,recoveryBody)).toBe(false);
   const straightWalk=resolveGroundWalk(g,recoveryBody,straight,undefined,undefined,recoveryBody.heightM,recoveryBody.radiusM,recoveryBody.footprint);
   const diagonalWalk=resolveGroundWalk(g,recoveryBody,diagonal,undefined,undefined,recoveryBody.heightM,recoveryBody.radiusM,recoveryBody.footprint);
   expect(straightWalk).toMatchObject({blocked:false,onStairs:false,yM:0});expect(diagonalWalk).toMatchObject({blocked:false,onStairs:false,yM:0});
   expect(groundBodyVolumeClear(g,recoveryBody,straightWalk,recoveryBody)).toBe(false);
   expect(groundBodyVolumeClear(g,recoveryBody,diagonalWalk,recoveryBody)).toBe(false);
   expect(groundBodyVolumeClear(g,straightWalk,straightWalk,recoveryBody)).toBe(true);
   expect(groundBodyVolumeClear(g,diagonalWalk,diagonalWalk,recoveryBody)).toBe(true);
   expect(groundBodyVolumeRecoveryClear(g,recoveryBody,straight,recoveryBody)).toBe(true);
   expect(groundBodyVolumeRecoveryClear(g,recoveryBody,diagonal,recoveryBody)).toBe(true);
   const deeper={...recoveryBody,zM:-.05};
   expect(groundBodyVolumeRecoveryClear(g,deeper,{...deeper,zM:.07},deeper)).toBe(true);
   expect(groundBodyVolumeRecoveryClear(g,recoveryBody,{...recoveryBody,zM:-.12},recoveryBody)).toBe(false);
   expect(groundBodyVolumeRecoveryClear(g,recoveryBody,{...recoveryBody,zM:-2},recoveryBody)).toBe(false);
   expect(groundBodyVolumeRecoveryClear(overlapWorld(true),recoveryBody,straight,recoveryBody)).toBe(false);
   expect(groundBodyVolumeRecoveryClear(g,recoveryBody,{...recoveryBody,yM:.1},recoveryBody)).toBe(false);
   expect(groundBodyVolumeRecoveryClear(g,recoveryBody,straight,{...recoveryBody,heightM:NaN})).toBe(false);
  });
});
describe('walking overlap escape boundaries',()=>{
  it('does not combine outward recovery with a floor-height change',()=>{
    expect(groundBodyVolumeRecoveryClear(overlapWorld(),recoveryBody,
      {...recoveryBody,zM:.12,yM:.1},recoveryBody)).toBe(false);
  });
  it('does not use a tiny outward component to cross another face of the solid',()=>{
    expect(groundBodyVolumeRecoveryClear(overlapWorld(),recoveryBody,
      {...recoveryBody,xM:-2,zM:.001},recoveryBody)).toBe(false);
  });
  it('can reduce a deeper existing overlap through several short outward steps',()=>{
    const g=overlapWorld();let current={...recoveryBody,zM:-.05};
    expect(groundBodyVolumeClear(g,current,current,recoveryBody)).toBe(false);
    for(const zM of [-.03,-.01,.01]){
      const next={...current,zM};
      expect(groundBodyVolumeRecoveryClear(g,current,next,recoveryBody)).toBe(true);
      current=next;
    }
    expect(groundBodyVolumeClear(g,current,current,recoveryBody)).toBe(true);
  });
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
