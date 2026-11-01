/** Live landscape brushes keep sparse height offsets over the native terrain.
 * The worker reads its current ground and applies ordered dabs before one
 * bed rebuild per batch. Undo groups every dab of a drag together.
 * This module changes land only; water response remains the solver's job. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 17/10/2026, 03:44:34
 * Dependents: components/DesignPreview/steps/water/RiverLandscapePanel.tsx, components/DesignPreview/steps/water/RiverScene.tsx, components/World3D/water/riverLiveClient.ts, systems/world3d/river/riverLive.ts, systems/world3d/river/riverWorker.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { groundShapeBounds, groundShapeDeltas, validateGroundShape, type GroundShapeKind } from '@/systems/worldforge/terrain/groundShapeProfile';

export type RiverTerrainTool = 'raise' | 'lower' | 'smooth' | 'flatten';
export type RiverTerrainBrushCommand =
  | {kind:'dab';stroke:number;tool:RiverTerrainTool;x:number;z:number;radius:number;strength:number;target?:number}
  | {kind:'finish'} | {kind:'undo'} | {kind:'reset'}
  /**
   * AN EXACT SHAPE (2026-10-25, for spells). Unlike a dab, it sets each cell
   * from its distance to the shape, so overlaps never add up:
   *  - hole: a bowl `depth` m deep, radius `radius` m, at (x, z);
   *  - trench: the same profile along the segment (x, z) to (x2, z2); it
   *    follows the ground less `depth`, so a channel slopes with the land;
   *  - wall: a dam with a level crest at the lowest ground under its core plus
   *    `depth` m (its height); ground already higher (a bank) stays, so the
   *    wall ties into the banks and water ponds to the crest, then spills.
   * The edge eases over the outer quarter of `radius` (steep sides).
   *  - crater (2026-10-29, GG-533): the 3D arena's blast sphere; see
   *    `groundShapeProfile.ts`, which owns every kind (this type takes its list).
   */
  | {kind:'shape';stroke:number;shape:GroundShapeKind;x:number;z:number;x2?:number;z2?:number;radius:number;depth:number};
export interface TerrainBrushBounds {x0:number;z0:number;x1:number;z1:number}
export interface TerrainBrushLayer {
  id:'ground'|'outer';nx:number;nz:number;step:number;x0:number;z0:number;
  /** Current ground at cell centers or outer lattice vertices, not water. */
  heights:ArrayLike<number>;
  /** A batch overlays its earlier dabs while keeping neighbors immutable
   * within each individual smoothing dab. */
  heightAt?:(index:number)=>number;
}
interface Change {layer:TerrainBrushLayer['id'];index:number;before:number}
interface Stroke {id:number;changes:Map<string,Change>;bounds:TerrainBrushBounds|null}
const union=(a:TerrainBrushBounds|null,b:TerrainBrushBounds):TerrainBrushBounds=>a?{
  x0:Math.min(a.x0,b.x0),z0:Math.min(a.z0,b.z0),x1:Math.max(a.x1,b.x1),z1:Math.max(a.z1,b.z1),
}:{...b};
function validate(command:RiverTerrainBrushCommand):void {
  if(command.kind==='shape'){
    validateGroundShape(command);
    if(!Number.isSafeInteger(command.stroke))throw Error('Invalid terrain shape');
    return;
  }
  if(command.kind!=='dab'){
    if(!['finish','undo','reset'].includes(command.kind))throw Error('Invalid terrain brush');
    return;
  }
  if(!['raise','lower','smooth','flatten'].includes(command.tool)
    ||![command.x,command.z,command.radius,command.strength,command.stroke].every(Number.isFinite)
    ||command.radius<=0||command.strength<=0||!Number.isSafeInteger(command.stroke)
    ||(command.tool==='flatten'&&!Number.isFinite(command.target)))throw Error('Invalid terrain brush');
}

