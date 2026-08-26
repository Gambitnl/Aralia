/**
 * ARCHITECTURAL CONTEXT:
 * This file is the 'Combat engine God Object'. It handles everything 
 * from distance math and cover calculations to entity conversion.
 *
 * Recent updates focus on 'Combat Feature Parity'. Specifically, 
 * `createPlayerCombatCharacter` now maps `feats` from the persistent 
 * `PlayerCharacter` state into the transient `CombatCharacter`. This 
 * allows the combat execution layer to check for IDs like `great_weapon_master` 
 * or `lucky` when calculating damage and re-rolls. 
 *
 * @file src/utils/combatUtils.ts
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 20/09/2026, 21:00:39
 * Dependents: App.tsx, components/BattleMap/characters/characterActor/CharacterActor.tsx, components/DesignPreview/steps/classes/subclasses/artificer/AlchemistDemo.tsx, components/DesignPreview/steps/classes/subclasses/artificer/ArmorerDemo.tsx, components/DesignPreview/steps/classes/subclasses/barbarian/WildHeartDemo.tsx, components/DesignPreview/steps/classes/subclasses/fighter/ChampionDemo.tsx, components/DesignPreview/steps/classes/subclasses/monk/WarriorOfShadowDemo.tsx, components/DesignPreview/steps/classes/subclasses/monk/WarriorOfTheOpenHandDemo.tsx, components/DesignPreview/steps/classes/subclasses/paladin/OathOfVengeanceDemo.tsx, components/DesignPreview/steps/classes/subclasses/sorcerer/DraconicSorceryDemo.tsx, components/DesignPreview/steps/classes/subclasses/sorcerer/WildMagicSorceryDemo.tsx, components/DesignPreview/steps/classes/subclasses/warlock/ArchfeyPatronDemo.tsx, components/DesignPreview/steps/classes/subclasses/warlock/FiendPatronDemo.tsx, components/DesignPreview/steps/classes/subclasses/wizard/AbjurerDemo.tsx, components/DesignPreview/steps/classes/subclasses/wizard/EvokerDemo.tsx, components/DesignPreview/steps/raceDomain/leaves/abyssalTieflingRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/airGenasiRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/astralElfRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/autumnEladrinRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/beastbornHumanRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/beasthideShifterRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/blackDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/blueDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/brassDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/bronzeDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/bugbearRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/centaurRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/chthonicTieflingRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/cloudGiantGoliathRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/copperDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/draconbloodDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/drowHalfElfRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/fairyRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/fallenAasimarRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/firbolgRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/fireGenasiRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/fireGiantGoliathRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/forestGnomeRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/forgebornHumanRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/frostGiantGoliathRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/giffRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/githyankiRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/githzeraiRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/goblinRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/goldDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/grayDwarfDuergarRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/greenDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/guardianHumanRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/hadozeeRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/halfElfRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/halfOrcRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/halflingRaceLeaf.tsx, components/DesignPreview/steps/scenarioControls/conditionsScenarioControls.ts, components/DesignPreview/steps/scenarioControls/counterspellNestedReactionsScenarioControls.ts, components/DesignPreview/steps/scenarioControls/reachCreatureSizeScenarioControls.ts, components/DesignPreview/steps/scenarioControls/savingThrowsHalfDamageScenarioControls.ts, components/DesignPreview/steps/scenarioControls/tauntForcedTargetingScenarioControls.ts, components/DesignPreview/steps/scenarioControls/teleportationOccupiedSpacesScenarioControls.ts, components/DesignPreview/steps/spells/cureWoundsScenario.tsx, state/reducers/characterReducer.ts, systems/combat/fallingGroundImpactResolution.ts, systems/combat/reactions/companionProtectionReaction.ts, systems/spells/mechanics/DiceRoller.ts, systems/spells/mechanics/areaDamageSpellCastResolution.ts, systems/spells/mechanics/directDamageSpellCastResolution.ts, systems/spells/mechanics/reactiveDamageRetaliationResolution.ts, systems/spells/mechanics/teleportationResolution.ts, systems/spells/mechanics/witchBoltOngoingResolution.ts, utils/character/checkUtils.ts, utils/character/savingThrowUtils.ts, utils/combat/actionEconomyUtils.ts, utils/combat/aerialMovementUtils.ts, utils/combat/alchemistUtils.ts, utils/combat/armorerUtils.ts, utils/combat/battleMasterUtils.ts, utils/combat/beastMasterUtils.ts, utils/combat/circleOfTheLandUtils.ts, utils/combat/collegeOfLoreUtils.ts, utils/combat/collegeOfValorUtils.ts, utils/combat/combatAI.ts, utils/combat/grappleUtils.ts, utils/combat/hunterUtils.ts, utils/combat/index.ts, utils/combat/mechanicsUtils.ts, utils/combat/multiattackUtils.ts, utils/combat/shoveUtils.ts, utils/sandbox/quickCharacterGenerator.ts, utils/spells/outOfCombatCasting.ts
 * Imports: 17 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { BattleMapData, CombatAction, CombatCharacter, Position, CharacterStats, Ability, DamageNumber, StatusEffect, AreaOfEffect, AbilityEffect, CombatArmorEquipmentState, CombatEquipmentState } from '../../types/combat';
import { PlayerCharacter, Item, LimitedUses } from '../../types';
import { Spell, DamageType } from '../../types/spells';
import { getRacialDefenseBucketsFromTraitText, type RacialDefenseBuckets } from '../../data/races/racialTraits';
import { createAbilityFromSpell } from '../character/spellAbilityFactory';
import { isWeaponProficient } from '../character/weaponUtils';
import { generateId } from '../core/idGenerator';
import { getAbilityModifierValue } from '../character/statUtils';
import { buildHitPointDicePools, resolveRacialResourceId } from '../character/characterUtils';
import { getRacialMovementSpeedsForLevel } from '../character/progression';
import { ResistanceCalculator } from './resistanceUtils';
import { calculateExhaustionEffects, exhaustionLevelFromConditions } from './physicsUtils';
import { HUNTER_PREY_FEATURE_ID } from './hunterUtils';
import { PRIMAL_COMPANION_FEATURE_ID } from './beastMasterUtils';
import { resolveStatusGlyph } from '../visuals/conditionPalette';
import {
  CUNNING_ACTION_FEATURE_ID,
  FAST_HANDS_FEATURE_ID,
  SECOND_STORY_WORK_FEATURE_ID,
  cunningActionOptionsFor,
} from './thiefUtils';
import {
  ASSASSINATE_FEATURE_ID,
  ASSASSINS_TOOLS_FEATURE_ID,
} from './assassinUtils';
import {
  ANY_DIFFICULT_TERRAIN_POLICY,
  EARTH_WALK_TERRAIN_POLICY,
  TIMBERWALK_TERRAIN_POLICY,
  resolveTerrainMovementPolicyFromTraits,
  type TerrainMovementPolicy,
  type TerrainMovementPolicyId,
} from './movementUtils';

import { bresenhamLine } from '../spatial/lineOfSight';

// ============================================================================
// Preview-Only Combat Capability
// ============================================================================
// CombatCharacter remains the shared production contract. This small local
// intersection carries an explicit runtime marker only for the disposable
// Design Preview player, avoiding a broad combat-type change while keeping the
// exception visible and impossible to trigger from a name or id heuristic.
// ============================================================================

export type DevPlaytestCombatant = CombatCharacter & {
  devPlaytest?: {
    unlimitedSpellSlots: boolean;
  };
};

export function isUnlimitedSpellSlotCombatant(
  character: CombatCharacter,
): character is DevPlaytestCombatant & { devPlaytest: { unlimitedSpellSlots: true } } {
  return (character as DevPlaytestCombatant).devPlaytest?.unlimitedSpellSlots === true;
}


// Re-export for consumers
export { createAbilityFromSpell, generateId, ResistanceCalculator };

// ============================================================================
// Combat equipment projection
// ============================================================================
// The inventory owns complete items. Combat receives only the torso armour and
// shield facts that tactical rules can inspect without depending on container,
// economy or inventory-management behavior.

const projectArmorForCombat = (
  item: Item | undefined,
  slot: CombatArmorEquipmentState['slot']
): CombatArmorEquipmentState | undefined => {
  // A weapon in the off hand is not a shield. Likewise, a clothing item in the
  // torso slot must not accidentally satisfy rules that require worn armour.
  if (!item || (item.type !== 'armor' && item.armorCategory === undefined)) {
    return undefined;
  }

  // Magic metadata is authoritative when present. Older and imported items
  // often omit it, so the projection reports `unknown` instead of guessing
  // from a name such as "+1 Shield" or from item rarity.
  const magicStatus: CombatArmorEquipmentState['magicStatus'] =
    item.magicProperties !== undefined || item.requiresAttunement === true
      ? 'magical'
      : 'unknown';

  return {
    itemId: item.id,
    itemName: item.name,
    slot,
    category: item.armorCategory,
    magicStatus,
    properties: [...(item.properties ?? [])],
    baseArmorClass: item.baseArmorClass,
    armorClassBonus: item.armorClassBonus,
    strengthRequirement: item.strengthRequirement,
    stealthDisadvantage: item.stealthDisadvantage,
  };
};

/**
 * Builds the reusable tactical equipment view from a character's equipped items.
 *
 * Returning undefined for an empty projection keeps monsters, summons and old
 * saves compatible while allowing future equip-in-combat flows to call the same
 * function when they refresh a combatant.
 */
export function createCombatEquipmentState(
  equippedItems: PlayerCharacter['equippedItems']
): CombatEquipmentState | undefined {
  const wornArmor = projectArmorForCombat(equippedItems.Torso, 'Torso');
  const offHandArmor = projectArmorForCombat(equippedItems.OffHand, 'OffHand');
  const shield = offHandArmor?.category === 'Shield' ? offHandArmor : undefined;

  if (!wornArmor && !shield) {
    return undefined;
  }

  return { wornArmor, shield };
}

// ============================================================================
// Subclass rider ability ids
// ============================================================================
// The rider modules under `utils/combat/{hunter,beastMaster,thief,assassin}Utils`
// own every rule, and each gates itself on a feature ability being present on
// the combatant (`hasHuntersPrey`, `hasCunningAction`, `hasAssassinate`, ...).
// Nothing granted those abilities, so no rider could ever fire in play.
// `createPlayerCombatCharacter` now grants them from the persistent
// `subclassId` and level, and the two ids below are the buttons the action
// executor dispatches on.
// ============================================================================

