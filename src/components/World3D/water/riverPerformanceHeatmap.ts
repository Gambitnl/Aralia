/** Measured drawing contributions for the river inspection overlay.
 * Each color comes from paired GPU timestamps of the same frozen draw state.
 * This is net draw cost saved by omission, not a spatial simulation profiler.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 17/10/2026, 12:21:34
 * Dependents: components/DesignPreview/steps/water/RiverScene.tsx, components/World3D/water/RiverDropMenu.tsx, components/World3D/water/riverReachScene.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import { captureRendererGpu } from '@/devtools/perf/rendererProbe';

export interface RiverHeatmapContribution { id: string; label: string; savedMs: number | null; noiseMs: number; samples: number; shared: boolean }
export interface RiverHeatmapReading { enabled: boolean; state: 'off' | 'waiting' | 'scanning' | 'ready' | 'unavailable' | 'error'; completed: number; total: number; measuredAt: number | null; groups: RiverHeatmapContribution[]; message: string }

/** Reject unresolved or order-sensitive differences instead of painting noise. */
export function riverHeatmapEstimate(pairs: ReadonlyArray<readonly [number, number]>): { savedMs: number | null; noiseMs: number } {
  if (pairs.length < 4 || pairs.some(p => p.some(v => !Number.isFinite(v) || v < 0))) return { savedMs: null, noiseMs: 0 };
  const d = pairs.map(([full, omitted]) => full - omitted), mean = d.reduce((a,b)=>a+b,0)/d.length;
  const variance = d.reduce((a,b)=>a+(b-mean)**2,0)/(d.length-1);
  const noiseMs = Math.max(0.03, 3 * Math.sqrt(variance / d.length));
  // Both alternating orders must agree in sign; cache/order artifacts stay unknown.
  const orders = [0,1].map(k=>d.filter((_,i)=>i%2===k).reduce((a,b)=>a+b,0)/(d.length/2));
  return { savedMs: mean > noiseMs && orders.every(v=>v>0) ? mean : null, noiseMs };
}
export function riverHeatmapOpacity(savedMs: number | null, largestMs: number): number {
  return savedMs !== null && savedMs > 0 && largestMs > 0 ? 0.62 * Math.sqrt(Math.min(1, savedMs / largestMs)) : 0;
}
interface Group { id: string; label: string; shared: boolean; meshes: Set<THREE.Mesh>; pairs: Array<[number,number]>; warm: boolean; priority: number; savedMs: number | null; noiseMs: number }

