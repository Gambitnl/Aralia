/**
 * This file resolves the combat Hide lifecycle against live map and character facts.
 *
 * A successful Hide needs cover or real obscurity, records its Dexterity
 * (Stealth) total on one owned Hidden status, and keeps observer detection
 * relative to that source. Movement and attack reveals remove only Hide-derived
 * state, while stable event ids make repeated deliveries atomic.
 *
 * Called by: normal weapon attacks and the Stealth & Hidden Tactical Sandbox.
 * Depends on: production visibility, skill, placement, dice, and economy helpers.
 */

import type {
  BattleMapData,
  CombatCharacter,
  LightSource,
  Position,
  StatusEffect,
} from '../../types/combat';
import { calculateTotalSkillModifier } from '../../utils/character/skillModifierUtils';
import { calculatePassiveScore } from '../../utils/character/statUtils';
import {
  canAffordActionCost,
  consumeActionCost,
} from '../../utils/combat/actionEconomyUtils';
import {
  getDistance,
  rollD20,
  validateCharacterPlacement,
} from '../../utils/combat';
import { SeededRandom } from '../../utils/random/seededRandom';
import { VisibilitySystem, type VisibilityTier } from '../visibility';
import { resolveEventDetection, type DetectionMode } from './eventDetection';

// ============================================================================
// Public Resolution Contracts
// ============================================================================
// Callers receive the complete next actor and a concise receipt. Rejected and
// replayed events return the original object so atomicity can be asserted.
// ============================================================================

export interface StealthContext {
  mapData: BattleMapData;
  characters: CombatCharacter[];
  activeLightSources: LightSource[];
  observer: CombatCharacter;
}

export interface HideAttemptInput extends StealthContext {
  hider: CombatCharacter;
  ownerId: string;
  statusId: string;
  eventId: string;
  rng?: () => number;
}

export interface StealthObservationInput {
  hidden: CombatCharacter;
  observer: CombatCharacter;
  ownerId: string;
  eventId: string;
  mode: DetectionMode;
  rng?: SeededRandom;
}

export interface HiddenMovementInput extends StealthContext {
  hidden: CombatCharacter;
  ownerId: string;
  destination: Position;
  eventId: string;
}

export interface StealthResolutionResult {
  character: CombatCharacter;
  outcome: 'applied' | 'detected' | 'undetected' | 'moved_hidden' | 'revealed' | 'rejected' | 'replayed';
  reason: string;
  roll?: number;
  total?: number;
}

// ============================================================================
// Exact Hidden Ownership
// ============================================================================
// A plain Hidden label is not enough to establish ownership. Only structured
// Hide state with the requested owner can be replaced or removed here.
// ============================================================================

export function isOwnedHiddenStatus(status: StatusEffect, ownerId: string): boolean {
  return status.name.toLowerCase() === 'hidden'
    && status.stealth?.ownerId === ownerId;
}

export function hasUndetectedHiddenSource(
  character: CombatCharacter,
  observerId: string,
): boolean {
  return character.statusEffects.some(status => (
    status.name.toLowerCase() === 'hidden'
    && Boolean(status.stealth)
    && !status.stealth?.detectedBy.includes(observerId)
  ));
}

export function revealHideDerivedHiddenAfterAttack(
  character: CombatCharacter,
): { character: CombatCharacter; removedStatusIds: string[] } {
  const removedStatusIds = character.statusEffects
    .filter(status => status.stealth?.breaksOnAttack === true)
    .map(status => status.id);

  // If this attacker had no Hide-derived source, preserve the exact actor
  // reference. Invisible and unrelated Hidden records are never swept up.
  if (removedStatusIds.length === 0) {
    return { character, removedStatusIds };
  }

  const removedIds = new Set(removedStatusIds);
  return {
    character: {
      ...character,
      statusEffects: character.statusEffects.filter(status => !removedIds.has(status.id)),
    },
    removedStatusIds,
  };
}

// ============================================================================
// Visibility, Skill, And Stable-Event Helpers
// ============================================================================
// Bright outdoor boards are visible unless geometry blocks sight. Dark boards
// use the same VisibilitySystem as targeting and both renderers.
// ============================================================================

function eventWasProcessed(character: CombatCharacter, eventId: string): boolean {
  return character.stealthEventIds?.includes(eventId) ?? false;
}

