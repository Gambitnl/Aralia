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
import { OllamaService, BanterContext, extractDiscoveredFacts } from '../services/ollama';
import { createOllamaLogEntry } from '../utils/createOllamaLogEntry';
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
  const [banterHistory, setBanterHistory] = useState<BanterHistoryLine[]>([]);

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

    // Archive the banter if it had any meaningful content
    if (banterHistoryRef.current.length > 0) {
      const moment: import('../types/companions').BanterMoment = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        locationId: gameStateRef.current.currentLocationId,
        participants: participantsRef.current.map(p => p.id),
        lines: banterHistoryRef.current.map(line => ({
          speakerId: line.speakerId,
          speakerName: line.speakerName,
          text: line.text
        }))
      };

      dispatch({
        type: 'ARCHIVE_BANTER',
        payload: moment
      });
    }

    // Generate memory/backstory from this conversation if it was substantial
    if (banterHistoryRef.current.length >= 3 && contextRef.current) {
      const historyForSummary = [...banterHistoryRef.current];
      const participantsForSummary = participantsRef.current.map(p => ({
        id: p.id,
        name: p.identity.name,
        personality: p.personality.values.join(', ')
      }));
      const contextForSummary = { ...contextRef.current };

      // Get existing discovered facts for each companion to avoid duplicates
      const participantsForFactExtraction = participantsRef.current.map(p => ({
        id: p.id,
        name: p.identity.name,
        knownFacts: (p.discoveredFacts || []).map(f => f.fact)
      }));

      // Async processing (fire and forget) - Summarize conversation into memory
      OllamaService.summarizeConversation(
        participantsForSummary,
        historyForSummary,
        contextForSummary
      ).then(result => {
        if (result.success) {
          const { text, tags } = result.data;
          // Add memory to all participants
          participantsForSummary.forEach(p => {
            dispatch({
              type: 'ADD_COMPANION_MEMORY',
              payload: {
                companionId: p.id,
                memory: {
                  id: crypto.randomUUID(),
                  type: 'banter',
                  text,
                  tags,
                  timestamp: Date.now(),
                  importance: 5
                }
              }
            });
          });
        } else {
          console.warn('Failed to summarize banter:', result.error);
        }
      }).catch(err => console.error('Failed to summarize banter (unexpected):', err));

      // Async processing (fire and forget) - Extract new character facts
      extractDiscoveredFacts(historyForSummary, participantsForFactExtraction)
        .then(factsResult => {
          if (factsResult.success && factsResult.data.length > 0) {
            console.debug(`Extracted ${factsResult.data.length} new character facts from banter`);
            factsResult.data.forEach(factWithId => {
              // The fact already includes companionId from the LLM response
              const { companionId, ...fact } = factWithId as { companionId: string } & typeof factWithId;
              dispatch({
                type: 'ADD_DISCOVERED_FACT',
                payload: { companionId, fact }
              });
            });
          }
        })
        .catch(err => console.error('Failed to extract character facts:', err));
    }

    isGeneratingRef.current = false;
    banterHistoryRef.current = [];
    setBanterHistory([]);
    turnRef.current = 0;
    failureCountRef.current = 0;
    setIsBanterActive(false);
    setIsWaitingForNextLine(false);
    setSecondsUntilNextLine(0);
  }, [dispatch]);

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
      personality: `${c.personality.values.join(', ')}. Quirks: ${c.personality.quirks.join(', ')}`,
      memories: c.memories?.map(m => m.text) || []
    }));

    const result = await OllamaService.generateBanterLine(
      participants,
      banterHistoryRef.current,
      contextRef.current,
      turnRef.current,
      (id, prompt, model) => {
        dispatch({
          type: 'ADD_OLLAMA_LOG_ENTRY',
          payload: {
            id,
            timestamp: new Date(),
            model,
            prompt,
            response: 'Waiting for response...',
            context: contextRef.current,
            isPending: true
          }
        });
      }
    );

    // Update the log with the response
    if (result.metadata) {
      dispatch({
        type: 'UPDATE_OLLAMA_LOG_ENTRY',
        payload: {
          id: result.metadata.id || '',
          response: result.metadata.response || '',
          model: result.metadata.model
        }
      });
    }

    if (!result.success) {
      // AI failed - don't end immediately, wait and try again
      console.debug('Banter line generation failed, will retry...', result.error);
      failureCountRef.current += 1;

      let details = 'Unknown error';
      if (result.error) {
        if (result.error.type === 'PARSE_ERROR') {
          details = `JSON Parse Error: ${result.error.message}`;
        } else if (result.error.type === 'TIMEOUT') {
          details = `Timeout: ${result.error.message}`;
        } else {
          details = `${result.error.type}: ${result.error.message}`;
        }
      }

      dispatch({
        type: 'ADD_BANTER_DEBUG_LOG',
        payload: {
          timestamp: new Date(),
          check: 'Generation',
          result: false,
          details
        }
      });

      // TODO: Refactor retry logic (max 3 attempts, 10s delay) into configurable constants to avoid magic numbers and allow tuning of "AI stubbornness".
      // TODO: When failing 3x, capture last prompt/metadata into the debug log for postmortems instead of silently ending the banter loop.
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
    const newHistoryItem = {
      speakerId,
      speakerName,
      text
    };
    banterHistoryRef.current.push(newHistoryItem);
    setBanterHistory(prev => [...prev, newHistoryItem]);

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

    // TODO: Implement an AbortController for the in-flight Ollama request to cancel the AI generation if the player interrupts. This prevents race conditions where an old AI response overwrites the player's new context.

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
    const newPlayerItem = {
      speakerId: playerId,
      speakerName: playerName,
      text: playerMessage
    };
    banterHistoryRef.current.push(newPlayerItem);
    setBanterHistory(prev => [...prev, newPlayerItem]);

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

    // TODO: Add exponential backoff/single-flight caching for OllamaService.isAvailable() to avoid hammering /tags after a failure; reflect availability state in the debug log/UI.
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
    endBanter,
    banterHistory
  };
};
