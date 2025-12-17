
/**
 * @file src/hooks/actions/handleWorldEvents.ts
 * This file contains handlers for world-level events that occur outside of direct player actions.
 */
import React from 'react';
import { GameState, KnownFact, GossipUpdatePayload, DiscoveryType, NpcMemory } from '../../types';
import { AppAction } from '../../state/actionTypes';
import * as GeminiService from '../../services/geminiService';
import { AddGeminiLogFn } from './actionHandlerTypes';
import { NPCS, LOCATIONS } from '../../constants';
import * as NpcBehaviorConfig from '../../config/npcBehaviorConfig';
import { formatGameTime } from '../../utils/timeUtils';

// TODO(FEATURES): Add NPC daily routines and faction-driven schedules to world events (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).

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
    for (const location of Object.values(gameState.mapData?.tiles.flat() || [])) {
        if(location.locationId && LOCATIONS[location.locationId]?.npcIds) {
            npcsByLocation[location.locationId] = [
                ...(npcsByLocation[location.locationId] || []),
                ...LOCATIONS[location.locationId].npcIds!,
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

            const rephraseResult = await GeminiService.rephraseFactForGossip(factToSpread.fact.text, speaker.initialPersonalityPrompt, listener.initialPersonalityPrompt, gameState.devModelOverride);
            
            addGeminiLog('rephraseFactForGossip', rephraseResult.data?.promptSent || rephraseResult.metadata?.promptSent || "", rephraseResult.data?.rawResponse || rephraseResult.metadata?.rawResponse || rephraseResult.error || "");
            
            const rephrasedText = (rephraseResult.data?.text) ? rephraseResult.data.text : factToSpread.fact.text;

            const newGossipFact: KnownFact = {
                id: crypto.randomUUID(),
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
        dispatch({ type: 'PROCESS_Gossip_UPDATES', payload: gossipUpdatePayload });
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

        const discoveryEntryId = crypto.randomUUID();

        const newFact: KnownFact = {
          id: crypto.randomUUID(),
          text: residue.text,
          source: 'direct',
          isPublic: true,
          timestamp: gameState.gameTime.getTime(),
          strength: 7,
          lifespan: 999,
          sourceDiscoveryId: discoveryEntryId,
        };
        dispatch({ type: 'ADD_NPC_KNOWN_FACT', payload: { npcId: residue.discovererNpcId, fact: newFact }});

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

    const rephraseResult = await GeminiService.rephraseFactForGossip(factToSpread.text, speaker.initialPersonalityPrompt, listener.initialPersonalityPrompt, gameState.devModelOverride);
    
    addGeminiLog('rephraseFactForGossip (immediate)', rephraseResult.data?.promptSent || rephraseResult.metadata?.promptSent || "", rephraseResult.data?.rawResponse || rephraseResult.metadata?.rawResponse || rephraseResult.error || "");
    
    const rephrasedText = (rephraseResult.data?.text) ? rephraseResult.data.text : factToSpread.text;

    const newGossipFact: KnownFact = {
      id: crypto.randomUUID(),
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
    dispatch({ type: 'PROCESS_Gossip_UPDATES', payload: gossipUpdatePayload });
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