function recordEvent(character: CombatCharacter, eventId: string): CombatCharacter {
  if (eventWasProcessed(character, eventId)) return character;
  return {
    ...character,
    stealthEventIds: [...(character.stealthEventIds ?? []), eventId],
  };
}

function hasSkillProficiency(character: CombatCharacter, skill: string): boolean {
  return character.modifiers?.skillProficiencies?.some(
    candidate => candidate.toLowerCase() === skill.toLowerCase(),
  ) ?? false;
}

function skillModifier(
  character: CombatCharacter,
  abilityScore: number,
  skill: string,
): number {
  return calculateTotalSkillModifier({
    abilityScore,
    hasProficiency: hasSkillProficiency(character, skill),
    level: character.level,
  });
}

function observerVisibility(
  observer: CombatCharacter,
  target: CombatCharacter,
  mapData: BattleMapData,
  activeLightSources: LightSource[],
): VisibilityTier {
  // Forest and other ordinary themes are bright ambient boards. Geometry can
  // still block them, but an open target is visible without an authored lamp.
  if (mapData.theme !== 'cave' && mapData.theme !== 'dungeon') {
    const targetTile = mapData.tiles.get(`${target.position.x}-${target.position.y}`);
    if (!mapData.tiles.has(`${observer.position.x}-${observer.position.y}`) || !targetTile) return 'hidden';

    const visibility = VisibilitySystem.calculateVisibility(
      observer,
      mapData,
      new Map(Array.from(mapData.tiles.keys()).map(tileId => [tileId, 'bright' as const])),
    );
    return visibility.get(targetTile.id) ?? 'hidden';
  }

  const lightLevels = VisibilitySystem.calculateLightLevels(mapData, activeLightSources);
  return VisibilitySystem.calculateVisibility(observer, mapData, lightLevels)
    .get(`${target.position.x}-${target.position.y}`) ?? 'hidden';
}

function hasHideSupport(
  hider: CombatCharacter,
  context: StealthContext,
): { supported: boolean; reason: string; visibility: VisibilityTier } {
  const tile = context.mapData.tiles.get(`${hider.position.x}-${hider.position.y}`);
  const visibility = observerVisibility(
    context.observer,
    hider,
    context.mapData,
    context.activeLightSources,
  );
  const hasCover = tile?.providesCover === true;
  const obscured = visibility === 'hidden';
  return {
    supported: hasCover || obscured,
    reason: hasCover
      ? 'cover supports Hide'
      : obscured
        ? 'the observer cannot see this space'
        : 'the creature is visible in open ground',
    visibility,
  };
}

// ============================================================================
// Hide, Perception, And Movement Transactions
// ============================================================================
// These functions compose the shared rule helpers into atomic gameplay events.
// No result is committed until every eligibility, resource, and placement gate
// has passed.
// ============================================================================

export function resolveHideAttempt(input: HideAttemptInput): StealthResolutionResult {
  if (eventWasProcessed(input.hider, input.eventId)) {
    return { character: input.hider, outcome: 'replayed', reason: 'stable Hide event already resolved' };
  }

  const support = hasHideSupport(input.hider, input);
  if (!support.supported) {
    return { character: input.hider, outcome: 'rejected', reason: `Hide rejected: ${support.reason}.` };
  }
  if (!canAffordActionCost(input.hider, { type: 'action' })) {
    return { character: input.hider, outcome: 'rejected', reason: 'Hide rejected: Action is unavailable.' };
  }

  const roll = rollD20({ rng: input.rng });
  const total = roll + skillModifier(input.hider, input.hider.stats.dexterity, 'stealth');
  const otherStatuses = input.hider.statusEffects.filter(
    status => !isOwnedHiddenStatus(status, input.ownerId),
  );
  const hiddenStatus: StatusEffect = {
    id: input.statusId,
    name: 'Hidden',
    type: 'neutral',
    description: `Hide total ${total}; detection remains observer-relative.`,
    duration: 999,
    persistsUntilRemoved: true,
    source: input.ownerId,
    sourceCasterId: input.hider.id,
    stealth: {
      ownerId: input.ownerId,
      stealthDc: total,
      detectedBy: [],
      breaksOnAttack: true,
    },
  };
  const paidHider = consumeActionCost(input.hider, { type: 'action' });
  return {
    character: recordEvent({ ...paidHider, statusEffects: [...otherStatuses, hiddenStatus] }, input.eventId),
    outcome: 'applied',
    reason: `Hide applied: ${support.reason}; Dexterity (Stealth) ${roll} + ${total - roll} = ${total}.`,
    roll,
    total,
  };
}

