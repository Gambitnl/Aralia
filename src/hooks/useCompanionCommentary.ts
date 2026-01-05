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
import { isPlayerFocused } from '../utils/world';
import { Companion, ReactionTriggerType, CompanionReactionRule } from '../types/companions';
import { OllamaService, BanterContext } from '../services/OllamaService';

// Cooldown tracking: companionId -> triggerType -> timestamp
type CooldownMap = Record<string, Record<string, number>>;

type CompanionAction =
  | { type: 'ADD_COMPANION_REACTION'; payload: { companionId: string; reaction: string } }
  | { type: 'UPDATE_COMPANION_APPROVAL'; payload: { companionId: string; change: number; reason: string; source: string } }
  | { type: 'ADD_OLLAMA_LOG_ENTRY'; payload: { timestamp: Date; model: string; prompt: string; response: string; context?: any } };

export const useCompanionCommentary = (
  gameState: GameState,
  dispatch: React.Dispatch<CompanionAction>,
) => {
  const [cooldowns, setCooldowns] = useState<CooldownMap>({});

  // Track previous state to detect changes
  const prevLocationRef = useRef(gameState.currentLocationId);
  const prevMessagesLengthRef = useRef(gameState.messages.length);
  const prevGoldRef = useRef(gameState.gold);
  const prevKnownCrimesRef = useRef(gameState.notoriety?.knownCrimes?.length || 0);

  // Startup timestamp - suppress reactions for first 5 seconds to prevent false triggers during initialization
  const startupTimestampRef = useRef(Date.now());
  const STARTUP_DELAY_MS = 5000;

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
  const evaluateReaction = useCallback(async (triggerType: ReactionTriggerType, tags: string[] = [], eventDescription?: string) => {
    // Skip reactions during startup period
    if (Date.now() - startupTimestampRef.current < STARTUP_DELAY_MS) {
      return;
    }

    if (!gameState.companions) {
      return;
    }

    // Don't trigger reactions if the player is busy focusing on something else
    if (isPlayerFocused(gameState)) {
      return;
    }

    // Find all valid reactions from all companions
    const candidates: {
      companionId: string;
      companion: Companion;
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

        // Check Chance
        if (rule.chance !== undefined && Math.random() > rule.chance) {
          return;
        }

        if (rule.requirements?.locationId && rule.requirements.locationId !== gameState.currentLocationId) {
          return;
        }

        const priority = rule.priority || 0;
        candidates.push({
          companionId: companion.id,
          companion,
          rule,
          score: priority * 10 + Math.random()
        });
      });
    });

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      const winner = candidates[0];

      // Build context for AI
      const locId = gameState.currentLocationId;
      const locName = gameState.dynamicLocations?.[locId]?.name || locId;
      const context: BanterContext = {
        locationName: locName,
        weather: gameState.environment?.currentWeather,
        timeOfDay: new Date(gameState.gameTime).getHours() < 12 ? 'Morning' : 'Afternoon',
        currentTask: gameState.questLog.find(q => q.status === 'Active' || (q.status as any) === 'active')?.title,
      };

      let dialogue = winner.rule.dialoguePool[Math.floor(Math.random() * winner.rule.dialoguePool.length)];
      let approvalChange = winner.rule.approvalChange;

      // Try AI-generated reaction if eventDescription is provided
      if (eventDescription) {
        const isAvailable = await OllamaService.isAvailable();
        if (isAvailable) {
          const result = await OllamaService.generateReaction(
            {
              id: winner.companion.id,
              name: winner.companion.identity.name,
              race: winner.companion.identity.race,
              class: winner.companion.identity.class,
              sex: winner.companion.identity.sex,
              personality: `Values: ${winner.companion.personality.values.join(', ')}. Quirks: ${winner.companion.personality.quirks.join(', ')}.`
            },
            {
              type: triggerType,
              description: eventDescription,
              tags
            },
            context
          );

          if (result.metadata) {
            dispatch({
              type: 'ADD_OLLAMA_LOG_ENTRY',
              payload: {
                timestamp: new Date(),
                model: result.metadata.model,
                prompt: result.metadata.prompt,
                response: result.metadata.response,
                context
              }
            });
          }

          if (result.data) {
            dialogue = result.data.text;
            approvalChange = result.data.approvalChange;
          }
        }
      }

      dispatch({
        type: 'ADD_COMPANION_REACTION',
        payload: {
          companionId: winner.companionId,
          reaction: dialogue
        }
      });

      if (approvalChange !== 0) {
        dispatch({
          type: 'UPDATE_COMPANION_APPROVAL',
          payload: {
            companionId: winner.companionId,
            change: approvalChange,
            reason: `Reaction to ${triggerType}`,
            source: 'system'
          }
        });
      }

      if (winner.rule.cooldown) {
        setCooldown(winner.companionId, `${triggerType}_${winner.rule.triggerTags.join('_')}`);
      }
    }
  }, [gameState, isOnCooldown, setCooldown, dispatch]);

  // --- EVENT LISTENERS (State Diffing) ---

  // 1. Location Changes
  useEffect(() => {
    if (gameState.currentLocationId !== prevLocationRef.current) {
      prevLocationRef.current = gameState.currentLocationId;
      evaluateReaction('location');
    }
  }, [gameState.currentLocationId, evaluateReaction]);

  // 2. Loot / Messages
  useEffect(() => {
    if (gameState.messages.length > prevMessagesLengthRef.current) {
      const newMessages = gameState.messages.slice(prevMessagesLengthRef.current);
      prevMessagesLengthRef.current = gameState.messages.length;

      // Check if Gold amount increased significantly
      const goldDiff = gameState.gold - prevGoldRef.current;
      if (goldDiff > 50) {
        evaluateReaction('loot', ['gold'], `The party found ${goldDiff} gold coins.`);
      }
      prevGoldRef.current = gameState.gold;

      // Check messages for item pickups
      newMessages.forEach(msg => {
        if (msg.text.includes("picked up") || msg.text.includes("received")) {
          const itemDescription = msg.text.replace(/You (picked up|received)/gi, 'The party acquired').trim();
          if (msg.text.toLowerCase().includes("gem") || msg.text.toLowerCase().includes("artifact")) {
            evaluateReaction('loot', ['valuable'], itemDescription);
          } else {
            evaluateReaction('loot', ['item'], itemDescription);
          }
        }
        if (msg.text.includes("Victory!")) {
          evaluateReaction('combat_end', ['victory'], 'The party won a combat encounter.');
        }
      });
    }
  }, [gameState.messages, gameState.gold, evaluateReaction]);

  // 3. Crimes
  useEffect(() => {
    // Handle case where notoriety might be undefined
    if (!gameState.notoriety?.knownCrimes) return;

    // Reset ref if knownCrimes shrunk (e.g. load game or clear history)
    if (gameState.notoriety.knownCrimes.length < prevKnownCrimesRef.current) {
      prevKnownCrimesRef.current = gameState.notoriety.knownCrimes.length;
      return;
    }

    if (gameState.notoriety.knownCrimes.length > prevKnownCrimesRef.current) {
      const newCrimes = gameState.notoriety.knownCrimes.slice(prevKnownCrimesRef.current);
      prevKnownCrimesRef.current = gameState.notoriety.knownCrimes.length;

      newCrimes.forEach(crime => {
        const tags = [crime.type.toLowerCase()];
        if (crime.severity > 50) tags.push('severe');
        if (crime.witnessed) tags.push('witnessed');

        const crimeDescription = `The player committed ${crime.type}${crime.witnessed ? ' and was witnessed' : ''}.`;
        evaluateReaction('crime_committed', tags, crimeDescription);
      });
    }
  }, [gameState.notoriety?.knownCrimes, evaluateReaction]);

  // TODO(2026-01-03 pass 4 Codex-CLI): hook currently has side effects only; return value reserved for future manual triggers/cleanup.
  return null;
};
