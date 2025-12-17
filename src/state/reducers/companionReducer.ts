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
      const { companionId, change, reason, source } = action.payload;
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

      if (Math.abs(newApproval - oldApproval) >= 5) {
        const sign = change > 0 ? 'approves' : 'disapproves';
        messages = [
            ...state.messages,
            {
                id: Date.now(),
                text: `${companion.identity.name} ${sign} of that.`,
                sender: 'system',
                timestamp: new Date()
            }
        ];
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
