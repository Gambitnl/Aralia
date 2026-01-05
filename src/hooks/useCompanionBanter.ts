/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/hooks/useCompanionBanter.ts
 * Hook to trigger and manage companion banter with turn-by-turn AI generation.
 * Supports player interruption to join the conversation.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { GameState, GamePhase } from '../types';
import { isPlayerFocused, isNpcOccupied } from '../utils/world';
import { AppAction } from '../state/actionTypes';
import { OllamaService, BanterContext } from '../services/OllamaService';
import { Companion } from '../types/companions';

interface BanterHistoryLine {
  speakerId: string;
  speakerName: string;
  text: string;
}

// How long to wait between NPC banter lines (30 seconds)
const BANTER_DELAY_MS = 30000;

export const useCompanionBanter = (
  gameState: GameState,
  dispatch: React.Dispatch<AppAction>,
  isBanterPaused: boolean = false
) => {
  const isGeneratingRef = useRef(false);
  const banterHistoryRef = useRef<BanterHistoryLine[]>([]);
  const participantsRef = useRef<Companion[]>([]);
  const contextRef = useRef<BanterContext | null>(null);
  const turnRef = useRef(0);
  const failureCountRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gameStateRef = useRef(gameState);

  // Exposed state for UI
  const [isBanterActive, setIsBanterActive] = useState(false);
  const [isWaitingForNextLine, setIsWaitingForNextLine] = useState(false);
  const [secondsUntilNextLine, setSecondsUntilNextLine] = useState(0);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Countdown timer for UI
  useEffect(() => {
    if (!isWaitingForNextLine || secondsUntilNextLine <= 0) return;

    const countdownInterval = setInterval(() => {
      setSecondsUntilNextLine(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [isWaitingForNextLine, secondsUntilNextLine]);

  /**
   * End the current banter session
   */
  const endBanter = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    isGeneratingRef.current = false;
    banterHistoryRef.current = [];
    turnRef.current = 0;
    failureCountRef.current = 0;
    setIsBanterActive(false);
    setIsWaitingForNextLine(false);
    setSecondsUntilNextLine(0);
  }, []);

  /**
   * Generate and play the next line of banter.
   */
  const generateNextLine = useCallback(async () => {
    if (!contextRef.current || participantsRef.current.length < 2) {
      endBanter();
      return;
    }

    setIsWaitingForNextLine(false);
    turnRef.current++;

    // Check max turns
    if (turnRef.current > 8) {
      endBanter();
      return;
    }

    const participants = participantsRef.current.map(c => ({
      id: c.id,
      name: c.identity.name,
      race: c.identity.race,
      class: c.identity.class,
      sex: c.identity.sex,
      age: c.identity.age,
      physicalDescription: c.identity.physicalDescription,
      personality: `${c.personality.values.join(', ')}. Quirks: ${c.personality.quirks.join(', ')}`
    }));

    const result = await OllamaService.generateBanterLine(
      participants,
      banterHistoryRef.current,
      contextRef.current,
      turnRef.current
    );

    // Log the AI interaction
    if (result.metadata) {
      dispatch({
        type: 'ADD_OLLAMA_LOG_ENTRY',
        payload: {
          timestamp: new Date(),
          model: result.metadata.model,
          prompt: result.metadata.prompt,
          response: result.metadata.response,
          context: contextRef.current
        }
      });
    }

    if (!result.data) {
      // AI failed - don't end immediately, wait and try again
      console.debug('Banter line generation failed, will retry...');
      failureCountRef.current += 1;
      dispatch({
        type: 'ADD_BANTER_DEBUG_LOG',
        payload: {
          timestamp: new Date(),
          check: 'Generation',
          result: false,
          details: result.metadata?.response
            ? `No parseable JSON (${result.metadata.response.slice(0, 180)}...)`
            : 'No response from Ollama'
        }
      });

      if (failureCountRef.current >= 3) {
        endBanter();
        return;
      }

      setIsWaitingForNextLine(true);
      setSecondsUntilNextLine(10); // Shorter retry delay
      timeoutRef.current = setTimeout(() => {
        generateNextLine();
      }, 10000);
      return;
    }

    failureCountRef.current = 0;

    const { speakerId, text, isConcluding } = result.data;

    // Find speaker name
    const speaker = participantsRef.current.find(p => p.id === speakerId);
    const speakerName = speaker?.identity.name || speakerId;

    // Add to history
    banterHistoryRef.current.push({
      speakerId,
      speakerName,
      text
    });

    // Display the line
    dispatch({
      type: 'ADD_MESSAGE',
      payload: {
        id: Date.now(),
        text: `${speakerName}: "${text}"`,
        sender: 'npc',
        timestamp: new Date(),
        metadata: {
          companionId: speakerId,
          type: 'banter'
        }
      }
    });

    // Check if banter should conclude
    if (isConcluding || turnRef.current >= 8) {
      endBanter();
      return;
    }

    // Wait and generate next line (30 seconds)
    setIsWaitingForNextLine(true);
    setSecondsUntilNextLine(BANTER_DELAY_MS / 1000);
    timeoutRef.current = setTimeout(() => {
      generateNextLine();
    }, BANTER_DELAY_MS);
  }, [dispatch, endBanter]);

  /**
   * Player interrupts the banter to add their own message
   */
  const playerInterrupt = useCallback((playerMessage: string) => {
    if (!isBanterActive || !contextRef.current) return;

    // Cancel pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsWaitingForNextLine(false);
    setSecondsUntilNextLine(0);

    // Get player name
    const playerName = gameStateRef.current.party[0]?.name || 'You';
    const playerId = gameStateRef.current.party[0]?.id || 'player';

    // Add player's message to history
    banterHistoryRef.current.push({
      speakerId: playerId,
      speakerName: playerName,
      text: playerMessage
    });

    // Display player's message
    dispatch({
      type: 'ADD_MESSAGE',
      payload: {
        id: Date.now(),
        text: `${playerName}: "${playerMessage}"`,
        sender: 'player',
        timestamp: new Date(),
        metadata: {
          type: 'banter'
        }
      }
    });

    // Continue with NPC response after a short delay
    turnRef.current++;
    setTimeout(() => {
      generateNextLine();
    }, 1500);
  }, [isBanterActive, dispatch, generateNextLine]);

  /**
   * Start a new banter session.
   */
  const startBanter = useCallback(async () => {
    const state = gameStateRef.current;
    const now = Date.now();

    // Debug log helper
    const logEntry = (check: string, result: boolean | string, details?: string) => {
      dispatch({ type: 'ADD_BANTER_DEBUG_LOG', payload: { timestamp: new Date(), check, result, details } });
    };

    logEntry('Trigger Check', true, `Tick at ${new Date().toLocaleTimeString()}`);

    if (isGeneratingRef.current) {
      logEntry('isGenerating', false, 'Already generating banter');
      return;
    }

    if (state.phase !== GamePhase.PLAYING) {
      logEntry('GamePhase', false, `Phase: ${state.phase}`);
      return;
    }

    if (isBanterPaused) {
      logEntry('Paused', false, 'Banter triggers manually paused');
      return;
    }
    logEntry('GamePhase', true, 'PLAYING');

    if (isPlayerFocused(state)) {
      logEntry('isPlayerFocused', false, 'Player in focused UI');
      return;
    }
    logEntry('isPlayerFocused', true, 'Not focused');

    const globalCooldown = state.banterCooldowns['GLOBAL'] || 0;
    const cooldownRemaining = Math.max(0, 120000 - (now - globalCooldown));
    if (cooldownRemaining > 0) {
      logEntry('Cooldown', false, `${Math.round(cooldownRemaining / 1000)}s left`);
      return;
    }
    logEntry('Cooldown', true, 'Elapsed');

    // 10% chance to trigger
    const roll = Math.random();
    if (roll >= 0.1) {
      logEntry('Roll', false, `${(roll * 100).toFixed(0)}% (need <10%)`);
      return;
    }
    logEntry('Roll', true, `${(roll * 100).toFixed(0)}% - TRIGGER!`);

    const isAvailable = await OllamaService.isAvailable();
    if (!isAvailable) {
      logEntry('Ollama', false, 'Not reachable');
      return;
    }
    logEntry('Ollama', true, 'Available');

    const availableCompanions = state.party
      .map(p => p.id ? state.companions[p.id] : undefined)
      .filter((c): c is Companion => !!c && !isNpcOccupied(state, c.id));

    if (availableCompanions.length < 2) {
      logEntry('Companions', false, `${availableCompanions.length} (need 2+)`);
      return;
    }
    logEntry('Companions', true, `${availableCompanions.length}: ${availableCompanions.map(c => c.identity.name).join(', ')}`);

    // Set up banter context
    const locId = state.currentLocationId;
    const locName = state.dynamicLocations?.[locId]?.name || locId;
    const weather = state.environment?.currentWeather || 'Clear';
    const hour = new Date(state.gameTime).getHours();
    const timeOfDay = hour < 6 ? 'Night' : hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
    const activeQuest = state.questLog.find(q => q.status === 'Active' || (q.status as any) === 'active');

    contextRef.current = {
      locationName: locName,
      weather,
      timeOfDay,
      currentTask: activeQuest?.title
    };

    participantsRef.current = availableCompanions;
    banterHistoryRef.current = [];
    turnRef.current = 0;
    failureCountRef.current = 0;
    isGeneratingRef.current = true;
    setIsBanterActive(true);

    logEntry('STARTED', true, `${locName} @ ${timeOfDay}`);

    // Update cooldown
    dispatch({
      type: 'UPDATE_BANTER_COOLDOWN',
      payload: { banterId: 'GLOBAL', timestamp: now }
    });

    // Start generating
    generateNextLine();
  }, [dispatch, generateNextLine]);

  /**
   * Force-start a banter, skipping cooldown and random roll.
   */
  const forceBanter = useCallback(async () => {
    const state = gameStateRef.current;
    const now = Date.now();

    const logEntry = (check: string, result: boolean | string, details?: string) => {
      dispatch({ type: 'ADD_BANTER_DEBUG_LOG', payload: { timestamp: new Date(), check, result, details } });
    };

    logEntry('FORCE TRIGGER', true, 'Manual trigger initiated');

    if (isGeneratingRef.current) {
      logEntry('isGenerating', false, 'Already generating banter');
      return;
    }

    const isAvailable = await OllamaService.isAvailable();
    if (!isAvailable) {
      logEntry('Ollama', false, 'Not reachable');
      return;
    }
    logEntry('Ollama', true, 'Available');

    const availableCompanions = state.party
      .map(p => p.id ? state.companions[p.id] : undefined)
      .filter((c): c is Companion => !!c && !isNpcOccupied(state, c.id));

    if (availableCompanions.length < 2) {
      logEntry('Companions', false, `${availableCompanions.length} (need 2+)`);
      return;
    }
    logEntry('Companions', true, `${availableCompanions.length}: ${availableCompanions.map(c => c.identity.name).join(', ')}`);

    // Set up banter context
    const locId = state.currentLocationId;
    const locName = state.dynamicLocations?.[locId]?.name || locId;
    const weather = state.environment?.currentWeather || 'Clear';
    const hour = new Date(state.gameTime).getHours();
    const timeOfDay = hour < 6 ? 'Night' : hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
    const activeQuest = state.questLog.find(q => q.status === 'Active' || (q.status as any) === 'active');

    contextRef.current = {
      locationName: locName,
      weather,
      timeOfDay,
      currentTask: activeQuest?.title
    };

    participantsRef.current = availableCompanions;
    banterHistoryRef.current = [];
    turnRef.current = 0;
    failureCountRef.current = 0;
    isGeneratingRef.current = true;
    setIsBanterActive(true);

    logEntry('FORCE STARTED', true, `${locName} @ ${timeOfDay}`);

    // Update cooldown
    dispatch({
      type: 'UPDATE_BANTER_COOLDOWN',
      payload: { banterId: 'GLOBAL', timestamp: now }
    });

    // Start generating
    generateNextLine();
  }, [dispatch, generateNextLine]);

  // Check for banter periodically
  useEffect(() => {
    const interval = setInterval(startBanter, 10000);
    return () => clearInterval(interval);
  }, [startBanter]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      isGeneratingRef.current = false;
    };
  }, []);

  return {
    forceBanter,
    isBanterActive,
    isWaitingForNextLine,
    secondsUntilNextLine,
    playerInterrupt,
    endBanter
  };
};
