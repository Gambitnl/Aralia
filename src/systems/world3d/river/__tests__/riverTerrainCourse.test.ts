import { describe, expect, it } from 'vitest';
import { rasterizeRiverTerrain } from '../riverTerrainRaster';
import { RiverTerrainCourse } from '../riverTerrainCourse';
import * as THREE from 'three/webgpu';
import { buildWaterfallComparisonLandscape } from '@/components/World3D/water/waterfallComparisonLandscape';
import { TERRAIN_COMPARISON_CASES } from '../waterfallTerrainProfiles';

function quad(x0:number,x1:number,z0:number,z1:number,y:(x:number,z:number)=>number):number[]{
  const p=(x:number,z:number)=>[x,y(x,z),z];return [...p(x0,z0),...p(x1,z0),...p(x1,z1),...p(x0,z0),...p(x1,z1),...p(x0,z1)];
}
describe('native water on rendered terrain',()=>{
  const grid={x0:0,z0:0,dx:.5,nx:12,nz:6};
  it('reads triangle heights and does not detach a steep continuous incline',()=>{
    const r=rasterizeRiverTerrain(quad(0,6,0,3,(x,z)=>30-3*x+.2*z),grid);
    expect(r.heightAt(1.3,1.7)).toBeCloseTo(26.44,11);
    expect(r.bed[0]).toBeCloseTo(29.3,11);
    expect(r.spillFaces).toEqual([]);
  });
  it('detects actual discontinuous ledges rather than every cell height drop',()=>{
    const r=rasterizeRiverTerrain([...quad(0,2.4,0,3,()=>4),...quad(2.4,6,0,3,()=>0)],grid);
    expect(r.spillFaces).toHaveLength(grid.nz);
    expect(r.spillFaces.every(f=>f.axis==='x'&&f.to===f.from+1&&f.from%grid.nx===4)).toBe(true);
  });
  it('retains the uppermost triangle and refuses uncovered bed instead of inventing terrain',()=>{
    const r=rasterizeRiverTerrain([...quad(0,6,0,3,()=>0),...quad(2,4,1,2,()=>5)],grid);
    expect(r.heightAt(3,1.5)).toBe(5);expect(r.heightAt(1,1.5)).toBe(0);
    expect(()=>rasterizeRiverTerrain(quad(0,2,0,3,()=>0),grid)).toThrow('uncovered');
  });
  it('keeps a real cliff when its upper edge falls exactly on a cell center',()=>{
    const r=rasterizeRiverTerrain([...quad(0,2.25,0,3,()=>4),...quad(2.25,6,0,3,()=>0)],grid);
    expect(r.spillFaces).toHaveLength(grid.nz);
    expect(r.spillFaces.every(f=>f.from%grid.nx===4&&f.to===f.from+1)).toBe(true);
  });
  it('draws the stepped reference gap as receiving rock below an exposed lip',()=>{
    const profile=TERRAIN_COMPARISON_CASES.find(p=>p.id==='storfossen')!;
    const material=new THREE.MeshStandardNodeMaterial();
    const mesh=buildWaterfallComparisonLandscape(profile,p=>[p[0],p[1],-p[2]],()=>0,material,0,7);
    const r=rasterizeRiverTerrain(mesh.geometry.getAttribute('position').array,{x0:4,z0:-2,dx:.25,nx:16,nz:16});
    // The high edge ends at x5.3. Immediately beyond it the receiver is about
    // eight meters lower; interpolated rock used to fill this entire interval.
    expect(r.heightAt(5.29,0)!-r.heightAt(5.31,0)!).toBeGreaterThan(7);
    expect(r.heightAt(5.5,0)).toBeCloseTo(56.3,4);
    expect(r.spillFaces.some(f=>f.axis==='x')).toBe(true);
    mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();material.dispose();
  });
  it('carries real native water over a lip, returns it once and retains source-off inventory',()=>{
    const mesh=[...quad(0,2.4,0,3,()=>2),...quad(2.4,6,0,3,()=>0)];
    const run=new RiverTerrainCourse(mesh,grid,[grid.nx+2,2*grid.nx+2,3*grid.nx+2,4*grid.nx+2],[1,0],.3,1);
    expect(run.solver.activeCells).toBeLessThan(grid.nx*grid.nz/2);
    let sawAir=false;
    while(run.solver.time<5){run.step();sawAir ||= run.spill.receipt().airborneVolume>0;}
    expect(sawAir).toBe(true);expect(run.spill.receipt().returnedVolume).toBeGreaterThan(0);
    const inventory=run.solver.totalWetPlusAirVolume(),admitted=run.solver.inVolume;
    run.setSource(false);
    while(run.solver.time<7)run.step();
    expect(run.solver.inVolume).toBe(admitted);
    expect(run.solver.totalWetPlusAirVolume()).toBeGreaterThan(0);
    expect(run.solver.totalWetPlusAirVolume()).toBeLessThanOrEqual(inventory+1e-10);
    expect(Math.abs(run.receipt().closure)).toBeLessThan(1e-10);
  });
});
