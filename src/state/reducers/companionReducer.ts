/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/state/reducers/companionReducer.ts
 * Handles companion-related state updates.
 */

import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
import { RelationshipManager } from '../../systems/companions/RelationshipManager';

export function companionReducer(state: GameState, action: AppAction): Partial<GameState> {
  switch (action.type) {
    case 'UPDATE_COMPANION_APPROVAL': {
      // TODO(lint-intent): 'source' is declared but unused, suggesting an unfinished state/behavior hook in this block.
      // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
      // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
      const { companionId, change, reason, source: _source } = action.payload;
      const companion = state.companions[companionId];

      if (!companion) {
        console.warn(`Companion ${companionId} not found`);
        return {};
      }

      // Default to updating player relationship
      // In future, targetId could be dynamic if companions interact with each other
      const targetId = 'player';

      const updatedCompanion = RelationshipManager.processApprovalEvent(
        companion,
        targetId,
        change,
        reason
      );

      // If approval changed significantly, maybe queue a message
      let messages = state.messages;
      const oldApproval = companion.relationships[targetId]?.approval || 0;
      const newApproval = updatedCompanion.relationships[targetId].approval;

      const oldUnlocks = companion.relationships[targetId]?.unlocks || [];
      const newUnlocks = updatedCompanion.relationships[targetId].unlocks || [];

      // Notify on significant approval change
      if (Math.abs(newApproval - oldApproval) >= 5) {
        const sign = change > 0 ? 'approves' : 'disapproves';
        messages = [
            ...messages,
            {
                id: Date.now(),
                text: `${companion.identity.name} ${sign} of that.`,
                sender: 'system',
                timestamp: new Date()
            }
        ];
      }

      // Notify on New Unlocks
      if (newUnlocks.length > oldUnlocks.length) {
          // Find the new ones
          const newlyUnlocked = newUnlocks.filter(u => !oldUnlocks.some(old => old.id === u.id));
          newlyUnlocked.forEach(unlock => {
              messages = [
                  ...messages,
                  {
                      id: Date.now() + Math.random(), // slight offset
                      text: `RELATIONSHIP MILESTONE: ${companion.identity.name} has unlocked "${unlock.description}"`,
                      sender: 'system',
                      timestamp: new Date()
                  }
              ];
          });
      }

      return {
        companions: {
          ...state.companions,
          [companionId]: updatedCompanion
        },
        messages
      };
    }

    case 'ADD_COMPANION_REACTION': {
        const { companionId, reaction } = action.payload;
        const companion = state.companions[companionId];

        if (!companion) return {};

        return {
            messages: [
                ...state.messages,
                {
                    id: Date.now(),
                    text: `${companion.identity.name}: "${reaction}"`,
                    sender: 'npc',
                    timestamp: new Date(),
                    metadata: {
                        companionId: companion.id,
                        reactionType: 'comment'
                    }
                }
            ]
        };
    }

    default:
      return {};
  }
}
