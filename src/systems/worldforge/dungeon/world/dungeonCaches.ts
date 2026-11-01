/** Source-owned completion of the existing treasure-room intent.
 * Each cache has a fixed floor anchor and its own frozen v1 seed stream. Adding
 * a cache never consumes geometry/history RNG or moves an existing prop or spawn.
 * Old plunder leaves it empty; reaching a room alone never awards its contents. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 16:00:19
 * Dependents: components/BattleMap/dungeon/Dungeon3DPreview.tsx, systems/worldforge/dungeon/world/dungeonObjectActions.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {CellKind,OverlayKind, type Cell, type DungeonPlan, type DungeonProp} from '../types';
import {childSeedPath,rngFromPath} from '../../seedPath';
import type {DungeonIdentity} from './dungeonIdentity';
import {dungeonRoomPlayerCell,dungeonTreasureEventId,dungeonEncounterEventId,dungeonSpawnCell} from './dungeonGameplay';

export interface DungeonCache {
  id:string;
  /** Reuse a pre-existing chest; only rooms without one receive a derived cache prop. */
  existingPropIndex?:number;
  roomId:number;
  cell:Cell;
  label:string;
  plundered:boolean;
  contents:readonly {itemId:string;quantity:number}[];
  prop:DungeonProp;
}

export function dungeonCaches(plan:DungeonPlan,identity:DungeonIdentity):DungeonCache[] {
  return plan.rooms.filter(room=>room.type==='treasure').sort((a,b)=>a.id-b.id).map(room=>{
    const existingPropIndex=plan.props.findIndex(prop=>prop.roomId===room.id&&prop.kind==='chest');
    const existing=existingPropIndex>=0?plan.props[existingPropIndex]:undefined;
    let cell:Cell;
    if(existing)cell={x:Math.floor(existing.x/plan.cellFt),y:Math.floor(existing.y/plan.cellFt)};
    else {
      try {cell=dungeonRoomPlayerCell(plan,room.id);} catch {
        // A wholly collapsed room keeps a buried center instead of relocating its reward to live floor.
        cell={x:Math.floor((room.x+room.w/2)/plan.cellFt),y:Math.floor((room.y+room.h/2)/plan.cellFt)};
      }
    }
    const plundered=plan.history.some(event=>event.kind==='plunder'&&event.roomIds.includes(room.id)) ||
      plan.props.some(prop=>prop.roomId===room.id&&prop.kind==='pried-vault');
    const rng=rngFromPath(childSeedPath(identity.seedPath,`cache:v1:room:${room.id}`));
    return {id:dungeonTreasureEventId(identity,room.id),...(existing?{existingPropIndex}:{}),
      roomId:room.id,cell,label:plan.archetype==='waterworks'?'Maintenance cache':'Old cache',plundered,
      // Freeze this v1 draw: these durable, nonperishable coins predate the current expedition.
      // No fresh food, player-tailored equipment, or unearned monster reward is manufactured.
      contents:plundered?[]:[{itemId:'gold_piece',quantity:rng.nextInt(2,9)}],
      prop:existing??{kind:'chest',x:cell.x*plan.cellFt,y:cell.y*plan.cellFt,rot:0 as const,scale:1.1,roomId:room.id}};
  });
}

/** An occupied or unqualified hazardous chamber cannot be looted through a progress button.
 * Native trap and water resolution remain required before these blocked caches can be secured. */
export function dungeonCacheBlocker(plan:DungeonPlan,identity:DungeonIdentity,cache:DungeonCache,
  clearedEncounterIds:readonly string[]):'buried'|'occupant'|'trap'|'water'|null {
  if(cache.cell.x<0||cache.cell.y<0||cache.cell.x>=plan.W||cache.cell.y>=plan.H||
    plan.grid[cache.cell.y*plan.W+cache.cell.x]!==CellKind.Floor) return 'buried';
  if(plan.spawns.some(spawn=>spawn.roomId===cache.roomId &&
    !clearedEncounterIds.includes(dungeonEncounterEventId(identity,spawn.roomId,dungeonSpawnCell(plan,spawn))))) return 'occupant';
  if(plan.traps.some(trap=>trap.roomId===cache.roomId)) return 'trap';
  if(plan.overlay[cache.cell.y*plan.W+cache.cell.x]===OverlayKind.Water) return 'water';
  return null;
}
