// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/04/2026, 00:55:31
 * Dependents: state/reducers/worldReducer.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/state/reducers/ritualReducer.ts
 * Reducer logic for managing ritual progress inside the shared game state.
 *
 * The ritual manager now stores canonical progress in seconds so world-time and
 * combat-time can share the same scalar. This reducer translates incoming time
 * actions into seconds, feeds them into the ritual manager, and keeps the older
 * display-facing ritual fields flowing through state for unfinished UI surfaces.
 */
import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
import * as RitualManager from '../../systems/rituals/RitualManager';
import { ROUND_DURATION_SECONDS } from '../../utils/core/spellTimeUtils';
import { generateId } from '../../utils/combatUtils';

// ============================================================================
// Ritual Advancement Payload Translation
// ============================================================================
// Different systems think in different units. World time already advances in
// seconds, while some dev/test ritual actions still talk in minutes or rounds.
// This helper normalizes all of those entry points into one runtime scalar.
// ============================================================================

function getAdvanceRitualSeconds(payload: { seconds?: number; minutes?: number; rounds?: number }): number {
  // Prefer an explicit seconds payload when it is provided, because seconds are
  // now the canonical ritual runtime unit.
  if (typeof payload.seconds === 'number') {
    return payload.seconds;
  }

  // Minutes are still useful for narrative/dev actions where the caller is
  // intentionally working at a broader time scale.
  if (typeof payload.minutes === 'number') {
    return payload.minutes * 60;
  }

  // Rounds remain useful for combat-driven ritual advancement.
  if (typeof payload.rounds === 'number') {
    return payload.rounds * ROUND_DURATION_SECONDS;
  }

  return 0;
}

export function ritualReducer(state: GameState, action: AppAction): Partial<GameState> {
  switch (action.type) {
    case 'START_RITUAL': {
      // payload matches RitualState structure from RitualManager
      const ritual = action.payload;
      return {
        activeRitual: ritual,
        messages: [
          ...state.messages,
          {
            id: Date.now(),
            // Fixed: use spellName instead of spell.name to match Singular RitualState
            text: `A ritual to cast ${ritual.spellName} has begun. (Duration: ${ritual.durationTotal} ${ritual.durationUnit})`,
            sender: 'system',
            timestamp: state.gameTime,
          }
        ]
      };
    }

    case 'ADVANCE_TIME': {
      // This reducer handles the implicit advancement of rituals via time
      if (!state.activeRitual || RitualManager.isRitualComplete(state.activeRitual) || state.activeRitual.isPaused) {
        return {};
      }

      // ADVANCE_TIME is already expressed in seconds, so feed that directly into
      // the ritual runtime instead of converting through minutes first.
      const updatedRitual = RitualManager.advanceRitual(state.activeRitual, action.payload.seconds);

      let messages = state.messages;
      const wasComplete = RitualManager.isRitualComplete(state.activeRitual);
      const isNowComplete = RitualManager.isRitualComplete(updatedRitual);

      // Check for completion transition
      if (isNowComplete && !wasComplete) {
        messages = [...state.messages, {
          id: Date.now(),
          text: `Ritual Complete: ${updatedRitual.spellName} is ready to be unleashed.`,
          sender: 'system',
          timestamp: state.gameTime, // Note: gameTime in state is technically old time before ADVANCE_TIME completes, but acceptable here
          metadata: { type: 'ritual_complete', ritualId: updatedRitual.id }
        }];
      }

      return {
        activeRitual: updatedRitual,
        messages: messages
      };
    }

    case 'ADVANCE_RITUAL': {
      if (!state.activeRitual) return {};

      // Manual ritual advancement can arrive in seconds, minutes, or rounds.
      const updatedRitual = RitualManager.advanceRitual(
        state.activeRitual,
        getAdvanceRitualSeconds(action.payload)
      );

      let messages = state.messages;
      const wasComplete = RitualManager.isRitualComplete(state.activeRitual);
      const isNowComplete = RitualManager.isRitualComplete(updatedRitual);

      if (isNowComplete && !wasComplete) {
        messages = [...state.messages, {
          id: Date.now(),
          text: `The ritual is complete! The magic of ${updatedRitual.spellName} takes hold.`,
          sender: 'system',
          timestamp: state.gameTime
        }];
      }

      return {
        activeRitual: updatedRitual,
        messages: messages
      };
    }

    case 'INTERRUPT_RITUAL': {
      if (!state.activeRitual) return {};

      // TODO(2026-01-03 pass 4 Codex-CLI): Cast ritual interrupt payload until event shape is fully typed.
      const event = action.payload.event as { type: 'damage' | 'movement' | 'condition'; value?: unknown; conditionName?: string } | undefined;
      if (!event) return {};
      // Fixed: Unpack the event object to match checkRitualInterrupt signature (ritual, type, value, name)
      // Note: event might be 'damage' | 'movement' etc as string in some contexts, but payload implies object based on test.
      // We assume event is { type, value, conditionName? }
      const interruptResult = RitualManager.checkRitualInterrupt(
          state.activeRitual,
          event.type,
          (event.value as number | undefined),
          event.conditionName
      );

      if (interruptResult.interrupted) {
         const updatedRitual = {
             ...state.activeRitual,
             isPaused: true,
             interruptionReason: interruptResult.reason || 'External disturbance'
         };

         // const backlashEffects = RitualManager.getBacklashOnFailure(updatedRitual);
         // TODO(lint-intent): The any on 'backlashEffects' hides the intended shape of this data.
         // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
         // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
        const backlashEffects: unknown[] = [];

        const backlashMessage = backlashEffects.length > 0
            // TODO(lint-intent): The any on 'b' hides the intended shape of this data.
            // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
            // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
            ? `Backlash: ${backlashEffects.map((b: unknown) => (b as { description?: string })?.description || 'effect').join(' ')}`
            : 'The magic dissipates harmlessly.';

         return {
             activeRitual: updatedRitual,
                messages: [
                    ...state.messages,
                    {
                        id: Date.now(),
                        text: `Ritual Interrupted! ${interruptResult.reason}. ${backlashMessage}`,
                        sender: 'system',
                        timestamp: state.gameTime,
                     metadata: { type: 'ritual_interruption', backlash: backlashEffects }
                 }
             ]
         };
      }

      return {};
    }

    case 'COMPLETE_RITUAL': {
      return {
        activeRitual: null
      };
    }

    default:
      return {};
  }
}
