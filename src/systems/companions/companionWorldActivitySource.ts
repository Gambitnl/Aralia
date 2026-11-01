/** Resolve new-world public activities from the actual bridge atlas and the
 * existing authored goal site. Kept out of the lightweight rumor/reducer paths:
 * loading or revisiting an old save must not regenerate anyone's life. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 08:33:40
 * Dependents: components/Worldforge/StartPointSelection.tsx, hooks/useGameInitialization.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {getBridgeAtlas} from '@/systems/worldforge/bridge/legacySubmapBridge';
import {enumerateDungeonSites} from '@/systems/worldforge/dungeon/world/dungeonSites';
import {planCompanionWorldActivities,type ActivityTown} from './companionWorldActivities';
import {COMPANIONS} from '@/data/companions';

export function companionActivitiesForNewWorld(worldSeed:number){
 const atlas=getBridgeAtlas(worldSeed);
 const towns=(atlas.pack.burgs as ActivityTown[]).filter(t=>t&&Number.isInteger(t.cell)&&atlas.pack.cells.h[t.cell]>=20);
 const site=enumerateDungeonSites(worldSeed).find(s=>s.authoredGoal?.companionId==='elara_vance'&&s.authoredGoal.goalId==='restore_temple');
 return planCompanionWorldActivities(worldSeed,towns,site?.authoredGoal?{...site.authoredGoal,sitePath:site.sitePath}:undefined);
}

export interface CompanionStartingLead {
 companionId:string; name:string; burgId:number; cellId:number; summary:string;
}

/** The new-game chooser previews the same independent public plans that normal
 * initialization will install. Selection moves only the player; this projection
 * writes no whereabouts, meetings, relationships, goals or party membership. */
export function companionStartingLeadsForNewWorld(worldSeed:number):CompanionStartingLead[] {
 return companionActivitiesForNewWorld(worldSeed).flatMap(activity=>{
  const person=COMPANIONS[activity.companionId];
  return person ? [{companionId:activity.companionId,name:person.identity.name,
   burgId:activity.burgId,cellId:activity.cellId,summary:activity.summary}] : [];
 });
}
