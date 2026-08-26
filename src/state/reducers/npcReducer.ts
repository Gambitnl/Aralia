// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 10:36:36
 * Dependents: state/appState.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/state/reducers/npcReducer.ts
 * A slice reducer that handles NPC memory state changes.
 */
import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
import { recordEmotionalMarker, pruneEmotionalMarkers } from '../../systems/social/npcEmotionalMemory';
import { applyWitnessedAct, pruneWitnessedActs } from '../../systems/social/npcWitnessMemory';
import {
  buildPropagationRoster,
  duePropagatedFacts,
  isPropagatableFact,
  propagateFact,
  PropagationNpc,
} from '../../systems/memory/factPropagation';
import { NPCS } from '../../data/world/npcs';
import { LOCATIONS } from '../../data/world/locations';
import { getGameDay } from '../../utils/core';
import { createEmptyMemory } from '../../utils/world/memoryUtils';

/**
 * Builds the propagation roster from whatever this save actually contains:
 * authored NPCs/locations plus the runtime-generated ones. Kept local to the
 * reducer so `factPropagation` itself stays free of store and data imports.
 */
function rosterFromState(state: GameState): PropagationNpc[] {
  return buildPropagationRoster({
    npcs: { ...NPCS, ...(state.dynamicNPCs ?? {}) },
    locations: { ...LOCATIONS, ...(state.dynamicLocations ?? {}) },
    extraTownMembers: state.currentLocationActiveDynamicNpcIds
      ? { [state.currentLocationId]: state.currentLocationActiveDynamicNpcIds }
      : undefined,
  });
}

