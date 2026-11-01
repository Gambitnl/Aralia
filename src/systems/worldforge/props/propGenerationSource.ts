/** Saved exterior sources belong to the existing world state, not a second
 * generator cache. Missing version means legacy; old yards never opt in by
 * loading a newer application. Source checks refuse drift without rerolling. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 03:34:51
 * Dependents: systems/worldforge/bridge/groundChunkLoader.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GroundWorld } from '../bridge/groundChunkLoader';
import type { PropInstance } from './propSchema';
import { propSourceId } from './propSchema';
import type { FreshPropPlacementReport } from './prospectivePropPlacement';
import { fnv1a } from '../seedPath';
import { isPropAffiliation } from './propLandUse';

export type PropGenerationRevision = 1 | 2;
export const CURRENT_PROP_GENERATION_REVISION: PropGenerationRevision = 2;
export interface PropWindowSource {
  version: 2;
  recipe: 'prop-window-v2';
  key: string;
  worldSeed: number;
  cellId: number;
  terrainSignature: string;
  props: PropInstance[];
  report: FreshPropPlacementReport;
  signature: string;
}
export type PropWindowSources = Record<string,PropWindowSource>;
const signature = (value:unknown) => `prop-window-data-v2:${fnv1a(JSON.stringify(value)).toString(36)}`;
export function resolvePropGenerationRevision(value:unknown):PropGenerationRevision {
  if(value===undefined||value===1)return 1;
  if(value===2)return 2;
  throw Error('Unsupported prop generation revision; the saved yard has not been regenerated');
}
export function propWindowKey(ground:GroundWorld,worldSeed:number,cellId:number):string {
  const b=ground.boundsFeet;
  if(!Number.isFinite(worldSeed)||!Number.isInteger(cellId)||!b||![b.x,b.y,ground.extentMetersX,ground.extentMetersZ].every(Number.isFinite))throw Error('Unknown prop window address');
  return `prop-window-v2:${worldSeed}:${cellId}:${b.x}:${b.y}:${ground.extentMetersX}:${ground.extentMetersZ}`;
}
function terrainSignature(ground:GroundWorld):string {
  return signature({cols:ground.cols,rows:ground.rows,heights:Array.from(ground.heights),bounds:ground.boundsFeet,
    extentMetersX:ground.extentMetersX,extentMetersZ:ground.extentMetersZ});
}
export function freezePropWindowSource(ground:GroundWorld,worldSeed:number,cellId:number,
  props:readonly PropInstance[],report:FreshPropPlacementReport):PropWindowSource {
  const body={version:2 as const,recipe:'prop-window-v2' as const,key:propWindowKey(ground,worldSeed,cellId),worldSeed,cellId,
    terrainSignature:terrainSignature(ground),props:structuredClone([...props]),report:structuredClone(report)};
  const source={...body,signature:signature(body)};
  readPropWindowSource(ground,worldSeed,cellId,source);return source;
}
export function readPropWindowSource(ground:GroundWorld,worldSeed:number,cellId:number,source:PropWindowSource):PropInstance[] {
  if(!source||source.version!==2||source.recipe!=='prop-window-v2'||source.key!==propWindowKey(ground,worldSeed,cellId)
    ||source.worldSeed!==worldSeed||source.cellId!==cellId||source.terrainSignature!==terrainSignature(ground))throw Error('Saved prop window source changed; explicit migration is required');
  const {signature:stored,...body}=source;
  const report=source.report;
  if(stored!==signature(body)||!Array.isArray(source.props)||!report||!Array.isArray(report.declined)
    ||![report.considered,report.kept,report.moved].every(value=>Number.isSafeInteger(value)&&value>=0)
    ||report.kept!==source.props.length||report.moved>report.kept
    ||report.considered!==report.kept+report.declined.length
    ||report.declined.some(row=>!row||typeof row.sourceId!=='string'||typeof row.defId!=='string'||typeof row.reason!=='string'
      ||(row.affiliation!==undefined&&!isPropAffiliation(row.affiliation))))throw Error('Invalid saved prop window source');
  const ids=new Set<string>();
  for(const prop of source.props){
    if(!prop||prop.renderRecipe!=='props-v1'||!prop.variation||!prop.surface||!Array.isArray(prop.surface.tiltAxis)
      ||prop.surface.tiltAxis.length!==2||typeof prop.defId!=='string'||!prop.defId
      ||![prop.xM,prop.zM,prop.rotationRad,prop.variation.scale,prop.variation.variant,
      prop.renderScale,prop.renderRadiusM,prop.surface.groundYM,prop.surface.sinkM,prop.surface.tiltRad,...prop.surface.tiltAxis].every(Number.isFinite)
      ||(prop.renderScale??0)<=0||(prop.renderRadiusM??0)<=0||prop.surface.sinkM<0)throw Error('Invalid saved prop art or pose');
    if(prop.affiliation!==undefined&&!isPropAffiliation(prop.affiliation))throw Error('Invalid saved prop affiliation');
    const id=propSourceId(prop);if(ids.has(id))throw Error('Duplicate saved prop identity');ids.add(id);
  }
  // Future reducers apply deliberate deltas/receipts to a copy. They never
  // rewrite the first source while serving it to a renderer or combat reader.
  return structuredClone(source.props);
}
