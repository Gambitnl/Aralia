// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 09:59:57
 * Dependents: hooks/useAbilitySystem.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file bridges normal combat damage logs into explicit reaction choices.
 *
 * Damage commands publish stable post-HP events. This queue claims each event
 * before awaiting UI input, discovers character-owned Hellish Rebuke, and
 * resolves accepted reactions depth-first. A retaliation creates a derived
 * post-HP event immediately ahead of later sibling events, giving nested and
 * competing reactions one deterministic ordering rule.
 *
 * Called by: useAbilitySystem after spell and ability command execution.
 * Depends on: typed combat logs and the canonical Hellish Rebuke resolver.
 */

import type { BattleMapData, CombatCharacter, CombatLogEntry } from '../../../types/combat';
import type { Spell } from '../../../types/spells';
import {
  getOwnedHellishRebukeSpells,
  getReactiveDamageRetaliationEligibility,
  resolveReactiveDamageRetaliation,
  type ReactiveDamageEvent,
  type ReactiveDamageRetaliationReceipt,
} from '../../spells/mechanics/reactiveDamageRetaliationResolution';

export type PostDamageReactionRequester = (
  attackerId: string,
  targetId: string,
  triggerType: 'on_take_damage',
  reactionSpells: Spell[],
) => Promise<string | null>;

export interface ResolvePostDamageReactionQueueInput {
  characters: CombatCharacter[];
  combatLog: CombatLogEntry[];
  mapData: BattleMapData | null;
  processedEventIds: Set<string>;
  requestReaction: PostDamageReactionRequester;
  damageRng?: () => number;
  saveRng?: () => number;
}

export interface ResolvePostDamageReactionQueueResult {
  characters: CombatCharacter[];
  logEntries: CombatLogEntry[];
  receipts: ReactiveDamageRetaliationReceipt[];
  processedEventIds: string[];
  duplicateEventIds: string[];
}

interface QueuedPostDamageEvent {
  event: ReactiveDamageEvent;
  depth: number;
}

const MAX_NESTED_REACTION_DEPTH = 8;

// ============================================================================
// Stable Event Projection
// ============================================================================
// Only the structured post-HP contract is eligible. Display text and legacy
// damage logs cannot accidentally wake a reaction or invent ownership.
// ============================================================================

export function extractPostHpDamageEvents(combatLog: CombatLogEntry[]): ReactiveDamageEvent[] {
  return combatLog.flatMap(entry => {
    const data = entry.data;
    if (
      entry.type !== 'damage'
      || data?.damageEventBoundary !== 'post_hp'
      || typeof data.sourceCharacterId !== 'string'
      || typeof data.targetCharacterId !== 'string'
      || typeof data.rawDamage !== 'number'
      || typeof data.finalDamage !== 'number'
      || typeof data.hitPointsBefore !== 'number'
      || typeof data.hitPointsAfter !== 'number'
    ) return [];

    return [{
      id: entry.id,
      boundary: 'post_hp' as const,
      sourceCharacterId: data.sourceCharacterId,
      targetCharacterId: data.targetCharacterId,
      isHit: data.hitConfirmed === true,
      rawDamage: data.rawDamage,
      finalDamage: data.finalDamage,
      damageType: data.damageType ?? data.type ?? 'untyped',
      hpBefore: data.hitPointsBefore,
      hpAfter: data.hitPointsAfter,
      tempHPBefore: data.temporaryHitPointsBefore,
      tempHPAfter: data.temporaryHitPointsAfter,
      targetDownedAfter: data.targetDownedAfter,
      targetIncapacitatedAfter: data.targetIncapacitatedAfter,
    }];
  });
}

function replaceActors(
  characters: CombatCharacter[],
  attacker: CombatCharacter,
  retaliator: CombatCharacter,
): CombatCharacter[] {
  return characters.map(character => {
    if (character.id === attacker.id) return attacker;
    if (character.id === retaliator.id) return retaliator;
    return character;
  });
}

