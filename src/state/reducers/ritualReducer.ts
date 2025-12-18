/**
 * @file src/state/reducers/ritualReducer.ts
 * Reducer logic for managing active rituals, tracking progress, and handling interruptions.
 */

import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
import { RitualManager } from '../../systems/rituals/RitualManager';
import { logger } from '../../utils/logger';

export function ritualReducer(state: GameState, action: AppAction): Partial<GameState> {
  switch (action.type) {
    case 'START_RITUAL': {
      const ritual = action.payload;
      logger.info('Starting ritual', { spellName: ritual.spell.name, duration: ritual.durationMinutes });

      return {
        activeRituals: {
          ...state.activeRituals,
          [ritual.id]: ritual,
        },
        // Optionally add a log message
        messages: [
          ...state.messages,
          {
            id: Date.now(),
            text: `${ritual.spell.name} ritual started. Duration: ${ritual.durationMinutes} minutes.`,
            sender: 'system',
            timestamp: new Date()
          }
        ]
      };
    }

    case 'ADVANCE_RITUAL': {
      const { ritualId, minutes } = action.payload;
      const ritual = state.activeRituals[ritualId];

      if (!ritual) return {};

      const updatedRitual = RitualManager.advanceRitual(ritual, minutes);

      let updates: Partial<GameState> = {
        activeRituals: {
          ...state.activeRituals,
          [ritualId]: updatedRitual
        }
      };

      // Handle completion
      if (updatedRitual.isComplete && !ritual.isComplete) {
        logger.info('Ritual completed', { ritualId });
        // The COMPLETE_RITUAL action will handle the effect, but we mark it complete here.
        // In a real loop, we might dispatch COMPLETE_RITUAL automatically,
        // but reducers must be pure, so we rely on the caller to check isComplete
        // or a thunk/middleware. For now, we just log it in chat.
        updates = {
          ...updates,
          messages: [
            ...state.messages,
            {
              id: Date.now(),
              text: `${ritual.spell.name} ritual is complete!`,
              sender: 'system',
              timestamp: new Date()
            }
          ]
        };
      }

      // Handle material consumption
      if (updatedRitual.materialsConsumed && !ritual.materialsConsumed) {
        // Logic to remove items from inventory would go here or be dispatched separately.
        // For now, we assume the UI/Caller handles the inventory update if needed,
        // or we can implement it here if we have the inventory logic.
        logger.info('Ritual materials consumed', { ritualId });
         updates = {
          ...updates,
          messages: [
            ...(updates.messages || state.messages),
            {
              id: Date.now() + 1,
              text: `Materials for ${ritual.spell.name} have been consumed.`,
              sender: 'system',
              timestamp: new Date()
            }
          ]
        };
      }

      return updates;
    }

    case 'CHECK_RITUAL_INTERRUPTION': {
      const event = action.payload;
      const updates: Partial<GameState> = { activeRituals: { ...state.activeRituals } };
      let interruptedAny = false;

      // Check all active rituals
      for (const id in state.activeRituals) {
        const ritual = state.activeRituals[id];
        if (ritual.isComplete || ritual.interrupted) continue;

        const result = RitualManager.checkInterruption(ritual, event);

        if (result.interrupted) {
          // If a save is allowed, we might not interrupt immediately,
          // but for this MVP reducer, we assume if it's interrupted, it breaks
          // (or we need a way to roll the save).

          // If result.canSave is true, we ideally prompt for a save.
          // For now, we will mark it as interrupted if no save logic is handled here yet.
          // In a full system, we'd trigger a 'REQUEST_SAVE' modal.

          if (result.canSave) {
             // TODO: Handle save rolls. For now, we log the danger.
             logger.warn('Ritual threatened', { ritualId: id, reason: result.reason, dc: result.saveDC });
             // We don't break it yet, assuming player will roll save in next turn?
             // Or we assume failure for MVP?
             // Let's assume failure for simplicity unless we build the save UI.
          }

          const brokenRitual = {
            ...ritual,
            interrupted: true,
            interruptionReason: result.reason
          };

          updates.activeRituals![id] = brokenRitual;
          interruptedAny = true;
        }
      }

      if (interruptedAny) {
        return {
          ...updates,
          messages: [
            ...state.messages,
            {
              id: Date.now(),
              text: `A ritual has been interrupted!`,
              sender: 'system',
              timestamp: new Date()
            }
          ]
        };
      }

      return {};
    }

    case 'COMPLETE_RITUAL': {
      const { ritualId } = action.payload;
      // Remove from active rituals or move to history?
      const { [ritualId]: completed, ...remaining } = state.activeRituals;

      return {
        activeRituals: remaining,
        // Trigger spell effect logic here?
        // Usually handled by the caller dispatching CAST_SPELL after completion.
      };
    }

    case 'ABORT_RITUAL': {
      const { ritualId, reason } = action.payload;
      const { [ritualId]: aborted, ...remaining } = state.activeRituals;

      return {
        activeRituals: remaining,
        messages: [
          ...state.messages,
          {
            id: Date.now(),
            text: `Ritual aborted: ${reason}`,
            sender: 'system',
            timestamp: new Date()
          }
        ]
      };
    }

    default:
      return {};
  }
}