export function resolveStealthObservation(
  input: StealthObservationInput,
): StealthResolutionResult {
  if (eventWasProcessed(input.hidden, input.eventId)) {
    return { character: input.hidden, outcome: 'replayed', reason: 'stable Perception event already resolved' };
  }

  const owned = input.hidden.statusEffects.find(status => isOwnedHiddenStatus(status, input.ownerId));
  if (!owned?.stealth) {
    return { character: input.hidden, outcome: 'rejected', reason: 'Perception rejected: owned Hidden is absent.' };
  }

  const perceptionModifier = skillModifier(input.observer, input.observer.stats.wisdom, 'perception');
  const passivePerception = calculatePassiveScore(perceptionModifier);
  const detection = resolveEventDetection(
    [{ id: input.observer.id, passivePerception }],
    owned.stealth.stealthDc,
    input.rng,
    { mode: input.mode },
  ).detections[0];
  const detectedBy = detection.detected
    ? Array.from(new Set([...owned.stealth.detectedBy, input.observer.id]))
    : owned.stealth.detectedBy;
  const nextStatuses = input.hidden.statusEffects.map(status => (
    status === owned
      ? { ...status, stealth: { ...owned.stealth!, detectedBy } }
      : status
  ));
  const character = recordEvent({ ...input.hidden, statusEffects: nextStatuses }, input.eventId);
  return {
    character,
    outcome: detection.detected ? 'detected' : 'undetected',
    reason: detection.method === 'active'
      ? `Active Perception ${detection.roll} + ${perceptionModifier} = ${detection.total} vs Stealth ${owned.stealth.stealthDc}: ${detection.detected ? 'detected' : 'not detected'}.`
      : `Passive Perception ${passivePerception} vs Stealth ${owned.stealth.stealthDc}: ${detection.detected ? 'detected' : 'not detected'}.`,
    roll: detection.roll,
    total: detection.total ?? passivePerception,
  };
}

export function resolveHiddenMovement(input: HiddenMovementInput): StealthResolutionResult {
  if (eventWasProcessed(input.hidden, input.eventId)) {
    return { character: input.hidden, outcome: 'replayed', reason: 'stable movement event already resolved' };
  }

  const owned = input.hidden.statusEffects.find(status => isOwnedHiddenStatus(status, input.ownerId));
  if (!owned?.stealth) {
    return { character: input.hidden, outcome: 'rejected', reason: 'Hidden movement rejected: owned Hidden is absent.' };
  }

  const placement = validateCharacterPlacement(
    input.hidden,
    input.destination,
    input.mapData,
    input.characters,
  );
  const movementCost = getDistance(input.hidden.position, input.destination) * 5;
  if (!placement.allowed) {
    return { character: input.hidden, outcome: 'rejected', reason: `Hidden movement rejected: ${placement.reason}` };
  }
  if (!canAffordActionCost(input.hidden, { type: 'movement-only', movementCost })) {
    return { character: input.hidden, outcome: 'rejected', reason: `Hidden movement rejected: ${movementCost} feet is unavailable.` };
  }

  const moved = consumeActionCost(
    { ...input.hidden, position: { ...input.destination } },
    { type: 'movement-only', movementCost },
  );
  const support = hasHideSupport(moved, input);
  if (!support.supported) {
    const revealed = {
      ...moved,
      statusEffects: moved.statusEffects.filter(status => !isOwnedHiddenStatus(status, input.ownerId)),
    };
    return {
      character: recordEvent(revealed, input.eventId),
      outcome: 'revealed',
      reason: `Moved ${movementCost} feet into ${support.visibility} open ground; owned Hidden ended.`,
    };
  }

  return {
    character: recordEvent(moved, input.eventId),
    outcome: 'moved_hidden',
    reason: `Moved ${movementCost} feet while ${support.reason}; owned Hidden remains.`,
  };
}
