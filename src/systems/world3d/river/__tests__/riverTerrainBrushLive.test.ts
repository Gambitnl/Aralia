/** Native brush edits must reach solver/mapper patches and undo the actual
 * ground without restarting the river or changing its source history. */
import {describe,it,expect,afterEach,vi} from 'vitest';
import {LiveRiver} from '../riverLive';
import {RIVER_SHAPE_DEFAULT,setRiverShape,setRiverCourseEdit} from '../riverReach';
import {setRiverHeadwaters} from '../riverHeadwaters';
afterEach(()=>{setRiverShape(null);setRiverCourseEdit(null);setRiverHeadwaters(false);});
function point(live:LiveRiver){const g=live.grid,i=Math.floor(g.nx*.5),j=Math.floor(g.nz*.85);return {i,j,c:j*g.nx+i,x:g.x0+(i+.5)*g.dx,z:g.z0+(j+.5)*g.dx};}
describe('native live landscape patches',()=>{
 it('commits many dabs as one native rebuild and returns their full height and one undo',()=>{
  const live=new LiveRiver();live.startCold();const p=point(live),before=live.ground[p.c],apply=vi.spyOn(live,'applyEdit');
  const commands=Array.from({length:12},()=>({kind:'dab' as const,stroke:3,tool:'raise' as const,x:p.x,z:p.z,radius:3,strength:.1}));
  const result=live.applyTerrainBrushBatch([...commands,{kind:'finish'}]);
  expect(apply).toHaveBeenCalledTimes(1);expect(live.ground[p.c]).toBeCloseTo(before+1.2,12);
  expect(result.patch?.ground).toBeInstanceOf(Float32Array);expect(result.undoCount).toBe(1);
  live.applyTerrainBrush({kind:'undo'});expect(live.ground[p.c]).toBe(before);
 },60000);
 it('raises native ground and returns a matching drawing patch, then undoes exactly',()=>{
  const live=new LiveRiver();live.startCold();const p=point(live),before=live.ground[p.c],bed=live.solver.bed[p.c],time=live.simTime,source=JSON.stringify(live.flood.source);
  const result=live.applyTerrainBrush({kind:'dab',stroke:1,tool:'raise',x:p.x,z:p.z,radius:3,strength:.5});
  expect(live.ground[p.c]).toBe(before+.5);expect(result.patch?.box).not.toBeNull();
  const patch=result.patch!,b=patch.box!,q=(p.j-b.j0)*(b.i1-b.i0+1)+p.i-b.i0;
  expect(patch.ground![q]).toBe(Math.fround(live.ground[p.c]));expect(live.solver.bed[p.c]).toBeGreaterThanOrEqual(live.ground[p.c]);
  live.applyTerrainBrush({kind:'finish'});const undo=live.applyTerrainBrush({kind:'undo'});
  expect(undo.undoCount).toBe(0);expect(live.ground[p.c]).toBe(before);expect(live.solver.bed[p.c]).toBe(bed);
  expect(live.simTime).toBe(time);expect(JSON.stringify(live.flood.source)).toBe(source);
 },60000);
 it('retains painted terrain through ordinary shape updates and can clear it independently',()=>{
  const live=new LiveRiver();live.startCold();const p=point(live),before=live.ground[p.c];
  live.applyTerrainBrush({kind:'dab',stroke:2,tool:'lower',x:p.x,z:p.z,radius:3,strength:.75});live.applyTerrainBrush({kind:'finish'});
  live.applyEdit({shape:{...RIVER_SHAPE_DEFAULT,widthScale:1.1},course:null});live.applyEdit({shape:RIVER_SHAPE_DEFAULT,course:null});
  expect(live.ground[p.c]).toBe(before-.75);
  live.applyTerrainBrush({kind:'reset'});expect(live.ground[p.c]).toBe(before);
  live.applyTerrainBrush({kind:'undo'});expect(live.ground[p.c]).toBe(before-.75);
 },60000);
});