/**
 * Cunning Action buttons are `cunning_action:<option>`, one per option
 * `cunningActionOptionsFor` reports for this character. The option id after the
 * colon is exactly what `resolveCunningAction` takes as `actionType`.
 */
export const CUNNING_ACTION_ABILITY_PREFIX = 'cunning_action:';

/** Bonus-action button that spends the ranger's Beast Master command. */
export const PRIMAL_COMPANION_COMMAND_ABILITY_ID = 'primal_companion_command';

// ============================================================================
// Race-aware terrain movement policy (GG-257)
// ============================================================================
// `CombatCharacter.terrainPolicyId` records WHICH squares a trait waives the
// difficult-terrain surcharge over. This is the one place that turns that id
// back into the predicate `movementUtils` and `findPath` understand, so no
// movement surface re-derives racial terrain rules for itself.
//
// A combatant with no qualified id but the flat `ignoreDifficultTerrain` flag
// still moves under the unqualified waiver. That is not a fallback: monsters,
// summons and older saves never carried race prose, and the flat flag is their
// only statement of the rule.
// ============================================================================

const TERRAIN_MOVEMENT_POLICIES: Record<TerrainMovementPolicyId, TerrainMovementPolicy> = {
  'earth-walk': EARTH_WALK_TERRAIN_POLICY,
  'timberwalk': TIMBERWALK_TERRAIN_POLICY,
  'any-difficult-terrain': ANY_DIFFICULT_TERRAIN_POLICY,
};

/** The terrain movement policy this combatant moves under, or null when none applies. */
export function resolveCombatantTerrainMovementPolicy(
  character: Pick<CombatCharacter, 'terrainPolicyId' | 'ignoreDifficultTerrain' | 'modifiers'>,
): TerrainMovementPolicy | null {
  if (character.terrainPolicyId) {
    return TERRAIN_MOVEMENT_POLICIES[character.terrainPolicyId];
  }
  if (character.modifiers?.ignoreDifficultTerrain || character.ignoreDifficultTerrain) {
    return ANY_DIFFICULT_TERRAIN_POLICY;
  }
  return null;
}

// ============================================================================
// Racial projection: trait-text damage defenses and limited-use resources
// ============================================================================
// The persistent character is the only place that knows a race's prose. Combat
// needs two facts out of it: which damage types the race defends against, and
// how many uses of each racial feature are left. Both used to be re-derived by
// every Design Preview race leaf, which meant a race whose leaf nobody had
// written reached combat with no defense at all.
// ============================================================================

/**
 * Reads damage defenses out of a race's trait prose.
 *
 * WHAT THIS IS: a thin composition over `getRacialDefenseBucketsFromTraitText`,
 * the parser that already turns trait prose into defense buckets for the
 * racial trait library and for `applyRacialSpellGrantsByLevel`. It is reused
 * rather than re-implemented so the combat bridge can never disagree with the
 * character sheet about what a race resists — a second regex would have been a
 * second reading of the same sentence.
 *
 * WHY THE IMPORT IS SAFE: `data/races/racialTraits` imports types only. It does
 * not pull in the race data bundle, which is the reason this module stays away
 * from `utils/character/stats`.
 *
 * WHAT IS PARSED: "resistance to necrotic damage" yields Necrotic; "resistance
 * to necrotic damage and radiant damage" and "resistance to acid and poison
 * damage" yield both types; damage-type names are returned title-cased, the
 * same canonical spelling the persistent projection writes.
 *
 * WHAT IS NOT PARSED: prose that names no damage type. "Resistance to the
 * damage type associated with your Draconic Ancestry" and "resistance to all
 * damage" are dropped, because the real type lives in character data
 * (`player.resistances`, `race.resistance`), not in the sentence.
 *
 * WHAT REMAINS UNCERTAIN: the underlying parser reads a clause, not a
 * condition, so a trait granting a named resistance only under a condition
 * would read as unconditional. No shipped race writes one; a race that does
 * needs a structured trait field rather than a cleverer regex.
 */
export function parseRacialDamageDefensesFromTraits(
  traits: readonly string[] | undefined
): RacialDefenseBuckets {
  const defenses: RacialDefenseBuckets = { resistances: [], immunities: [], vulnerabilities: [] };
  if (!traits?.length) return defenses;

  traits.forEach(trait => {
    if (typeof trait !== 'string') return;

    const parsed = getRacialDefenseBucketsFromTraitText(trait);
    (Object.keys(defenses) as Array<keyof RacialDefenseBuckets>).forEach(bucket => {
      defenses[bucket].push(...parsed[bucket]);
    });
  });

  (Object.keys(defenses) as Array<keyof RacialDefenseBuckets>).forEach(bucket => {
    defenses[bucket] = Array.from(new Set(defenses[bucket]));
  });

  return defenses;
}

/**
 * Unions parsed trait defenses onto the defenses a character already carries.
 *
 * Case-insensitive, and the existing entry wins: a character whose data already
 * says `necrotic` keeps that spelling instead of gaining a second `Necrotic`
 * entry. Returns undefined when nothing on either side exists, so combatants
 * with no defenses keep an absent field rather than an empty array.
 */
function mergeDamageDefenses(
  existing: readonly string[] | undefined,
  parsed: readonly string[]
): DamageType[] | undefined {
  if (!existing?.length && !parsed.length) return undefined;

  const merged: string[] = [];
  const seen = new Set<string>();

  [...(existing ?? []), ...parsed].forEach(entry => {
    const key = entry.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(entry);
  });

  return merged;
}

/**
 * Copies the persistent character's limited-use resources into combat.
 *
 * WHAT CHANGED (agora-0ad6): `createPlayerCombatCharacter` read
 * `player.limitedUses` only to stamp `maxUses`/`usesRemaining` onto individual
 * abilities, and never carried the record itself. A racial feature such as
 * Healing Hands, Hidden Step or Breath Weapon therefore arrived in combat with
 * no spendable resource, and each race leaf re-attached its own key by hand
 * before it could run its scenario.
 *
 * WHY EVERY ENTRY, NOT ONLY RACIAL ONES: the record is keyed by resource id,
 * and combat cannot tell a racial key from a class key without re-deriving race
 * data it deliberately does not import. Carrying the whole record is the honest
 * projection and makes class resources spendable through the same payer.
 *
 * WHAT IS PRESERVED: each entry is cloned, so spending a use in combat cannot
 * write back into the persistent character. Returning undefined for a character
 * with no resources keeps the field absent exactly as it was.
 */
function projectLimitedUsesForCombat(limitedUses: PlayerCharacter['limitedUses']): LimitedUses | undefined {
  if (!limitedUses) return undefined;

  const entries = Object.entries(limitedUses);
  if (!entries.length) return undefined;

  return Object.fromEntries(entries.map(([id, use]) => [id, { ...use }]));
}

/** The outcome of asking a combatant to pay one use of a limited resource. */
export interface CombatLimitedUsePayment {
  /** The combatant after the payment. Unchanged when `paid` is false. */
  character: CombatCharacter;
  paid: boolean;
  /** Uses left after the payment, or null when the resource is not present. */
  remaining: number | null;
  reason?: 'resource_unavailable' | 'resource_exhausted';
}

/**
 * Spends one use of a projected limited-use resource.
 *
 * This is the shared payer the race leaves each re-implemented: it never
 * mutates the combatant, it refuses rather than going negative, and it reports
 * why it refused so a caller can keep its action economy intact instead of
 * paying an action for a feature that could not fire.
 */
export function spendCombatLimitedUse(
  character: CombatCharacter,
  resourceId: string
): CombatLimitedUsePayment {
  const resource = character.limitedUses?.[resourceId];
  if (!resource) {
    return { character, paid: false, remaining: null, reason: 'resource_unavailable' };
  }

  if (resource.current <= 0) {
    return { character, paid: false, remaining: resource.current, reason: 'resource_exhausted' };
  }

  const remaining = resource.current - 1;

  return {
    character: {
      ...character,
      limitedUses: {
        ...character.limitedUses,
        [resourceId]: { ...resource, current: remaining },
      },
    },
    paid: true,
    remaining,
  };
}


// PHYSICS INTEGRATION — status as of 2026-09-09 (was TODO #1312 / #1313).
//
// 1. Fall damage: WIRED. `calculateFallDamage` is called by
//    systems/combat/fallingGroundImpactResolution.ts, which owns forced movement
//    and teleport-into-a-drop outcomes. Nothing is missing here any more.
// 2. Exhaustion: WIRED BELOW. `createPlayerCombatCharacter` now applies the
//    exhaustion SPEED penalty from `calculateExhaustionEffects` when building
//    combat stats. The d20 half of the 2024 rule (-2 per level on attacks, checks
//    and saves) is still unapplied because CombatCharacter has no numeric d20
//    modifier channel — `modifiers.advantage/disadvantage/bonuses` are text arrays
//    matched by string. Tracked as GG-212.
// 3. Jumping: PARTIAL. `calculateJumpDistance` is reachable only through the Thief
//    subclass helper (utils/combat/thiefUtils.ts); useGridMovement has no jump
//    movement mode. Tracked as GG-213.

/**
 * Checks if a character can take a reaction.
 * Verifies HP, reaction resource availability, and incapacitating conditions.
 *
 * CURRENT FUNCTIONALITY:
 * - Validates character is alive (HP > 0)
 * - Checks reaction resource availability in action economy
 * - Evaluates incapacitating conditions (Incapacitated, Paralyzed, Petrified, Stunned, Unconscious)
 * - Handles both legacy statusEffects and new conditions array formats
 *
 * IMPROVEMENT OPPORTUNITIES:
 * 1. PERFORMANCE: The dual checking of statusEffects and conditions creates redundancy
 *    - Consider normalizing data structure to eliminate duplicate condition checking
 * 2. MAINTAINABILITY: Hard-coded condition names could be centralized in a constants file
 * 3. EXTENSIBILITY: Add support for conditional reactions (e.g., Opportunity Attacks based on movement type)
 * 4. TESTABILITY: Extract condition checking logic into separate pure function for easier unit testing
 *
 * @param character The character to check.
 * @returns True if the character can take a reaction.
 */
