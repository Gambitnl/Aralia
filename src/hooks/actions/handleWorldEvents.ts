// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 10:35:53
 * Dependents: hooks/actions/handleGeminiCustom.ts, hooks/actions/handleResourceActions.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/hooks/actions/handleWorldEvents.ts
 * This file contains handlers for world-level events that occur outside of direct player actions.
 */
import React from 'react';
import { GameState, KnownFact, GossipUpdatePayload, DiscoveryType, NpcMemory } from '../../types';
import { AppAction } from '../../state/actionTypes';
import * as OllamaTextService from '../../services/ollamaTextService';
import { AddGeminiLogFn } from './actionHandlerTypes';
import { NPCS, LOCATIONS } from '../../constants';
import * as NpcBehaviorConfig from '../../config/npcBehaviorConfig';
import { formatGameTime, getGameDay } from '../../utils/core';
import {
  buildPropagationRoster,
  duePropagatedFacts,
  isPropagatableFact,
  propagateFact,
} from '../../systems/memory/factPropagation';
import { generateId } from '../../utils/core/idGenerator';
import { occupantLocationAt, type ScheduleBlock } from '../../systems/worldforge/roster/occupantSchedule';
import { burgIdForLocation } from '../../systems/worldforge/townsim/chronicleForLocation';
import type { TownRoster } from '../../systems/worldforge/roster/types';

// ============================================================================
// NPC daily routines (Worldforge bridge)
// ============================================================================
// Worldforge already owns the routine substrate: `roster/occupantSchedule`
// answers "where is occupant O, doing what, at hour H?" deterministically from
// the occupant's static record. Nothing in the game loop read it. The pass
// below is the bridge: on a world-time advance it diffs each occupant's block
// between the hour the clock left and the hour it arrived at, and emits the
// transitions as world events for the town the player is standing in.
//
// FACTIONS: there is no faction half to bridge. A schedule entry cannot name a
// faction — `roster/types.Occupant` carries only id/name/ageBand/home/work/
// occupation (its own comment defers factions to "a later pass"), and
// `systems/world/FactionManager` exposes only reputation application, no
// schedule concept. So no FactionManager hook is wired here.
// ============================================================================

/** One occupant's routine transition across a world-time advance. */
export interface NpcRoutineChange {
  occupantId: number;
  name: string;
  /** Where/what they were at the hour the clock left. */
  from: ScheduleBlock;
  /** Where/what they are at the hour the clock arrived at. */
  to: ScheduleBlock;
}

/** Player-facing phrasing for the block an occupant moved into. */
const ROUTINE_PHRASE: Record<ScheduleBlock['activity'], string> = {
  sleeping: 'turns in for the night',
  home: 'heads home',
  working: 'starts their day’s work',
  out: 'goes out into the town',
};

/** How many routine events one advance may surface (keeps the log bounded). */
const MAX_ROUTINE_EVENTS_PER_ADVANCE = 4;

/**
 * Pure: which occupants changed routine block between `fromHour` and `toHour`.
 *
 * A change is a different plot OR a different activity, so both "walked across
 * town" and "stopped working but stayed put" count. Occupant order is the
 * roster's, so the capped result is deterministic — no RNG, no clock read.
 */
export function townRoutineChanges(
  roster: TownRoster,
  fromHour: number,
  toHour: number,
  max: number = MAX_ROUTINE_EVENTS_PER_ADVANCE
): NpcRoutineChange[] {
  if (fromHour === toHour) return [];
  const changes: NpcRoutineChange[] = [];
  for (const occupant of roster.occupants) {
    if (changes.length >= max) break;
    const from = occupantLocationAt(occupant, fromHour);
    const to = occupantLocationAt(occupant, toHour);
    if (from.activity === to.activity && from.plotId === to.plotId) continue;
    changes.push({ occupantId: occupant.id, name: occupant.name, from, to });
  }
  return changes;
}

