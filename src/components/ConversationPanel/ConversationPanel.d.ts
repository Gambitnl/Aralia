/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/ConversationPanel/ConversationPanel.tsx
 * Floating panel for interactive companion conversations.
 */
import React from 'react';
import { GameState } from '../../types';
import { AppAction } from '../../state/actionTypes';
import './ConversationPanel.css';
interface ConversationPanelProps {
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
}
export declare const ConversationPanel: React.FC<ConversationPanelProps>;
export default ConversationPanel;
