/** Frames the actual reconstructed land extent in either pane shape.
 * This changes only inspection: the terrain, source and water keep their state.
 * A long fall must not push the eye back onto the last available course point,
 * which cropped Langfossen. The host still applies its native ground clearance.
 * Frustum coverage does not certify that intervening rock is unobstructed. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/10/2026, 22:56:07
 * Dependents: components/World3D/water/waterfallTerrainComparisonView.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

type Point = [number,number,number];
export function fitWaterfallCamera(points:readonly Point[],direction:readonly [number,number],aspect:number,elevationSlope=.48):{pos:Point;look:Point;fov:number} {
  if(!points.length||!Number.isFinite(aspect)||aspect<=0||points.some(p=>p.some(v=>!Number.isFinite(v))))throw Error('Unavailable waterfall camera extent');
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const p of points)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],p[k]);hi[k]=Math.max(hi[k],p[k]);}
  const look=lo.map((v,k)=>(v+hi[k])/2) as Point;
  const radius=Math.max(1,...points.map(p=>Math.hypot(p[0]-look[0],p[1]-look[1],p[2]-look[2])));
  const halfAngle=Math.min(Math.PI/6,Math.atan(Math.tan(Math.PI/6)*aspect));
  // The default retains the existing elevated inspection. A negative slope
  // lets a reference be inspected from its receiving valley, looking up the
  // actual face. The same enclosing sphere still fits every sampled point.
  const distance=1.12*radius/Math.sin(halfAngle),axis=Math.hypot(direction[0],elevationSlope,direction[1]);
  if(!Number.isFinite(axis)||axis===0)throw Error('Unavailable waterfall camera direction');
  return {pos:[look[0]+distance*direction[0]/axis,look[1]+distance*elevationSlope/axis,look[2]+distance*direction[1]/axis],look,fov:60};
}
