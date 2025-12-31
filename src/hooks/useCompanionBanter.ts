/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/hooks/useCompanionBanter.ts
 * Hook to trigger and manage companion banter.
 */
// TODO(lint-intent): 'useState' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { useCallback, useEffect, useRef, useState as _useState } from 'react';
import { GameState } from '../types';
import { BanterManager } from '../systems/companions/BanterManager';
import { BanterDefinition } from '../types/companions';

export const useCompanionBanter = (
  gameState: GameState,
  // TODO(lint-intent): The any on this value hides the intended shape of this data.
  // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
  // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
  dispatch: React.Dispatch<unknown>
) => {
  // We don't return state, just manage the flow.
  // We use refs to track active banter to avoid re-renders just for logic updates.
  const activeBanterRef = useRef<{ definition: BanterDefinition; lineIndex: number } | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gameStateRef = useRef(gameState);
  const playNextLineRef = useRef<() => void>(() => {});

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Helper to play the next line of the active banter
  const playNextLine = useCallback(() => {
    const active = activeBanterRef.current;
    if (!active) return;

    if (active.lineIndex >= active.definition.lines.length) {
      // Banter finished
      activeBanterRef.current = null;
      return;
    }

    const line = active.definition.lines[active.lineIndex];
    active.lineIndex++;

    // Dispatch message
    dispatch({
      type: 'ADD_MESSAGE',
      payload: {
        id: crypto.randomUUID(),
        text: `: "${line.text}"`,
        sender: 'npc',
        timestamp: Date.now(),
        metadata: {
          companionId: line.speakerId,
          type: 'banter'
        }
      }
    });

    // Schedule next line
    timeoutRef.current = setTimeout(() => {
      playNextLineRef.current();
    }, line.delay || 4000);
  }, [dispatch]);

  useEffect(() => {
    playNextLineRef.current = playNextLine;
  }, [playNextLine]);

  // Trigger Logic
  useEffect(() => {
    const checkBanter = () => {
      // Don't start if already talking
      if (activeBanterRef.current) return;

      // 10% chance every 10s to TRY finding a banter
      // The BanterManager.selectBanter has its own internal probability check too
      if (Math.random() < 0.1) {
        const banter = BanterManager.selectBanter(gameStateRef.current);
        if (banter) {
          // Update cooldown in state via dispatch instead of static method
          dispatch({
            type: 'UPDATE_BANTER_COOLDOWN',
            payload: { banterId: banter.id, timestamp: Date.now() }
          });
          activeBanterRef.current = { definition: banter, lineIndex: 0 };
          playNextLine();
        }
      }
    };

    const interval = setInterval(checkBanter, 10000);
    return () => clearInterval(interval);
  // TODO(lint-intent): If banter timing should reset on location/party changes, add those fields to the deps.
  }, [dispatch, playNextLine]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      activeBanterRef.current = null; // Reset state on unmount
    };
  }, []);
};
