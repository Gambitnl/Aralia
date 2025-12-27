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
      return {
        activeRitual: action.payload,
        messages: [
          ...state.messages,
          {
            id: generateId(),
            text: `A ritual to cast ${action.payload.spell.name} has begun. (Duration: ${action.payload.durationMinutes} minutes)`,
            sender: 'system',
            timestamp: state.gameTime,
          }
        ]
      };
    }

    case 'ADVANCE_TIME': {
      // This reducer handles the implicit advancement of rituals via time
      if (!state.activeRitual || state.activeRitual.isComplete || state.activeRitual.interrupted) {
        return {};
      }

      const minutesPassed = action.payload.seconds / 60;
      const updatedRitual = RitualManager.advanceRitual(state.activeRitual, minutesPassed);

      let messages = state.messages;

      // Check for completion transition
      if (updatedRitual.isComplete && !state.activeRitual.isComplete) {
        messages = [...state.messages, {
          id: generateId(),
          text: `Ritual Complete: ${updatedRitual.spell.name} is ready to be unleashed.`,
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

      const updatedRitual = RitualManager.advanceRitual(state.activeRitual, action.payload.minutes);

      let messages = state.messages;

      if (updatedRitual.isComplete && !state.activeRitual.isComplete) {
        messages = [...state.messages, {
          id: generateId(),
          text: `The ritual is complete! The magic of ${updatedRitual.spell.name} takes hold.`,
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

      const interruptResult = RitualManager.checkInterruption(state.activeRitual, action.payload.event);

      if (interruptResult.interrupted) {
         const updatedRitual = {
             ...state.activeRitual,
             interrupted: true,
             interruptionReason: interruptResult.reason || 'External disturbance'
         };

         const backlashEffects = RitualManager.getBacklashOnFailure(updatedRitual);
         const backlashMessage = backlashEffects.length > 0
            ? `Backlash: ${backlashEffects.map(b => b.description).join(' ')}`
            : 'The magic dissipates harmlessly.';

         return {
             activeRitual: updatedRitual,
             messages: [
                 ...state.messages,
                 {
                     id: generateId(),
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
