// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/08/2026, 13:55:04
 * Dependents: hooks/ability/useAbilityExecution.ts, hooks/useAbilitySystem.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/hooks/ability/useReactionSystem.ts
 * Manages combat reaction triggers, player prompts, line-of-sight checks, and arbitration.
 *
 * In D&D 5e combat, reactions happen outside of a character's normal turn in response
 * to an event — such as getting hit by an attack (Shield, Hellish Rebuke), seeing an
 * enemy cast a spell (Counterspell), or an enemy moving out of reach (Opportunity Attack).
 * This hook manages the interactive prompt that asks the player if they want to use a
 * reaction, validates visibility and range conditions, and tracks processed damage events
 * so reactions don't fire multiple times for the same hit.
 *
 * Called by: useAbilitySystem.ts, useAbilityExecution.ts
 * Depends on: combat types, spatial utilities, postDamageReactionQueue system
 */

import { useState, useRef, useCallback } from 'react';
import type {
  CombatCharacter,
  BattleMapData,
  CombatLogEntry,
  Ability
} from '../../types/combat';
import type { Spell, SpellEffect } from '../../types/spells';
import { getDistance } from '../../utils/combat';
import { hasLineOfSight } from '../../utils/spatial';
import { resolvePostDamageReactionQueue } from '../../systems/combat/reactions/postDamageReactionQueue';

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a pending prompt waiting for the player to accept or decline a reaction.
 */
export interface PendingReaction {
  attackerId: string;
  targetId: string;
  triggerType: 'on_hit' | 'on_cast' | 'on_move' | 'on_take_damage' | 'opportunity_attack';
  /** Spells available to cast as a reaction (or wrapped spells from War Caster). */
  reactionSpells?: Array<Spell | Ability>;
  /** Weapons/attacks available to swing (e.g. for opportunity attacks). */
  reactionWeapons?: Ability[];
  /** Callback invoked when the player chooses an ability or declines. */
  onResolve: (choiceId: string | null) => void;
}

export interface UseReactionSystemProps {
  charactersRef: React.MutableRefObject<CombatCharacter[]>;
  mapDataRef: React.MutableRefObject<BattleMapData | null>;
  onCharacterUpdate: (character: CombatCharacter) => void;
  onLogEntry?: (entry: CombatLogEntry) => void;
}

// ============================================================================
// After-Hit Spell Materialization
// ============================================================================
// Some spells (like Divine Smite or Wrathful Smite) are cast immediately after
// landing a successful weapon attack. This helper transforms the hit-bound trigger
// into an immediate effect so it applies to the attack that just hit.
// ============================================================================

/**
 * Transforms an after-hit reaction spell (like Smite) so its effects apply immediately.
 */
export const materializeAfterHitReactionSpell = (spell: Spell): Spell => {
  // After-hit smites are cast after the weapon hit already exists. Their data
  // still marks the payload as hit-bound so validators and rider code know the
  // timing contract, but the reaction bridge must apply those payloads to this
  // triggering hit instead of registering them for a future attack.
  if (spell.castingTrigger?.type !== 'after_attack_hit') {
    return spell;
  }

  return {
    ...spell,
    effects: spell.effects.map(effect => {
      // Only the payloads that explicitly wait for an attack hit are rewritten.
      // Other rows, such as ordinary utility setup, stay untouched so future
      // after-hit reaction spells can mix immediate and hit-bound effects.
      if (effect.trigger?.type !== 'on_attack_hit') {
        return effect;
      }

      return {
        ...effect,
        trigger: {
          ...effect.trigger,
          type: 'immediate',
          consumption: 'unlimited'
        }
      } as SpellEffect;
    })
  };
};

/**
 * Normalizes weapon type labels between legacy spell data and current attack events.
 */
