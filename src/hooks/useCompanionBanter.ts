/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/hooks/useCompanionBanter.ts
 * Hook to trigger and manage companion banter.
 */

import { useEffect, useRef, useState } from 'react';
import { GameState } from '../types';
import { BanterManager } from '../systems/companions/BanterManager';
import { BanterDefinition } from '../types/companions';

export const useCompanionBanter = (
  gameState: GameState,
  dispatch: React.Dispatch<any>
) => {
  // We don't return state, just manage the flow.
  // We use refs to track active banter to avoid re-renders just for logic updates.
  const activeBanterRef = useRef<{ definition: BanterDefinition; lineIndex: number } | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to play the next line of the active banter
  const playNextLine = () => {
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
      playNextLine();
    }, line.delay || 4000);
  };

  // Trigger Logic
  useEffect(() => {
    const checkBanter = () => {
      // Don't start if already talking
      if (activeBanterRef.current) return;

      // 10% chance every 10s to TRY finding a banter
      // The BanterManager.selectBanter has its own internal probability check too
      if (Math.random() < 0.1) {
        const banter = BanterManager.selectBanter(gameState);
        if (banter) {
          BanterManager.markBanterUsed(banter.id);
          activeBanterRef.current = { definition: banter, lineIndex: 0 };
          playNextLine();
        }
      }
    };

    const interval = setInterval(checkBanter, 10000);
    return () => clearInterval(interval);
  }, [gameState.currentLocationId, gameState.companions]); // Dependencies affect availability

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      activeBanterRef.current = null; // Reset state on unmount
    };
  }, []);
};