export function canTakeReaction(character: CombatCharacter): boolean {
  // 1. Must be alive and conscious
  if (character.currentHP <= 0) return false;

  // 2. Must have reaction available in action economy
  if (character.actionEconomy.reaction.used) return false;

  // 3. Must not be incapacitated or have a condition explicitly preventing reactions
  // Conditions that prevent reactions: Incapacitated, Paralyzed, Petrified, Stunned, Unconscious, Slowed, Confused, Reactions Suppressed
  // Note: Sleep (Unconscious) and Hypnotic Pattern (Incapacitated) are covered here.
  const incapacitatedConditions: string[] = [
    'Incapacitated',
    'Paralyzed',
    'Petrified',
    'Stunned',
    'Unconscious',
    'Slowed',
    'Confused',
    'Reactions Suppressed'
  ];

  // Check legacy statusEffects
  const hasIncapacitatingEffect = character.statusEffects.some(effect => {
    const name = effect.name || effect.id; // Fallback
    return incapacitatedConditions.some(cond =>
      name.toLowerCase() === cond.toLowerCase() ||
      effect.id.toLowerCase().includes(cond.toLowerCase())
    );
  });

  if (hasIncapacitatingEffect) return false;

  // Check new conditions array (if populated)
  if (character.conditions) {
    const hasIncapacitatingCondition = character.conditions.some(cond =>
      incapacitatedConditions.includes(cond.name as string)
    );
    if (hasIncapacitatingCondition) return false;
  }

  return true;
}

/**
 * Calculates cover bonus for a target from a specific origin.
 * @param origin - The attacker's position.
 * @param target - The target's position.
 * @param mapData - The battle map data.
 * @returns The cover bonus to AC (0, 2, or 5).
 *
 * CURRENT FUNCTIONALITY:
 * - Uses Bresenham's line algorithm to trace path between attacker and target
 * - Evaluates each intermediate tile for cover-providing properties
 * - Applies standard D&D 5e cover bonuses (Half Cover: +2, Three-Quarters Cover: +5)
 * - Special handling for pillars providing superior cover
 *
 * IMPROVEMENT OPPORTUNITIES:
 * 1. PERFORMANCE: Line tracing for every attack could be expensive in complex battles
 *    - Consider pre-calculating cover maps for static environments
 *    - Implement spatial indexing for faster tile lookups
 * 2. ACCURACY: Current implementation may not handle complex terrain correctly
 *    - Add support for partial cover from multiple sources
 *    - Implement height-based cover calculations
 * 3. EXTENSIBILITY: Support for cover-modifying spells/items
 *    - Add callback system for dynamic cover effects
 *    - Integrate with spell system for cover-granting abilities
 */
export function calculateCover(origin: Position, target: Position, mapData: BattleMapData): number {
  if (!mapData) return 0;

  // Get the line of tiles between attacker and target
  const line = bresenhamLine(origin.x, origin.y, target.x, target.y);

  // Check each tile along the path, excluding start and end
  // If any tile provides cover, we determine the cover bonus (Half: +2 or Three-Quarters: +5)
  // and apply the highest bonus found along the path.
  let maxCover = 0;

  for (let i = 1; i < line.length - 1; i++) {
    const point = line[i];
    const tile = mapData.tiles.get(`${point.x}-${point.y}`) as any;

    if (tile && tile.providesCover) {
      // Default to Half Cover (+2)
      let currentCover = 2;

      // Pillars provide Three-Quarters Cover (+5) due to their width and solidity
      if (tile.decoration === 'pillar') {
        currentCover = 5;
      }

      if (currentCover > maxCover) {
        maxCover = currentCover;
      }
    }
  }

  return maxCover;
}

/**
 * RETIRED: the legacy roller family used to live here (agora-f821.4).
 *
 * `rollDieGroup`, `rollDice`, `rollD20` and `rollDamage` each defaulted to
 * `Math.random` and recorded nothing, so 143 of the game's rolls happened
 * outside the D-G3 roll contract. Remy ruled on 2026-09-20 (combat sheet q1)
 * that they retire rather than delegate. The one real implementation now lives
 * in `src/systems/dice/rollers.ts`, over `DiceAuditLog`.
 *
 * A forwarding re-export stood here until agora-f821.52 so that four call
 * sites locked by another packet could keep compiling. All four now import
 * from `systems/dice/rollers` directly, so nothing forwards from here and
 * `rollerGuard.test.ts` runs with an empty allowlist. Do not add it back:
 * import the roller from its one home so the roll lands in the audit log.
 */

/**
 * Generates a human-readable message for a combat action.
 * Distinguishes between "attacks with" (physical), "casts" (spells), and "uses" (generic).
 */
export function getActionMessage(action: CombatAction, character: CombatCharacter): string {
  const abilityName = action.abilityId || 'an ability';
  
  switch (action.type) {
    case 'move': {
      // "X moves." wastes the log's one job: telling the player what the enemy
      // did. Carry distance and compass direction from the data we already have.
      // The character object is often already at the destination when the log
      // line is written, so derive the origin from the walked path when present.
      const origin = action.movementPath?.[0];
      if (action.targetPosition && origin) {
        const dx = action.targetPosition.x - origin.x;
        const dy = action.targetPosition.y - origin.y;
        const tiles = Math.max(Math.abs(dx), Math.abs(dy));
        if (tiles > 0) {
          const ns = dy < 0 ? 'north' : dy > 0 ? 'south' : '';
          const ew = dx < 0 ? 'west' : dx > 0 ? 'east' : '';
          const dir = Math.abs(dy) > Math.abs(dx) * 2 ? ns : Math.abs(dx) > Math.abs(dy) * 2 ? ew : `${ns}${ew}` || ns || ew;
          return `${character.name} moves ${tiles * 5} ft ${dir}.`;
        }
      }
      return `${character.name} moves.`;
    }
    case 'ability': {
      const ability = character.abilities.find(a => a.id === action.abilityId);
      const name = ability?.name || abilityName;
      
      // Use descriptive verbs based on ability type
      if (ability?.type === 'attack') {
        return `${character.name} attacks with ${name}`;
      } else if (ability?.spell) {
        return `${character.name} casts ${name}`;
      }
      return `${character.name} uses ${name}`;
    }
    case 'end_turn':
      return `${character.name} ends their turn`;
    default:
      return `${character.name} performs an action`;
  }
}

/**
 * Calculates the distance between two positions in tiles.
 * Uses Chebyshev distance (5-5-5 rule) to support 8-way movement on the grid.
 * This is primarily used for AoE calculations and simple range checks.
 *
 * NOTE: For strict movement cost calculation (5-10-5 rule), use `getTargetDistance`
 * from `movementUtils.ts` or `findPath` from `pathfinding.ts`.
 *
 * @param pos1 - The first position.
 * @param pos2 - The second position.
 * @returns The distance in tiles (maximum coordinate difference).
 */
export function getDistance(pos1: Position, pos2: Position): number {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  return Math.max(Math.abs(dx), Math.abs(dy));
}

/**
 * Returns the width/height of a creature in tiles based on its size category.
 * - Tiny/Small/Medium: 1x1 (1 tile)
 * - Large: 2x2 (2 tiles)
 * - Huge: 3x3 (3 tiles)
 * - Gargantuan: 4x4+ (4 tiles)
 */
export function getCharacterSizeMultiplier(size?: string): number {
  switch (size) {
    case 'Large': return 2;
    case 'Huge': return 3;
    case 'Gargantuan': return 4;
    default: return 1;
  }
}

/**
 * Calculates all tiles occupied by a character based on their size.
 * Large creatures occupy 2x2, Huge 3x3, etc.
 * The 'position' field always represents the top-left corner tile.
 *
 * @param character - The character to check.
 * @returns An array of positions occupied by the character.
 */
export function getOccupiedTiles(character: CombatCharacter): Position[] {
  const size = character.stats.size;
  const multiplier = getCharacterSizeMultiplier(size);
  
  if (multiplier === 1) return [character.position];

  const tiles: Position[] = [];
  for (let dx = 0; dx < multiplier; dx++) {
    for (let dy = 0; dy < multiplier; dy++) {
      tiles.push({
        x: character.position.x + dx,
        y: character.position.y + dy
      });
    }
  }
  return tiles;
}

/**
 * Calculates the shortest distance between two characters, accounting for their sizes.
 * Distance is measured from the closest pair of occupied tiles.
 */
export function getCharacterDistance(char1: CombatCharacter, char2: CombatCharacter): number {
  const tiles1 = getOccupiedTiles(char1);
  const tiles2 = getOccupiedTiles(char2);
  
  let minDist = Infinity;
  for (const t1 of tiles1) {
    for (const t2 of tiles2) {
      const d = getDistance(t1, t2);
      if (d < minDist) minDist = d;
      if (minDist === 0) return 0; // Optimized: adjacent or overlapping
    }
  }
  return minDist;
}

// ============================================================================
// Creature Footprint Placement
// ============================================================================
// Movement previews, forced movement, and scenario controls all need the same
// answer when a Large or larger creature tries to occupy a destination. This
// helper checks every square in the canonical footprint against map bounds,
// blocking terrain, and the complete footprints of other living combatants.
// ============================================================================

export interface CharacterPlacementValidation {
  allowed: boolean;
  occupiedTiles: Position[];
  reason: string;
  blockerId?: string;
}