export const normalizeAfterHitWeaponType = (
  weaponType?: string
): 'melee' | 'ranged' | 'unarmed' | 'any' | undefined => {
  // Older spell packets and migration fixtures used weapon-object labels such
  // as `melee_weapon`, while command-backed attack events publish the compact
  // attack context labels used by the live combat event bus. The after-hit
  // prompt bridge accepts both so legacy metadata does not strand a smite-like
  // spell after the qualifying hit already happened.
  if (weaponType === 'melee_weapon') {
    return 'melee';
  }

  if (weaponType === 'ranged_weapon') {
    return 'ranged';
  }

  // Current spell data should already arrive in this compact form. Unknown
  // values intentionally fall through to `undefined` so the matcher rejects the
  // spell instead of widening it to any weapon by accident.
  if (weaponType === 'melee' || weaponType === 'ranged' || weaponType === 'unarmed' || weaponType === 'any') {
    return weaponType;
  }

  return undefined;
};

// ============================================================================
// Visibility and Line of Sight for Interruption Reactions (Counterspell)
// ============================================================================
// Counterspell requires the reactor to see the caster and be within 60 feet.
// These helpers evaluate grid obstacles and stealth/invisibility conditions.
// ============================================================================

/**
 * Checks whether the reacting character has a clear line of sight to the caster on the grid.
 */
export const hasSpellInterruptionLineOfSight = (
  reactor: CombatCharacter,
  caster: CombatCharacter,
  mapData: BattleMapData | null
): boolean => {
  // Counterspell's trigger requires the reacting creature to see the caster.
  // When a battle map is present, use the same grid line-of-sight helper that
  // targeting uses instead of treating range alone as visibility.
  if (mapData) {
    const reactorTile = mapData.tiles.get(`${reactor.position.x}-${reactor.position.y}`);
    const casterTile = mapData.tiles.get(`${caster.position.x}-${caster.position.y}`);

    // Some encounters or test harnesses carry positions without a populated
    // tile map. Preserve the older range-only behavior for those incomplete
    // states rather than silently disabling every interruption reaction.
    if (!reactorTile || !casterTile) {
      return true;
    }

    return hasLineOfSight(reactorTile, casterTile, mapData);
  }

  // Mapless encounters have no obstacle authority, so visibility remains a
  // range-and-trigger decision until a richer theater-of-mind visibility model exists.
  return true;
};

/**
 * Checks whether the caster is visible to the reacting creature (not invisible, hidden, or blocked).
 */
export const hasSpellInterruptionVisibility = (
  reactor: CombatCharacter,
  caster: CombatCharacter,
  mapData: BattleMapData | null
): boolean => {
  // Counterspell says the reactor must see the spell being cast. The map line
  // can be clear while the caster is still magically Invisible or explicitly
  // Hidden, so check the shared status-effect surface before asking the grid
  // about obstacles.
  const casterVisibilityStates = [
    ...(caster.statusEffects || []),
    ...(caster.conditions || [])
  ];
  const casterIsUnseen = casterVisibilityStates.some(effect => {
    // Status IDs are usually lower-case while names are display-case. The newer
    // structured condition mirror may not have an ID at all, so normalize both
    // available labels and make either runtime surface block Counterspell.
    const statusId = 'id' in effect ? effect.id?.toLowerCase?.() : undefined;
    const statusName = effect.name?.toLowerCase?.();

    return statusId === 'invisible' ||
      statusName === 'invisible' ||
      statusId === 'hidden' ||
      statusName === 'hidden';
  }) ?? false;

  if (casterIsUnseen) {
    return false;
  }

  return hasSpellInterruptionLineOfSight(reactor, caster, mapData);
};

/**
 * Calculates the distance in feet between the reacting character and the caster.
 */
export const getSpellInterruptionDistanceFeet = (
  reactor: CombatCharacter,
  caster: CombatCharacter,
): number => {
  // Battle-map positions are five-foot grid cells, while Counterspell stores
  // its maximum range in feet. Converting at this boundary keeps the reaction
  // window aligned with every other spell range check on the combat map.
  return getDistance(reactor.position, caster.position) * 5;
};

/**
 * Determines if the caster is within the maximum range for an interruption reaction.
 */
