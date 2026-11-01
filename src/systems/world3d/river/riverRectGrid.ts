/** Physical cell geometry for a river grid whose streamwise edges can follow
 * real cliff lips. This changes cell capacity, not water or terrain positions.
 * The default grid retains its original uniform arithmetic. Only rectangular
 * X spacing is supported here; arbitrary oblique cut cells remain separate.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 16/10/2026, 07:56:21
 * Dependents: components/World3D/water/riverSpillView.ts, components/World3D/water/riverWaterMaterial.ts, components/World3D/water/waterfallTerrainComparisonView.ts, systems/world3d/river/riverFlowField.ts, systems/world3d/river/riverSolver.ts, systems/world3d/river/riverSpillTransfer.ts, systems/world3d/river/riverTerrainRaster.ts, systems/world3d/river/riverWaterSheet.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { RiverSolverGrid } from './riverSolver';

export function riverCellWidth(g:RiverSolverGrid,i:number):number{return g.xEdges?g.xEdges[i+1]-g.xEdges[i]:g.dx;}
export function riverCellArea(g:RiverSolverGrid,c:number):number{return riverCellWidth(g,c%g.nx)*g.dx;}
export function riverCellX(g:RiverSolverGrid,i:number):number{return g.xEdges?(g.xEdges[i]+g.xEdges[i+1])*.5:g.x0+(i+.5)*g.dx;}
export function riverEdgeX(g:RiverSolverGrid,i:number):number{return g.xEdges?g.xEdges[i]:g.x0+i*g.dx;}
export function riverIndexX(g:RiverSolverGrid,x:number):number{
  if(!g.xEdges)return Math.floor((x-g.x0)/g.dx);
  const edges=g.xEdges;if(x<edges[0])return -1;if(x>=edges[g.nx])return g.nx;
  let lo=0,hi=g.nx;while(hi-lo>1){const m=(lo+hi)>>1;if(x<edges[m])hi=m;else lo=m;}return lo;
}
export function riverMinimumSpacing(g:RiverSolverGrid):number{
  let min=g.dx;
  if(g.xEdges){
    if(g.xEdges.length!==g.nx+1||g.xEdges[0]!==g.x0||!g.xEdges.every(Number.isFinite))throw Error('Invalid river X edges');
    for(let i=0;i<g.nx;i++){const width=riverCellWidth(g,i);if(!(width>0))throw Error('River X edges must increase');min=Math.min(min,width);}
  }
  return min;
}

/** Fit existing cell faces to measured straight terrain boundaries. Keep the
 * outer footprint and number of cells. Close competing boundaries require a
 * different topology; rejecting them is safer than silently missing a lip. */
export function fitRiverXEdges(g:RiverSolverGrid,targets:readonly number[]):number[]{
  const edges=Array.from({length:g.nx+1},(_,i)=>g.x0+i*g.dx),assigned=new Map<number,number>();
  for(const x of [...targets].sort((a,b)=>a-b)){
    if(!Number.isFinite(x))throw Error('Nonfinite terrain boundary');
    const i=Math.round((x-g.x0)/g.dx);if(i<=0||i>=g.nx)continue;
    const previous=assigned.get(i);
    if(previous!==undefined&&Math.abs(x-previous)>1e-4)throw Error('Competing terrain boundaries require more cells');
    // Float32 world triangles can disagree by micrometers after rotation.
    // Fit the outermost measured edge in that cluster; do not move parcels.
    assigned.set(i,x);edges[i]=x;
  }
  riverMinimumSpacing({...g,xEdges:edges});return edges;
}

/** Exact inverse of the piecewise-linear physical edge map, in cell units.
 * The slope changes also form a compact, texture-free native shader mapping. */
export function riverInverseMapSegments(g:RiverSolverGrid):Array<{x:number;delta:number}>{
  const segments:Array<{x:number;delta:number}>=[];
  for(let i=1;i<g.nx;i++){const delta=1/riverCellWidth(g,i)-1/riverCellWidth(g,i-1);if(delta!==0)segments.push({x:riverEdgeX(g,i),delta});}
  return segments;
}

/** The same four-neighbor wet distance as the native mapper, measured in
 * physical meters when cell widths differ. Stop at its existing 8 m horizon. */
export function riverRectWetDistance(g:RiverSolverGrid,wet:ArrayLike<number>):Float32Array{
  const out=new Float32Array(g.nx*g.nz).fill(8),heap:Array<{c:number;d:number}>=[];
  const push=(c:number,d:number)=>{let k=heap.length;heap.push({c,d});while(k>0){const p=(k-1)>>1;if(heap[p].d<=d)break;heap[k]=heap[p];k=p;}heap[k]={c,d};};
  for(let c=0;c<out.length;c++)if(wet[c]){out[c]=0;push(c,0);}
  while(heap.length){
    const first=heap[0],last=heap.pop()!;
    if(heap.length){let k=0;while(k*2+1<heap.length){let child=k*2+1;if(child+1<heap.length&&heap[child+1].d<heap[child].d)child++;if(heap[child].d>=last.d)break;heap[k]=heap[child];k=child;}heap[k]=last;}
    if(first.d>out[first.c]+1e-6)continue;
    const i=first.c%g.nx,j=Math.floor(first.c/g.nx);
    for(const q of [i>0?first.c-1:-1,i<g.nx-1?first.c+1:-1,j>0?first.c-g.nx:-1,j<g.nz-1?first.c+g.nx:-1]){
      if(q<0)continue;const step=Math.floor(q/g.nx)===j?Math.abs(riverCellX(g,q%g.nx)-riverCellX(g,i)):g.dx,d=first.d+step;
      // Store rounded distances once; using the stored value as the heap key
      // prevents a Float32 round-down from repeatedly re-enqueuing one node.
      const rounded=Math.fround(d);if(rounded<out[q]){out[q]=rounded;push(q,rounded);}
    }
  }
  return out;
}
