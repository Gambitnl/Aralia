/** Optional connected deformation of the falling water's existing sections.
 * This prescribed experiment moves material during descent. It is not a
 * turbulence solver. The inverse and edge splits share the same physical
 * depth knots, so the polygon keeps its area without a corrective rescale. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/10/2026, 19:14:47
 * Dependents: components/World3D/water/riverWaterfallView.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export type SecondarySectionMap = { scale: number; radius: number; values: readonly [number,number,number] };
export const WATERFALL_SECONDARY = { rows:513, slotsPerEdge:4, axialCellM:2.5, amplitude:0.05, scale:0.12 } as const;
export function secondarySectionMap(width:number,thickness:number,age:number,developed:number,samples:readonly[number,number,number,number]):SecondarySectionMap {
  const growth=developed*(1-Math.exp(-age*age));
  return {scale:1+WATERFALL_SECONDARY.scale*growth*samples[0],radius:Math.max(1e-8,thickness*1.5),
    values:samples.slice(1).map(v=>(v-.5)*2*width*WATERFALL_SECONDARY.amplitude*growth) as unknown as [number,number,number]};
}
export function secondarySectionOffset(y:number,m:SecondarySectionMap):number {
  const z=Math.max(-1,Math.min(1,y/m.radius));
  const values=[0,...m.values,0];const cell=Math.min(3,Math.floor((z+1)*2));
  const t=(z+1)*2-cell;
  return values[cell]*(1-t)+values[cell+1]*t;
}
export function secondarySectionForward(p:readonly[number,number],m:SecondarySectionMap):[number,number] {
  return [m.scale*p[0]+secondarySectionOffset(p[1],m),p[1]/m.scale];
}
export function secondarySectionInverse(p:readonly[number,number],m:SecondarySectionMap):[number,number] {
  const y=p[1]*m.scale;return [(p[0]-secondarySectionOffset(y,m))/m.scale,y];
}
/** Every edge owns four stable slots. Missing crossings collapse locally;
 * they never shift the following edge's indices as the water moves.
 * The caller's ring must stay inside +/-radius: only the three interior
 * slope changes are split. Native section bounds satisfy this condition. */
export function secondarySectionRing(ring:readonly(readonly[number,number])[],m:SecondarySectionMap):[number,number][] {
  return ring.flatMap((a,i)=>{
    const b=ring[(i+1)%ring.length],dy=b[1]-a[1];
    const ts=[-.5,0,.5].map(z=>dy===0?0:Math.max(0,Math.min(1,(z*m.radius-a[1])/dy))).sort((x,y)=>x-y);
    return [0,...ts].map(t=>secondarySectionForward([a[0]+t*(b[0]-a[0]),a[1]+t*dy],m));
  });
}
export function secondaryPolygonMoments(ring:readonly(readonly[number,number])[]) {
  let twice=0,x=0,y=0;
  ring.forEach((a,i)=>{const b=ring[(i+1)%ring.length],w=a[0]*b[1]-b[0]*a[1];twice+=w;x+=(a[0]+b[0])*w;y+=(a[1]+b[1])*w;});
  return {area:Math.abs(twice)/2,centroid:[x/(3*twice),y/(3*twice)] as [number,number]};
}
