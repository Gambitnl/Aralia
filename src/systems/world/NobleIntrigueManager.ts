/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/world/NobleIntrigueManager.ts
 * Manages procedural noble house intrigue events based on faction personalities.
 */

import { GameState, GameMessage, WorldRumor, Faction } from '../../types';
import { modifyFactionRelationship } from '../../utils/factionUtils';
import { getGameDay } from '../../utils/timeUtils';
import { SeededRandom } from '../../utils/seededRandom';
import { WorldEventResult } from './WorldEventManager';

type IntrigueType = 'ALLIANCE_PROPOSAL' | 'SCANDAL_EXPOSURE' | 'POWER_PLAY' | 'DIPLOMATIC_INSULT';

/**
 * Attempts to generate a noble intrigue event based on faction personalities.
 */
export const generateNobleIntrigue = (state: GameState, rng: SeededRandom): WorldEventResult => {
  const factionIds = Object.keys(state.factions).filter(id => state.factions[id].type === 'NOBLE_HOUSE');

  if (factionIds.length < 2) {
    return { state, logs: [] };
  }

  // 1. Select Initiator
  const initiatorId = rng.pick(factionIds);
  const initiator = state.factions[initiatorId];

  // 2. Select Target & Action Type
  // We look for suitable targets for different types of intrigue

  const possibleActions: {
    type: IntrigueType;
    targetId: string;
    weight: number;
    context: string
  }[] = [];

  factionIds.forEach(targetId => {
    if (targetId === initiatorId) return;
    const target = state.factions[targetId];

    // Shared Values -> Alliance/Support
    const sharedValues = initiator.values.filter(v => target.values.includes(v));
    if (sharedValues.length > 0) {
      possibleActions.push({
        type: 'ALLIANCE_PROPOSAL',
        targetId,
        weight: 10 + (sharedValues.length * 20),
        context: `shared belief in ${sharedValues[0]}`
      });
    }

    // Value Clash (Initiator Hates what Target Values) -> Insult/Scandal
    const hatedValues = initiator.hates.filter(h => target.values.includes(h));
    if (hatedValues.length > 0) {
       possibleActions.push({
        type: 'DIPLOMATIC_INSULT',
        targetId,
        weight: 20 + (hatedValues.length * 30),
        context: `disdain for their ${hatedValues[0]}`
      });

       // If Initiator is sneaky/political (has "knowledge" or "ambition"), maybe Scandal
       if (initiator.values.includes('knowledge') || initiator.values.includes('ambition')) {
         possibleActions.push({
            type: 'SCANDAL_EXPOSURE',
            targetId,
            weight: 15,
            context: `rumors of ${hatedValues[0]}`
          });
       }
    }

    // Power Play (Strong vs Weak Rival)
    // If we are rivals or enemies, and I am stronger
    const isHostile = initiator.enemies.includes(targetId) || initiator.rivals.includes(targetId);
    if (isHostile && initiator.power > target.power + 20) {
        possibleActions.push({
            type: 'POWER_PLAY',
            targetId,
            weight: 40,
            context: 'political leverage'
        });
    }
  });

  if (possibleActions.length === 0) {
    return { state, logs: [] };
  }

  // 3. Pick Action
  // Weighted random selection
  const totalWeight = possibleActions.reduce((sum, a) => sum + a.weight, 0);
  let roll = rng.next() * totalWeight;
  let selectedAction = possibleActions[0];

  for (const action of possibleActions) {
    if (roll < action.weight) {
      selectedAction = action;
      break;
    }
    roll -= action.weight;
  }

  const target = state.factions[selectedAction.targetId];

  // 4. Resolve & Generate Result
  return resolveIntrigue(state, initiator, target, selectedAction, rng);
};

const resolveIntrigue = (
  state: GameState,
  initiator: Faction,
  target: Faction,
  action: { type: IntrigueType; context: string },
  rng: SeededRandom
): WorldEventResult => {
  let newState = { ...state };
  let newFactions = { ...newState.factions };
  const logs: GameMessage[] = [];
  const timestamp = state.gameTime || new Date();
  const gameDay = getGameDay(timestamp);

  let text = '';
  let rumorText = '';
  let virality = 0.5;

  switch (action.type) {
    case 'ALLIANCE_PROPOSAL':
      // Relations Improve
      updateRelation(newFactions, initiator.id, target.id, 10);
      text = `${initiator.name} has publicly praised ${target.name} for their ${action.context}.`;
      rumorText = `Courts whisper of a growing bond between ${initiator.name} and ${target.name}, united by ${action.context}.`;
      virality = 0.6;
      break;

    case 'DIPLOMATIC_INSULT':
      // Relations Worsen
      updateRelation(newFactions, initiator.id, target.id, -15);
      text = `${initiator.name} publicly denounced ${target.name}, citing ${action.context}.`;
      rumorText = `Tensions rise as ${initiator.name} insults ${target.name} over their ${action.context}.`;
      virality = 0.8;
      break;

    case 'SCANDAL_EXPOSURE':
      // Target loses power, Relations Worsen significantly
      updateRelation(newFactions, initiator.id, target.id, -25);
      const powerLoss = 5 + Math.floor(rng.next() * 5);
      newFactions[target.id] = {
          ...newFactions[target.id],
          power: Math.max(0, newFactions[target.id].power - powerLoss)
      };

      text = `${initiator.name} exposed a scandal within ${target.name} regarding ${action.context}.`;
      rumorText = `Scandal rocks ${target.name}! Agents of ${initiator.name} uncovered evidence of ${action.context}.`;
      virality = 1.0; // Scandals spread fast
      break;

    case 'POWER_PLAY':
      // Initiator gains power, Target loses power, Relations Worsen
      updateRelation(newFactions, initiator.id, target.id, -10);
      const powerShift = 3 + Math.floor(rng.next() * 3);

      newFactions[initiator.id] = {
          ...newFactions[initiator.id],
          power: Math.min(100, newFactions[initiator.id].power + powerShift)
      };
      newFactions[target.id] = {
          ...newFactions[target.id],
          power: Math.max(0, newFactions[target.id].power - powerShift)
      };

      text = `${initiator.name} used ${action.context} to seize assets from ${target.name}.`;
      rumorText = `${initiator.name} tightens their grip, forcing ${target.name} to concede territory.`;
      virality = 0.7;
      break;
  }

  newState.factions = newFactions;

  // Add Log
  logs.push({
    id: Date.now() + rng.next(),
    text: `Intrigue: ${text}`,
    sender: 'system',
    timestamp
  });

  // Add Rumor
  const rumor: WorldRumor = {
      id: `intrigue-${gameDay}-${rng.next().toString(36).substr(2, 5)}`,
      text: rumorText,
      sourceFactionId: initiator.id,
      targetFactionId: target.id,
      type: 'event', // Generic event type for now
      timestamp: gameDay,
      expiration: gameDay + 14, // Intrigue lasts 2 weeks
      spreadDistance: 0,
      virality
  };

  newState.activeRumors = [...(newState.activeRumors || []), rumor];

  return { state: newState, logs };
};

// Helper to safely update bi-directional relationships
const updateRelation = (factions: Record<string, Faction>, aId: string, bId: string, amount: number) => {
    // A -> B
    const res1 = modifyFactionRelationship(factions, aId, bId, amount);
    if (res1) factions[aId] = res1.actor;

    // B -> A (Reaction is usually mutual in intrigue unless it's a secret plot, keeping simple for now)
    const res2 = modifyFactionRelationship(factions, bId, aId, amount);
    if (res2) factions[bId] = res2.actor;
};