export class RiverPerformanceHeatmap {
  enabled = false;
  private state: RiverHeatmapReading['state'] = 'off';
  private groups = new Map<string, Group>();
  private queue: Group[] = [];
  private signature = '';
  private stableAt = 0;
  private nextAt = 0;
  private pending = false;
  private epoch = 0;
  private measuredAt: number | null = null;
  private message = '';
  private hidden: string | null = null;
  private probing = false;
  private disposed = false;
  private readonly frustum = new THREE.Frustum();
  private readonly projection = new THREE.Matrix4();
  private readonly bounds = new THREE.Box3();
  private readonly center = new THREE.Vector3();
  constructor(private readonly renderer: THREE.WebGPURenderer) {}
  setEnabled(on: boolean): void {
    if (this.enabled === on) return;
    this.enabled = on; this.refresh();
    if (!on) { this.state = 'off'; this.groups.clear(); }
  }
  refresh(): void {
    this.epoch++; this.groups.clear(); this.queue = []; this.signature = ''; this.measuredAt = null;
    this.state = this.enabled ? 'waiting' : 'off'; this.stableAt = performance.now(); this.message = '';
  }
  reading(): RiverHeatmapReading {
    const groups = [...this.groups.values()].map(g=>({ id:g.id,label:g.label,shared:g.shared,savedMs:g.savedMs,noiseMs:g.noiseMs,samples:g.pairs.length }));
    return { enabled:this.enabled,state:this.state,completed:groups.filter(g=>g.samples>=4).length,total:this.queue.length,measuredAt:this.measuredAt,groups,message:this.message };
  }
  beginFrame(camera: THREE.Camera, width: number, height: number): void {
    if (!this.enabled) return;
    const sig = camera.matrixWorld.elements.concat(camera.projectionMatrix.elements).map(v=>v.toFixed(3)).join(',') + ':' + width + ':' + height;
    if (sig !== this.signature) {
      this.refresh(); this.signature = sig;
    }
    this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse), THREE.WebGPUCoordinateSystem);
    // Keep only the current native draw objects, including the ground batch proxies.
    for (const g of this.groups.values()) g.meshes.clear();
  }
  private groupFor(mesh: THREE.Mesh, kind: string): { id: string; label: string; shared: boolean; priority: number } {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    this.bounds.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);
    this.bounds.getCenter(this.center);
    const span = Math.max(this.bounds.max.x-this.bounds.min.x,this.bounds.max.z-this.bounds.min.z);
    const shared = kind === 'water' || (mesh as THREE.InstancedMesh).isInstancedMesh || (mesh.geometry as THREE.InstancedBufferGeometry).isInstancedBufferGeometry || span > 240;
    if (shared) {
      const label = kind==='water' ? 'Water (shared draw)' : (mesh as THREE.InstancedMesh).isInstancedMesh || (mesh.geometry as THREE.InstancedBufferGeometry).isInstancedBufferGeometry ? 'Vegetation / instances (shared draw)' : 'Large terrain / objects (shared draw)';
      return { id:'shared:'+label,label,shared:true,priority:0 };
    }
    const x = Math.floor(this.center.x/160), z = Math.floor(this.center.z/160);
    return { id:'patch:'+x+':'+z,label:'Map patch '+x+', '+z,shared:false,priority:1 };
  }
  /** Called inside groundBatch.draw, after its native proxies have been installed.
   * Omission restores every visibility flag before the native batch scope exits.
   */
  draw(scene: THREE.Scene, camera: THREE.Camera, kind: string, render: () => void): void {
    if (!this.enabled) { render(); return; }
    const hidden: THREE.Mesh[] = [];
    scene.traverseVisible(object=>{
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh) return;
      mesh.updateWorldMatrix(true,false);
      const key = this.groupFor(mesh,kind);
      if (!this.probing && camera === this.mainCamera && this.frustum.intersectsBox(this.bounds)) {
        let group = this.groups.get(key.id);
        if (!group) { group={...key,meshes:new Set(),pairs:[],warm:false,savedMs:null,noiseMs:0}; this.groups.set(key.id,group); }
        group.meshes.add(mesh);
      }
      if (this.probing && key.id === this.hidden) hidden.push(mesh);
    });
    try { for (const mesh of hidden) mesh.visible=false; render(); }
    finally { for (const mesh of hidden) mesh.visible=true; }
  }
  private mainCamera: THREE.Camera | null = null;
  setCamera(camera: THREE.Camera): void { this.mainCamera=camera; }
  /** At most one short A/B pair every 180 ms. No workers, sources, quality or
   * animation are stepped between the two offscreen draws. Output stays intact.
   */
  step(drawFrozen: () => void): void {
    const now = performance.now();
    if (!this.enabled || this.disposed || this.pending || this.state==='ready' || this.state==='unavailable' || this.state==='error' || now < this.nextAt || now-this.stableAt < 750) return;
    if (this.state==='waiting') {
      // Limits scan overhead. Remaining patches remain unmeasured, never green.
      this.queue=[...this.groups.values()].filter(g=>g.meshes.size).sort((a,b)=>a.priority-b.priority).slice(0,18);
      this.state='scanning';
    }
    const group=this.queue.find(g=>g.pairs.length<4);
    if (!group) { this.state='ready'; this.measuredAt=Date.now(); return; }
    this.pending=true; this.nextAt=now+180;
    const epoch=this.epoch, reversed=group.pairs.length%2===1;
    const order: Array<[number,string|null]>=reversed?[[1,group.id],[0,null]]:[[0,null],[1,group.id]];
    void captureRendererGpu(this.renderer,section=>{
      this.probing=true;
      try {
        for (const [id,hidden] of order) { this.hidden=hidden; section(id,drawFrozen); }
        // Restore native offscreen buffers, so depth picking never sees omission.
        this.hidden=null; drawFrozen();
      } finally { this.probing=false; this.hidden=null; }
    }).then(result=>{
      if (this.disposed || !this.enabled || epoch!==this.epoch) return;
      if (!result || !result.has(0) || !result.has(1)) {
        this.state='unavailable'; this.message='GPU timestamps unavailable or busy. No estimated colors are shown.'; return;
      }
      if (!group.warm) { group.warm=true; return; }
      group.pairs.push([result.get(0)!,result.get(1)!]);
      Object.assign(group,riverHeatmapEstimate(group.pairs));
    }).catch(()=>{
      if (epoch===this.epoch && this.enabled) { this.state='error';this.message='Measurement failed. Refresh to retry; the map is unchanged.'; }
    }).finally(()=>{this.pending=false;});
  }
  coloredMeshes(): Array<{ source: THREE.Mesh; alpha: number }> {
    const largest=Math.max(0,...[...this.groups.values()].map(g=>g.savedMs??0));
    const result: Array<{source:THREE.Mesh;alpha:number}>=[];
    for (const g of this.groups.values()) {
      const alpha=riverHeatmapOpacity(g.savedMs,largest);
      if (alpha) for (const source of g.meshes) result.push({source,alpha});
    }
    return result;
  }
  dispose(): void { this.disposed=true;this.setEnabled(false); }
}
