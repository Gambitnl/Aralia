// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/08/2026, 01:29:58
 * Dependents: App.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/hooks/useGameHotkeys.ts
 *
 * Centralized keyboard shortcuts & hotkey management for exploration and gameplay.
 *
 * ARCHITECTURAL ROLE:
 * Provides standard, intuitive RPG keyboard shortcuts for players during active gameplay
 * (GamePhase.PLAYING). Intercepts hotkeys like [M] for Map, [C] for Character Sheet,
 * [I] for Inventory, [Q]/[J] for Quests, [L] for Discoveries, [G] for Glossary,
 * [R] for Rest, [V] for View Mode, and [Esc] to dismiss open modals or toggle the menu.
 *
 * SAFETY & ACCESSIBILITY:
 * - Automatically suppresses hotkeys when typing in <input>, <textarea>, search fields,
 *   or contenteditable containers.
 * - Does not interfere with browser navigation shortcuts (Ctrl/Cmd/Alt combos are passed through).
 * - Integrates cleanly with modal escape hierarchies so pressing Escape dismisses active overlays.
 */

import { useEffect, useCallback } from 'react';
import { GameState, GamePhase, Action } from '../types';
import { AppAction } from '../state/actionTypes';

// ============================================================================
// Types
// ============================================================================

export interface UseGameHotkeysProps {
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  onAction?: (action: Action) => void;
  disabled?: boolean;
}

// ============================================================================
// Helper: Input Focus Guard
// ============================================================================
/** Checks whether an editable element currently holds focus. */
function isEditableElementFocused(): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    (active as HTMLElement).isContentEditable
  );
}

// ============================================================================
// Hook Implementation
// ============================================================================
export function useGameHotkeys({
  gameState,
  dispatch,
  onAction,
  disabled = false,
}: UseGameHotkeysProps) {
  const isPlaying = gameState.phase === GamePhase.PLAYING;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Pass through if disabled, not in gameplay, modifier key pressed, or typing
      if (disabled || !isPlaying || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableElementFocused()) return;

      const code = e.code;

      switch (code) {
        // [Escape] -> Close active modal or toggle menu
        case 'Escape': {
          e.preventDefault();
          if (gameState.characterSheetModal?.isOpen) {
            dispatch({ type: 'CLOSE_CHARACTER_SHEET' });
          } else if (gameState.isMapVisible) {
            dispatch({ type: 'TOGGLE_MAP_VISIBILITY' });
          } else if (gameState.isQuestLogVisible) {
            dispatch({ type: 'TOGGLE_QUEST_LOG' });
          } else if (gameState.isDiscoveryLogVisible) {
            dispatch({ type: 'TOGGLE_DISCOVERY_LOG_VISIBILITY' });
          } else if (gameState.isGlossaryVisible) {
            dispatch({ type: 'TOGGLE_GLOSSARY_VISIBILITY' });
          } else if (gameState.isPartyOverlayVisible) {
            dispatch({ type: 'TOGGLE_PARTY_OVERLAY' });
          } else if (gameState.isShortRestModalVisible) {
            dispatch({ type: 'TOGGLE_SHORT_REST_MODAL' });
          } else if (gameState.isLongRestModalVisible) {
            dispatch({ type: 'TOGGLE_LONG_REST_MODAL' });
          } else if (gameState.isDevMenuVisible) {
            dispatch({ type: 'TOGGLE_DEV_MENU' });
          } else {
            dispatch({ type: 'TOGGLE_DEV_MENU' });
          }
          break;
        }

        // [M] or [Tab] -> Toggle World Map
        case 'KeyM':
        case 'Tab': {
          e.preventDefault();
          if (onAction) {
            onAction({ type: 'toggle_map', label: gameState.isMapVisible ? 'Close Map' : 'World Map' });
          } else {
            dispatch({ type: 'TOGGLE_MAP_VISIBILITY' });
          }
          break;
        }

        // [C] -> Toggle Character Sheet for party leader
        case 'KeyC': {
          e.preventDefault();
          if (gameState.characterSheetModal?.isOpen) {
            dispatch({ type: 'CLOSE_CHARACTER_SHEET' });
          } else if (gameState.party.length > 0) {
            dispatch({ type: 'OPEN_CHARACTER_SHEET', payload: { character: gameState.party[0] } });
          }
          break;
        }

        // [I] -> Toggle Inventory / Character Sheet Items
        case 'KeyI': {
          e.preventDefault();
          if (gameState.characterSheetModal?.isOpen) {
            dispatch({ type: 'CLOSE_CHARACTER_SHEET' });
          } else if (gameState.party.length > 0) {
            dispatch({ type: 'OPEN_CHARACTER_SHEET', payload: { character: gameState.party[0] } });
          }
          break;
        }

        // [P] -> Toggle Party Overlay
        case 'KeyP': {
          e.preventDefault();
          dispatch({ type: 'TOGGLE_PARTY_OVERLAY' });
          break;
        }

        // [Q] or [J] -> Toggle Quest Log (Journal)
        case 'KeyQ':
        case 'KeyJ': {
          e.preventDefault();
          dispatch({ type: 'TOGGLE_QUEST_LOG' });
          break;
        }

        // [L] -> Toggle Discovery Log / Dossier
        case 'KeyL': {
          e.preventDefault();
          dispatch({ type: 'TOGGLE_DISCOVERY_LOG_VISIBILITY' });
          break;
        }

        // [G] -> Toggle Glossary / Compendium
        case 'KeyG': {
          e.preventDefault();
          dispatch({ type: 'TOGGLE_GLOSSARY_VISIBILITY' });
          break;
        }

        // [R] -> Toggle Rest Menu
        case 'KeyR': {
          e.preventDefault();
          dispatch({ type: 'TOGGLE_SHORT_REST_MODAL' });
          break;
        }

        // [V] -> Toggle View Mode (3D World <-> 2D Atlas)
        case 'KeyV': {
          e.preventDefault();
          const nextMode = gameState.worldViewMode === '3d' ? 'atlas' : '3d';
          dispatch({ type: 'SET_WORLD_VIEW_MODE', payload: nextMode });
          break;
        }

        default:
          break;
      }
    },
    [disabled, isPlaying, gameState, dispatch, onAction],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}

export default useGameHotkeys;
