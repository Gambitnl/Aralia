/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/state/reducers/conversationReducer.ts
 * Handles interactive companion conversation state updates.
 */

import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
import { ActiveConversation } from '../../types/conversation';

export function conversationReducer(state: GameState, action: AppAction): Partial<GameState> {
    switch (action.type) {
        case 'START_CONVERSATION': {
            const { companionIds, initialMessage } = action.payload;

            const newConversation: ActiveConversation = {
                id: crypto.randomUUID(),
                participants: companionIds,
                messages: [initialMessage],
                startedAt: Date.now(),
                isPlayerTurn: true, // Player responds after initial companion message
                pendingResponse: false,
            };

            return {
                activeConversation: newConversation,
            };
        }

        case 'ADD_CONVERSATION_MESSAGE': {
            if (!state.activeConversation) return {};

            const message = action.payload;
            const isFromPlayer = message.speakerId === 'player';

            return {
                activeConversation: {
                    ...state.activeConversation,
                    messages: [...state.activeConversation.messages, message],
                    isPlayerTurn: !isFromPlayer, // Toggle turn
                    pendingResponse: false, // Clear pending when message arrives
                },
            };
        }

        case 'SET_CONVERSATION_PENDING': {
            if (!state.activeConversation) return {};

            return {
                activeConversation: {
                    ...state.activeConversation,
                    pendingResponse: action.payload,
                },
            };
        }

        case 'END_CONVERSATION': {
            // Note: Memory summarization is handled by the useConversation hook
            // before dispatching this action
            return {
                activeConversation: null,
            };
        }

        default:
            return {};
    }
}
