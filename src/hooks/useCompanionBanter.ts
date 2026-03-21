// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:28:25
 * Dependents: App.tsx
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end
/**
 * ARCHITECTURAL CONTEXT:
 * This hook is the 'Social Brain' of Aralia. It manages the lifecycle 
 * of NPC dialogue, from the initial trigger to the resolution of 
 * complex multi-turn conversations.
 *
 * Recent updates focus on 'Player Engagement and Escalation'.
 * - Introduced `PLAYER_DIRECTED` mode. If only one companion is available, 
 *   or chosen by random roll (50/50), NPCs will now address the player.
 * - Added `playerResponseDeadline`. The player has a limited window (default 
 *   2 minutes) to respond before the NPC feels ignored.
 * - Implemented `escalationLine` logic. If ignored, the NPC's traits 
 *   (Extraversion and Neuroticism) determine if they keep talking, 
 *   get angry, or give up.
 * - Expanded the context sent to Ollama to include 'Social Dynamics' signals 
 *   like NPC personality markers and current player gear for context-aware 
 *   dialogue.
 */

/**
 * This hook drives the "ambient life" system where NPCs talk.
 *
 * It manages two distinct modes:
 * 1. NPC-to-NPC: Traditional overheard conversations.
 * 2. Player-Directed: One NPC speaks directly to the player and waits for a reply.
 *
 * The hook handles the timers for inter-line delays, the deadline for player
 * responses, and the logic for escalating if the player remains silent.
 *
 * Called by: App.tsx
 * Depends on: OllamaService for text generation, appReducer for state updates
 */

// ============================================================================
// Types and Definitions
// ============================================================================

/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/hooks/useCompanionBanter.ts
 * Hook to trigger and manage companion banter with turn-by-turn AI generation.
 *
 * Supports two banter modes:
 *  - NPC_TO_NPC:       Two or more companions talk amongst themselves (original behaviour).
 *  - PLAYER_DIRECTED:  One NPC addresses the player directly. The player has 2 minutes to
 *                      respond; ignoring them triggers escalation lines shaped by the NPC's
 *                      extraversion (persistence) and neuroticism (emotional intensity).
 *
 * Mode selection:
 *  - 1 available companion  → always PLAYER_DIRECTED
 *  - 2+ available companions → 50 / 50 random split between modes
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { GameState, GamePhase } from '../types';
import { isPlayerFocused, isNpcOccupied } from '../utils/world';
import { AppAction } from '../state/actionTypes';
import { OllamaService, BanterContext, extractDiscoveredFacts } from '../services/ollama';
import { Companion } from '../types/companions';
import { generateId } from '../utils/core/idGenerator';

// ============================================================================
// Types
// ============================================================================

type BanterMode = 'NPC_TO_NPC' | 'PLAYER_DIRECTED';

export interface BanterHistoryLine {
  speakerId: string;
  speakerName: string;
  text: string;
  /** True when this line was generated as a player-directed opening or escalation. */
  isDirectedAtPlayer?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Delay between NPC-to-NPC banter lines (30 seconds). */
const BANTER_DELAY_MS = 30_000;

/** How long the player has to respond when an NPC addresses them (2 minutes). */
const PLAYER_RESPONSE_DEADLINE_MS = 120_000;

/** How many times the player can be ignored before the NPC gives up. */
const MAX_IGNORE_COUNT = 2;

// ============================================================================
// Hook
// ============================================================================

export const useCompanionBanter = (
  gameState: GameState,
  dispatch: React.Dispatch<AppAction>,
  isBanterPaused: boolean = false
) => {
  // ── Refs (stable across re-renders) ──────────────────────────────────────
  const isGeneratingRef = useRef(false);
  const banterHistoryRef = useRef<BanterHistoryLine[]>([]);
  const participantsRef = useRef<Companion[]>([]);
  const contextRef = useRef<BanterContext | null>(null);
  const turnRef = useRef(0);
  const failureCountRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gameStateRef = useRef(gameState);
  const banterModeRef = useRef<BanterMode>('NPC_TO_NPC');
  /** Tracks how many times the player has failed to respond in PLAYER_DIRECTED mode. */
  const ignoreCountRef = useRef(0);
  /** Mirror of playerResponseDeadlineSeconds kept as a ref so callbacks can read it without stale closures. */
  const playerDeadlineSecondsRef = useRef(0);
  /** Mirror of secondsUntilNextLine kept as a ref so extendNpcLineDelay can read it without stale closures. */
  const nextLineSecondsRef = useRef(0);

  // ── State (drives UI) ────────────────────────────────────────────────────
  const [isBanterActive, setIsBanterActive] = useState(false);
  const [isWaitingForNextLine, setIsWaitingForNextLine] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingSpeakerName, setGeneratingSpeakerName] = useState<string | null>(null);
  const [secondsUntilNextLine, setSecondsUntilNextLine] = useState(0);
  const [banterHistory, setBanterHistory] = useState<BanterHistoryLine[]>([]);
  /** True when the current session is in PLAYER_DIRECTED mode. */
  const [isPlayerDirected, setIsPlayerDirected] = useState(false);
  /** True while waiting for the player to respond to a directed line. */
  const [isWaitingForPlayerResponse, setIsWaitingForPlayerResponse] = useState(false);
  /** Countdown in seconds for the player to reply (0 when not waiting). */
  const [playerResponseDeadlineSeconds, setPlayerResponseDeadlineSeconds] = useState(0);