export function npcReducer(state: GameState, action: AppAction): Partial<GameState> {
  switch (action.type) {
    case 'UPDATE_NPC_DISPOSITION': {
      const { npcId, amount } = action.payload;
      const currentMemory = state.npcMemory[npcId];
      if (!currentMemory) return {};

      const newDisposition = Math.max(-100, Math.min(100, currentMemory.disposition + amount));

      return {
        npcMemory: {
          ...state.npcMemory,
          [npcId]: {
            ...currentMemory,
            disposition: newDisposition,
          },
        },
      };
    }

    case 'ADD_NPC_KNOWN_FACT': {
      const { npcId, fact } = action.payload; // fact is now a KnownFact object
      const currentMemory = state.npcMemory[npcId];
      if (!currentMemory) return {};

      // Avoid adding duplicate facts by checking the text content
      if (currentMemory.knownFacts.some(existingFact => existingFact.text === fact.text)) {
        return {};
      }

      const nextMemory: GameState['npcMemory'] = {
        ...state.npcMemory,
        [npcId]: {
          ...currentMemory,
          knownFacts: [...currentMemory.knownFacts, fact],
        },
      };

      // DIAL-002 cross-NPC propagation. Additive: a private fact, or one that is
      // itself hearsay, resolves to nothing and this block is a no-op, so every
      // pre-existing ADD_NPC_KNOWN_FACT call site behaves exactly as before.
      // Only the same-town channel (delay 0) can land here; faction (1 day) and
      // rumor-mill recipients become due on a later day and are picked up by the
      // daily pass in `handleWorldEvents.handleFactPropagationEvent`.
      if (isPropagatableFact(fact)) {
        const currentDay = state.gameTime instanceof Date ? getGameDay(state.gameTime) : 0;
        const arrivals = duePropagatedFacts(
          propagateFact(fact, {
            originNpcId: npcId,
            npcs: rosterFromState(state),
            learnedOnDay: currentDay,
          }),
          currentDay,
        );

        for (const arrival of arrivals) {
          const recipient = nextMemory[arrival.npcId];
          // Only NPCs the save is actually tracking can learn anything, and the
          // same text is never stored twice (matching the check above).
          if (!recipient) continue;
          if (recipient.knownFacts.some(known => known.text === arrival.fact.text)) continue;
          nextMemory[arrival.npcId] = {
            ...recipient,
            knownFacts: [...recipient.knownFacts, arrival.fact],
          };
        }
      }

      return { npcMemory: nextMemory };
    }

    case 'UPDATE_NPC_SUSPICION': {
      const { npcId, newLevel } = action.payload;
      const currentMemory = state.npcMemory[npcId];
      if (!currentMemory || currentMemory.suspicion === newLevel) return {};

      return {
        npcMemory: {
          ...state.npcMemory,
          [npcId]: {
            ...currentMemory,
            suspicion: newLevel,
          },
        },
      };
    }
    
    // This case handles updating the status of a specific goal for an NPC.
    // It finds the correct NPC and goal, then updates the status immutably.
    // This is the core state logic for progressing NPC motivations.
    case 'UPDATE_NPC_GOAL_STATUS': {
        const { npcId, goalId, newStatus } = action.payload;
        const currentMemory = state.npcMemory[npcId];
        if (!currentMemory || !currentMemory.goals) return {};
        
        const goalIndex = currentMemory.goals.findIndex(g => g.id === goalId);
        if (goalIndex === -1 || currentMemory.goals[goalIndex].status === newStatus) {
            return {}; // Goal not found or status is already the same
        }

        const newGoals = [...currentMemory.goals];
        newGoals[goalIndex] = { ...newGoals[goalIndex], status: newStatus };

        return {
            npcMemory: {
                ...state.npcMemory,
                [npcId]: {
                    ...currentMemory,
                    goals: newGoals,
                },
            },
        };
    }
    
    // This new case efficiently applies all state changes generated by a single Gossip Event.
    // It iterates through the payload, updating multiple NPCs' memories in one go.
    // This is crucial for performance, preventing many separate re-renders.
    case 'PROCESS_GOSSIP_UPDATES': {
        const payload = action.payload as import('../../types').GossipUpdatePayload;
        const newNpcMemory = { ...state.npcMemory };
        let hasChanges = false;

        for (const npcId in payload) {
            const update = payload[npcId];
            const currentMemory = newNpcMemory[npcId];

            if (currentMemory) {
                hasChanges = true;
                const newFacts = update.newFacts.filter(
                    newFact => !currentMemory.knownFacts.some(existing => existing.text === newFact.text)
                );
                
                const newDisposition = Math.max(-100, Math.min(100, currentMemory.disposition + update.dispositionNudge));

                if (newFacts.length > 0 || newDisposition !== currentMemory.disposition) {
                    newNpcMemory[npcId] = {
                        ...currentMemory,
                        disposition: newDisposition,
                        knownFacts: [...currentMemory.knownFacts, ...newFacts],
                    };
                }
            }
        }
        return hasChanges ? { npcMemory: newNpcMemory } : {};
    }

    // This action updates the last time the player interacted with a specific NPC.
    // This is used for the disposition drift mechanic during a long rest.
    case 'UPDATE_NPC_INTERACTION_TIMESTAMP': {
      const { npcId, timestamp } = action.payload;
      const currentMemory = state.npcMemory[npcId];
      if (!currentMemory) return {};

      return {
        npcMemory: {
          ...state.npcMemory,
          [npcId]: {
            ...currentMemory,
            lastInteractionTimestamp: timestamp,
          },
        },
      };
    }

    // Seeds a neutral player relationship for an NPC that just joined a location
    // (Linker path). Existing memory is never overwritten.
    case 'LINK_NPC_TO_LOCATION': {
      const { npcId } = action.payload;
      if (state.npcMemory[npcId]) return {};
      return {
        npcMemory: {
          ...state.npcMemory,
          [npcId]: createEmptyMemory(),
        },
      };
    }

    // This action replaces the entire npcMemory state slice with a new one.
    // It is used by the long rest world event handler for a single, performant update
    // after calculating decay, pruning, and disposition drift.
    case 'BATCH_UPDATE_NPC_MEMORY': {
      return { npcMemory: action.payload };
    }

    // Handles recording a discussed topic in both the active session and NPC memory
    case 'DISCUSS_TOPIC': {
      const { topicId, npcId, date } = action.payload;
      const currentMemory = state.npcMemory[npcId];

      // Update Active Session if it exists and matches the NPC
      const activeSession = state.activeDialogueSession;
      let newActiveSession = activeSession;

      if (activeSession && activeSession.npcId === npcId && !activeSession.discussedTopicIds.includes(topicId)) {
          newActiveSession = {
              ...activeSession,
              discussedTopicIds: [...activeSession.discussedTopicIds, topicId]
          };
      }

      // Update NPC Memory if it exists
      let newNpcMemory = state.npcMemory;
      if (currentMemory) {
          newNpcMemory = {
              ...state.npcMemory,
              [npcId]: {
                  ...currentMemory,
                  discussedTopics: {
                      ...(currentMemory.discussedTopics || {}),
                      [topicId]: date
                  }
              }
          };
      }

      return {
          activeDialogueSession: newActiveSession,
          npcMemory: newNpcMemory
      };
    }

    case 'REGISTER_GENERATED_NPC': {
      const { npc } = action.payload;
      
      // Add to generated NPCs registry
      const newGeneratedNpcs = {
        ...state.generatedNpcs,
        [npc.id]: npc
      };

      // Initialize memory if needed (RichNPC comes with default memory, we should merge/use it)
      let newNpcMemory = state.npcMemory;
      if (!newNpcMemory[npc.id] && npc.memory) {
        if ('disposition' in npc.memory) {
          newNpcMemory = {
            ...state.npcMemory,
            [npc.id]: npc.memory
          };
        } else {
          // Legacy memory shapes are preserved on the NPC itself. The reducer only
          // mirrors disposition-aware memories into the indexed relationship store.
        }
      }

      return {
        generatedNpcs: newGeneratedNpcs,
        npcMemory: newNpcMemory
      };
    }

    // --- NPC Grudge & Bond System ---
    // Records one emotional marker (grudge or bond) on an NPC's existing memory
    // entry. Recording is delegated to `recordEmotionalMarker` so the reinforce-
    // instead-of-duplicate rule lives with the data model, not in the reducer.
    case 'RECORD_NPC_EMOTIONAL_MARKER': {
      const { npcId, marker } = action.payload;
      const currentMemory = state.npcMemory[npcId];
      // Matches the rest of this slice: an unknown NPC is a no-op rather than an
      // implicit memory creation, so callers stay responsible for registration.
      if (!currentMemory) return {};

      return {
        npcMemory: {
          ...state.npcMemory,
          [npcId]: recordEmotionalMarker(currentMemory, marker),
        },
      };
    }

    // Forgets markers that have decayed below the "no longer changes behavior"
    // threshold, across every NPC at once. Intended to run on the same long-rest
    // maintenance pass as `BATCH_UPDATE_NPC_MEMORY`. Returns {} when nothing was
    // forgotten so the store keeps its previous reference.
    case 'PRUNE_NPC_EMOTIONAL_MARKERS': {
      const { gameDay } = action.payload;
      const nextMemory = { ...state.npcMemory };
      let changed = false;

      for (const npcId of Object.keys(nextMemory)) {
        const pruned = pruneEmotionalMarkers(nextMemory[npcId], gameDay);
        if (pruned !== nextMemory[npcId]) {
          nextMemory[npcId] = pruned;
          changed = true;
        }
      }

      return changed ? { npcMemory: nextMemory } : {};
    }

    // --- NPC Reaction Memory ---
    // Records one thing this NPC saw or was told the player did. Recording is
    // delegated to `applyWitnessedAct` so the witness record AND the grudge/bond
    // it implies land in one immutable update, and so the belief-based
    // de-duplication rule stays with the data model rather than in the reducer.
    case 'RECORD_NPC_WITNESSED_ACT': {
      const { npcId, act } = action.payload;
      const currentMemory = state.npcMemory[npcId];
      // Same contract as the rest of this slice: an unknown NPC is a no-op, not
      // an implicit memory creation.
      if (!currentMemory) return {};

      const nextMemory = applyWitnessedAct(currentMemory, act);
      // A weaker retelling of something already known changes nothing; keep the
      // previous reference so subscribers do not re-render.
      if (nextMemory === currentMemory) return {};

      return {
        npcMemory: {
          ...state.npcMemory,
          [npcId]: nextMemory,
        },
      };
    }

    // Forgets witness records that have faded below the "no longer changes
    // behavior" threshold, across every NPC at once. Meant for the same
    // long-rest maintenance pass as PRUNE_NPC_EMOTIONAL_MARKERS.
    case 'PRUNE_NPC_WITNESSED_ACTS': {
      const { gameDay } = action.payload;
      const nextMemory = { ...state.npcMemory };
      let changed = false;

      for (const npcId of Object.keys(nextMemory)) {
        const pruned = pruneWitnessedActs(nextMemory[npcId], gameDay);
        if (pruned !== nextMemory[npcId]) {
          nextMemory[npcId] = pruned;
          changed = true;
        }
      }

      return changed ? { npcMemory: nextMemory } : {};
    }

    default:
      return {};
  }
}