export function validateCharacterPlacement(
  character: CombatCharacter,
  position: Position,
  mapData: BattleMapData,
  characters: CombatCharacter[] = [],
): CharacterPlacementValidation {
  // Reuse the normal top-left anchor contract to project the candidate's full
  // footprint without changing the live combatant before legality is known.
  const candidate = { ...character, position: { ...position } };
  const occupiedTiles = getOccupiedTiles(candidate);

  // A larger creature is out of bounds when even one of its occupied squares
  // falls beyond the authored map, not only when its anchor leaves the board.
  const missingTile = occupiedTiles.find(tile => !mapData.tiles.has(`${tile.x}-${tile.y}`));
  if (missingTile) {
    return {
      allowed: false,
      occupiedTiles,
      reason: `${character.name}'s ${character.stats.size ?? 'Medium'} footprint leaves the battle map at ${missingTile.x},${missingTile.y}.`,
    };
  }

  // Walls and other movement blockers reject the complete placement. The
  // precise square is returned in the reason so logs can explain the boundary.
  const blockedTile = occupiedTiles.find(tile => (
    mapData.tiles.get(`${tile.x}-${tile.y}`)?.blocksMovement === true
  ));
  if (blockedTile) {
    return {
      allowed: false,
      occupiedTiles,
      reason: `${character.name}'s ${character.stats.size ?? 'Medium'} footprint is blocked at ${blockedTile.x},${blockedTile.y}.`,
    };
  }

  // Compare full footprints rather than only top-left anchors. Downed actors
  // follow the existing movement-executor convention and do not block a space.
  const occupiedKeys = new Set(occupiedTiles.map(tile => `${tile.x}-${tile.y}`));
  const blocker = characters.find(other => (
    other.id !== character.id
    && other.currentHP > 0
    && getOccupiedTiles(other).some(tile => occupiedKeys.has(`${tile.x}-${tile.y}`))
  ));
  if (blocker) {
    return {
      allowed: false,
      occupiedTiles,
      reason: `${character.name}'s footprint overlaps ${blocker.name}.`,
      blockerId: blocker.id,
    };
  }

  return {
    allowed: true,
    occupiedTiles,
    reason: `${character.name}'s complete footprint fits at ${position.x},${position.y}.`,
  };
}

/**
 * Normalizes AoE information on an ability into a concrete AreaOfEffect object.
 * This keeps older abilities that only set areaOfEffect working while supporting
 * the newer areaShape/areaSize fields described in the combat types.
 */
export function resolveAreaDefinition(ability: Ability): AreaOfEffect | null {
  if (ability.areaOfEffect) return ability.areaOfEffect;
  if (ability.areaShape && ability.areaSize) {
    return { shape: ability.areaShape, size: ability.areaSize };
  }
  return null;
}

/**
 * Calculates all map coordinates touched by a given area template. The geometry
 * intentionally mirrors D&D 5e templates: cones spread in a 90° arc by default,
 * circles use Chebyshev distance (5 ft squares), and lines extend from the caster
 * toward the selected center.
 */
export function computeAoETiles(
  area: AreaOfEffect,
  center: Position,
  mapData: BattleMapData,
  origin?: Position
): Position[] {
  const tiles = new Map<string, Position>();
  const clampWithinMap = (pos: Position) =>
    pos.x >= 0 && pos.y >= 0 && pos.x < mapData.dimensions.width && pos.y < mapData.dimensions.height;

  const addTile = (pos: Position) => {
    if (clampWithinMap(pos)) {
      tiles.set(`${pos.x}-${pos.y}`, pos);
    }
  };

  switch (area.shape) {
    case 'circle': {
      for (let x = center.x - area.size; x <= center.x + area.size; x++) {
        for (let y = center.y - area.size; y <= center.y + area.size; y++) {
          const pos = { x, y };
          if (getDistance(center, pos) <= area.size) {
            addTile(pos);
          }
        }
      }
      break;
    }
    case 'square': {
      const half = Math.floor(area.size / 2);
      for (let x = center.x - half; x <= center.x + half; x++) {
        for (let y = center.y - half; y <= center.y + half; y++) {
          addTile({ x, y });
        }
      }
      break;
    }
    case 'line': {
      const originPos = origin || center;
      const dx = center.x - originPos.x;
      const dy = center.y - originPos.y;
      const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
      const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;

      let current: Position = { x: originPos.x, y: originPos.y };
      for (let i = 0; i < area.size; i++) {
        current = { x: current.x + stepX, y: current.y + stepY };
        addTile(current);
      }
      break;
    }
    case 'cone': {
      const originPos = origin || center;
      const baseDir = {
        x: center.x - originPos.x,
        y: center.y - originPos.y,
      };
      const magnitude = Math.max(1, Math.hypot(baseDir.x, baseDir.y));
      const dir = { x: baseDir.x / magnitude, y: baseDir.y / magnitude };
      const angleLimit = (area.angle ?? 90) * (Math.PI / 180);

      for (let x = originPos.x - area.size; x <= originPos.x + area.size; x++) {
        for (let y = originPos.y - area.size; y <= originPos.y + area.size; y++) {
          const pos = { x, y };
          const dist = getDistance(originPos, pos);
          if (dist === 0 || dist > area.size) continue;

          const vec = { x: pos.x - originPos.x, y: pos.y - originPos.y };
          const vecMag = Math.max(1, Math.hypot(vec.x, vec.y));
          const normVec = { x: vec.x / vecMag, y: vec.y / vecMag };
          const dot = dir.x * normVec.x + dir.y * normVec.y;
          const theta = Math.acos(Math.min(1, Math.max(-1, dot)));

          if (theta <= angleLimit / 2) {
            addTile(pos);
          }
        }
      }
      break;
    }
    default:
      break;
  }

  return Array.from(tiles.values());
}

/**
 * Facts about a single damage instance that change which defenses apply.
 *
 * WHAT CHANGED (agora-5143): `calculateDamage` and `calculateDamageWithDefense`
 * used to hard-code `undefined` for the resistance calculator's `isMagical`
 * argument, so `nonMagicalResistances` and `nonMagicalImmunities` — which
 * `ResistanceCalculator` only consults when `isMagical === false` — could never
 * fire through these two entry points. A werewolf was as hard to hit with a
 * club as with a silvered sword. WHY AN OPTIONS OBJECT: the magical/nonmagical
 * fact is the first of several source-of-damage facts these functions will need
 * (weapon material, spell origin), and a named field reads at the call site
 * where a sixth bare boolean would not.
 *
 * WHAT IS PRESERVED: omitting `options`, or omitting `isMagical` inside it,
 * leaves `isMagical` undefined exactly as before, so every existing caller keeps
 * its current result. There is no inference: a caller that does not state
 * whether the damage is magical gets the undefined behavior rather than a
 * guess.
 */
export interface DamageResolutionOptions {
  /**
   * `false` engages the target's nonmagical-only defenses. `true` states the
   * damage is magical and therefore bypasses them. Leave unset when the caller
   * genuinely does not know.
   */
  isMagical?: boolean;
}

/**
 * Calculates final damage by applying 5e rules for Resistance, Vulnerability, and Immunity.
 *
 * Logic:
 * 1. Immunity: Reduces damage to 0.
 * 2. Vulnerability: Doubles damage.
 * 3. Resistance: Halves damage (rounded down).
 *
 * @param baseDamage The base rolled damage.
 * @param caster The source of the damage (for future feat checks like Elemental Adept).
 * @param target The character receiving the damage.
 * @param damageType The type of damage (fire, cold, etc.).
 * @param zoneContext Battlefield zones that may grant area-of-effect protections.
 * @param options Magical/nonmagical facts about this damage instance.
 * @returns The final damage integer.
 */
export function calculateDamage(
  baseDamage: number,
  caster: CombatCharacter | null,
  target: CombatCharacter,
  damageType?: string,
  zoneContext?: Parameters<typeof ResistanceCalculator.applyResistances>[5],
  options?: DamageResolutionOptions
): number {
  if (!damageType || baseDamage <= 0) return Math.max(0, baseDamage);

  return ResistanceCalculator.applyResistances(
    baseDamage,
    damageType as DamageType,
    target,
    caster,
    options?.isMagical,
    zoneContext
  );
}

/**
 * Calculates final damage along with full defense breakdown (immunity, resistance,
 * vulnerability, and structured metadata tags) applying 5e rules.
 *
 * @param baseDamage The base rolled damage.
 * @param caster The source of the damage (for feat checks like Elemental Adept).
 * @param target The character receiving the damage.
 * @param damageType The type of damage (fire, cold, radiant, poison, etc.).
 * @param zoneContext Battlefield zones that may grant area-of-effect protections.
 * @param options Magical/nonmagical facts about this damage instance.
 * @returns An object containing final damage, defense flags, and formatted metadata tags.
 */
export function calculateDamageWithDefense(
  baseDamage: number,
  caster: CombatCharacter | null,
  target: CombatCharacter,
  damageType?: string,
  zoneContext?: Parameters<typeof ResistanceCalculator.applyResistances>[5],
  options?: DamageResolutionOptions
): {
  baseDamage: number;
  finalDamage: number;
  damageType: string;
  isImmune: boolean;
  isResistant: boolean;
  effectiveResistance: boolean;
  ignoresResistance: boolean;
  isVulnerable: boolean;
  tags: string[];
} {
  if (!damageType || baseDamage <= 0) {
    const raw = Math.max(0, baseDamage);
    return {
      baseDamage: raw,
      finalDamage: raw,
      damageType: damageType || 'untyped',
      isImmune: false,
      isResistant: false,
      effectiveResistance: false,
      ignoresResistance: false,
      isVulnerable: false,
      tags: [],
    };
  }

  const breakdown = ResistanceCalculator.getDefenseBreakdown(
    baseDamage,
    damageType as DamageType,
    target,
    caster,
    options?.isMagical,
    zoneContext
  );

  return {
    baseDamage: breakdown.baseDamage,
    finalDamage: breakdown.finalDamage,
    damageType,
    isImmune: breakdown.isImmune,
    isResistant: breakdown.hasResistance,
    effectiveResistance: breakdown.effectiveResistance,
    ignoresResistance: breakdown.ignoresResistance,
    isVulnerable: breakdown.hasVulnerability,
    tags: breakdown.tags,
  };
}

/**
 * Builds a DamageNumber payload that the BattleMap overlay can consume.
 * Centralizing this logic ensures all floating numbers share timing and styling metadata.
 */
export function createDamageNumber(
  value: number,
  position: Position,
  type: DamageNumber['type']
): DamageNumber {
  return {
    id: generateId(),
    value,
    position,
    type,
    startTime: Date.now(),
    duration: 1500,
  };
}

/**
 * Returns a consistent icon for a status effect so the UI can visualize buffs/debuffs.
 *
 * The glyph table moved to `src/utils/visuals/conditionPalette.ts` (agora-f821.31):
 * this function's switch had a byte-identical ASCII twin in `BattleMapOverlay.tsx`,
 * and neither of them knew the condition NAMES, so every condition drew the same
 * debuff skull. The shared resolver prefers an explicit icon, then the condition
 * palette, then the kind-of-effect fallback.
 */
