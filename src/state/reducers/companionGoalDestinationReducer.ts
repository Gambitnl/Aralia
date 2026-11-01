/** Asking about a person's public destination records what they disclosed.
 * Preparations, possessions, trust and recruitment keep their existing owners;
 * learning a place does not accept a quest or establish a safe route. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 21:12:40
 * Dependents: state/reducers/companionReducer.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { DiscoveryType, type GameState } from '@/types/state';
import type { CompanionGoalDestination, CompanionGoalDestinationSelection } from '@/types/companions';
import { publicCompanionDestinations } from '@/systems/companions/companionGoalDestinations';
import { generateId } from '@/utils/core/idGenerator';
import { logReducer } from './logReducer';

export function discussCompanionDestination(state: GameState, selection: CompanionGoalDestinationSelection): Partial<GameState> {
  const conversation = state.activeConversation;
  if (!conversation || conversation.pendingResponse || !conversation.isPlayerTurn || selection.worldSeed !== state.worldSeed) return {};
  const match = publicCompanionDestinations(state, selection.companionId)
    .find(entry => entry.goal.id === selection.goalId && entry.site.sitePath === selection.sitePath);
  if (!match) return {};
  const { companion, goal, site, source } = match;
  const now = state.gameTime.getTime();
  const prior = goal.disclosedDestination;
  // Repeat questions preserve the first sharing date and the original memory.
  const alreadyShared = prior?.worldSeed === state.worldSeed && prior.sitePath === site.sitePath && prior.sourceId === source.sourceId;
  const destination: CompanionGoalDestination = alreadyShared ? prior : {
    worldSeed: source.worldSeed, sourceId: source.sourceId, sitePath: site.sitePath, cellId: site.cellId,
    name: source.name, nearbyBurgId: source.nearbyBurgId, nearbyBurgName: source.nearbyBurgName, sharedAt: now,
  };
  const reply = `I intend to restore the ${source.name}, near ${source.nearbyBurgName}. Its undercroft is part of that site. I still need to establish a safe approach. If you want to help, we should agree on what you are taking on first.`;
  const discovery = alreadyShared ? {} : logReducer(state, { type: 'ADD_DISCOVERY_ENTRY', payload: {
    type: DiscoveryType.NPC_INTERACTION, title: `${companion.identity.name}'s destination`, content: reply,
    gameTime: state.gameTime.toISOString(), source: { type: 'NPC', id: companion.id, name: companion.identity.name },
    flags: [{ key: 'companionGoalSource', value: `${source.worldSeed}:${source.sourceId}` }],
    associatedLocationId: `cell_${site.cellId}`,
  } });
  return {
    ...discovery,
    companions: { ...state.companions, [companion.id]: { ...companion,
      goals: alreadyShared ? companion.goals : companion.goals.map(entry => entry.id === goal.id ? { ...entry, disclosedDestination: destination } : entry),
      memories: alreadyShared ? companion.memories : [...companion.memories, {
        id: generateId(), type: 'event', text: `I told ${state.party[0]?.name ?? 'the traveler'} where I intend to go: ${source.name}, near ${source.nearbyBurgName}. Sharing the location was not a promise to undertake the restoration.`,
        tags: ['public-goal-destination', source.sourceId, `world:${source.worldSeed}`], timestamp: now, importance: 7,
      }],
    } },
    activeConversation: { ...conversation, messages: [...conversation.messages,
      { id: generateId(), speakerId: 'player', text: alreadyShared ? 'Remind me where you intend to go.' : 'Where is the temple you intend to restore?', timestamp: now, memoryHandled: true },
      { id: generateId(), speakerId: companion.id, text: reply, timestamp: now, memoryHandled: true },
    ] },
  };
}
