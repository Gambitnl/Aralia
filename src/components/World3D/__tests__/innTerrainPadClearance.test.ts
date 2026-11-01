/** The played Menaikon inn must connect street soil to its real open doorway.
 * This is the saved world's source geometry, never a replacement showcase.
 * Actual walking and rendered reload still qualify the production experience. */
import {beforeAll,describe,expect,it} from 'vitest';
import {getWorldforgeLocalForCell} from '@/systems/worldforge/bridge/legacySubmapBridge';
import {makeGroundWorld,groundSurfaceY,type GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import {siteDoorKey} from '@/systems/worldforge/bridge/sitePartTransform';
import {resolveGroundWalk} from '../groundBuildingMotion';

describe('the played inn terrain pad preserves standing entrance clearance',()=>{
 let ground:GroundWorld;
 beforeAll(()=>{
  const seed=1793146029630;
  const {local,region}=getWorldforgeLocalForCell(seed,4337,{centerPx:[114.73,362.3]});
  ground=makeGroundWorld(local,seed,region,{skipProps:true,anchorCellId:4337,hour:11.3});
 },60000);
 const inn=()=>ground.buildings.find(b=>b.id==='wf-plot-675-10')!;
 const leaf=()=>inn().parts.find(p=>p.door?.level===0)!;
 const from={xM:544.1307073725443,zM:456.8098834229934,yM:3.3914370065594617};
 const to={xM:542.9908512412762,zM:456.18480102841596};
 const opened=()=>new Set([siteDoorKey(inn().id,leaf())]);

 it('lets the measured standing body reach the finished floor through its open source door',()=>{
  const before={...from};
  const result=resolveGroundWalk(ground,from,to,opened(),undefined,1.8531429259165852);
  expect(result.blocked).toBe(false);
  expect(result.xM).toBeCloseTo(to.xM);
  expect(result.zM).toBeCloseTo(to.zM);
  expect(result.yM).toBeCloseTo(groundSurfaceY(ground,inn().xM,inn().zM)+.12192);
  expect(from).toEqual(before);
 });
 it('retains the same building datum, neighbors, leaf and authored headroom',()=>{
  expect(groundSurfaceY(ground,inn().xM,inn().zM)).toBeCloseTo(2.816964684154679,10);
  expect(siteDoorKey(inn().id,leaf())).toBe('wf-plot-675-10/0:3:x:-2.2860:-3.8100');
  expect(leaf().h).toBeCloseTo(2.1336,10);
  expect(leaf().baseY).toBeCloseTo(.12192,10);
  for(const [id,y] of [['wf-plot-675-9',2.816964684154679],['wf-plot-675-127',3.9198731330725156],['wf-plot-675-128',3.9198731330725156]] as const){
   const b=ground.buildings.find(b=>b.id===id)!;
   expect(groundSurfaceY(ground,b.xM,b.zM)).toBeCloseTo(y,10);
  }
 });
 it('still stops at a closed door',()=>{
  expect(resolveGroundWalk(ground,from,to,new Set(),undefined,1.8531429259165852).blocked).toBe(true);
 });
 it('still stops a body taller than the real opening',()=>{
  expect(resolveGroundWalk(ground,from,to,opened(),undefined,2.4).blocked).toBe(true);
 });
});