export function getStatusEffectIcon(effect: StatusEffect): string {
  return resolveStatusGlyph(effect, 'emoji');
}

// ============================================================================
// Tavern Brawler (agora-4325.2)
// ============================================================================
// The feat has three riders: proficiency with Improvised Weapons, an Unarmed
// Strike that deals 1d4 + Strength, and a free 5-foot shove after a hit with
// either. The predicates live here because this file already resolves weapon
// proficiency and builds the Unarmed Strike ability; the combat-side damage
// upgrade (AbilityCommandFactory) and the shove rider (shoveUtils) read them
// so one definition of "has the feat" serves all three.
// ============================================================================

/** Feat id as stored on a character's `feats` array. */
export const TAVERN_BRAWLER_FEAT_ID = 'tavern_brawler';

/** Unarmed Strike damage die the feat grants, before the Strength modifier. */
export const TAVERN_BRAWLER_UNARMED_DIE = '1d4';

/** True when the character holds Tavern Brawler. */
export function hasTavernBrawler(character: { feats?: string[] } | null | undefined): boolean {
  return !!character?.feats?.includes(TAVERN_BRAWLER_FEAT_ID);
}

/**
 * True when an item counts as an Improvised Weapon.
 *
 * 5e calls an object an improvised weapon when it is not a weapon but is used
 * as one — a bar stool, a bottle, a frying pan. An item may also declare the
 * category or property outright, which is how a purpose-built improvised
 * weapon entry opts in.
 */
export function isImprovisedWeapon(item: Item | null | undefined): boolean {
  if (!item) return false;
  if (item.category?.toLowerCase().includes('improvised')) return true;
  if (item.properties?.some(property => property.toLowerCase() === 'improvised')) return true;
  return item.type !== 'weapon';
}

/**
 * Unarmed Strike damage formula for a character.
 *
 * Without the feat this is the flat 1 + Strength modifier the 2024 rules give
 * an Unarmed Strike. With Tavern Brawler it becomes 1d4 + Strength.
 */
export function getUnarmedStrikeDamageFormula(
  character: { feats?: string[] },
  strengthModifier: number
): string {
  const modifierPart = strengthModifier === 0
    ? ''
    : `${strengthModifier > 0 ? '+' : '-'}${Math.abs(strengthModifier)}`;

  if (hasTavernBrawler(character)) {
    return `${TAVERN_BRAWLER_UNARMED_DIE}${modifierPart}`;
  }
  return String(Math.max(0, 1 + strengthModifier));
}

/**
 * Converts a PlayerCharacter from the main game state into a CombatCharacter for the battle map.
 *
 * ## Architecture Note: Persistent vs Transient State
 * The game maintains two separate character representations:
 * 1. **PlayerCharacter (Persistent):** Stores long-term state (inventory, XP, all known spells) in Redux/LocalStorage.
 * 2. **CombatCharacter (Transient):** Optimized for the turn-based combat engine (flat ability list, position) and discarded after combat.
 *
 * This factory acts as the bridge (Adapter Pattern), ensuring the combat engine receives a standardized interface
 * regardless of whether the source is a Player or a Monster.
 *
 * ## Key Transformations
 * - **Weapons -> Abilities:** Equipped weapons are converted into 'Attack' abilities.
 *   - Note: We set `value: 0` in the damage effect as a SENTINEL. The combat system detects this and
 *     dynamically rolls the weapon's damage dice at runtime.
 * - **Spells -> Abilities:** Hydrates the spellbook using the global spell dictionary.
 * - **Stats:** Flattens nested stat objects for easier access by combat systems.
 *
 * CURRENT FUNCTIONALITY:
 * - Maps player stats to combat-ready format
 * - Converts equipped weapons to combat abilities with proper damage calculations
 * - Integrates spellbook with combat ability system
 * - Handles class-specific combat features (Second Wind, Cunning Dash, etc.)
 * - Applies racial traits like darkvision
 * - Manages hit point dice pools for combat use
 *
 * IMPROVEMENT OPPORTUNITIES:
 * 1. PERFORMANCE: Expensive transformation process called frequently
 *    - Implement caching for unchanged character state
 *    - Consider incremental updates instead of full recreation
 * 2. MAINTAINABILITY: Monolithic function with multiple responsibilities
 *    - Extract weapon conversion to separate helper function
 *    - Separate spell processing from core character creation
 *    - Break down class feature handling into modular components
 * 3. ROBUSTNESS: Missing error handling for data inconsistencies
 *    - Add validation for missing spell data
 *    - Handle malformed weapon/equipment data gracefully
 *    - Implement fallback behaviors for incomplete character data
 * 4. EXTENSIBILITY: Hard-coded class features limit flexibility
 *    - Create plugin system for class-specific combat abilities
 *    - Add support for temporary combat modifiers/buffs
 *    - Integrate with condition system for combat-specific effects
 *
 * @param player - The persistent PlayerCharacter object.
 * @param allSpells - Dictionary of all spell data, used to resolve spell IDs into full ability objects.
 * @returns A fully hydrated CombatCharacter ready for the BattleMap.
 */