export class RiverTerrainBrush {
  private readonly offsets={ground:new Map<number,number>(),outer:new Map<number,number>()};
  private history:Stroke[]=[];
  private active:Stroke|null=null;
  private allBounds:TerrainBrushBounds|null=null;
  /** Keep the latest32 completed drags; older changes remain in the landscape. */
  get undoCount():number{return this.history.length+(this.active?.changes.size?1:0);}
  offset(layer:TerrainBrushLayer['id'],index:number):number{return this.offsets[layer].get(index)??0;}
  private finish():void{
    if(this.active?.changes.size){this.history.push(this.active);if(this.history.length>32)this.history.shift();}
    this.active=null;
  }
  private put(layer:TerrainBrushLayer['id'],index:number,value:number):void{
    if(value===0)this.offsets[layer].delete(index);else this.offsets[layer].set(index,value);
  }
  /** Keep every dab and its neighbor semantics, but defer expensive native
   * terrain rebuilding until the whole ordered batch has been evaluated. */
  applyBatch(commands:readonly RiverTerrainBrushCommand[],layers:readonly TerrainBrushLayer[]):TerrainBrushBounds|null{
    for(const command of commands)validate(command);
    const before={ground:new Map(this.offsets.ground),outer:new Map(this.offsets.outer)};
    const current=layers.map(layer=>({...layer,heightAt:(index:number)=>
      layer.heights[index]+this.offset(layer.id,index)-(before[layer.id].get(index)??0)}));
    let bounds:TerrainBrushBounds|null=null;
    for(const command of commands){const changed=this.apply(command,current);if(changed)bounds=union(bounds,changed);}
    return bounds;
  }
  apply(command:RiverTerrainBrushCommand,layers:readonly TerrainBrushLayer[]):TerrainBrushBounds|null{
    validate(command);
    if(command.kind==='finish'){this.finish();return null;}
    if(command.kind==='undo'){
      this.finish();const previous=this.history.pop();if(!previous)return null;
      for(const c of previous.changes.values())this.put(c.layer,c.index,c.before);
      return previous.bounds;
    }
    if(command.kind==='reset'){
      this.finish();const changes=new Map<string,Change>();
      for(const layer of ['ground','outer'] as const)for(const [index,before] of this.offsets[layer])changes.set(`${layer}:${index}`,{layer,index,before});
      if(!changes.size)return null;
      this.active={id:-1,changes,bounds:this.allBounds};this.offsets.ground.clear();this.offsets.outer.clear();this.finish();return this.allBounds;
    }
    if(command.kind==='shape')return this.applyShape(command,layers);
    const radius=Math.min(60,command.radius),strength=Math.min(5,command.strength);
    const bounds={x0:command.x-radius,z0:command.z-radius,x1:command.x+radius,z1:command.z+radius};
    const updates:Array<{layer:TerrainBrushLayer['id'];index:number;before:number;after:number}>=[];
    // Read every smoothing neighbor from the same unchanged layer. Applying
    // during the scan would push a peak in the scan direction instead of smoothing.
    for(const layer of layers){
      const {nx,nz,step,x0,z0,heights}=layer;
      const read=layer.heightAt??((index:number)=>heights[index]);
      const i0=Math.max(0,Math.ceil((bounds.x0-x0)/step)),i1=Math.min(nx-1,Math.floor((bounds.x1-x0)/step));
      const j0=Math.max(0,Math.ceil((bounds.z0-z0)/step)),j1=Math.min(nz-1,Math.floor((bounds.z1-z0)/step));
      for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
        const index=j*nx+i,h=read(index),distance=Math.hypot(x0+i*step-command.x,z0+j*step-command.z)/radius;
        if(distance>=1||!Number.isFinite(h))continue;
        const t=1-distance,weight=t*t*(3-2*t);let delta:number;
        if(command.tool==='raise'||command.tool==='lower')delta=(command.tool==='raise'?1:-1)*strength*weight;
        else{
          let target=command.target??h;
          if(command.tool==='smooth'){
            let sum=0,count=0;
            for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){
              const ni=i+di,nj=j+dj;if(ni<0||ni>=nx||nj<0||nj>=nz)continue;
              const value=read(nj*nx+ni);if(Number.isFinite(value)){sum+=value;count++;}
            }
            target=count?sum/count:h;
          }
          delta=(target-h)*Math.min(1,strength)*weight;
        }
        if(delta===0)continue;
        const before=this.offset(layer.id,index);updates.push({layer:layer.id,index,before,after:before+delta});
      }
    }
    if(!updates.length)return null;
    if(this.active?.id!==command.stroke){this.finish();this.active={id:command.stroke,changes:new Map(),bounds:null};}
    const active=this.active!;
    for(const update of updates){
      const key=`${update.layer}:${update.index}`;
      if(!active.changes.has(key))active.changes.set(key,{layer:update.layer,index:update.index,before:update.before});
      this.put(update.layer,update.index,update.after);
    }
    active.bounds=union(active.bounds,bounds);this.allBounds=union(this.allBounds,bounds);return bounds;
  }
  /** The exact shapes (see the 'shape' command). Each cell's new height comes
   * from its distance to the shape; the change joins the active stroke. The
   * shape math is the shared `groundShapeDeltas` (agora-257c, 2026-10-29), so
   * the world's ground record cuts the same shape for the same spell. */
  private applyShape(command:Extract<RiverTerrainBrushCommand,{kind:'shape'}>,layers:readonly TerrainBrushLayer[]):TerrainBrushBounds|null{
    const bounds=groundShapeBounds(command);
    const updates:Array<{layer:TerrainBrushLayer['id'];index:number;before:number;after:number}>=[];
    for(const layer of layers){
      const {nx,nz,step,x0,z0,heights}=layer;
      const read=layer.heightAt??((index:number)=>heights[index]);
      for(const [index,delta] of groundShapeDeltas(command,{nx,nz,step,x0,z0,read})){
        const before=this.offset(layer.id,index);updates.push({layer:layer.id,index,before,after:before+delta});
      }
    }
    if(!updates.length)return null;
    if(this.active?.id!==command.stroke){this.finish();this.active={id:command.stroke,changes:new Map(),bounds:null};}
    const active=this.active!;
    for(const update of updates){
      const key=`${update.layer}:${update.index}`;
      if(!active.changes.has(key))active.changes.set(key,{layer:update.layer,index:update.index,before:update.before});
      this.put(update.layer,update.index,update.after);
    }
    active.bounds=union(active.bounds,bounds);this.allBounds=union(this.allBounds,bounds);return bounds;
  }
}