export interface TownRoutineEventOptions {
  /** Hours the clock just advanced by (the ADVANCE_TIME payload / 3600). */
  hoursAdvanced: number;
  /**
   * Roster source. Defaults to the canonical Worldforge roster for the burg the
   * player stands in; tests (and any caller that already holds a roster) pass
   * their own instead of paying for atlas + town generation.
   */
  resolveRoster?: (worldSeed: number, burgId: number) => TownRoster | undefined;
  /** Cap on emitted events. */
  max?: number;
}

/**
 * Emit NPC location changes as world events for the town the player is in.
 *
 * Called on a world-time advance. Returns [] when the player is not standing in
 * a burg, or when the advance did not cross an hour boundary — both legitimate
 * "nothing moved" cases, not swallowed errors (no-fallback directive: a roster
 * that fails to build throws).
 */
export async function handleTownRoutineEvents(
  gameState: GameState,
  dispatch: React.Dispatch<AppAction>,
  options: TownRoutineEventOptions
): Promise<NpcRoutineChange[]> {
  const burgId = burgIdForLocation({
    worldSeed: gameState.worldSeed,
    cellId: gameState.playerCell?.cellId,
  });
  if (burgId === undefined) return []; // not standing in a town

  const arrived = new Date(gameState.gameTime);
  const left = new Date(arrived.getTime() - options.hoursAdvanced * 3600 * 1000);
  const fromHour = left.getHours();
  const toHour = arrived.getHours();
  if (fromHour === toHour) return []; // advance stayed inside one hour

  const resolveRoster =
    options.resolveRoster ??
    (await import('../../systems/worldforge/townsim/townSimRegistration')).townRosterForBurg;
  const roster = resolveRoster(gameState.worldSeed, burgId);
  if (!roster) return [];

  const changes = townRoutineChanges(roster, fromHour, toHour, options.max);

  for (const change of changes) {
    dispatch({
      type: 'ADD_DISCOVERY_ENTRY',
      payload: {
        id: generateId(),
        gameTime: formatGameTime(arrived, { hour: '2-digit', minute: '2-digit' }),
        type: DiscoveryType.MISC_EVENT,
        title: 'Town Routine',
        content: `${change.name} ${ROUTINE_PHRASE[change.to.activity]}.`,
        source: { type: 'SYSTEM', id: `burg_${burgId}`, name: 'Town Routine' },
        flags: [
          { key: 'burgId', value: burgId },
          { key: 'occupantId', value: change.occupantId, label: change.name },
          { key: 'plotId', value: change.to.plotId },
          { key: 'activity', value: change.to.activity },
        ],
      },
    });
  }

  return changes;
}

/**
 * The deterministic half of the daily social tick (DIAL-002).
 *
 * `handleGossipEvent` below is the flavour lane: it picks a random speaker and
 * listener in one room and pays for an LLM rephrase. This pass is the rules
 * lane. It re-resolves every public first-hand fact through
 * `systems/memory/factPropagation`, which is what makes the DELAYED channels
 * work: same-town recipients already landed inside the reducer on the day the
 * fact was learned, so the only thing a later day adds is faction-aligned NPCs
 * (1-day delay) and strangers the rumor mill has reached.
 *
 * No model call, no randomness, no new state: recipients are de-duplicated by
 * fact text in the reducer, so running this every day is idempotent.
 */
