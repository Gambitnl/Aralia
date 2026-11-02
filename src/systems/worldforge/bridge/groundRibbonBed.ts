/** Carry a copied, source-aligned bed window beside
 * ChunkData, so water coverage/depth does not depend on terrain LOD. Existing
 * source heights own the bed; river widths, positions and waterlines are inputs
 * from the existing clipper. Lakes and legacy ribbons retain their owners. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/11/2026, 17:13:32
 * Dependents: systems/world3d/waterGeometry.ts, systems/worldforge/bridge/groundChunkLoader.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {ChunkData} from '../../world3d/types';
import type {GroundWorld} from './groundChunkLoader';
import {GROUND_METERS_PER_CELL} from './groundWorldAdapter';
import {WORLD3D_CONFIG,heightToMeters} from '../../world3d/config';
export interface RibbonBedPatch {
 kind:'ground-ribbon-bed-v1';cx:number;cy:number;
 sourceCols:number;sourceRows:number;spacingM:number;
 originCol:number;originRow:number;cols:number;rows:number;
 source:{artifactSeedPath:string|null;groundShapesJson:string};
 /** Float64 preserves the original JS encoded-height values at wet/dry ties.
  * This buffer is a COPY: worker transfer must never detach source terrain. */
 heights:Float64Array;
}
type CandidateChunk=ChunkData;
const M=WORLD3D_CONFIG.METERS_PER_CELL;
const qualified=(r:ChunkData['rivers'][number])=>r.waterlineY?.length===r.points.length&&r.waterlineY.every(Number.isFinite);

export function attachRibbonBed(ground:GroundWorld,data:ChunkData):CandidateChunk {
 // Native production declares its path even when there is no river. Missing
 // native samples cannot masquerade as a legacy continent or dry chunk.
 const source={artifactSeedPath:ground.artifactSeedPath??null,groundShapesJson:JSON.stringify(ground.groundShapes??[])};
 const native:CandidateChunk={...data,groundRibbonMode:'native-source-bed-v1',groundRibbonSource:source};
 if(data.rivers.some(r=>!qualified(r)))throw Error('Native river waterline unavailable');
 const ribbons=data.rivers.filter(qualified);if(!ribbons.length)return native;
 if(!Number.isSafeInteger(ground.cols)||ground.cols<2||!Number.isSafeInteger(ground.rows)||ground.rows<2||ground.heights.length!==ground.cols*ground.rows)throw Error('Invalid source bed dimensions');
 let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
 for(const r of ribbons){const radius=Math.max(...r.width.map(w=>w*M/2));if(!Number.isFinite(radius)||radius<0)throw Error('Invalid authored ribbon width');for(const p of r.points){if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('Invalid authored ribbon point');minX=Math.min(minX,p.x*M-radius);maxX=Math.max(maxX,p.x*M+radius);minZ=Math.min(minZ,p.y*M-radius);maxZ=Math.max(maxZ,p.y*M+radius);}}
 const clamp=(v:number,max:number)=>Math.max(0,Math.min(max,v));
 const originCol=clamp(Math.floor(minX/GROUND_METERS_PER_CELL),ground.cols-1),originRow=clamp(Math.floor(minZ/GROUND_METERS_PER_CELL),ground.rows-1);
 const cols=clamp(Math.floor(maxX/GROUND_METERS_PER_CELL)+1,ground.cols-1)-originCol+1,rows=clamp(Math.floor(maxZ/GROUND_METERS_PER_CELL)+1,ground.rows-1)-originRow+1;
 // Refuse an unexpectedly unbounded packet rather than silently truncating it.
 // This is a per-chunk safety fence, not a whole-world transport budget.
 if(!Number.isSafeInteger(cols*rows)||cols*rows>1_000_000)throw Error('Source bed packet exceeds per-chunk capacity');
 const heights=new Float64Array(cols*rows);
 for(let z=0;z<rows;z++)for(let x=0;x<cols;x++){const h=ground.heights[(originRow+z)*ground.cols+originCol+x];if(!Number.isFinite(h))throw Error('Nonfinite source bed');heights[z*cols+x]=h;}
 return {...native,groundRibbonBed:{kind:'ground-ribbon-bed-v1',cx:data.cx,cy:data.cy,sourceCols:ground.cols,sourceRows:ground.rows,spacingM:GROUND_METERS_PER_CELL,originCol,originRow,cols,rows,heights,source:{...source}}};
}

export function validateRibbonBed(data:CandidateChunk):void {
 if(data.groundRibbonMode==='legacy-continent'){if(data.groundRibbonBed)throw Error('Legacy path contains native bed');return;}
 if(data.groundRibbonMode!=='native-source-bed-v1'||!data.groundRibbonSource)throw Error('Water source mode unavailable');
 if(data.rivers.some(r=>!qualified(r)))throw Error('Native river waterline unavailable');
 const p=data.groundRibbonBed;if(!p){if(data.rivers.length)throw Error('Native river bed unavailable');return;}
 if(!data.groundRibbonSource||p.source?.artifactSeedPath!==data.groundRibbonSource.artifactSeedPath||p.source?.groundShapesJson!==data.groundRibbonSource.groundShapesJson)throw Error('Mismatched source record labels');
 if(p.cols*p.rows>1_000_000)throw Error('Source bed packet exceeds per-chunk capacity');
 if(p.kind!=='ground-ribbon-bed-v1'||p.cx!==data.cx||p.cy!==data.cy||p.spacingM!==GROUND_METERS_PER_CELL||![p.cols,p.rows,p.sourceCols,p.sourceRows].every(n=>Number.isSafeInteger(n)&&n>0)||![p.originCol,p.originRow].every(n=>Number.isSafeInteger(n)&&n>=0)||p.originCol+p.cols>p.sourceCols||p.originRow+p.rows>p.sourceRows||!(p.heights instanceof Float64Array)||p.heights.length!==p.cols*p.rows||!p.heights.every(Number.isFinite))throw Error('Invalid or mismatched source bed packet');
}

export function ribbonBedHeightAt(data:CandidateChunk,gx:number,gz:number,fallback:()=>number):number {
 const p=data.groundRibbonBed;if(!p)return fallback();
 // Beyond the actual source window, the existing far-shell/edge-drop sampler
 // retains ownership. A clamped copy must not invent a continued canonical bed.
 if(gx*M<0||gz*M<0||gx*M>(p.sourceCols-1)*p.spacingM||gz*M>(p.sourceRows-1)*p.spacingM)return fallback();
 const x=Math.max(0,Math.min(p.sourceCols-1,gx*M/p.spacingM)),z=Math.max(0,Math.min(p.sourceRows-1,gz*M/p.spacingM));
 const x0=Math.floor(x),z0=Math.floor(z),x1=Math.min(p.sourceCols-1,x0+1),z1=Math.min(p.sourceRows-1,z0+1),tx=x-x0,tz=z-z0;
 const h=(c:number,r:number)=>{const i=c-p.originCol,j=r-p.originRow;if(i<0||j<0||i>=p.cols||j>=p.rows)throw Error('Ribbon vertex escapes source bed packet');const value=p.heights[j*p.cols+i];if(!Number.isFinite(value))throw Error('Invalid source bed sample');return value;};
 return heightToMeters((h(x0,z0)*(1-tx)+h(x1,z0)*tx)*(1-tz)+(h(x0,z1)*(1-tx)+h(x1,z1)*tx)*tz);
}
