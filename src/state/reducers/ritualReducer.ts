/**
 * @file src/state/reducers/ritualReducer.ts
 * Reducer logic for managing ritual state.
 */
import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
import { RitualManager } from '../../systems/rituals/RitualManager';
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

    case 'ADVANCE_RITUAL': {
      if (!state.activeRitual) return {};

      // Delegate logic to RitualManager
      const updatedRitual = RitualManager.advanceRitual(state.activeRitual, action.payload.minutes);

      const newMessages = [...state.messages];

      // Check for completion transition
      if (updatedRitual.isComplete && !state.activeRitual.isComplete) {
        newMessages.push({
          id: generateId(),
          text: `The ritual is complete! The magic of ${updatedRitual.spell.name} takes hold.`,
          sender: 'system',
          timestamp: state.gameTime
        });
      }

      return {
        activeRitual: updatedRitual,
        messages: newMessages
      };
    }

    case 'INTERRUPT_RITUAL': {
      if (!state.activeRitual) return {};

      const interruptResult = RitualManager.checkInterruption(state.activeRitual, action.payload.event);

      if (interruptResult.interrupted) {
         // Apply interruption logic (marking as interrupted)
         // NOTE: RitualManager.checkInterruption checks IF it should interrupt, but doesn't return a new state.
         // We need to manually update the state to reflect interruption if verified.
         // However, RitualManager doesn't seem to have a 'markInterrupted' method exposed publicly in the class interface I saw earlier,
         // but looking at usage, we might just need to update the object.
         // Wait, RitualState has `interrupted` boolean.

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
             activeRitual: updatedRitual, // Kept in state so UI can show "Failed", cleared later or by COMPLETE
             messages: [
                 ...state.messages,
                 {
                     id: generateId(),
                     text: `Ritual Interrupted! ${interruptResult.reason} ${backlashMessage}`,
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
      // Clears the ritual from state, assuming effects are applied elsewhere
      return {
        activeRitual: null
      };
    }

    default:
      return {};
  }
}