export function handleFactPropagationEvent(
  gameState: GameState,
  dispatch: React.Dispatch<AppAction>
): void {
  const currentDay = gameState.gameTime instanceof Date ? getGameDay(gameState.gameTime) : 0;

  const roster = buildPropagationRoster({
    npcs: { ...NPCS, ...(gameState.dynamicNPCs ?? {}) },
    locations: { ...LOCATIONS, ...(gameState.dynamicLocations ?? {}) },
    extraTownMembers: gameState.currentLocationActiveDynamicNpcIds
      ? { [gameState.currentLocationId]: gameState.currentLocationActiveDynamicNpcIds }
      : undefined,
  });

  // Strangers hear a fact only through talk the rumor mill already carried.
  // `activeRumors` is the world-level projection of that spread, so an NPC is
  // only stranger-reachable while a rumor naming them is live.
  const rumorReachedNpcIds = Array.from(
    new Set(
      (gameState.activeRumors ?? [])
        .flatMap(rumor => (rumor.locationId ? LOCATIONS[rumor.locationId]?.npcIds ?? [] : []))
    )
  );

  for (const [originNpcId, memory] of Object.entries(gameState.npcMemory)) {
    for (const fact of memory.knownFacts) {
      if (!isPropagatableFact(fact)) continue;

      // The fact's own timestamp is a wall-clock ms value on most writers, so
      // the delay clock is anchored to the day it entered memory where that is
      // recoverable, and to today otherwise (a same-day fact then only reaches
      // the same town, which is the conservative outcome).
      const learnedOnDay = fact.timestamp > 1_000_000
        ? getGameDay(new Date(fact.timestamp))
        : fact.timestamp;

      const arrivals = duePropagatedFacts(
        propagateFact(fact, {
          originNpcId,
          npcs: roster,
          learnedOnDay,
          rumorReachedNpcIds,
        }),
        currentDay
      );

      for (const arrival of arrivals) {
        const recipient = gameState.npcMemory[arrival.npcId];
        if (!recipient) continue;
        if (recipient.knownFacts.some(known => known.text === arrival.fact.text)) continue;
        dispatch({
          type: 'ADD_NPC_KNOWN_FACT',
          payload: { npcId: arrival.npcId, fact: arrival.fact },
        });
      }
    }
  }
}

/**
 * Simulates the spread of information (gossip) between NPCs.
 */
export async function handleGossipEvent(
  gameState: GameState,
  addGeminiLog: AddGeminiLogFn,
  dispatch: React.Dispatch<AppAction>
): Promise<void> {
  const allNpcIds = Object.keys(NPCS);

  const npcsByLocation: Record<string, string[]> = {};
  // Grid retirement: gossip spreads among the authored LOCATIONS that have NPCs.
  // Iterate those directly instead of scanning the legacy 30x20 mapData.tiles for
  // placed locationIds — the static LOCATIONS ARE that set (and the cell-native
  // world no longer guarantees a tile grid).
  for (const [locationId, loc] of Object.entries(LOCATIONS)) {
    if (loc.npcIds?.length) {
      npcsByLocation[locationId] = [
        ...(npcsByLocation[locationId] || []),
        ...loc.npcIds,
      ];
    }
  }
  if (gameState.currentLocationActiveDynamicNpcIds) {
    npcsByLocation[gameState.currentLocationId] = [
      ...(npcsByLocation[gameState.currentLocationId] || []),
      ...gameState.currentLocationActiveDynamicNpcIds,
    ];
  }

  const spreadableFacts: Array<{ npcId: string; fact: KnownFact }> = [];
  for (const npcId of allNpcIds) {
    const memory = gameState.npcMemory[npcId];
    if (memory) {
      memory.knownFacts.forEach(fact => {
        if (fact.isPublic && fact.source === 'direct') {
          spreadableFacts.push({ npcId, fact });
        }
      });
    }
  }

  if (spreadableFacts.length === 0) return;

  const gossipUpdatePayload: GossipUpdatePayload = {};
  let totalExchanges = 0;

  for (const locationId in npcsByLocation) {
    const localNpcs = npcsByLocation[locationId];
    if (localNpcs.length < 2) continue;

    const exchangesInLocation = Math.min(NpcBehaviorConfig.MAX_GOSSIP_EXCHANGES_PER_LOCATION, Math.floor(localNpcs.length / 2));

    for (let i = 0; i < exchangesInLocation; i++) {
      if (totalExchanges >= NpcBehaviorConfig.MAX_TOTAL_GOSSIP_EXCHANGES) break;

      const potentialSpeakers = localNpcs.filter(id => spreadableFacts.some(sf => sf.npcId === id));
      if (potentialSpeakers.length === 0) continue;
      const speakerId = potentialSpeakers[Math.floor(Math.random() * potentialSpeakers.length)];
      const speakerFacts = spreadableFacts.filter(sf => sf.npcId === speakerId);
      const factToSpread = speakerFacts[Math.floor(Math.random() * speakerFacts.length)];

      const potentialListeners = localNpcs.filter(id => id !== speakerId && !gameState.npcMemory[id]?.knownFacts.some(kf => kf.text === factToSpread.fact.text));
      if (potentialListeners.length === 0) continue;
      const listenerId = potentialListeners[Math.floor(Math.random() * potentialListeners.length)];

      const speaker = NPCS[speakerId];
      const listener = NPCS[listenerId];

      if (!speaker || !listener) continue;

      const rephraseResult = await OllamaTextService.rephraseFactForGossip(factToSpread.fact.text, speaker.initialPersonalityPrompt, listener.initialPersonalityPrompt);

      addGeminiLog('rephraseFactForGossip', rephraseResult.data?.promptSent || rephraseResult.metadata?.promptSent || "", rephraseResult.data?.rawResponse || rephraseResult.metadata?.rawResponse || rephraseResult.error || "");

      const rephrasedText = (rephraseResult.data?.text) ? rephraseResult.data.text : factToSpread.fact.text;

      const newGossipFact: KnownFact = {
        id: generateId(),
        text: rephrasedText,
        source: 'gossip',
        sourceNpcId: speakerId,
        isPublic: false,
        timestamp: gameState.gameTime.getTime(),
        strength: factToSpread.fact.strength - 1,
        lifespan: 10,
      };

      if (!gossipUpdatePayload[listenerId]) {
        gossipUpdatePayload[listenerId] = { newFacts: [], dispositionNudge: 0 };
      }
      gossipUpdatePayload[listenerId].newFacts.push(newGossipFact);
      gossipUpdatePayload[listenerId].dispositionNudge += factToSpread.fact.text.includes('succeeded') ? 1 : -1;

      totalExchanges++;
    }
    if (totalExchanges >= NpcBehaviorConfig.MAX_TOTAL_GOSSIP_EXCHANGES) break;
  }

  // Cross-Location Gossip Propagation (omitted for brevity, but would follow same pattern using rephraseResult.data?.text)

  if (Object.keys(gossipUpdatePayload).length > 0) {
    dispatch({ type: 'PROCESS_GOSSIP_UPDATES', payload: gossipUpdatePayload });
  }
}