  // ============================================================================
  // Pacing and Orchestration
  // ============================================================================
  // These effects handle the ticking of various timers that drive the flow
  // of conversation.
  // ============================================================================

  // ── Sync refs ─────────────────────────────────────────────────────────────
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { playerDeadlineSecondsRef.current = playerResponseDeadlineSeconds; }, [playerResponseDeadlineSeconds]);
  useEffect(() => { nextLineSecondsRef.current = secondsUntilNextLine; }, [secondsUntilNextLine]);

  // ── NPC-to-NPC countdown timer ────────────────────────────────────────────
  useEffect(() => {
    if (!isWaitingForNextLine || secondsUntilNextLine <= 0) return;
    const countdownInterval = setInterval(() => {
      setSecondsUntilNextLine(prev => {
        if (prev <= 1) { clearInterval(countdownInterval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countdownInterval);
  }, [isWaitingForNextLine, secondsUntilNextLine]);

  // ── Player response countdown timer ──────────────────────────────────────
  useEffect(() => {
    if (!isWaitingForPlayerResponse || playerResponseDeadlineSeconds <= 0) return;
    const countdownInterval = setInterval(() => {
      setPlayerResponseDeadlineSeconds(prev => {
        if (prev <= 1) { clearInterval(countdownInterval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countdownInterval);
  }, [isWaitingForPlayerResponse, playerResponseDeadlineSeconds]);

  // ============================================================================
  // endBanter
  // ============================================================================
  const endBanter = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Archive the banter if it had any meaningful content
    if (banterHistoryRef.current.length > 0) {
      const moment: import('../types/companions').BanterMoment = {
        id: generateId(),
        timestamp: Date.now(),
        locationId: gameStateRef.current.currentLocationId,
        participants: participantsRef.current.map(p => p.id),
        lines: banterHistoryRef.current.map(line => ({
          speakerId: line.speakerId,
          speakerName: line.speakerName,
          text: line.text
        }))
      };
      dispatch({ type: 'ARCHIVE_BANTER', payload: moment });
    }

    // Generate memory from this conversation if substantial
    if (banterHistoryRef.current.length >= 3 && contextRef.current) {
      const historyForSummary = [...banterHistoryRef.current];
      const participantsForSummary = participantsRef.current.map(p => ({
        id: p.id,
        name: p.identity.name,
        personality: p.personality.values.join(', ')
      }));
      const contextForSummary = { ...contextRef.current };
      const participantsForFactExtraction = participantsRef.current.map(p => ({
        id: p.id,
        name: p.identity.name,
        knownFacts: (p.discoveredFacts || []).map(f => f.fact)
      }));

      // Fire-and-forget: summarize into NPC memory
      OllamaService.summarizeConversation(
        participantsForSummary,
        historyForSummary,
        contextForSummary
      ).then(result => {
        if (result.success) {
          const { text, tags } = result.data;
          participantsForSummary.forEach(p => {
            dispatch({
              type: 'ADD_COMPANION_MEMORY',
              payload: {
                companionId: p.id,
                memory: { id: generateId(), type: 'banter', text, tags, timestamp: Date.now(), importance: 5 }
              }
            });
          });
        } else {
          console.warn('Failed to summarize banter:', result.error);
        }
      }).catch(err => console.error('Failed to summarize banter (unexpected):', err));

      // Fire-and-forget: extract new character facts
      extractDiscoveredFacts(historyForSummary, participantsForFactExtraction)
        .then(factsResult => {
          if (factsResult.success && factsResult.data.length > 0) {
            console.debug(`Extracted ${factsResult.data.length} new character facts from banter`);
            factsResult.data.forEach(factWithId => {
              const { companionId, ...fact } = factWithId as { companionId: string } & typeof factWithId;
              dispatch({ type: 'ADD_DISCOVERED_FACT', payload: { companionId, fact } });
            });
          }
        })
        .catch(err => console.error('Failed to extract character facts:', err));
    }

    // Reset all state
    isGeneratingRef.current = false;
    banterHistoryRef.current = [];
    setBanterHistory([]);
    turnRef.current = 0;
    failureCountRef.current = 0;
    ignoreCountRef.current = 0;
    setIsBanterActive(false);
    setIsWaitingForNextLine(false);
    setSecondsUntilNextLine(0);
    setIsPlayerDirected(false);
    setIsWaitingForPlayerResponse(false);
    setPlayerResponseDeadlineSeconds(0);
  }, [dispatch]);

  // ============================================================================
  // handlePlayerIgnored — called when player's 2-minute response window expires
  // ============================================================================
  const handlePlayerIgnored = useCallback(async () => {
    ignoreCountRef.current++;
    setIsWaitingForPlayerResponse(false);
    setPlayerResponseDeadlineSeconds(0);

    dispatch({
      type: 'ADD_BANTER_DEBUG_LOG',
      payload: {
        timestamp: new Date(),
        check: 'PlayerResponse',
        result: false,
        details: `Ignored #${ignoreCountRef.current}`
      }
    });

    if (ignoreCountRef.current >= MAX_IGNORE_COUNT) {
      // NPC gives up — no further lines
      endBanter();
      return;
    }

    // Generate an escalation / follow-up line
    const npc = participantsRef.current[0];
    if (!npc || !contextRef.current) { endBanter(); return; }

    setIsGenerating(true);
    setGeneratingSpeakerName(npc.identity.name);

    const npcParticipant = {
      id: npc.id,
      name: npc.identity.name,
      race: npc.identity.race,
      class: npc.identity.class,
      sex: npc.identity.sex,
      age: npc.identity.age,
      physicalDescription: npc.identity.physicalDescription,
      personality: `${npc.personality.values.join(', ')}. Quirks: ${npc.personality.quirks.join(', ')}`,
      memories: npc.memories?.map(m => m.text) || []
    };

    const result = await OllamaService.generateEscalationLine(
      npcParticipant,
      contextRef.current,
      banterHistoryRef.current,
      ignoreCountRef.current,
      (id, prompt, model) => {
        dispatch({
          type: 'ADD_OLLAMA_LOG_ENTRY',
          payload: { id, timestamp: new Date(), model, prompt, response: 'Waiting for response...', context: contextRef.current, isPending: true }
        });
      }
    );

    setIsGenerating(false);
    setGeneratingSpeakerName(null);

    if (result.metadata) {
      dispatch({
        type: 'UPDATE_OLLAMA_LOG_ENTRY',
        payload: { id: result.metadata.id || '', response: result.metadata.response || '', model: result.metadata.model }
      });
    }

    if (!result.success) {
      // Escalation generation failed — just end banter
      endBanter();
      return;
    }

    const { speakerId, text, isConcluding } = result.data;
    const speakerName = npc.identity.name;

    const newHistoryItem: BanterHistoryLine = { speakerId, speakerName, text, isDirectedAtPlayer: true };
    banterHistoryRef.current.push(newHistoryItem);
    setBanterHistory(prev => [...prev, newHistoryItem]);

    dispatch({
      type: 'ADD_MESSAGE',
      payload: {
        id: Date.now(),
        text: `${speakerName}: "${text}"`,
        sender: 'npc',
        timestamp: new Date(),
        metadata: { companionId: speakerId, type: 'banter' }
      }
    });

    if (isConcluding || ignoreCountRef.current >= MAX_IGNORE_COUNT) {
      endBanter();
      return;
    }

    // Restart the player response timer for the follow-up
    setIsWaitingForPlayerResponse(true);
    setPlayerResponseDeadlineSeconds(PLAYER_RESPONSE_DEADLINE_MS / 1000);
    timeoutRef.current = setTimeout(handlePlayerIgnored, PLAYER_RESPONSE_DEADLINE_MS);
  }, [dispatch, endBanter]);

  // ============================================================================
  // generateNextLine
  // ============================================================================
  const generateNextLine = useCallback(async () => {
    const mode = banterModeRef.current;

    // NPC_TO_NPC still requires 2+ participants; PLAYER_DIRECTED only needs 1
    if (mode === 'NPC_TO_NPC' && participantsRef.current.length < 2) {
      endBanter();
      return;
    }
    if (!contextRef.current || participantsRef.current.length < 1) {
      endBanter();
      return;
    }

    setIsWaitingForNextLine(false);
    setIsGenerating(true);

    const currentLastSpeakerId = banterHistoryRef.current[banterHistoryRef.current.length - 1]?.speakerId;

    if (mode === 'NPC_TO_NPC') {
      const nextLikelySpeaker = participantsRef.current.find(p => p.id !== currentLastSpeakerId);
      if (participantsRef.current.length === 2 && nextLikelySpeaker) {
        setGeneratingSpeakerName(nextLikelySpeaker.identity.name);
      } else {
        setGeneratingSpeakerName(null);
      }
    } else {
      // PLAYER_DIRECTED — always the single (or first) NPC
      setGeneratingSpeakerName(participantsRef.current[0]?.identity.name ?? null);
    }

    turnRef.current++;
    if (turnRef.current > 8) { endBanter(); return; }

    // ── Build participant data ───────────────────────────────────────────────
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

    const onPending = (id: string, prompt: string, model: string) => {
      dispatch({
        type: 'ADD_OLLAMA_LOG_ENTRY',
        payload: { id, timestamp: new Date(), model, prompt, response: 'Waiting for response...', context: contextRef.current, isPending: true }
      });
    };

    // ── Generate the line ────────────────────────────────────────────────────
    let result;
    const isFirstPlayerDirectedTurn = mode === 'PLAYER_DIRECTED' && banterHistoryRef.current.length === 0;
    const hasPlayerResponded = mode === 'PLAYER_DIRECTED' &&
      banterHistoryRef.current.some(l => l.speakerId === (gameStateRef.current.party[0]?.id || 'player'));

    if (mode === 'PLAYER_DIRECTED' && (isFirstPlayerDirectedTurn || !hasPlayerResponded)) {
      // NPC opens by addressing the player directly
      result = await OllamaService.generatePlayerDirectedLine(
        participants[0],
        contextRef.current,
        banterHistoryRef.current,
        turnRef.current,
        onPending
      );
    } else {
      // Standard NPC line (NPC_TO_NPC or PLAYER_DIRECTED after player has responded)
      result = await OllamaService.generateBanterLine(
        participants,
        banterHistoryRef.current,
        contextRef.current,
        turnRef.current,
        onPending
      );
    }

    setIsGenerating(false);
    setGeneratingSpeakerName(null);

    if (result.metadata) {
      dispatch({
        type: 'UPDATE_OLLAMA_LOG_ENTRY',
        payload: { id: result.metadata.id || '', response: result.metadata.response || '', model: result.metadata.model }
      });
    }

    // ── Handle failures ──────────────────────────────────────────────────────
    if (!result.success) {
      console.debug('Banter line generation failed, will retry...', result.error);
      failureCountRef.current += 1;

      let details = 'Unknown error';
      if (result.error) {
        if (result.error.type === 'PARSE_ERROR') details = `JSON Parse Error: ${result.error.message}`;
        else if (result.error.type === 'TIMEOUT') details = `Timeout: ${result.error.message}`;
        else details = `${result.error.type}: ${result.error.message}`;
      }

      dispatch({ type: 'ADD_BANTER_DEBUG_LOG', payload: { timestamp: new Date(), check: 'Generation', result: false, details } });

      if (failureCountRef.current >= 3) { endBanter(); return; }

      setIsWaitingForNextLine(true);
      setSecondsUntilNextLine(10);
      timeoutRef.current = setTimeout(() => { generateNextLine(); }, 10_000);
      return;
    }

    failureCountRef.current = 0;

    // ── Validate and de-dup speaker ──────────────────────────────────────────
    const { speakerId: rawSpeakerId, text, isConcluding } = result.data;
    let speakerId = rawSpeakerId;

    const lastSpeakerId = banterHistoryRef.current[banterHistoryRef.current.length - 1]?.speakerId;
    if (mode === 'NPC_TO_NPC' && speakerId === lastSpeakerId && participantsRef.current.length > 1) {
      const alt = participantsRef.current.find(p => p.id !== lastSpeakerId);
      if (alt) { console.debug(`Correcting same-speaker: ${speakerId} → ${alt.id}`); speakerId = alt.id; }
    }

    // ── Duplicate line guard ─────────────────────────────────────────────────
    const lastText = banterHistoryRef.current[banterHistoryRef.current.length - 1]?.text?.toLowerCase().trim();
    const currentText = text.toLowerCase().trim();
    if (lastText && (currentText === lastText || currentText.includes(lastText) || lastText.includes(currentText))) {
      console.debug('Skipping duplicate banter line:', text);
      failureCountRef.current += 1;
      if (failureCountRef.current >= 3) { endBanter(); return; }
      setIsWaitingForNextLine(true);
      setSecondsUntilNextLine(5);
      timeoutRef.current = setTimeout(() => { generateNextLine(); }, 5_000);
      return;
    }

    // ── Add to history and dispatch ──────────────────────────────────────────
    const speaker = participantsRef.current.find(p => p.id === speakerId);
    const speakerName = speaker?.identity.name || speakerId;
    const isDirectedLine = mode === 'PLAYER_DIRECTED' && !hasPlayerResponded;

    const newHistoryItem: BanterHistoryLine = { speakerId, speakerName, text, isDirectedAtPlayer: isDirectedLine };
    banterHistoryRef.current.push(newHistoryItem);
    setBanterHistory(prev => [...prev, newHistoryItem]);

    dispatch({
      type: 'ADD_MESSAGE',
      payload: {
        id: Date.now(),
        text: `${speakerName}: "${text}"`,
        sender: 'npc',
        timestamp: new Date(),
        metadata: { companionId: speakerId, type: 'banter' }
      }
    });

    if (isConcluding || turnRef.current >= 8) { endBanter(); return; }

    // ── Schedule next line ───────────────────────────────────────────────────
    if (mode === 'PLAYER_DIRECTED' && isDirectedLine) {
      // Wait for the player to respond
      dispatch({
        type: 'ADD_BANTER_DEBUG_LOG',
        payload: { timestamp: new Date(), check: 'PlayerResponse', result: true, details: `Waiting ${PLAYER_RESPONSE_DEADLINE_MS / 1000}s` }
      });
      setIsWaitingForPlayerResponse(true);
      setPlayerResponseDeadlineSeconds(PLAYER_RESPONSE_DEADLINE_MS / 1000);
      timeoutRef.current = setTimeout(handlePlayerIgnored, PLAYER_RESPONSE_DEADLINE_MS);
    } else {
      // Standard NPC-to-NPC pacing
      setIsWaitingForNextLine(true);
      setSecondsUntilNextLine(BANTER_DELAY_MS / 1000);
      timeoutRef.current = setTimeout(() => { generateNextLine(); }, BANTER_DELAY_MS);
    }
  }, [dispatch, endBanter, handlePlayerIgnored]);

  // ============================================================================
  // playerInterrupt — player joins banter mid-session
  // ============================================================================
  const playerInterrupt = useCallback((playerMessage: string) => {
    if (!isBanterActive || !contextRef.current) return;

    // Cancel any pending timeout (NPC timer or player response timer)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Clear player-directed waiting state (player responded!)
    if (isWaitingForPlayerResponse) {
      setIsWaitingForPlayerResponse(false);
      setPlayerResponseDeadlineSeconds(0);
      ignoreCountRef.current = 0;

      dispatch({
        type: 'ADD_BANTER_DEBUG_LOG',
        payload: { timestamp: new Date(), check: 'PlayerResponse', result: true, details: 'received' }
      });
    }

    setIsWaitingForNextLine(false);
    setSecondsUntilNextLine(0);

    const playerName = gameStateRef.current.party[0]?.name || 'You';
    const playerId = gameStateRef.current.party[0]?.id || 'player';

    const newPlayerItem: BanterHistoryLine = { speakerId: playerId, speakerName: playerName, text: playerMessage };
    banterHistoryRef.current.push(newPlayerItem);
    setBanterHistory(prev => [...prev, newPlayerItem]);

    dispatch({
      type: 'ADD_MESSAGE',
      payload: {
        id: Date.now(),
        text: `${playerName}: "${playerMessage}"`,
        sender: 'player',
        timestamp: new Date(),
        metadata: { type: 'banter' }
      }
    });

    turnRef.current++;
    setIsGenerating(true);

    const nextLikelySpeaker = participantsRef.current.find(p => p.id !== playerId);
    if (participantsRef.current.length >= 1 && nextLikelySpeaker) {
      setGeneratingSpeakerName(nextLikelySpeaker.identity.name);
    } else {
      setGeneratingSpeakerName(null);
    }

    setTimeout(() => { generateNextLine(); }, 1500);
  }, [isBanterActive, dispatch, generateNextLine, isWaitingForPlayerResponse]);

  // ============================================================================
  // extendPlayerResponseDeadline — adds 60 s to the player's reply window
  // ============================================================================
  const extendPlayerResponseDeadline = useCallback(() => {
    if (!isWaitingForPlayerResponse) return;
    const EXTENSION_SECONDS = 60;

    // Cancel the existing fire-and-forget ignore timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Add 60 s to whatever time is still showing on the countdown
    const newDeadline = playerDeadlineSecondsRef.current + EXTENSION_SECONDS;
    setPlayerResponseDeadlineSeconds(newDeadline);

    // WHAT CHANGED: Added extendPlayerResponseDeadline and extendNpcLineDelay.
    // WHY IT CHANGED: NPC interjections were sometimes too fast or the 120s 
    // player response window was too tight for certain gameplay moments. 
    // These functions allow the UI to grant the player more time to think 
    // or read without the AI escalating or ending the session prematurely.

    // Re-arm the ignore timeout for the extended duration
    timeoutRef.current = setTimeout(handlePlayerIgnored, newDeadline * 1000);

    dispatch({
      type: 'ADD_BANTER_DEBUG_LOG',
      payload: {
        timestamp: new Date(),
        check: 'PlayerResponse',
        result: true,
        details: `Deadline extended +${EXTENSION_SECONDS}s → ${newDeadline}s remaining`
      }
    });
  }, [dispatch, handlePlayerIgnored, isWaitingForPlayerResponse]);

  // ============================================================================
  // extendNpcLineDelay — adds 60 s to the NPC-to-NPC inter-line wait
  // ============================================================================
  const extendNpcLineDelay = useCallback(() => {
    if (!isWaitingForNextLine) return;
    const EXTENSION_SECONDS = 60;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const newDelay = nextLineSecondsRef.current + EXTENSION_SECONDS;
    setSecondsUntilNextLine(newDelay);
    timeoutRef.current = setTimeout(() => { generateNextLine(); }, newDelay * 1000);

    dispatch({
      type: 'ADD_BANTER_DEBUG_LOG',
      payload: {
        timestamp: new Date(),
        check: 'NpcTimer',
        result: true,
        details: `Interjection window extended +${EXTENSION_SECONDS}s → ${newDelay}s`
      }
    });
  }, [dispatch, generateNextLine, isWaitingForNextLine]);

  // ============================================================================
  // Internal helper — shared banter session setup
  // ============================================================================
  const setupBanterSession = (
    availableCompanions: Companion[],
    state: GameState,
    mode: BanterMode,
    now: number
  ) => {
    const locId = state.currentLocationId;
    const locName = state.dynamicLocations?.[locId]?.name || locId;
    const weather = state.environment?.currentWeather || 'Clear';
    const hour = new Date(state.gameTime).getHours();
    const timeOfDay = hour < 6 ? 'Night' : hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
    // DEBT: Cast status to any to bridge case sensitivity mismatch between legacy and modern quest schemas.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeQuest = state.questLog.find(q => q.status === 'Active' || (q.status as any) === 'active');
    const playerName = state.party[0]?.name || 'the player';

    // For PLAYER_DIRECTED, attach NPC personality traits + real player gear to the context.
    const primaryNpc = availableCompanions[0];
    const player = state.party[0];
    const playerEquippedItems = player?.equippedItems
      ? (Object.entries(player.equippedItems) as [string, import('../types/items').Item | undefined][])
          .filter((entry): entry is [string, import('../types/items').Item] => entry[1] != null)
          .map(([slot, item]) => ({
            name: item.name,
            slot,
            category: (item as { category?: string }).category ?? (item as { type?: string }).type
          }))
      : [];

    contextRef.current = {
      locationName: locName,
      weather,
      timeOfDay,
      currentTask: activeQuest?.title,
      ...(mode === 'PLAYER_DIRECTED' && {
        isPlayerDirected: true,
        playerName,
        npcExtraversion: primaryNpc?.personality?.extraversion,
        npcNeuroticism: primaryNpc?.personality?.neuroticism,
        playerEquippedItems,
        playerClass: player?.class?.name ?? undefined,
        playerLevel: player?.level ?? undefined
      })
    };

    // NPC_TO_NPC uses all available companions; PLAYER_DIRECTED uses only the primary NPC
    participantsRef.current = mode === 'PLAYER_DIRECTED'
      ? [primaryNpc]
      : availableCompanions;

    banterHistoryRef.current = [];
    turnRef.current = 0;
    failureCountRef.current = 0;
    ignoreCountRef.current = 0;
    isGeneratingRef.current = true;
    banterModeRef.current = mode;

    setIsBanterActive(true);
    setIsPlayerDirected(mode === 'PLAYER_DIRECTED');

    dispatch({ type: 'UPDATE_BANTER_COOLDOWN', payload: { banterId: 'GLOBAL', timestamp: now } });

    return { locName, timeOfDay };
  };

  // ============================================================================
  // startBanter — periodic automatic trigger (every 10 seconds)
  // ============================================================================
  const startBanter = useCallback(async () => {
    const state = gameStateRef.current;
    const now = Date.now();

    const logEntry = (check: string, result: boolean | string, details?: string) => {
      dispatch({ type: 'ADD_BANTER_DEBUG_LOG', payload: { timestamp: new Date(), check, result, details } });
    };

    logEntry('Trigger Check', true, `Tick at ${new Date().toLocaleTimeString()}`);

    if (isGeneratingRef.current) { logEntry('isGenerating', false, 'Already generating banter'); return; }
    if (state.phase !== GamePhase.PLAYING) { logEntry('GamePhase', false, `Phase: ${state.phase}`); return; }
    if (isBanterPaused) { logEntry('Paused', false, 'Banter triggers manually paused'); return; }
    logEntry('GamePhase', true, 'PLAYING');

    if (isPlayerFocused(state)) { logEntry('isPlayerFocused', false, 'Player in focused UI'); return; }
    logEntry('isPlayerFocused', true, 'Not focused');

    const globalCooldown = state.banterCooldowns['GLOBAL'] || 0;
    const cooldownRemaining = Math.max(0, 120_000 - (now - globalCooldown));
    if (cooldownRemaining > 0) { logEntry('Cooldown', false, `${Math.round(cooldownRemaining / 1000)}s left`); return; }
    logEntry('Cooldown', true, 'Elapsed');

    const roll = Math.random();
    if (roll >= 0.1) { logEntry('Roll', false, `${(roll * 100).toFixed(0)}% (need <10%)`); return; }
    logEntry('Roll', true, `${(roll * 100).toFixed(0)}% - TRIGGER!`);

    const isAvailable = await OllamaService.isAvailable();
    if (!isAvailable) { logEntry('Ollama', false, 'Not reachable'); return; }
    logEntry('Ollama', true, 'Available');

    const availableCompanions = state.party
      .map(p => p.id ? state.companions[p.id] : undefined)
      .filter((c): c is Companion => !!c && !isNpcOccupied(state, c.id));

    if (availableCompanions.length < 1) {
      logEntry('Companions', false, `${availableCompanions.length} (need 1+)`);
      return;
    }
    logEntry('Companions', true, `${availableCompanions.length} available`);

    // Mode selection: 1 companion → always PLAYER_DIRECTED; 2+ → 50/50 split
    const mode: BanterMode = availableCompanions.length === 1
      ? 'PLAYER_DIRECTED'
      : (Math.random() < 0.5 ? 'PLAYER_DIRECTED' : 'NPC_TO_NPC');

    logEntry('BanterMode', true, mode);

    // NPC_TO_NPC still requires 2+ companions after mode selection
    if (mode === 'NPC_TO_NPC' && availableCompanions.length < 2) {
      logEntry('BanterMode', false, 'NPC_TO_NPC selected but only 1 companion — skipping');
      return;
    }

    const { locName, timeOfDay } = setupBanterSession(availableCompanions, state, mode, now);
    logEntry('STARTED', true, `${mode} @ ${locName} (${timeOfDay})`);

    generateNextLine();
  }, [dispatch, generateNextLine, isBanterPaused]);

  // ============================================================================
  // forceBanter — manual trigger from devtools, skips cooldown and roll
  // ============================================================================
  const forceBanter = useCallback(async () => {
    const state = gameStateRef.current;
    const now = Date.now();

    const logEntry = (check: string, result: boolean | string, details?: string) => {
      dispatch({ type: 'ADD_BANTER_DEBUG_LOG', payload: { timestamp: new Date(), check, result, details } });
    };

    logEntry('FORCE TRIGGER', true, 'Manual trigger initiated');

    if (isGeneratingRef.current) { logEntry('isGenerating', false, 'Already generating banter'); return; }

    const isAvailable = await OllamaService.isAvailable();
    if (!isAvailable) { logEntry('Ollama', false, 'Not reachable'); return; }
    logEntry('Ollama', true, 'Available');

    const availableCompanions = state.party
      .map(p => p.id ? state.companions[p.id] : undefined)
      .filter((c): c is Companion => !!c && !isNpcOccupied(state, c.id));

    if (availableCompanions.length < 1) {
      logEntry('Companions', false, `${availableCompanions.length} (need 1+)`);
      return;
    }
    logEntry('Companions', true, `${availableCompanions.length} available`);

    const mode: BanterMode = availableCompanions.length === 1
      ? 'PLAYER_DIRECTED'
      : (Math.random() < 0.5 ? 'PLAYER_DIRECTED' : 'NPC_TO_NPC');

    logEntry('BanterMode', true, mode);

    if (mode === 'NPC_TO_NPC' && availableCompanions.length < 2) {
      logEntry('BanterMode', false, 'NPC_TO_NPC selected but only 1 companion — skipping');
      return;
    }

    const { locName, timeOfDay } = setupBanterSession(availableCompanions, state, mode, now);
    logEntry('FORCE STARTED', true, `${mode} @ ${locName} (${timeOfDay})`);

    generateNextLine();
  }, [dispatch, generateNextLine]);

  // ── Periodic trigger ───────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(startBanter, 10_000);
    return () => clearInterval(interval);
  }, [startBanter]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      isGeneratingRef.current = false;
    };
  }, []);

  // ============================================================================
  // Public API
  // ============================================================================
  return {
    forceBanter,
    isBanterActive,
    isWaitingForNextLine,
    isGenerating,
    generatingSpeakerName,
    secondsUntilNextLine,
    playerInterrupt,
    endBanter,
    banterHistory,
    // Player-directed banter additions:
    isPlayerDirected,
    isWaitingForPlayerResponse,
    playerResponseDeadlineSeconds,
    extendPlayerResponseDeadline,
    // NPC-to-NPC interjection window extension:
    extendNpcLineDelay,
  };
};
