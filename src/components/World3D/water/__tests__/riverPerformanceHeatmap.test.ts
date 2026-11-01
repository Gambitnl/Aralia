import { describe,expect,it,vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { RiverPerformanceHeatmap,riverHeatmapEstimate,riverHeatmapOpacity } from '../riverPerformanceHeatmap';
vi.mock('@/devtools/perf/rendererProbe',()=>({captureRendererGpu:vi.fn()}));
describe('river drawing-cost heatmap',()=>{
  it('colors consistent savings, not noise, regressions or order artifacts',()=>{
    expect(riverHeatmapEstimate([[8,5],[9,6],[8,5],[9,6]]).savedMs).toBe(3);
    expect(riverHeatmapEstimate([[8,5],[8,11],[8,5],[8,11]]).savedMs).toBeNull();
    expect(riverHeatmapEstimate([[8,8.001],[8,7.999],[8,8],[8,8]]).savedMs).toBeNull();
    expect(riverHeatmapEstimate([[8,9],[8,9],[8,9],[8,9]]).savedMs).toBeNull();
    expect(riverHeatmapEstimate([[NaN,2],[4,2],[4,2],[4,2]]).savedMs).toBeNull();
    expect(riverHeatmapEstimate([[4,2]]).savedMs).toBeNull();
  });
  it('increases red opacity with measured cost and leaves unknown areas clear',()=>{
    expect(riverHeatmapOpacity(null,10)).toBe(0);
    expect(riverHeatmapOpacity(-2,10)).toBe(0);
    expect(riverHeatmapOpacity(1,10)).toBeLessThan(riverHeatmapOpacity(8,10));
    expect(riverHeatmapOpacity(10,10)).toBe(0.62);
    expect(riverHeatmapOpacity(20,10)).toBe(0.62);
  });
  it('restores visible draw objects on an exception and never steps the simulation',()=>{
    const heatmap=new RiverPerformanceHeatmap({} as THREE.WebGPURenderer),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());scene.add(mesh);
    heatmap.setEnabled(true);heatmap.setCamera(camera);heatmap.beginFrame(camera,100,100);
    // A frozen A/B omission only scopes visibility around a native draw.
    const internals=heatmap as unknown as {probing:boolean;hidden:string};internals.probing=true;internals.hidden='patch:0:0';
    expect(()=>heatmap.draw(scene,camera,'terrain',()=>{expect(mesh.visible).toBe(false);throw Error('native error');})).toThrow('native error');
    expect(mesh.visible).toBe(true);heatmap.dispose();mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();
  });
});
