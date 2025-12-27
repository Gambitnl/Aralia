/**
 * @file src/state/reducers/ritualReducer.ts
 * Reducer logic for managing ritual state.
 */
import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
import * as RitualManager from '../../systems/rituals/RitualManager';
import { generateId } from '../../utils/combatUtils';

export function ritualReducer(state: GameState, action: AppAction): Partial<GameState> {
  switch (action.type) {
    case 'START_RITUAL': {
      // Need a way to construct the initial ritual state here.
      // But START_RITUAL payload is `RitualState` usually.
      // Let's assume action.payload is already the RitualState object.
      return {
        activeRitual: action.payload,
        messages: [
          ...state.messages,
          {
            id: generateId(),
            text: `A ritual to cast ${action.payload.spellName} has begun.`,
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

      // Convert seconds to "rounds" roughly? Or units.
      // RitualManager.advanceRitual uses 'amount'.
      // If ritual is in rounds (combat), 6 seconds = 1 round.
      // If ritual is in minutes, 60 seconds = 1 unit.

      // Simplification: Assume 'rounds' for now as per RitualManager default
      const roundsPassed = Math.floor(action.payload.seconds / 6);

      const updatedRitual = RitualManager.advanceRitual(state.activeRitual, roundsPassed);

      let messages = state.messages;

      // Check for completion transition
      if (RitualManager.isRitualComplete(updatedRitual) && !RitualManager.isRitualComplete(state.activeRitual)) {
        messages = [...state.messages, {
          id: generateId(),
          text: `Ritual Complete: ${updatedRitual.spellName} is ready to be unleashed.`,
          sender: 'system',
          timestamp: state.gameTime,
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

      // Payload might be { minutes: number } or { rounds: number }
      // Assuming rounds for consistency with RitualManager
      const amount = action.payload.minutes ? action.payload.minutes * 10 : (action.payload.rounds || 1);

      const updatedRitual = RitualManager.advanceRitual(state.activeRitual, amount);

      let messages = state.messages;

      if (RitualManager.isRitualComplete(updatedRitual) && !RitualManager.isRitualComplete(state.activeRitual)) {
        messages = [...state.messages, {
          id: generateId(),
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

      // Payload: { event: 'damage', value: 10 }
      const interruptResult = RitualManager.checkRitualInterrupt(
          state.activeRitual,
          action.payload.event.type,
          action.payload.event.value,
          action.payload.event.conditionName
      );

      if (interruptResult.interrupted) {
         // Mark as interrupted in state? RitualState doesn't have 'interrupted' flag explicitly in the type definition usually
         // but let's assume we just clear it or pause it.
         // Actually, let's just log it and maybe clear it if broken.

         if (interruptResult.ritualBroken) {
             return {
                 activeRitual: null,
                 messages: [
                     ...state.messages,
                     {
                         id: generateId(),
                         text: `Ritual Broken! ${interruptResult.reason}`,
                         sender: 'system',
                         timestamp: state.gameTime
                     }
                 ]
             };
         }
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
