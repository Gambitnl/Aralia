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

      // checkInterruption -> checkRitualInterrupt (Corrected function name)
      // Also, checkRitualInterrupt signature: (ritual, eventType, value?, conditionName?)
      // action.payload.event is likely an object like { type: 'damage', value: 10 }
      // We need to unpack it or change usage.
      // Looking at RitualManager.ts: checkRitualInterrupt(ritual, eventType, value, conditionName)

      const payload = action.payload as any; // Temporary cast to handle dynamic payload
      const eventType = payload.event?.type || 'unknown';
      const eventValue = payload.event?.value;
      const eventCondition = payload.event?.condition;

      const interruptResult = RitualManager.checkRitualInterrupt(
          state.activeRitual,
          eventType,
          eventValue,
          eventCondition
      );

      if (interruptResult.interrupted) {
         const updatedRitual = {
             ...state.activeRitual,
             interrupted: true,
             interruptionReason: interruptResult.reason || 'External disturbance'
         };

         // getBacklashOnFailure does not exist in RitualManager.ts.
         // We will remove it for now and assume no backlash until implemented.
         // TODO(RitualSystem): Restore backlash mechanics once getBacklashOnFailure is implemented.
         const backlashEffects: any[] = [];
         const backlashMessage = 'The magic dissipates harmlessly.';

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