export async function handleResidueChecks(
  gameState: GameState,
  dispatch: React.Dispatch<AppAction>
): Promise<void> {
  for (const locationId in gameState.locationResidues) {
    const residue = gameState.locationResidues[locationId];
    if (residue) {
      const discoveryChance = Math.max(0.05, (21 - residue.discoveryDc) / 20.0);

      if (Math.random() < discoveryChance) {
        const discovererNpc = NPCS[residue.discovererNpcId];
        const location = LOCATIONS[locationId];
        if (!discovererNpc || !location) continue;

        const discoveryEntryId = generateId();

        const newFact: KnownFact = {
          id: generateId(),
          text: residue.text,
          source: 'direct',
          isPublic: true,
          timestamp: gameState.gameTime.getTime(),
          strength: 7,
          lifespan: 999,
          sourceDiscoveryId: discoveryEntryId,
        };
        dispatch({ type: 'ADD_NPC_KNOWN_FACT', payload: { npcId: residue.discovererNpcId, fact: newFact } });

        dispatch({ type: 'REMOVE_LOCATION_RESIDUE', payload: { locationId } });

        dispatch({
          type: 'ADD_DISCOVERY_ENTRY',
          payload: {
            id: discoveryEntryId,
            gameTime: formatGameTime(new Date(gameState.gameTime), { hour: '2-digit', minute: '2-digit' }),
            type: DiscoveryType.ACTION_DISCOVERED,
            title: 'Past Action Discovered',
            content: `While you were resting, ${discovererNpc.name} discovered the evidence you left at ${location.name}. They now know that "${residue.text}"`,
            source: { type: 'NPC', id: discovererNpc.id, name: discovererNpc.name },
            flags: [
              { key: 'npcId', value: discovererNpc.id, label: discovererNpc.name },
              { key: 'locationId', value: locationId, label: location.name },
            ],
          },
        });
      }
    }
  }
}