function createReactionLog(
  event: ReactiveDamageEvent,
  receipt: ReactiveDamageRetaliationReceipt,
): CombatLogEntry {
  const selected = receipt.outcome === 'resolved'
    ? `accepts Hellish Rebuke for ${receipt.retaliation?.finalDamage ?? 0} Fire damage`
    : receipt.outcome === 'declined'
      ? 'declines Hellish Rebuke'
      : `cannot use Hellish Rebuke (${receipt.reason})`;

  return {
    id: `${event.id}:hellish-rebuke:${receipt.retaliator.id}:${receipt.reason}`,
    timestamp: Date.now(),
    type: 'action',
    message: `${receipt.retaliator.name} ${selected}. ${receipt.order.join(' ')}`,
    characterId: receipt.retaliator.id,
    targetIds: [receipt.attacker.id],
    data: {
      spellId: 'hellish-rebuke',
      casterId: receipt.retaliator.id,
      targetId: receipt.attacker.id,
      outcome: receipt.reason,
      notes: `post-hp-event:${event.id}`,
    },
  };
}

function createNestedEvent(
  parent: ReactiveDamageEvent,
  receipt: ReactiveDamageRetaliationReceipt,
): ReactiveDamageEvent | null {
  const retaliation = receipt.retaliation;
  if (!retaliation || retaliation.finalDamage <= 0) return null;

  return {
    id: `${parent.id}:hellish-rebuke:${receipt.retaliator.id}`,
    boundary: 'post_hp',
    sourceCharacterId: receipt.retaliator.id,
    targetCharacterId: receipt.attacker.id,
    isHit: true,
    rawDamage: retaliation.damageAfterSave,
    finalDamage: retaliation.finalDamage,
    damageType: 'Fire',
    hpBefore: retaliation.hpBefore,
    hpAfter: retaliation.hpAfter,
    tempHPBefore: 0,
    tempHPAfter: receipt.attacker.tempHP ?? 0,
    targetDownedAfter: retaliation.attackerDowned,
    targetIncapacitatedAfter: retaliation.attackerDowned,
  };
}

// ============================================================================
// Depth-First Prompt And Resolution Queue
// ============================================================================
// Claiming precedes the await so duplicate UI calls cannot open two prompts.
// Derived reaction damage is unshifted, so it resolves before sibling events.
// ============================================================================

export async function resolvePostDamageReactionQueue(
  input: ResolvePostDamageReactionQueueInput,
): Promise<ResolvePostDamageReactionQueueResult> {
  let characters = input.characters;
  const pending: QueuedPostDamageEvent[] = extractPostHpDamageEvents(input.combatLog)
    .map(event => ({ event, depth: 0 }));
  const receipts: ReactiveDamageRetaliationReceipt[] = [];
  const logEntries: CombatLogEntry[] = [];
  const processedEventIds: string[] = [];
  const duplicateEventIds: string[] = [];

  while (pending.length > 0) {
    const next = pending.shift()!;
    const event = next.event;

    if (input.processedEventIds.has(event.id)) {
      duplicateEventIds.push(event.id);
      continue;
    }

    // The claim is deliberately synchronous and happens before any prompt.
    // A re-entrant render or repeated command result therefore sees a no-op.
    input.processedEventIds.add(event.id);
    processedEventIds.push(event.id);

    const attacker = characters.find(character => character.id === event.sourceCharacterId);
    const retaliator = characters.find(character => character.id === event.targetCharacterId);
    if (!attacker || !retaliator) continue;

    const reactionSpells = getOwnedHellishRebukeSpells(retaliator);
    if (reactionSpells.length === 0) continue;

    const eligibility = getReactiveDamageRetaliationEligibility({
      attacker,
      retaliator,
      mapData: input.mapData,
      event,
    });
    let choice: 'accept' | 'decline' = 'accept';

    if (eligibility.eligible) {
      const selectedId = await input.requestReaction(
        attacker.id,
        retaliator.id,
        'on_take_damage',
        reactionSpells,
      );
      choice = reactionSpells.some(spell => spell.id === selectedId) ? 'accept' : 'decline';
    }

    const receipt = resolveReactiveDamageRetaliation({
      attacker,
      retaliator,
      mapData: input.mapData,
      event,
      choice,
      damageRng: input.damageRng,
      saveRng: input.saveRng,
    });
    receipts.push(receipt);
    logEntries.push(createReactionLog(event, receipt));
    characters = replaceActors(characters, receipt.attacker, receipt.retaliator);

    if (receipt.outcome === 'resolved' && next.depth < MAX_NESTED_REACTION_DEPTH) {
      const nestedEvent = createNestedEvent(event, receipt);
      if (nestedEvent) pending.unshift({ event: nestedEvent, depth: next.depth + 1 });
    }
  }

  return {
    characters,
    logEntries,
    receipts,
    processedEventIds,
    duplicateEventIds,
  };
}
