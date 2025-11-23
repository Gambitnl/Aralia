/**
 * @file src/hooks/actions/handleSystemAndUi.ts
 * Handles system and UI actions like saving, main menu, and toggling UI panes.
 */
import React from 'react';
import { GameState, GamePhase } from '../../types';
import { AppAction } from '../actionTypes';
import * as SaveLoadService from '../../services/saveLoadService';
import { AddMessageFn } from './actionHandlerTypes';
import { USE_DUMMY_CHARACTER_FOR_DEV } from '../../constants';

interface HandleSystemAndUiProps {
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
}

export async function handleSaveGame({
  gameState,
  dispatch,
  addMessage,
}: Omit<HandleSystemAndUiProps, 'action'>): Promise<void> {
  dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: "Saving your progress..." } });
  const success = await SaveLoadService.saveGame(gameState);
  if (success) {
    addMessage("Game Saved!", 'system');
  } else {
    addMessage("Failed to save game. Check console or try again later.", 'system');
  }
  dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
  dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
}

export async function handleGoToMainMenu({
  gameState,
  dispatch,
  addMessage,
}: Omit<HandleSystemAndUiProps, 'action'>): Promise<void> {
  addMessage("Returning to Main Menu...", 'system');
  if (!USE_DUMMY_CHARACTER_FOR_DEV) {
    await handleSaveGame({ gameState, dispatch, addMessage });
  }
  dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.MAIN_MENU });
}

export function handleToggleMap(dispatch: React.Dispatch<AppAction>): void {
  dispatch({ type: 'TOGGLE_MAP_VISIBILITY' });
  dispatch({ type: 'RESET_NPC_INTERACTION_CONTEXT' });
}

export function handleToggleSubmap(dispatch: React.Dispatch<AppAction>): void {
  dispatch({ type: 'TOGGLE_SUBMAP_VISIBILITY' });
  dispatch({ type: 'RESET_NPC_INTERACTION_CONTEXT' });
}

export function handleToggleDevMenu(dispatch: React.Dispatch<AppAction>): void {
  dispatch({ type: 'TOGGLE_DEV_MENU' });
}

export function handleToggleNpcTestModal(dispatch: React.Dispatch<AppAction>): void {
  dispatch({ type: 'TOGGLE_NPC_TEST_MODAL' });
}

export function handleToggleDiscoveryLog(dispatch: React.Dispatch<AppAction>): void {
    dispatch({ type: 'TOGGLE_DISCOVERY_LOG_VISIBILITY' });
}

export function handleToggleGlossary(dispatch: React.Dispatch<AppAction>, initialTermId?: string): void {
    dispatch({ type: 'TOGGLE_GLOSSARY_VISIBILITY', payload: { initialTermId } });
}

export function handleToggleLogbook(dispatch: React.Dispatch<AppAction>): void {
    dispatch({ type: 'TOGGLE_LOGBOOK' });
}

export function handleTogglePartyEditor(dispatch: React.Dispatch<AppAction>): void {
  dispatch({ type: 'TOGGLE_PARTY_EDITOR_MODAL' });
}

export function handleTogglePartyOverlay(dispatch: React.Dispatch<AppAction>): void {
    dispatch({ type: 'TOGGLE_PARTY_OVERLAY' });
}

export function handleToggleGameGuide(dispatch: React.Dispatch<AppAction>): void {
  dispatch({ type: 'TOGGLE_GAME_GUIDE' });
}