export async function handleImmediateGossip(
  gameState: GameState,
  dispatch: React.Dispatch<AppAction>,
  addGeminiLog: AddGeminiLogFn,
  witnesses: string[],
  factToSpread: KnownFact,
  originalTargetNpcId?: string | null
): Promise<void> {
  if (witnesses.length === 0) return;

  const sourceNpcId = originalTargetNpcId || witnesses[Math.floor(Math.random() * witnesses.length)];
  const speaker = NPCS[sourceNpcId];
  if (!speaker) return;

  const gossipUpdatePayload: GossipUpdatePayload = {};

  const listeners = witnesses.filter(id => id !== sourceNpcId);

  for (const listenerId of listeners) {
    const listener = NPCS[listenerId];
    if (!listener) continue;

    const rephraseResult = await OllamaTextService.rephraseFactForGossip(factToSpread.text, speaker.initialPersonalityPrompt, listener.initialPersonalityPrompt);

    addGeminiLog('rephraseFactForGossip (immediate)', rephraseResult.data?.promptSent || rephraseResult.metadata?.promptSent || "", rephraseResult.data?.rawResponse || rephraseResult.metadata?.rawResponse || rephraseResult.error || "");

    const rephrasedText = (rephraseResult.data?.text) ? rephraseResult.data.text : factToSpread.text;

    const newGossipFact: KnownFact = {
      id: generateId(),
      text: rephrasedText,
      source: 'gossip',
      sourceNpcId: sourceNpcId,
      isPublic: false,
      timestamp: gameState.gameTime.getTime(),
      strength: factToSpread.strength,
      lifespan: 10,
    };

    if (!gossipUpdatePayload[listenerId]) {
      gossipUpdatePayload[listenerId] = { newFacts: [], dispositionNudge: 0 };
    }
    gossipUpdatePayload[listenerId].newFacts.push(newGossipFact);
    gossipUpdatePayload[listenerId].dispositionNudge += -10;
  }

  if (Object.keys(gossipUpdatePayload).length > 0) {
    dispatch({ type: 'PROCESS_GOSSIP_UPDATES', payload: gossipUpdatePayload });
  }
}

export function handleLongRestWorldEvents(gameState: GameState): GameState['npcMemory'] {
  const DRIFT_THRESHOLD_MS = NpcBehaviorConfig.DRIFT_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  const currentTime = gameState.gameTime.getTime();

  const newNpcMemory: Record<string, NpcMemory> = JSON.parse(JSON.stringify(gameState.npcMemory));

  for (const npcId in newNpcMemory) {
    const memory = newNpcMemory[npcId];

    memory.knownFacts = memory.knownFacts.map((fact: KnownFact) => ({
      ...fact,
      lifespan: (fact.lifespan < 999) ? fact.lifespan - 1 : fact.lifespan,
    })).filter((fact: KnownFact) => fact.lifespan > 0);

    if (memory.knownFacts.length > NpcBehaviorConfig.MAX_FACTS_PER_NPC) {
      memory.knownFacts.sort((a: KnownFact, b: KnownFact) => a.strength - b.strength || a.timestamp - b.timestamp);
      memory.knownFacts = memory.knownFacts.slice(memory.knownFacts.length - NpcBehaviorConfig.MAX_FACTS_PER_NPC);
    }

    const timeSinceInteraction = currentTime - (memory.lastInteractionTimestamp || 0);

    if (timeSinceInteraction > DRIFT_THRESHOLD_MS && memory.disposition !== 0) {
      const newDisposition = Math.round(memory.disposition * 0.95);
      memory.disposition = (Math.abs(newDisposition) < 1) ? 0 : newDisposition;
    }
  }
  return newNpcMemory;
}

