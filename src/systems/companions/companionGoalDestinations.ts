/** Public ambitions can name their existing authored world site. Conversation
 * and its reducer share this lookup so a stale choice cannot attach a goal to
 * another world's temple. Secret ambitions never enter this surface. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 29/10/2026, 05:57:59
 * Dependents: components/ConversationPanel/CompanionGoalDestinationChoices.tsx, components/MapPane.tsx, state/reducers/companionGoalDestinationReducer.ts, systems/companions/companionGoalWork.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState } from '@/types/state';
import { enumerateDungeonSites } from '@/systems/worldforge/dungeon/world/dungeonSites';
import { rumorConversationCompanion } from './companionRumors';

/** A remembered direction remains usable away from its speaker. Return only
 * the shared cell and names: entrance coordinates and secret goals stay out of
 * map knowledge. Catalog drift hides the cue without rewriting saved memory. */
export function learnedCompanionDestinations(state: GameState | undefined) {
  if (!state || !Number.isSafeInteger(state.worldSeed) || state.worldSeed! < 0) return [];
  const sites = enumerateDungeonSites(state.worldSeed!);
  return Object.values(state.companions ?? {}).flatMap(companion => {
    if (!state.metNpcIds?.includes(companion.id)) return [];
    return companion.goals.flatMap(goal => {
      const direction = goal.disclosedDestination;
      if (goal.isSecret || !direction || direction.worldSeed !== state.worldSeed) return [];
      const source = sites.find(site => site.sitePath === direction.sitePath && site.cellId === direction.cellId)?.authoredGoal;
      if (!source || source.worldSeed !== state.worldSeed || source.sourceId !== direction.sourceId
        || source.companionId !== companion.id || source.goalId !== goal.id) return [];
      return [{companionId:companion.id, companionName:companion.identity.name, goalId:goal.id,
        cellId:direction.cellId, name:direction.name, nearbyBurgName:direction.nearbyBurgName}];
    });
  });
}

export function publicCompanionDestinations(state: GameState, companionId: string) {
  const companion = rumorConversationCompanion(state, companionId);
  if (!companion || !Number.isSafeInteger(state.worldSeed) || state.worldSeed! < 0) return [];
  return companion.goals.flatMap(goal => {
    if (goal.isSecret || goal.status !== 'active') return [];
    return enumerateDungeonSites(state.worldSeed!).flatMap(site => {
      const source = site.authoredGoal;
      // A changed catalog cannot rewrite directions this person already gave.
      // Keep that saved knowledge intact until its source is reconciled.
      if (goal.disclosedDestination?.worldSeed === state.worldSeed
        && (goal.disclosedDestination.sitePath !== site.sitePath || goal.disclosedDestination.sourceId !== source?.sourceId)) return [];
      return source?.worldSeed === state.worldSeed && source.companionId === companionId && source.goalId === goal.id
        ? [{ companion, goal, site, source }] : [];
    });
  });
}
