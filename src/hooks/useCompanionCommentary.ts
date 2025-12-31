/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/hooks/useCompanionCommentary.ts
 * A hook to trigger companion reactions based on various game events (decisions, combat, loot).
 * Replaces the basic useCompanionReactions hook.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameState } from '../types';
import { Companion, ReactionTriggerType, CompanionReactionRule } from '../types/companions';

// Cooldown tracking: companionId -> triggerType -> timestamp
type CooldownMap = Record<string, Record<string, number>>;

type CompanionAction =
  | { type: 'ADD_COMPANION_REACTION'; payload: { companionId: string; reaction: string } }
  | { type: 'UPDATE_COMPANION_APPROVAL'; payload: { companionId: string; change: number; reason: string; source: string } };

export const useCompanionCommentary = (
  gameState: GameState,
  dispatch: React.Dispatch<CompanionAction>,
  // lastAction is removed from props as we rely on state diffing
) => {
  const [cooldowns, setCooldowns] = useState<CooldownMap>({});

  // Track previous state to detect changes
  const prevLocationRef = useRef(gameState.currentLocationId);
  const prevMessagesLengthRef = useRef(gameState.messages.length);
  const prevGoldRef = useRef(gameState.gold);

  // Helper to check cooldowns
  const isOnCooldown = useCallback((companionId: string, triggerType: string, cooldownMinutes: number = 1): boolean => {
    const lastTrigger = cooldowns[companionId]?.[triggerType] || 0;
    const now = Date.now();
    return (now - lastTrigger) < (cooldownMinutes * 60 * 1000);
  }, [cooldowns]);

  // Helper to set cooldown
  const setCooldown = useCallback((companionId: string, triggerType: string) => {
    setCooldowns(prev => ({
      ...prev,
      [companionId]: {
        ...(prev[companionId] || {}),
        [triggerType]: Date.now()
      }
    }));
  }, []);

  // Main evaluation logic
  const evaluateReaction = useCallback((triggerType: ReactionTriggerType, tags: string[] = []) => {
    if (!gameState.companions) {
      return;
    }

    // Find all valid reactions from all companions
    const candidates: {
      companionId: string;
      rule: CompanionReactionRule;
      score: number
    }[] = [];

    Object.values(gameState.companions).forEach((companion: Companion) => {
      companion.reactionRules.forEach(rule => {
        const ruleType = rule.triggerType || 'decision';
        if (ruleType !== triggerType) return;

        if (rule.triggerTags.length > 0) {
          const hasMatch = rule.triggerTags.some(tag => tags.includes(tag));
          if (!hasMatch) return;
        }

        if (rule.cooldown && isOnCooldown(companion.id, `${triggerType}_${rule.triggerTags.join('_')}`, rule.cooldown)) {
          return;
        }

        // 4. Check Chance
        if (rule.chance !== undefined && Math.random() > rule.chance) {
          return;
        }

        if (rule.requirements?.locationId && rule.requirements.locationId !== gameState.currentLocationId) {
          return;
        }

        const priority = rule.priority || 0;
        candidates.push({
          companionId: companion.id,
          rule,
          score: priority * 10 + Math.random()
        });
      });
    });

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      const winner = candidates[0];
      const dialogue = winner.rule.dialoguePool[Math.floor(Math.random() * winner.rule.dialoguePool.length)];

      dispatch({
        type: 'ADD_COMPANION_REACTION',
        payload: {
          companionId: winner.companionId,
          reaction: dialogue
        }
      });

      if (winner.rule.approvalChange !== 0) {
        dispatch({
          type: 'UPDATE_COMPANION_APPROVAL',
          payload: {
            companionId: winner.companionId,
            change: winner.rule.approvalChange,
            reason: `Reaction to ${triggerType}`,
            source: 'system'
          }
        });
      }

      if (winner.rule.cooldown) {
        setCooldown(winner.companionId, `${triggerType}_${winner.rule.triggerTags.join('_')}`);
      }
    }
  }, [gameState.companions, gameState.currentLocationId, isOnCooldown, setCooldown, dispatch]);

  // --- EVENT LISTENERS (State Diffing) ---

  // 1. Location Changes
  useEffect(() => {
    if (gameState.currentLocationId !== prevLocationRef.current) {
      prevLocationRef.current = gameState.currentLocationId;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      evaluateReaction('location'); // Tag could be biome or region derived from location
    }
  }, [gameState.currentLocationId, evaluateReaction]); // Re-run when location changes

  // 2. Loot / Messages
  useEffect(() => {
    if (gameState.messages.length > prevMessagesLengthRef.current) {
      const newMessages = gameState.messages.slice(prevMessagesLengthRef.current);
      prevMessagesLengthRef.current = gameState.messages.length;

      // Check if any message indicates valuable loot
      // Or if Gold amount increased significantly
      const goldDiff = gameState.gold - prevGoldRef.current;
      if (goldDiff > 50) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        evaluateReaction('loot', ['gold']);
      }
      prevGoldRef.current = gameState.gold;

      // Check messages for item pickups (if log text is consistent)
      // "You picked up X"
      newMessages.forEach(msg => {
        if (msg.text.includes("picked up") || msg.text.includes("received")) {
          if (msg.text.toLowerCase().includes("gem") || msg.text.toLowerCase().includes("artifact")) {
            evaluateReaction('loot', ['valuable']);
          }
        }
        if (msg.text.includes("Victory!")) {
          evaluateReaction('combat_end', ['victory']);
        }
      });
    }
  }, [gameState.messages, gameState.gold, evaluateReaction]);

};
