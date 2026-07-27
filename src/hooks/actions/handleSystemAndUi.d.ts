/**
 * @file src/hooks/actions/handleSystemAndUi.ts
 * Handles system and UI actions like saving, main menu, and toggling UI panes.
 */
import React from 'react';
import { GameState } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { AddMessageFn } from './actionHandlerTypes';
interface HandleSystemAndUiProps {
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
    addMessage: AddMessageFn;
}
export declare function handleSaveGame({ gameState, dispatch, addMessage, }: Omit<HandleSystemAndUiProps, 'action'>): Promise<void>;
export declare function handleGoToMainMenu({ gameState, dispatch, addMessage, }: Omit<HandleSystemAndUiProps, 'action'>): Promise<void>;
export declare function handleToggleMap(dispatch: React.Dispatch<AppAction>): void;
export declare function handleToggleDevMenu(dispatch: React.Dispatch<AppAction>): void;
export declare function handleToggleNpcTestModal(dispatch: React.Dispatch<AppAction>): void;
export declare function handleToggleDiscoveryLog(dispatch: React.Dispatch<AppAction>): void;
export declare function handleToggleGlossary(dispatch: React.Dispatch<AppAction>, initialTermId?: string): void;
export declare function handleToggleLogbook(dispatch: React.Dispatch<AppAction>): void;
export declare function handleTogglePartyEditor(dispatch: React.Dispatch<AppAction>): void;
export declare function handleTogglePartyOverlay(dispatch: React.Dispatch<AppAction>): void;
export declare function handleToggleGameGuide(dispatch: React.Dispatch<AppAction>): void;
export declare function handleToggleQuestLog(dispatch: React.Dispatch<AppAction>): void;
export {};
