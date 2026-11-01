/** Shared source-creature appearance exceptions for exploration and combat.
 * These plans change presentation only. Approved library bodies keep priority;
 * ordinary Elementals retain their existing Earth body and all mechanics stay source-owned. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 00:16:10
 * Dependents: components/BattleMap/characters/characterActor/CharacterActor.tsx, components/BattleMap/dungeon/dungeonCreatureActors.ts, systems/entities3d/recipeFromCombatant.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {EntityRecipe} from './types';
import {acceptedByName} from './library/acceptedEntities';

export function usesProceduralWater(name:string,creatureType:string|undefined):boolean {
  return creatureType==='Elemental'&&name.trim().toLowerCase()==='water weird'&&!acceptedByName(name);
}

/** Exact source name and family only: a similarly named humanoid is not water. */
export function proceduralCreatureAppearance(name:string,creatureType:string,seed:string):EntityRecipe|null {
  if(!usesProceduralWater(name,creatureType))return null;
  return {
    kind:'planned',seed,
    plan:{
      name,frame:{heightFt:9,lengthFt:7.5,bulk:0.55,stance:'upright'},
      spine:{segments:8,taper:0.6,arch:0.45,mass:[0.8,0.6,1.6]},
      appendages:[],
      heads:[{sizeScale:0.6,eyes:{count:0,sizeScale:0.6}}],
      palette:{bodyHex:'#45b3c8',bellyHex:'#abe3d9',accentHex:'#c4f2ed',eyeHex:'#c4f2ed',opacity:0.72},
      skin:{blend:0.9},
    },
  };

}
