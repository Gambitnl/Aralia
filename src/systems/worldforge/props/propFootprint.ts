/** Horizontal geometry for first-generation prop siting. Model vertices form
 * an oriented convex hull; concave lots and separate building floor pieces
 * remain separate, so this does not fill an L-shaped home's open corner. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 03:58:01
 * Dependents: systems/worldforge/props/freshPropClearance.ts, systems/worldforge/props/propLandUse.ts, systems/worldforge/props/prospectivePropPlacement.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export interface FootprintPoint { x: number; z: number }
export interface FootprintBounds { minX: number; maxX: number; minZ: number; maxZ: number }
const EPS=1e-9;
const cross=(a:FootprintPoint,b:FootprintPoint,c:FootprintPoint)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
export function footprintBounds(points:readonly FootprintPoint[],gap=0):FootprintBounds {
  return {minX:Math.min(...points.map(p=>p.x))-gap,maxX:Math.max(...points.map(p=>p.x))+gap,
    minZ:Math.min(...points.map(p=>p.z))-gap,maxZ:Math.max(...points.map(p=>p.z))+gap};
}
export function boundsOverlap(a:FootprintBounds,b:FootprintBounds):boolean {
  return a.minX<=b.maxX&&a.maxX>=b.minX&&a.minZ<=b.maxZ&&a.maxZ>=b.minZ;
}
export function validFootprint(points:readonly FootprintPoint[]):boolean {
  return points.length>=3&&points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z))
    &&Math.abs(points.reduce((s,a,i)=>{const b=points[(i+1)%points.length];return s+a.x*b.z-b.x*a.z;},0))>EPS;
}
/** Andrew's monotone chain, on copies. The result encloses every projected
 * model vertex without replacing a long narrow object with a broad circle. */
export function convexFootprint(points:readonly FootprintPoint[]):FootprintPoint[] {
  const sorted=[...new Map(points.map(p=>[`${p.x}:${p.z}`,p])).values()].sort((a,b)=>a.x-b.x||a.z-b.z);
  if(sorted.length<3)return [];
  const half=(input:FootprintPoint[])=>{const out:FootprintPoint[]=[];
    for(const p of input){while(out.length>=2&&cross(out[out.length-2],out[out.length-1],p)<=0)out.pop();out.push({...p});}
    out.pop();return out;};
  return [...half(sorted),...half([...sorted].reverse())];
}
export function pointInsideFootprint(p:FootprintPoint,polygon:readonly FootprintPoint[]):boolean {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)inside=!inside;
  }return inside;
}
function pointSegmentDistance(p:FootprintPoint,a:FootprintPoint,b:FootprintPoint):number {
  const dx=b.x-a.x,dz=b.z-a.z,length2=dx*dx+dz*dz;
  const t=length2?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/length2)):0;
  return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);
}
function segmentsCross(a:FootprintPoint,b:FootprintPoint,c:FootprintPoint,d:FootprintPoint):boolean {
  if(Math.max(a.x,b.x)<Math.min(c.x,d.x)||Math.max(c.x,d.x)<Math.min(a.x,b.x)
    ||Math.max(a.z,b.z)<Math.min(c.z,d.z)||Math.max(c.z,d.z)<Math.min(a.z,b.z))return false;
  const x=cross(a,b,c),y=cross(a,b,d),u=cross(c,d,a),v=cross(c,d,b);
  return ((x<=EPS&&y>=-EPS)||(y<=EPS&&x>=-EPS))&&((u<=EPS&&v>=-EPS)||(v<=EPS&&u>=-EPS));
}
function segmentDistance(a:FootprintPoint,b:FootprintPoint,c:FootprintPoint,d:FootprintPoint):number {
  return segmentsCross(a,b,c,d)?0:Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),
    pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));
}
/** Boundary distance catches edge crossings even when all hull vertices are
 * inside a concave lot. A woodpile cannot bridge across its neighbor's notch. */
export function footprintBoundaryDistance(a:readonly FootprintPoint[],b:readonly FootprintPoint[]):number {
  let distance=Infinity;
  for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){
    distance=Math.min(distance,segmentDistance(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]));
    if(distance===0)return 0;
  }
  return distance;
}
export function footprintDistance(a:readonly FootprintPoint[],b:readonly FootprintPoint[]):number {
  if(a.some(p=>pointInsideFootprint(p,b))||b.some(p=>pointInsideFootprint(p,a)))return 0;
  return footprintBoundaryDistance(a,b);
}
export function footprintRouteDistance(hull:readonly FootprintPoint[],a:FootprintPoint,b:FootprintPoint):number {
  if(pointInsideFootprint(a,hull)||pointInsideFootprint(b,hull))return 0;
  let distance=Infinity;
  for(let i=0;i<hull.length;i++){
    distance=Math.min(distance,segmentDistance(hull[i],hull[(i+1)%hull.length],a,b));
    if(distance===0)return 0;
  }
  return distance;
}
export function footprintFitsLot(hull:readonly FootprintPoint[],lot:readonly FootprintPoint[],gap=.05):boolean {
  return validFootprint(hull)&&validFootprint(lot)&&hull.every(p=>pointInsideFootprint(p,lot))
    &&footprintBoundaryDistance(hull,lot)>=gap;
}
