import { describe, expect, it } from 'vitest';
import { townBuildingVisit } from '../../../components/Worldforge/townBuildingVisit';
import { buildBuildingMeshData, returnStairBoxes } from '../buildingModels';
import {returnStairCandidates,reserveReturnStair,returnStairPoint} from '../../worldforge/interior/stairLayout';
import type {BlueprintFloor,BlueprintPlan,ReturnStairLayout} from '../../worldforge/interior/blueprintTypes';
import { cellKey } from '../../worldforge/interior/blueprintTypes';

describe('admitted return stair construction', () => {
  it('cuts the whole shaft and meets actual upper floor surfaces', () => {
    const { plan } = townBuildingVisit(1793146029630, 10, 1, undefined, undefined, 1);
    const stair = plan.stairs[0];
    expect(stair.layout).toBeDefined();
    const data = buildBuildingMeshData(plan);
    const upper = data.floors.find(f => f.level === 1)!;
    expect(upper.stairHoleCells.map(c => cellKey(c.cx, c.cy)).sort())
      .toEqual(stair.layout!.shaftCells.map(c => cellKey(c.cx, c.cy)).sort());
    const boxes = returnStairBoxes(stair.layout!, 0);
    expect(boxes.filter(b => b.stairRole === 'tread')).toHaveLength(16);
    expect(boxes.filter(b => b.stairRole === 'riser')).toHaveLength(18);
    const rise = 10 / 18;
    expect(boxes.filter(b => b.stairRole === 'riser').every(b => Math.abs(b.h - rise) < 1e-10)).toBe(true);
    const slabTop = upper.boxes.find(b => b.kind === 'floor')!;
    expect(Math.max(...boxes.filter(b => b.stairRole !== 'rail').map(b => b.z0 + b.h))).toBeCloseTo(slabTop.z0 + slabTop.h);
    expect(boxes.find(b => b.stairRole === 'landing')!.z0 + boxes.find(b => b.stairRole === 'landing')!.h).toBeCloseTo(5.4);
    for (const b of boxes) {
      expect(b.w).toBeGreaterThan(0); expect(b.d).toBeGreaterThan(0); expect(b.h).toBeGreaterThan(0);
      // Positive-thickness construction stays in the shaft, allowing the
      // riser's half-thickness across its shared landing boundary.
      const portalAllowance = b.stairRole === 'rail' ? .12 : .05;
      expect(b.x - b.w / 2).toBeGreaterThanOrEqual(20 - portalAllowance);
      expect(b.x + b.w / 2).toBeLessThanOrEqual(30 + 0.05);
      expect(b.y - b.d / 2).toBeGreaterThanOrEqual(0);
      expect(b.y + b.d / 2).toBeLessThanOrEqual(10);
    }
  });
});


it('builds the wider flights and landing inside the complete six-cell opening',()=>{
 const cells=Array.from({length:36},(_,i)=>({cx:i%6,cy:Math.floor(i/6)}));
 const floors:BlueprintFloor[]=[0,1].map(level=>({level,rooms:[{id:0,purpose:'hall',cells:structuredClone(cells),area:36,anchor:{cx:2,cy:2},bbox:{x:0,y:0,w:30,d:30},isMain:true,isCorridor:false}],
  doors:level===0?[{a:-1,b:0,x:17.5,y:0,axis:'x',isEntry:true,openDir:{nx:0,ny:1},swingInto:0}]:[],windows:[],furnishings:[],walls:[],wallRuns:[]}));
 const layout=returnStairCandidates(cells,floors,1.2).next().value as ReturnStairLayout,point=returnStairPoint(layout,2.5,2.5);
 const plan:BlueprintPlan={buildingId:1,type:'cottage',footprintCells:cells,widthFt:30,depthFt:30,masses:[],floors:reserveReturnStair(floors,layout),stairs:[{fromLevel:0,...point,layout}]};
 const upper=buildBuildingMeshData(plan).floors.find(f=>f.level===1)!;
 expect(upper.stairHoleCells.map(c=>cellKey(c.cx,c.cy)).sort()).toEqual(layout.shaftCells.map(c=>cellKey(c.cx,c.cy)).sort());
 const boxes=returnStairBoxes(layout,0),treads=boxes.filter(b=>b.stairRole==='tread');
 expect(treads).toHaveLength(18);expect(boxes.filter(b=>b.stairRole==='riser')).toHaveLength(20);
 const slab=upper.boxes.find(b=>b.kind==='floor')!;
 expect(Math.max(...boxes.filter(b=>b.stairRole!=='rail').map(b=>b.z0+b.h))).toBeCloseTo(slab.z0+slab.h);
 for(const box of boxes){
  const x=box.x-layout.origin.x,y=box.y-layout.origin.y;
  const u=x*layout.runDir.dx+y*layout.runDir.dy,v=x*layout.acrossDir.dx+y*layout.acrossDir.dy;
  const halfU=(Math.abs(layout.runDir.dx)*box.w+Math.abs(layout.runDir.dy)*box.d)/2;
  const halfV=(Math.abs(layout.acrossDir.dx)*box.w+Math.abs(layout.acrossDir.dy)*box.d)/2;
  expect(u-halfU).toBeGreaterThanOrEqual(-.12);expect(u+halfU).toBeLessThanOrEqual(15+.05);
  expect(v-halfV).toBeGreaterThanOrEqual(0);expect(v+halfV).toBeLessThanOrEqual(10);
 }
});
