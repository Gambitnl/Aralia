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
      // payload matches RitualState structure from RitualManager
      const ritual = action.payload;
      return {
        activeRitual: ritual,
        messages: [
          ...state.messages,
          {
            id: generateId(),
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

      const minutesPassed = action.payload.seconds / 60;
      // Advance ritual returns a new state object
      const updatedRitual = RitualManager.advanceRitual(state.activeRitual, minutesPassed);

      let messages = state.messages;
      const wasComplete = RitualManager.isRitualComplete(state.activeRitual);
      const isNowComplete = RitualManager.isRitualComplete(updatedRitual);

      // Check for completion transition
      if (isNowComplete && !wasComplete) {
        messages = [...state.messages, {
          id: generateId(),
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

      const updatedRitual = RitualManager.advanceRitual(state.activeRitual, action.payload.minutes);

      let messages = state.messages;
      const wasComplete = RitualManager.isRitualComplete(state.activeRitual);
      const isNowComplete = RitualManager.isRitualComplete(updatedRitual);

      if (isNowComplete && !wasComplete) {
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

      const event = action.payload.event;
      // Fixed: Unpack the event object to match checkRitualInterrupt signature (ritual, type, value, name)
      // Note: event might be 'damage' | 'movement' etc as string in some contexts, but payload implies object based on test.
      // We assume event is { type, value, conditionName? }
      const interruptResult = RitualManager.checkRitualInterrupt(
          state.activeRitual,
          event.type,
          event.value,
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
            ? `Backlash: ${backlashEffects.map((b: unknown) => b.description).join(' ')}`
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
