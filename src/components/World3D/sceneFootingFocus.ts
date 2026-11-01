/** Keep nearby people's standing ground precise without moving those people.
 * The scene supplies accepted feet and explicit retained cast positions. This
 * selects render coverage only: it never chooses a physical height or location.
 * A fixed outer window and quantized values bound mesh rebuilds while walking. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 05:41:08
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

type Point = Readonly<{x: number; z: number}>;
export interface SceneFootingFocus {
  centerX: number;
  centerZ: number;
  innerRadius: number;
  outerRadius: number;
}

export function sceneFootingFocus(player: Point, people: readonly Point[], step: number): SceneFootingFocus | undefined {
  const inner = 8, outer = 16, bodyMargin = 2, maximumInner = outer - 2;
  if (![player.x, player.z, step].every(Number.isFinite) || step <= 0 || step > (inner - bodyMargin) * 2) return undefined;
  const snap = (value: number) => Math.round(value / step) * step;
  let minX = player.x, maxX = player.x, minZ = player.z, maxZ = player.z;
  let result: SceneFootingFocus = {centerX:snap(player.x),centerZ:snap(player.z),innerRadius:inner,outerRadius:outer};
  const distance = (point: Point) => Math.max(Math.abs(point.x-player.x),Math.abs(point.z-player.z));
  const nearby = people.filter(point => Number.isFinite(point.x) && Number.isFinite(point.z)
    && distance(point) <= 2 * (maximumInner-bodyMargin)).slice()
    .sort((a,b) => distance(a)-distance(b) || a.x-b.x || a.z-b.z);
  for (const point of nearby) {
    const left = Math.min(minX,point.x), right = Math.max(maxX,point.x);
    const top = Math.min(minZ,point.z), bottom = Math.max(maxZ,point.z);
    const centerX = snap((left+right)/2), centerZ = snap((top+bottom)/2);
    const required = Math.max(centerX-left,right-centerX,centerZ-top,bottom-centerZ)+bodyMargin;
    // Never trade the player's coverage for a distant figure. A person who
    // cannot fit this bounded patch retains their real place for later work.
    if (required > maximumInner) continue;
    minX=left;maxX=right;minZ=top;maxZ=bottom;
    const innerRadius = required <= inner ? inner : Math.min(maximumInner,Math.ceil(required/step)*step);
    result={centerX,centerZ,innerRadius,outerRadius:outer};
  }
  return result;
}
