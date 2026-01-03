/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/hooks/useCompanionBanter.ts
 * Hook to trigger and manage companion banter with turn-by-turn AI generation.
 */
import { useCallback, useEffect, useRef } from 'react';
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

export const useCompanionBanter = (
  gameState: GameState,
  dispatch: React.Dispatch<AppAction>
) => {
  const isGeneratingRef = useRef(false);
  const banterHistoryRef = useRef<BanterHistoryLine[]>([]);
  const participantsRef = useRef<Companion[]>([]);
  const contextRef = useRef<BanterContext | null>(null);
  const turnRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gameStateRef = useRef(gameState);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  /**
   * Generate and play the next line of banter.
   */
  const generateNextLine = useCallback(async () => {
    if (!contextRef.current || participantsRef.current.length < 2) {
      isGeneratingRef.current = false;
      return;
    }

    turnRef.current++;

    // Check max turns
    if (turnRef.current > 5) {
      isGeneratingRef.current = false;
      banterHistoryRef.current = [];
      turnRef.current = 0;
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
      // AI failed, end banter
      isGeneratingRef.current = false;
      banterHistoryRef.current = [];
      turnRef.current = 0;
      return;
    }

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
        text: `: "${text}"`,
        sender: 'npc',
        timestamp: new Date(),
        metadata: {
          companionId: speakerId,
          type: 'banter'
        }
      }
    });

    // Check if banter should conclude
    if (isConcluding || turnRef.current >= 5) {
      // End banter
      isGeneratingRef.current = false;
      banterHistoryRef.current = [];
      turnRef.current = 0;
      return;
    }

    // Wait and generate next line
    timeoutRef.current = setTimeout(() => {
      generateNextLine();
    }, 3500);
  }, [dispatch]);

  /**
   * Start a new banter session.
   */
  const startBanter = useCallback(async () => {
    const state = gameStateRef.current;
    if (isGeneratingRef.current) return;
    if (state.phase !== GamePhase.PLAYING) return;
    if (isPlayerFocused(state)) return;

    const globalCooldown = state.banterCooldowns['GLOBAL'] || 0;
    const now = Date.now();
    if (now - globalCooldown < 120000) return;

    // 10% chance to trigger
    if (Math.random() >= 0.1) return;

    const isAvailable = await OllamaService.isAvailable();
    if (!isAvailable) return;

    const availableCompanions = state.party
      .map(p => p.id ? state.companions[p.id] : undefined)
      .filter((c): c is Companion => !!c && !isNpcOccupied(state, c.id));

    if (availableCompanions.length < 2) return;

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
    isGeneratingRef.current = true;

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
};