export const isWithinSpellInterruptionRange = (
  reactor: CombatCharacter,
  caster: CombatCharacter,
  maxRangeFeet: number,
): boolean => {
  // A creature exactly on the listed boundary remains eligible. Only a caster
  // farther away is rejected before a prompt, Reaction, or slot is created.
  return getSpellInterruptionDistanceFeet(reactor, caster) <= maxRangeFeet;
};

// ============================================================================
// React Sub-Hook: useReactionSystem
// ============================================================================
// Manages the pending reaction prompt modal and post-damage reaction event resolution.
// ============================================================================

export const useReactionSystem = ({
  charactersRef,
  mapDataRef,
  onCharacterUpdate,
  onLogEntry
}: UseReactionSystemProps) => {
  // Currently active reaction modal/prompt.
  const [pendingReaction, setPendingReaction] = useState<PendingReaction | null>(null);

  // Set of damage-event IDs that have already resolved their post-damage reactions.
  // Using a ref ensures the ledger survives re-renders without triggering extra render cycles.
  const processedPostDamageReactionEventIdsRef = useRef<Set<string>>(new Set<string>());

  /**
   * Opens an interactive reaction prompt for the player and returns a promise
   * that resolves when the player chooses an ability or dismisses the prompt.
   */
  const requestReaction = useCallback((
    attackerId: string,
    targetId: string,
    triggerType: 'on_hit' | 'on_cast' | 'on_move' | 'on_take_damage' | 'opportunity_attack',
    reactionSpells: Array<Spell | Ability> = [],
    reactionWeapons: Ability[] = []
  ): Promise<string | null> => {
    return new Promise(resolve => {
      setPendingReaction({
        attackerId,
        targetId,
        triggerType,
        reactionSpells,
        reactionWeapons,
        onResolve: (choice) => {
          setPendingReaction(null);
          resolve(choice);
        }
      });
    });
  }, []);

  /**
   * Replays post-damage reaction events from combat log entries.
   * Ensures idempotency: duplicate events generate a no-op log receipt without re-prompting.
   */
  const replayPostDamageReactionEvents = useCallback(async (entries: CombatLogEntry[]) => {
    // This public replay seam exists for retained event delivery, reconnection,
    // and deterministic scenario proof. It goes through the same claimed-ID
    // queue as first delivery; a duplicate emits a readable no-op receipt but
    // cannot reopen the prompt, spend resources, or apply either damage again.
    const replay = await resolvePostDamageReactionQueue({
      characters: charactersRef.current,
      combatLog: entries,
      mapData: mapDataRef.current,
      processedEventIds: processedPostDamageReactionEventIdsRef.current,
      requestReaction,
    });

    replay.characters.forEach(character => {
      const previous = charactersRef.current.find(candidate => candidate.id === character.id);
      if (previous !== character) onCharacterUpdate(character);
    });
    replay.logEntries.forEach(entry => onLogEntry?.(entry));
    replay.duplicateEventIds.forEach(eventId => onLogEntry?.({
      id: `${eventId}:post-damage-replay-no-op`,
      timestamp: Date.now(),
      type: 'status',
      message: `Duplicate post-HP event ${eventId}: no prompt, damage, Reaction, or spell slot was applied.`,
      data: { outcome: 'duplicate_event', notes: `post-hp-event:${eventId}` },
    }));

    return replay;
  }, [charactersRef, mapDataRef, onCharacterUpdate, onLogEntry, requestReaction]);

  /**
   * Clears the processed reaction event ID cache when an encounter resets.
   */
  const resetProcessedReactionEvents = useCallback(() => {
    processedPostDamageReactionEventIdsRef.current.clear();
  }, []);

  return {
    pendingReaction,
    setPendingReaction,
    processedPostDamageReactionEventIdsRef,
    requestReaction,
    replayPostDamageReactionEvents,
    resetProcessedReactionEvents
  };
};

export type UseReactionSystemReturn = ReturnType<typeof useReactionSystem>;
