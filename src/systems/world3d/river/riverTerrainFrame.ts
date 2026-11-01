/** Rotates a terrain test into its river direction without changing water units.
 * Heights and gravity stay in world meters. Only horizontal coordinates turn;
 * positions, currents, gradients and emitting-face spans must turn together.
 * This does not correct a grid's finite shoreline or cliff-position error.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/10/2026, 07:13:49
 * Dependents: components/World3D/water/riverTerrainCourseView.ts, components/World3D/water/riverWaterMaterial.ts, components/World3D/water/waterfallTerrainComparisonView.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export interface RiverTerrainFrame {
  origin: readonly [number, number];
  xAxis: readonly [number, number];
  zAxis: readonly [number, number];
}
export function createRiverTerrainFrame(origin: readonly [number,number], forward: readonly [number,number]): RiverTerrainFrame {
  if(![...origin,...forward].every(Number.isFinite)||Math.abs(Math.hypot(...forward)-1)>1e-8)throw Error('Terrain frame requires a finite unit direction');
  return {origin:[...origin],xAxis:[...forward],zAxis:[-forward[1],forward[0]]};
}
export function terrainPointToLocal(f:RiverTerrainFrame,p:readonly [number,number,number]):[number,number,number]{
  const x=p[0]-f.origin[0],z=p[2]-f.origin[1];return [x*f.xAxis[0]+z*f.xAxis[1],p[1],x*f.zAxis[0]+z*f.zAxis[1]];
}
export function terrainVectorToWorld(f:RiverTerrainFrame,v:readonly [number,number,number]):[number,number,number]{
  return [f.xAxis[0]*v[0]+f.zAxis[0]*v[2],v[1],f.xAxis[1]*v[0]+f.zAxis[1]*v[2]];
}
export function terrainPointToWorld(f:RiverTerrainFrame,p:readonly [number,number,number]):[number,number,number]{
  const v=terrainVectorToWorld(f,p);return [v[0]+f.origin[0],v[1],v[2]+f.origin[1]];
}
