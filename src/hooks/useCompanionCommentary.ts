/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/hooks/useCompanionCommentary.ts
 * A hook to trigger companion reactions based on various game events (decisions, combat, loot).
 * Replaces the basic useCompanionReactions hook.
 */

import { useEffect, useRef, useState } from 'react';
import { GameState, Action } from '../types';
import { Companion, ReactionTriggerType, CompanionReactionRule } from '../types/companions';
import { COMPANIONS } from '../data/companions';

// Cooldown tracking: companionId -> triggerType -> timestamp
type CooldownMap = Record<string, Record<string, number>>;

export const useCompanionCommentary = (
  gameState: GameState,
  dispatch: React.Dispatch<any>,
  // lastAction is removed from props as we rely on state diffing
) => {
  const [cooldowns, setCooldowns] = useState<CooldownMap>({});

  // Track previous state to detect changes
  const prevLocationRef = useRef(gameState.currentLocationId);
  const prevMessagesLengthRef = useRef(gameState.messages.length);
  const prevGoldRef = useRef(gameState.gold);

  // Helper to check cooldowns
  const isOnCooldown = (companionId: string, triggerType: string, cooldownMinutes: number = 1): boolean => {
    const lastTrigger = cooldowns[companionId]?.[triggerType] || 0;
    const now = Date.now();
    return (now - lastTrigger) < (cooldownMinutes * 60 * 1000);
  };

  // Helper to set cooldown
  const setCooldown = (companionId: string, triggerType: string) => {
    setCooldowns(prev => ({
      ...prev,
      [companionId]: {
        ...(prev[companionId] || {}),
        [triggerType]: Date.now()
      }
    }));
  };

  // Main evaluation logic
  const evaluateReaction = (triggerType: ReactionTriggerType, tags: string[] = []) => {
    if (!gameState.companions) return;

    // Find all valid reactions from all companions
    const candidates: {
      companionId: string;
      rule: CompanionReactionRule;
      score: number
    }[] = [];

    Object.values(gameState.companions).forEach((companion: Companion) => {
      // Skip if companion is not present/active (logic depends on party system)
      // For now, assume all in gameState.companions are with you

      companion.reactionRules.forEach(rule => {
        // 1. Check Trigger Type
        // Fallback: If rule has no triggerType, assume 'decision' (legacy)
        const ruleType = rule.triggerType || 'decision';
        if (ruleType !== triggerType) return;

        // 2. Check Tags (if applicable)
        // If rule has tags, at least one must match the input tags
        if (rule.triggerTags.length > 0) {
           const hasMatch = rule.triggerTags.some(tag => tags.includes(tag));
           if (!hasMatch) return;
        }

        // 3. Check Cooldown
        if (rule.cooldown && isOnCooldown(companion.id, `${triggerType}_${rule.triggerTags.join('_')}`, rule.cooldown)) {
           return;
        }

        // 4. Check Chance
        if (rule.requirements?.chance && Math.random() > rule.requirements.chance) {
           return;
        }

        // 5. Check Requirements (Location, Relationship)
        if (rule.requirements?.minRelationship) {
           // Logic to check relationship level would go here
        }
        if (rule.requirements?.locationId && rule.requirements.locationId !== gameState.currentLocationId) {
           return;
        }

        // Candidate found! Calculate score (priority + randomness)
        const priority = rule.priority || 0;
        candidates.push({
          companionId: companion.id,
          rule,
          score: priority * 10 + Math.random()
        });
      });
    });

    // Pick the winner
    if (candidates.length > 0) {
      // Sort by score descending
      candidates.sort((a, b) => b.score - a.score);
      const winner = candidates[0];

      // Trigger the reaction
      const dialogue = winner.rule.dialoguePool[Math.floor(Math.random() * winner.rule.dialoguePool.length)];

      dispatch({
        type: 'ADD_COMPANION_REACTION',
        payload: {
          companionId: winner.companionId,
          reaction: dialogue
        }
      });

      // Apply approval change if any
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

      // Set cooldown
      if (winner.rule.cooldown) {
          setCooldown(winner.companionId, `${triggerType}_${winner.rule.triggerTags.join('_')}`);
      }
    }
  };

  // --- EVENT LISTENERS (State Diffing) ---

  // 1. Location Changes
  useEffect(() => {
    if (gameState.currentLocationId !== prevLocationRef.current) {
        prevLocationRef.current = gameState.currentLocationId;
        evaluateReaction('location'); // Tag could be biome or region derived from location
    }
  }, [gameState.currentLocationId]); // Re-run when location changes

  // 2. Loot / Messages
  useEffect(() => {
      if (gameState.messages.length > prevMessagesLengthRef.current) {
          const newMessages = gameState.messages.slice(prevMessagesLengthRef.current);
          prevMessagesLengthRef.current = gameState.messages.length;

          // Check if any message indicates valuable loot
          // Or if Gold amount increased significantly
          const goldDiff = gameState.gold - prevGoldRef.current;
          if (goldDiff > 50) {
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
  }, [gameState.messages, gameState.gold]);

};