export function createPlayerCombatCharacter(player: PlayerCharacter, allSpells: Record<string, Spell> = {}): CombatCharacter {
  // Exhaustion (2026-09-09, was TODO #1313). Exhaustion is carried on the persistent
  // character as a condition string, so the level is parsed once here and turned into
  // the 2024 speed penalty (-5 ft per level) by `calculateExhaustionEffects`. Applying
  // it at this boundary means every downstream movement budget — action economy, grid
  // movement, Dash — inherits the penalty without each one re-deriving it.
  //
  // Level 6 is death in the rules; `calculateExhaustionEffects` reports no speed
  // penalty there, so we clamp to 5 rather than letting a dying character be the
  // fastest on the map. Killing the character is deliberately NOT done here: this
  // function only projects persistent state into combat, and death is a combat-state
  // transition that belongs to the turn/HP systems.
  //
  // The d20 half of the rule is not applied — see the physics integration note above
  // and GG-212. A rested character parses to level 0 and is untouched, so no existing
  // caller changes behavior.
  const exhaustionLevel = exhaustionLevelFromConditions(player.conditions);
  const exhaustionSpeedPenalty = exhaustionLevel > 0
    ? calculateExhaustionEffects(Math.min(exhaustionLevel, 5)).speedPenalty
    : 0;

  // Read the race's trait prose once. A race with no defense clause produces
  // three empty lists, so a character that never had defenses is untouched.
  const racialTraitDefenses = parseRacialDamageDefensesFromTraits(player.race?.traits);

  const stats: CharacterStats = {
    strength: player.finalAbilityScores.Strength,
    dexterity: player.finalAbilityScores.Dexterity,
    constitution: player.finalAbilityScores.Constitution,
    intelligence: player.finalAbilityScores.Intelligence,
    wisdom: player.finalAbilityScores.Wisdom,
    charisma: player.finalAbilityScores.Charisma,
    // baseInitiative is the NON-Dex part of the initiative bonus (feats/bonuses +
    // optional proficiency). rollInitiative adds the Dex modifier on top, so Dex
    // must NOT be included here — doing so double-counted Dex for players while
    // monsters (whose baseInitiative is the proficiency part only) were correct.
    baseInitiative: (player.initiativeBonus || 0) + (player.initiativeProficiency ? (player.proficiencyBonus || 2) : 0),
    // Speed after exhaustion. Floored at 0 so a heavily exhausted character is
    // immobile rather than moving backwards.
    speed: Math.max(0, player.speed - exhaustionSpeedPenalty),
    cr: 'N/A',
    senses: { darkvision: 0, blindsight: 0, tremorsense: 0, truesight: 0 },
  };

  // Racial fly/swim/climb/burrow modes (agora-db71.30, GG-259). Read at the
  // character's level through the same helper the character sheet uses, so a
  // Dragonborn's Draconic Flight reaches combat at level 5 and stays off the
  // actor before it. Without this fill the combat readers — aerialMovementUtils,
  // actionEconomyUtils, useBattleMap, useGridMovement — saw `undefined` and no
  // player ever flew, swam, climbed or burrowed at ANY level.
  //
  // The key is only written when the race grants a mode, so a character with no
  // alternate movement is byte-for-byte what it was before.
  const racialMovementSpeeds = getRacialMovementSpeedsForLevel(player);
  if (Object.keys(racialMovementSpeeds).length > 0) {
    stats.extraMovementSpeeds = racialMovementSpeeds;
  }

  // 1. Basic Physical Abilities
  const abilities: Ability[] = [];

  // Generate Attack Actions from Equipped Weapons
  const mainHand = player.equippedItems?.MainHand;
  const offHand = player.equippedItems?.OffHand;

  /**
   * Creates a combat Ability from an equipped weapon item.
   * Handles damage type defaults, reach properties, and Weapon Mastery validation.
   */
  const createWeaponAbility = (weapon: Item, idSuffix: string, isOffHand: boolean = false): Ability => {
    // Default to physical damage. Future expansion can parse damage types from item data.
    const damageType: AbilityEffect['damageType'] = 'physical';

    // Tavern Brawler grants proficiency with Improvised Weapons, which
    // isWeaponProficient cannot express: it rejects any item whose type is not
    // 'weapon' before it looks at the character's proficiency list at all.
    const isProficient = isWeaponProficient(player, weapon)
      || (hasTavernBrawler(player) && isImprovisedWeapon(weapon));

    const ability: Ability = {
      id: `attack_${idSuffix}`,
      name: weapon.name,
      description: `Attack with ${weapon.name}.`,
      type: 'attack',
      cost: { type: isOffHand ? 'bonus' : 'action' },
      targeting: 'single_enemy',
      range: (() => {
        let baseRange = 1;
        if (weapon.properties?.some(p => p === 'reach')) baseRange = 2;
        const rangeProp = weapon.properties?.find(p => p.startsWith('range:'));
        if (rangeProp) {
          const match = rangeProp.match(/range:(\d+)/);
          if (match && match[1]) {
            baseRange = Math.max(baseRange, Math.floor(parseInt(match[1]) / 5));
          }
        }
        return baseRange;
      })(),
      effects: [{
        type: 'damage',
        value: 0, // Value 0 signals "roll weapon damage" to the system
        dice: weapon.damageDice || '1d4', // Default fallback if missing
        damageType: damageType
      }],
      icon: '⚔️',
      weapon: weapon, // Link source weapon
      isProficient: isProficient
    };

    // Attach Weapon Mastery if the character is proficient, has unlocked it, and the weapon supports it.
    if (isProficient && weapon.mastery && player.selectedWeaponMasteries?.includes(weapon.id)) {
      ability.mastery = weapon.mastery;
    }

    return ability;
  };

  if (mainHand) {
    abilities.push(createWeaponAbility(mainHand, 'main'));
  } else {
    // Unarmed Strike
    abilities.push({
      id: 'unarmed_strike',
      name: 'Unarmed Strike',
      description: 'A basic punch or kick. Melee Range (5 ft).',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 1,
      // A dice formula rather than a flat value, because Tavern Brawler turns
      // the strike into 1d4 + Strength. AbilityEffectMapper prefers `dice` over
      // `value`, so the formula is the single magnitude the command layer reads.
      effects: [{
        type: 'damage',
        value: 0,
        dice: getUnarmedStrikeDamageFormula(player, getAbilityModifierValue(stats.strength)),
        damageType: 'bludgeoning'
      }],
      attackType: 'unarmed',
      icon: '✊'
    });
  }

  if (offHand && offHand.category && offHand.category.includes('Weapon')) {
    abilities.push(createWeaponAbility(offHand, 'off', true));
  }

  // ------------------------------------------------------------------
  // Universal Actions — available to all player characters
  // ------------------------------------------------------------------
  // These are standard D&D actions that every character can take regardless
  // of class or equipment. They're added after weapon abilities so they
  // appear at the end of the ability palette in the combat UI.
  //
  // - Dash: Doubles your movement for the turn (costs your Action).
  // - Disengage: Prevents opportunity attacks when you move away (costs Action).
  // - Stand Up: Rights yourself from the Prone condition. Per the 2024 PHB,
  //   this costs half your total Speed (not an Action). The 'movement-only'
  //   cost type deducts from remaining movement without consuming any action.
  //   The actual Prone removal happens in useActionExecutor.ts.
  // ------------------------------------------------------------------
  abilities.push(
    { id: 'dash', name: 'Dash', description: 'Gain extra movement for the turn.', type: 'movement', cost: { type: 'action' }, targeting: 'self', range: 0, effects: [{ type: 'movement', value: stats.speed }], icon: '🏃' },
    { id: 'disengage', name: 'Disengage', description: 'Prevent opportunity attacks.', type: 'utility', cost: { type: 'action' }, targeting: 'self', range: 0, effects: [], icon: '🛡️' },
    { id: 'stand_up', name: 'Stand Up', description: 'Right yourself from a Prone position. Costs half your Speed.', type: 'movement', cost: { type: 'movement-only', movementCost: Math.floor(stats.speed / 2) }, targeting: 'self', range: 0, effects: [], icon: '⬆️' }
  );

  const addClassFeatureAbility = (ability: Ability, limitedUseId?: string): void => {
    if (limitedUseId) {
      const limitedUse = player.limitedUses?.[limitedUseId];
      if (limitedUse) {
        const maxUses = typeof limitedUse.max === 'number' ? limitedUse.max : undefined;
        if (typeof maxUses === 'number') {
          ability.maxUses = maxUses;
        }
        if (typeof limitedUse.current === 'number') {
          ability.usesRemaining = limitedUse.current;
        }
      }
    }

    abilities.push(ability);
  };

  if (player.class.id === 'rogue' && (player.level || 1) >= 2) {
    // Cunning Action is a level-2 rogue feature (was incorrectly granted at level 1).
    abilities.push({ id: 'cunning_dash', name: 'Cunning Dash', description: 'Dash as a bonus action.', type: 'movement', cost: { type: 'bonus' }, targeting: 'self', range: 0, effects: [{ type: 'movement', value: stats.speed }], icon: '🏃' });
  }

  // Steady Aim (rogue level 3+): forgo movement to gain advantage on your next attack.
  if (player.class.id === 'rogue' && (player.level || 1) >= 3) {
    abilities.push({ id: 'steady_aim', name: 'Steady Aim', description: 'Forgo movement this turn to gain advantage on your next attack.', type: 'utility', cost: { type: 'bonus' }, targeting: 'self', range: 0, effects: [], icon: '🎯' });
  }

  if (player.class.id === 'fighter') {
    abilities.push({ id: 'second_wind', name: 'Second Wind', description: 'Regain hit points.', type: 'utility', cost: { type: 'bonus', limitations: { oncePerTurn: true } }, targeting: 'self', range: 0, effects: [{ type: 'heal', value: 10 + (player.level || 1) }], icon: '➕' });
  }

  // Action Surge (fighter level 2+): once per rest, take one additional action.
  if (player.class.id === 'fighter' && (player.level || 1) >= 2) {
    abilities.push({ id: 'action_surge', name: 'Action Surge', description: 'Take one additional action on your turn (once per rest).', type: 'utility', cost: { type: 'free' }, targeting: 'self', range: 0, effects: [], icon: '⚡', maxUses: 1, usesRemaining: 1 });
  }

  if (player.class.id === 'barbarian') {
    // Path of the Wild Heart (level 3): the Rage of the Wilds "bear" boon makes a
    // raging character resistant to ALL damage except psychic (rather than just
    // the base Rage physical resistance). We tag the Rage ability so the rage
    // executor can widen the resistance list when the barbarian activates it.
    const isWildHeart = player.subclassId === 'wild_heart' && (player.level || 1) >= 3;
    addClassFeatureAbility({
      id: 'rage',
      name: isWildHeart ? 'Rage (Bear Spirit)' : 'Rage',
      description: isWildHeart
        ? 'Enter a Rage channeling the bear spirit — resistant to all damage except psychic.'
        : 'Enter a Rage as a bonus action.',
      type: 'utility',
      cost: { type: 'bonus' },
      targeting: 'self',
      range: 0,
      effects: [],
      icon: '🔥',
      ...(isWildHeart ? { tags: ['wild_heart_bear'] } : {}),
    }, 'rage');
  }

  // Frenzy (Path of the Berserker barbarian, level 3): while raging you can make a
  // single melee weapon attack as a bonus action. Built as a real weapon attack
  // (rolls to hit, deals the equipped weapon's damage) that flows through the
  // normal WeaponAttackCommand path, just like Flurry of Blows.
  const frenzyWeapon = player.equippedItems?.MainHand;
  if (player.class.id === 'barbarian' && player.subclassId === 'berserker' && (player.level || 1) >= 3 && frenzyWeapon) {
    abilities.push({
      id: 'frenzy_attack',
      name: 'Frenzy',
      description: 'While raging, make a single melee weapon attack as a bonus action.',
      type: 'attack',
      cost: { type: 'bonus' },
      targeting: 'single_enemy',
      range: (frenzyWeapon.properties?.some(p => p === 'reach')) ? 2 : 1,
      effects: [
        { type: 'damage', value: 0, dice: frenzyWeapon.damageDice || '1d8', damageType: 'physical' },
      ],
      weapon: frenzyWeapon,
      isProficient: isWeaponProficient(player, frenzyWeapon),
      icon: '⚔️',
    });
  }

  // Reckless Attack (barbarian level 2+): advantage on your Strength melee
  // attacks this turn, but attacks against you have advantage until your next turn.
  if (player.class.id === 'barbarian' && (player.level || 1) >= 2) {
    abilities.push({ id: 'reckless_attack', name: 'Reckless Attack', description: 'Gain advantage on melee attacks this turn; attacks against you have advantage until your next turn.', type: 'utility', cost: { type: 'free' }, targeting: 'self', range: 0, effects: [], icon: '⚔️' });
  }

  // Channel Divinity: Turn Undead (cleric level 2+): a creature that can see the
  // cleric must save or be Frightened and flee. Uses the standard 'status' effect
  // → STATUS_CONDITION('Frightened') pipeline (with a save), no special-case needed.
  if (player.class.id === 'cleric' && (player.level || 1) >= 2) {
    abilities.push({
      id: 'channel_divinity_turn_undead',
      name: 'Channel Divinity: Turn Undead',
      description: 'A creature that can see you must succeed on a Wisdom saving throw or be Frightened, forced to flee for 1 minute.',
      type: 'utility',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 6,
      effects: [{ type: 'status', statusEffect: { id: 'frightened', name: 'Frightened', type: 'debuff', duration: 10, effect: { type: 'condition' } } }],
      icon: '✨',
      maxUses: 1,
      usesRemaining: 1,
    });
  }

  // Flurry of Blows (monk level 2+): a bonus-action unarmed strike (a real attack
  // that rolls to hit and deals martial-arts-die damage), rather than an inert
  // button. Uses the monk's better of Strength/Dexterity (Martial Arts).
  if (player.class.id === 'monk' && (player.level || 1) >= 2) {
    const martialArtsMod = Math.max(getAbilityModifierValue(stats.strength), getAbilityModifierValue(stats.dexterity));
    abilities.push({
      id: 'flurry_of_blows',
      name: 'Flurry of Blows',
      description: 'Make an unarmed strike as a bonus action.',
      type: 'attack',
      cost: { type: 'bonus' },
      targeting: 'single_enemy',
      range: 1,
      effects: [{ type: 'damage', value: 0, dice: `1d6+${martialArtsMod}`, damageType: 'bludgeoning' }],
      icon: '👊'
    });
  }

  // Bardic Inspiration (bard): as a bonus action, inspire an ally — they gain
  // the Inspired condition (advantage on their next attack). Applied to the ally
  // through the standard 'status' → STATUS_CONDITION('Inspired') pipeline.
  if (player.class.id === 'bard') {
    // Bardic Inspiration is a limited resource (Charisma-mod uses per rest).
    const bardicUse = player.limitedUses?.bardic_inspiration;
    const bardicMax = typeof bardicUse?.max === 'number' ? bardicUse.max : Math.max(1, getAbilityModifierValue(stats.charisma));
    const bardicRemaining = typeof bardicUse?.current === 'number' ? bardicUse.current : bardicMax;
    abilities.push({
      id: 'bardic_inspiration',
      name: 'Bardic Inspiration',
      description: 'Inspire an ally with a stirring word — they gain advantage on their next attack.',
      type: 'utility',
      cost: { type: 'bonus' },
      targeting: 'single_ally',
      range: 12,
      effects: [{ type: 'status', statusEffect: { id: 'inspired', name: 'Inspired', type: 'buff', duration: 10, effect: { type: 'condition' } } }],
      icon: '🎶',
      maxUses: bardicMax,
      usesRemaining: bardicRemaining,
    });
  }

  // Lay on Hands (paladin level 1): touch a creature to restore hit points. Uses
  // the working 'heal' effect pipeline (like Second Wind).
  if (player.class.id === 'paladin') {
    abilities.push({ id: 'lay_on_hands', name: 'Lay on Hands', description: 'Touch a creature to restore hit points from your pool of divine healing.', type: 'utility', cost: { type: 'action' }, targeting: 'single_ally', range: 1, effects: [{ type: 'heal', value: 5 }], icon: '✋', maxUses: 3, usesRemaining: 3 });
  }

  // Vow of Enmity (Oath of Vengeance paladin, level 3 — Channel Divinity): gain
  // advantage on attack rolls against a chosen foe. Modeled as a self-buff that
  // grants attack advantage (same status-effect advantage mechanic Reckless
  // Attack and Steady Aim use, which WeaponAttackCommand reads), applied by the
  // executor's vow_of_enmity handler.
  if (player.class.id === 'paladin' && player.subclassId === 'oath_of_vengeance' && (player.level || 1) >= 3) {
    abilities.push({
      id: 'vow_of_enmity',
      name: 'Vow of Enmity (Channel Divinity)',
      description: 'Speak a vow against a foe — gain advantage on your attack rolls.',
      type: 'utility',
      cost: { type: 'bonus' },
      targeting: 'self',
      range: 0,
      effects: [],
      icon: '👁️',
      maxUses: 1,
      usesRemaining: 1,
    });
  }

  // Divine Smite (paladin level 2+): a melee weapon strike that expends divine
  // power for extra radiant damage. Built as a real weapon attack + a 2d8 radiant
  // damage effect (the same weapon-attack-plus-extra-damage shape Booming Blade
  // uses), so it actually rolls to hit and deals both damages, instead of being
  // an inert button.
  const smiteWeapon = player.equippedItems?.MainHand;
  if (player.class.id === 'paladin' && (player.level || 1) >= 2 && smiteWeapon) {
    abilities.push({
      id: 'divine_smite',
      name: 'Divine Smite',
      description: 'Strike with your weapon and channel divine power for an extra 2d8 radiant damage.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: (smiteWeapon.properties?.some(p => p === 'reach')) ? 2 : 1,
      effects: [
        { type: 'damage', value: 0, dice: smiteWeapon.damageDice || '1d8', damageType: 'physical' },
        { type: 'damage', value: 0, dice: '2d8', damageType: 'radiant' },
      ],
      weapon: smiteWeapon,
      isProficient: isWeaponProficient(player, smiteWeapon),
      icon: '✨',
      maxUses: 2,
      usesRemaining: 2,
    });
  }

  if (player.class.id === 'warlock') {
    addClassFeatureAbility({
      id: 'pact_magic',
      name: 'Pact Magic',
      description: 'Use your pact magic resource.',
      type: 'utility',
      cost: { type: 'free' },
      targeting: 'self',
      range: 0,
      effects: [],
      icon: '🕯️'
    });
  }

  // 2. Convert Spells to Combat Abilities using the Factory
  // THIS IS THE WIRING POINT: We iterate the known spell IDs, find the JSON data, and convert it.
  if (player.spellbook) {
    // Dev Player receives the entire selected class list for spell playtests.
    // Every ordinary character continues to hydrate only its real spellbook.
    const previewClassSpellIds = player.devPlaytest?.unlimitedSpellSlots
      ? (player.class.spellcasting?.spellList ?? [])
      : [];
    const spellsToCheck = [
      ...(player.spellbook.preparedSpells || []),
      ...(player.spellbook.cantrips || []),
      ...(player.spellbook.knownSpells || []), // For known casters like Bards/Sorcerers
      ...previewClassSpellIds,
    ];

    const uniqueSpellIds = Array.from(new Set(spellsToCheck));

    uniqueSpellIds.forEach(spellId => {
      const spellData = allSpells[spellId];
      if (spellData) {
        // Here we pass the JSON data to the factory.
        // The factory reads 'effects' array from the JSON (Gold Standard)
        // and returns an executable 'Ability' for the combat engine.
        const ability = createAbilityFromSpell(spellData as unknown as Spell, player);
        ability.spell = spellData; // Link original spell data
        abilities.push(ability);
      } else {
        // Fallback if spell data isn't loaded or available in allSpells
        console.warn(`CombatUtils: Spell data for '${spellId}' not found in allSpells context.`);
      }
    });
  }

  const combatChar: DevPlaytestCombatant = {
    id: player.id || `player_${player.name.toLowerCase().replace(' ', '_')}`,
    name: player.name,
    level: player.level || 1,
    // Carry the race so combat surfaces can use it — drives 3D race-specific
    // character visuals (CharacterActor) and makes race-gated targeting (e.g.
    // Hold/Charm Person, Sleep) correct. Shape matches the documented intent
    // (`['Humanoid', 'Elf']`).
    creatureTypes: ['Humanoid', player.race?.name].filter((s): s is string => !!s),
    class: player.class,
    position: { x: 0, y: 0 },
    stats,
    abilities,
    team: 'player',
    currentHP: player.hp,
    maxHP: player.maxHp,
    armorClass: player.armorClass || 10,
    baseAC: player.armorClass || 10,
    // Project armour once at the persistent-to-combat boundary. Damage and
    // future equipment-sensitive rules can now inspect stable tactical facts
    // without reaching back into the player's inventory object.
    equipment: createCombatEquipmentState(player.equippedItems),
    // Champion fighters (Improved Critical, level 3) score critical hits on a 19
    // or 20; everyone else on a natural 20.
    critThreshold: (player.subclassId === 'champion' && (player.level || 1) >= 3) ? 19 : 20,
    // Carry Hit Dice pools into combat so pool-based targeting can use them.
    hitPointDice: buildHitPointDicePools(player),
    initiative: 0,
    statusEffects: [],
    actionEconomy: {
      action: { used: false, remaining: 1 },
      bonusAction: { used: false, remaining: 1 },
      reaction: { used: false, remaining: 1 },
      legendary: { used: 0, total: 0 },
      movement: { used: 0, total: stats.speed },
      freeActions: 1,
    },
    spellbook: player.spellbook,
    spellSlots: player.spellSlots,
    // Racial and class feature resources now cross the bridge (agora-0ad6).
    // Spend them with `spendCombatLimitedUse` so the persistent record is never
    // mutated by a combat action.
    limitedUses: projectLimitedUsesForCombat(player.limitedUses),
    savingThrowProficiencies: player.savingThrowProficiencies,
    // Keep the exception explicitly attached to this transient combatant. The
    // action-economy gate reads it to bypass only slot accounting, never turns.
    ...(player.devPlaytest ? { devPlaytest: { ...player.devPlaytest } } : {}),
    // WHAT CHANGED: Added feats array mapping.
    // WHY IT CHANGED: To support feat-based mechanics in the combat loop. 
    // By passing the feat IDs (e.g., ['great_weapon_master']) to the 
    // CombatCharacter, we allow the damage calculators and action 
    // handlers to apply bonus damage or special effects during a battle.
    feats: player.feats || [], // feat IDs (e.g. ['slasher', 'great_weapon_master'])
    // Damage defenses stated in the race's trait prose are projected here
    // (agora-ddb7) instead of being re-derived by each Design Preview race leaf.
    // The character's own data is listed first and wins on a case-insensitive
    // match, so an explicit `player.resistances` entry still decides the
    // spelling and nothing a character already had can be displaced.
    resistances: mergeDamageDefenses(
      player.resistances ?? (player.race as { resistance?: string[] })?.resistance,
      racialTraitDefenses.resistances
    ),
    immunities: mergeDamageDefenses(player.immunities, racialTraitDefenses.immunities),
    vulnerabilities: mergeDamageDefenses(player.vulnerabilities, racialTraitDefenses.vulnerabilities),
    modifiers: player.modifiers ? {
      advantage: [...player.modifiers.advantage],
      disadvantage: [...player.modifiers.disadvantage],
      bonuses: [...player.modifiers.bonuses],
      baseArmorClass: player.modifiers.baseArmorClass,
      acBonus: player.modifiers.acBonus,
      reachBonus: player.modifiers.reachBonus,
      powerfulBuild: player.modifiers.powerfulBuild,
      unendingBreath: player.modifiers.unendingBreath,
      languages: player.modifiers.languages ? [...player.modifiers.languages] : undefined,
      skillProficiencies: player.modifiers.skillProficiencies ? [...player.modifiers.skillProficiencies] : [],
      weaponProficiencies: player.modifiers.weaponProficiencies ? [...player.modifiers.weaponProficiencies] : [],
      armorProficiencies: player.modifiers.armorProficiencies ? [...player.modifiers.armorProficiencies] : [],
      initiativeBonus: player.modifiers.initiativeBonus,
      initiativeProficiency: player.modifiers.initiativeProficiency,
      ignoreDifficultTerrain: player.modifiers.ignoreDifficultTerrain,
      breathWeapon: player.modifiers.breathWeapon ? { ...player.modifiers.breathWeapon } : undefined,
      savageAttacks: player.modifiers.savageAttacks,
    } : undefined,
    initiativeBonus: player.initiativeBonus,
    initiativeProficiency: player.initiativeProficiency,
    ignoreDifficultTerrain: player.ignoreDifficultTerrain,
    // Level-3 subclass choices the rider modules read. They are plain data, so
    // they cross the bridge here; the feature abilities that unlock the riders
    // are granted in the subclass block below.
    hunterPreyChoice: player.hunterPreyChoice,
    primalBeastForm: player.primalBeastForm,
    // Read the race's trait prose once for the QUALIFIED waiver (GG-257). The
    // flat boolean above cannot say whether Earth Walk covers the water square
    // the mover is about to enter; this id can.
    terrainPolicyId: resolveTerrainMovementPolicyFromTraits(player.race?.traits)?.id,
  };

  // --------------------------------------------------------------------------
  // Subclass rider features (agora-db71.14)
  // --------------------------------------------------------------------------
  // Each rider module gates itself on one of these ability ids. Granting them
  // here is the whole wiring: the rules stay in the rider modules, and the
  // action executor reads the same ids back when it dispatches.
  // --------------------------------------------------------------------------
  const characterLevel = player.level || 1;

  const addFeatureMarker = (id: string, name: string, description: string, icon: string): void => {
    combatChar.abilities.push({
      id,
      name,
      description,
      type: 'utility',
      cost: { type: 'free' },
      targeting: 'self',
      range: 0,
      effects: [],
      icon,
    });
  };

  if (combatChar.class?.id === 'ranger' && player.subclassId === 'hunter' && characterLevel >= 3) {
    addFeatureMarker(
      HUNTER_PREY_FEATURE_ID,
      "Hunter's Prey",
      'Your chosen Hunter’s Prey option punishes the foes you strike.',
      '🏹',
    );
  }

  if (combatChar.class?.id === 'ranger' && player.subclassId === 'beast_master' && characterLevel >= 3) {
    addFeatureMarker(
      PRIMAL_COMPANION_FEATURE_ID,
      'Primal Companion',
      'A bonded beast fights alongside you and obeys your commands.',
      '🐺',
    );
    combatChar.abilities.push({
      id: PRIMAL_COMPANION_COMMAND_ABILITY_ID,
      name: 'Command Companion',
      description: 'Spend your bonus action to command your Primal Companion.',
      type: 'utility',
      cost: { type: 'bonus' },
      targeting: 'single_ally',
      range: 12,
      effects: [],
      icon: '🐾',
    });
  }

  // Cunning Action is the base rogue level-2 feature; Fast Hands (Thief, level
  // 3) widens the option list it produces. The options are read back out of the
  // same catalog the resolver validates against, so a button can never name an
  // option `resolveCunningAction` would refuse.
  if (combatChar.class?.id === 'rogue' && characterLevel >= 2) {
    addFeatureMarker(
      CUNNING_ACTION_FEATURE_ID,
      'Cunning Action',
      'Dash, Disengage, or Hide as a bonus action.',
      '🗡️',
    );
  }

  if (combatChar.class?.id === 'rogue' && player.subclassId === 'thief' && characterLevel >= 3) {
    addFeatureMarker(
      FAST_HANDS_FEATURE_ID,
      'Fast Hands',
      'Your Cunning Action can also use an object, thieves’ tools, or Sleight of Hand.',
      '🤲',
    );
    addFeatureMarker(
      SECOND_STORY_WORK_FEATURE_ID,
      'Second-Story Work',
      'Climbing costs you no extra movement, and you jump farther.',
      '🧗',
    );
  }

  if (combatChar.class?.id === 'rogue' && player.subclassId === 'assassin' && characterLevel >= 3) {
    addFeatureMarker(
      ASSASSINATE_FEATURE_ID,
      'Assassinate',
      'Advantage against foes who have not acted; a hit on a surprised creature is a critical.',
      '🥷',
    );
    addFeatureMarker(
      ASSASSINS_TOOLS_FEATURE_ID,
      'Assassin’s Tools',
      'You are proficient with a disguise kit and a poisoner’s kit.',
      '🧪',
    );
  }

  // The Cunning Action buttons come last so the option list already reflects
  // whether Fast Hands was granted above.
  for (const option of cunningActionOptionsFor(combatChar)) {
    combatChar.abilities.push({
      id: `${CUNNING_ACTION_ABILITY_PREFIX}${option.id}`,
      name: `Cunning Action: ${option.name}`,
      description: option.description,
      type: 'utility',
      cost: { type: 'bonus' },
      targeting: 'self',
      range: 0,
      effects: [],
      icon: '⚡',
    });
  }

  // Danger Sense (barbarian level 2+): advantage on Dexterity saving throws. The
  // save resolver matches advantage modifiers by text, so this string grants the
  // feature mechanically (dodging traps, breath weapons, fireballs, etc.).
  if (combatChar.class?.id === 'barbarian' && (player.level || 1) >= 2) {
    if (!combatChar.modifiers) {
      combatChar.modifiers = { advantage: [], disadvantage: [], bonuses: [] };
    }
    combatChar.modifiers.advantage.push('Advantage on Dexterity saving throws');
  }

  // Draconic Resilience (Draconic Sorcery, level 3): while not wearing armor the
  // sorcerer's AC becomes 10 + Dexterity modifier + Charisma modifier, and their
  // hit point maximum increases (1 per sorcerer level; +3 at level 3). We apply
  // the unarmored AC only when it beats the character's current AC so a shield or
  // Mage Armor is never downgraded, and bump both maxHP and currentHP.
  if (combatChar.class?.id === 'sorcerer' && player.subclassId === 'draconic' && (player.level || 1) >= 3 && !player.equippedItems?.Torso) {
    const dracAC = 10 + getAbilityModifierValue(stats.dexterity) + getAbilityModifierValue(stats.charisma);
    if (dracAC > (combatChar.armorClass ?? 10)) {
      combatChar.armorClass = dracAC;
      combatChar.baseAC = dracAC;
    }
    const hpBonus = player.level || 1;
    combatChar.maxHP += hpBonus;
    combatChar.currentHP += hpBonus;
  }

  // Dark One's Blessing (Fiend warlock, level 3): whenever the warlock reduces a
  // hostile creature to 0 HP, they gain temporary hit points equal to their
  // Charisma modifier + warlock level (minimum 1). We resolve the amount once
  // here so the damage engine can grant it at the kill point without re-deriving
  // subclass/level state. The actual grant lives in DamageCommand, which owns the
  // moment a target's HP drops to 0.
  if (combatChar.class?.id === 'warlock' && player.subclassId === 'fiend' && (player.level || 1) >= 3) {
    const blessingTempHp = Math.max(1, getAbilityModifierValue(stats.charisma) + (player.level || 1));
    combatChar.darkOnesBlessingTempHp = blessingTempHp;
  }

  // Unarmored Movement (monk level 2+): +10 ft speed while wearing no armor and
  // wielding no shield. Boosts the combat movement budget directly.
  if (combatChar.class?.id === 'monk' && (player.level || 1) >= 2 && !player.equippedItems?.Torso && !player.equippedItems?.OffHand) {
    combatChar.stats.speed += 10;
    combatChar.actionEconomy.movement.total = combatChar.stats.speed;
  }

  // Add Breath Weapon as a Combat Ability
  if (player.modifiers?.breathWeapon) {
    const bw = player.modifiers.breathWeapon;
    let damageDice = bw.damageDice;
    bw.scaling.forEach(s => {
      if (player.level && player.level >= s.level) {
        damageDice = s.dice;
      }
    });

    const resourceKey = resolveRacialResourceId('feature', `${player.race.id}__breath_weapon__resource`);
    const limitedUse = player.limitedUses?.[resourceKey];

    combatChar.abilities.push({
      id: 'racial_breath_weapon',
      name: 'Breath Weapon',
      description: `Exhale destructive energy in a ${bw.areaSize}-foot ${bw.areaShape}.`,
      type: 'attack',
      targeting: 'area',
      range: bw.areaSize,
      areaShape: bw.areaShape,
      areaSize: bw.areaSize / 5, // Convert feet to grid tiles
      cost: { type: 'action' },
      saveDC: 8 + (player.proficiencyBonus || 2) + getAbilityModifierValue(player.finalAbilityScores.Constitution),
      saveAbility: bw.saveAbility,
      effects: [{
        type: 'damage',
        dice: damageDice,
        damageType: bw.damageType as any,
      }],
      usesRemaining: limitedUse?.current,
      maxUses: typeof limitedUse?.max === 'number' ? limitedUse.max : (player.proficiencyBonus || 2),
    });
  }

  // Darkvision (2026-09-09, was TODO #1316: "replace with robust feature mapping from
  // Race traits"). That robust mapping already existed — `calculateCharacterDarkvisionFromRace`
  // in utils/character/stats.ts parses the race's `traits` strings for a Vision line and
  // applies the superior-darkvision overrides, and `updateDerivedStats` stores its result
  // on `player.darkvisionRange`. Combat now reads that derived value instead of matching
  // substrings of the race's display NAME, so a renamed or homebrew race no longer silently
  // loses darkvision, and combat can never disagree with the character sheet.
  //
  // combatUtils deliberately does not import stats.ts to recompute it: that module pulls in
  // the whole race data bundle, which does not belong in the combat path.
  //
  // The old name heuristic is PRESERVED as a fallback for characters that never went through
  // updateDerivedStats — test fixtures, older saves, and sandbox-generated combatants all
  // arrive with darkvisionRange 0.
  if (combatChar.stats.senses) {
      if (player.darkvisionRange > 0) {
          combatChar.stats.senses.darkvision = player.darkvisionRange;
      } else if (player.race.name.includes("Drow") || player.race.name.includes("Deep Gnome")) {
          combatChar.stats.senses.darkvision = 120;
      } else if (player.race.name.includes("Elf") || player.race.name.includes("Dwarf") || player.race.name.includes("Gnome") || player.race.name.includes("Tiefling")) {
          combatChar.stats.senses.darkvision = 60;
      }
  }

  return combatChar;
}

export interface AttackResult {
  isHit: boolean;
  isCritical: boolean;
  isAutoMiss: boolean;
  total: number;
}

/**
 * Resolves an attack roll against a target's Armor Class according to 5e rules.
 * Handles Natural 1 (Auto Miss), Natural 20 (Auto Hit/Crit), and Critical Ranges.
 *
 * @param d20Roll - The raw d20 roll (before modifiers).
 * @param modifiers - Total attack bonus (ability mod + proficiency + others).
 * @param targetAC - The target's Armor Class.
 * @param critThreshold - The minimum die roll required for a critical hit (default 20).
 * @returns An object containing hit/miss status and critical details.
 */
export function resolveAttack(
  d20Roll: number,
  modifiers: number,
  targetAC: number,
  critThreshold: number = 20
): AttackResult {
  const total = d20Roll + modifiers;
  let isHit = false;
  let isCritical = false;
  let isAutoMiss = false;

  if (d20Roll === 1) {
    isAutoMiss = true;
    isHit = false;
  } else if (d20Roll >= critThreshold) {
    isCritical = true;
    isHit = true;
  } else {
    isHit = total >= targetAC;
  }

  return { isHit, isCritical, isAutoMiss, total };
}
