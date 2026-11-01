/** Source encounter presentation only: visibility never creates or clears a creature. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 00:16:10
 * Dependents: components/BattleMap/dungeon/Dungeon3DPreview.tsx, components/BattleMap/dungeon/DungeonCreatureFigure.tsx
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {DungeonPlan} from '../../../systems/worldforge/dungeon/types';
import type {DungeonIdentity} from '../../../systems/worldforge/dungeon/world/dungeonIdentity';
import {dungeonCellToScenePosition,dungeonEncounterEventId,dungeonSpawnCell} from '../../../systems/worldforge/dungeon/world/dungeonGameplay';
import type {MonsterData} from '../../../types/ui';
import type {EntityRecipe,SizeCategory} from '../../../systems/entities3d/types';
import {SIZE_ORDER} from '../../../systems/entities3d/creatureProfiles';
import {CreatureType} from '../../../types/creatures';
import {proceduralCreatureAppearance,usesProceduralWater} from '../../../systems/entities3d/creatureAppearance';
import {acceptedByName,recipeForAccepted} from '../../../systems/entities3d/library/acceptedEntities';

export interface DungeonCreatureActor {
  eventId: string;
  monsterKey: string;
  position: {x:number;z:number};
}

/** A procedural aquatic body must never replace an existing approved plan. */
export function usesProceduralDungeonWater(monster:MonsterData):boolean {
  return usesProceduralWater(monster.name,monster.baseStats.creatureTypes?.[0]);
}

/** Remembered ink is intentionally insufficient. Use the current visibility owner,
 * and the exact same stable encounter keys that combat and saved attrition use. */
export function visibleDungeonCreatures(plan:DungeonPlan,identity:DungeonIdentity,
  visibleCellKeys:readonly string[],clearedEncounterIds:readonly string[]):DungeonCreatureActor[] {
  const visible=new Set(visibleCellKeys),cleared=new Set(clearedEncounterIds);
  return plan.spawns.flatMap(spawn=>{
    const cell=dungeonSpawnCell(plan,spawn);
    const eventId=dungeonEncounterEventId(identity,spawn.roomId,cell);
    if(!visible.has(`${cell.x},${cell.y}`)||cleared.has(eventId))return [];
    return [{eventId,monsterKey:spawn.monsterKey,position:dungeonCellToScenePosition(plan,cell)}];
  });
}

/** Preserve approved bodies and source metadata, then reuse the same aquatic
 * appearance policy as combat. This never changes encounter mechanics. */
export function dungeonCreatureRecipe(monster:MonsterData,seed:string):EntityRecipe|null {
  const size=monster.baseStats.size as SizeCategory;
  const creatureType=monster.baseStats.creatureTypes?.[0];
  // Missing source metadata is not permission to invent a Beast or a size.
  if(!creatureType||!SIZE_ORDER.includes(size)||!Object.values(CreatureType).includes(creatureType as CreatureType))return null;
  const approved=acceptedByName(monster.name);
  if(approved)return recipeForAccepted(approved);
  const appearance=proceduralCreatureAppearance(monster.name,creatureType,seed);
  if(appearance)return appearance;
  return {kind:'creature',creatureType,size,seed,
    cues:monster.name.toLowerCase().split(/[\s_-]+/)};
}
