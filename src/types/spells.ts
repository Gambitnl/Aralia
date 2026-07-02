// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 01/07/2026, 17:17:11
 * Dependents: commands/base/BaseEffectCommand.ts, commands/base/SpellCommand.ts, commands/effects/AttackRollModifierCommand.ts, commands/effects/CommandedSummonCommand.ts, commands/effects/ConcentrationCommands.ts, commands/effects/DamageCommand.ts, commands/effects/DefensiveCommand.ts, commands/effects/EnhanceAbilityCommand.ts, commands/effects/FamiliarPocketCommands.ts, commands/effects/FamiliarSharedSensesCommand.ts, commands/effects/GrantedActionCommand.ts, commands/effects/HealingCommand.ts, commands/effects/MovementCommand.ts, commands/effects/ReactiveEffectCommand.ts, commands/effects/RegisterRiderCommand.ts, commands/effects/StatusConditionCommand.ts, commands/effects/SummonDismissCommand.ts, commands/effects/SummonReturnHomeCommand.ts, commands/effects/SummoningCommand.ts, commands/effects/TerrainCommand.ts, commands/effects/UtilityCommand.ts, commands/factory/AbilityCommandFactory.ts, commands/factory/AbilityEffectMapper.ts, commands/factory/SpellCommandFactory.ts, commands/factory/boomingBladeAttackBridge.ts, commands/factory/greenFlameBladeAttackBridge.ts, commands/factory/trueStrikeAttackBridge.ts, components/BattleMap/AISpellInputModal.tsx, components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx, components/Combat/ReactionPrompt.tsx, data/adapters/5eTools/index.ts, data/adapters/5eTools/shared.ts, data/adapters/5eTools/spellEffectMapper.ts, data/adapters/5eTools/spellcastingAdapter.ts, data/feats/featsData.ts, data/races/racialTraits.ts, hooks/actionUtils.ts, hooks/combat/engine/useCombatEngine.ts, hooks/combat/useActionExecutor.ts, hooks/combat/useSummons.ts, hooks/combat/useTargetValidator.ts, hooks/data/useSpellRegistry.ts, hooks/movementUtils.ts, hooks/perTargetChoiceUtils.ts, hooks/spellEffectUtils.ts, hooks/teleportUtils.ts, hooks/useAbilitySystem.ts, scripts/audit_enchantment_consistency.ts, systems/creatures/CreatureTaxonomy.ts, systems/environment/EnvironmentSystem.ts, systems/environment/hazards.ts, systems/rituals/RitualManager.ts, systems/spells/ai/AISpellArbitrator.ts, systems/spells/effects/triggerHandler.ts, systems/spells/mechanics/ConcentrationTracker.ts, systems/spells/mechanics/SavingThrowResolver.ts, systems/spells/mechanics/ScalingEngine.ts, systems/spells/targeting/TargetAllocator.ts, systems/spells/targeting/TargetValidationUtils.ts, systems/spells/validation/LegacySpellValidator.ts, systems/spells/validation/SpellIntegrityValidator.ts, systems/spells/validation/TargetingPresets.ts, types/index.ts, types/mechanics.ts, types/spellAttackMetadata.ts, types/spellTargeting.ts, utils/character/savingThrowUtils.ts, utils/combat/combatUtils.ts, utils/combat/createEnemyFromMonster.ts, utils/combat/resistanceUtils.ts, utils/core/factories.ts, utils/validation/spellAuditor.ts, utils/validation/spellConsistencyValidator.ts, utils/visuals/spellVisuals.ts
 * Imports: 17 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/types/spells.ts
 * This file contains all the new TypeScript type definitions and interfaces
 * for the component-based spell system.
 * 
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Preservationist] Added '@ts-ignore' to the 
 * 'SpellVisualSpec' import to suppress script-specific resolution 
 * warnings.
 */

// @ts-ignore
import type { SpellVisualSpec } from './visuals';
import type { SpellAttackType, SpellRarity, SpellSchool } from './spellCoreMetadata';
import type {
  AreaOfEffect,
  DistanceUnit,
  Range,
  ScalableNumber,
  SpellTargeting,
  TargetFilter,
} from './spellTargeting';
import type {
  EffectSchedule,
  ModeChoice,
} from './spellEffectMetadata';
import type { AttackAugment } from './spellAttackMetadata';
import type { AbilityCheckModifier } from './spellCheckMetadata';
import type { ControlledEntity } from './spellControlledEntity';
import { DamageType, DamageTypeDefinitions } from './spellDamageMetadata';
import type { DamageTypeTraits } from './spellDamageMetadata';
import type { IllusionMetadata, SensoryManifestation } from './spellIllusionMetadata';
import type { FallControl } from './spellFallMetadata';
import type { ConditionBreakTrigger } from './spellStatusMetadata';
import type { AIContext, ArbitrationType } from './spellArbitrationMetadata';
import type { ConditionalEnding, EffectEndCleanup, SustainRequirement } from './spellLifecycleMetadata';
import type { HigherLevelScaling, ScalingFormula } from './spellScalingMetadata';
import type { DurationProgression } from './spellDurationMetadata';
import type {
  BarrierDamagePrevention,
  DamageInteraction,
  DeathPrevention,
  LinkedDamage,
  ResistanceSuppression,
  SpellEffectPrevention,
} from './spellProtectionMetadata';
export type { SpellAttackType, SpellRarity, SpellSchoolTraits } from './spellCoreMetadata';
export { MagicSchool, SpellSchool, SpellSchoolDefinitions } from './spellCoreMetadata';
export type {
  IllusionMetadata,
  IllusionRevealRule,
  SensoryChannel,
  SensoryManifestation,
  SensoryManifestationSize,
  SensoryManifestationVariant,
} from './spellIllusionMetadata';
export type { ControlledEntity } from './spellControlledEntity';
export type { AbilityCheckModifier } from './spellCheckMetadata';
export type { FallControl } from './spellFallMetadata';
export type { ConditionBreakTrigger } from './spellStatusMetadata';
export { DamageType, DamageTypeDefinitions } from './spellDamageMetadata';
export type { DamageTypeTraits } from './spellDamageMetadata';
export type { AIContext, ArbitrationType } from './spellArbitrationMetadata';
export type { ConditionalEnding, EffectEndCleanup, SustainRequirement } from './spellLifecycleMetadata';
export type { DurationProgression, DurationProgressionExtension } from './spellDurationMetadata';
export type {
  AreaSizeBonusScaling,
  CharacterLevelTierScaling,
  HigherLevelScaling,
  HigherLevelScalingRule,
  MultipleHigherLevelScaling,
  ScalingFormula,
  SlotLevelBonusScaling,
  SlotLevelTableScaling,
  SpecialTextOnlyHigherLevelScaling,
  TargetCountBonusScaling,
} from './spellScalingMetadata';
export type {
  BarrierDamagePrevention,
  DamageInteraction,
  DeathPrevention,
  LinkedDamage,
  ResistanceSuppression,
  SpellEffectPrevention,
} from './spellProtectionMetadata';
export type {
  AttackAbilitySubstitution,
  AttackAugment,
  AttackDamageDieOverride,
  AttackDamageTypeChoice,
  AttackDamageTypeChoiceOption,
  AttackWeaponRequirement,
  GrantedAttack,
} from './spellAttackMetadata';
export type {
  EffectSchedule,
  EffectScheduleEntry,
  EffectScheduleTargeting,
  ModeChoice,
  ModeChoiceOption,
} from './spellEffectMetadata';
export type {
  AreaOfEffect,
  AreaTargetSelection,
  AreaTargeting,
  DistanceUnit,
  GeometrySizeType,
  HybridTargeting,
  MultiTargeting,
  PointTargeting,
  Range,
  ScalableNumber,
  ScalableNumberObject,
  SelfTargeting,
  SingleTargeting,
  SpatialDetails,
  SpatialForm,
  SpatialMeasuredDetail,
  SpatialMeasuredUnit,
  SpellTargeting,
  TargetAllocation,
  TargetCluster,
  TargetFilter,
  TargetInstanceAllocation,
} from './spellTargeting';
export {
  isScalableNumberObject,
  resolveScalableNumber,
} from './spellTargeting';

//==============================================================================
// Core Spell Structure
//==============================================================================

/**
 * Represents a D&D 5e spell with a complete mechanical definition, designed
 * for a component-based, machine-readable system.
 */
export interface Spell {
  // --- Identity & Metadata ---
  id: string;
  name: string;
  aliases?: string[];
  level: number; // 0 for Cantrip
  school: SpellSchool;
  // TODO(preserve-lint): Align required metadata with SpellValidator once schema/typing are unified.
  source?: string;
  legacy?: boolean;
  classes: string[];
  subClasses: string[];
  /**
   * Retired 2026-05-11. Optional for backward compatibility with JSON files
   * that still carry it; the Sub-Classes bucket closure made this redundant.
   * New files should omit it.
   */
  subClassesVerification?: "unverified" | "verified";
  description: string;
  higherLevels?: string;
  /**
   * Structured higher-level scaling data for the runtime engine.
   *
   * Why this exists:
   * `higherLevels` is still the readable prose surface, but it is not a stable
   * runtime format. This field gives the JSON a machine-readable place to store
   * cantrip tier scaling, slot-level bonuses, breakpoint tables, and odd cases
   * that still need to preserve raw rules text without forcing the engine to
   * parse prose later.
   *
   * What it preserves:
   * - existing prose-based `higherLevels` for glossary/readability
   * - future room for richer runtime scaling without breaking old spells
   *
   * Current limitation:
   * most of the live corpus still uses prose only. This field is additive so the
   * migration can happen incrementally instead of forcing a corpus-wide rewrite.
   */
  higherLevelScaling?: HigherLevelScaling;
  /**
   * Structured rules that change the spell's duration after later play.
   *
   * Why this exists:
   * repeated daily casting, recasting an active structure, or maintaining
   * concentration for the full duration can make a spell last until dispelled,
   * become permanent, or extend its current lifetime. Those rules are not
   * higher-slot scaling and should not stay hidden in prose.
   */
  durationProgression?: DurationProgression[];
  tags?: string[];
  /**
   * Whether the spell can also be cast as a ritual.
   *
   * Why this stays separate from `castingTime`:
   * canonical spell pages often display ritual as part of the visible casting
   * time line, for example `1 Minute Ritual`. The runtime model keeps ritual as
   * its own switch so the app can reason about the normal cast time and the
   * ritual-capable status separately instead of flattening both ideas into one
   * string.
   */
  ritual?: boolean;
  rarity?: SpellRarity;
  attackType?: SpellAttackType;

  // --- Core Mechanics ---
  castingTime: CastingTime;
  /**
   * Structured event that makes this spell castable only after another combat
   * fact has happened.
   *
   * Why this exists:
   * smite-style spells and interruption spells are not ordinary "press the
   * spell button now" effects. They need the combat runtime to keep the
   * triggering hit, caster, target, and reaction timing together so the spell
   * payload lands on the correct event instead of becoming an immediate effect.
   */
  castingTrigger?: SpellCastingTrigger;
  /**
   * Structured result of a spell-cast interruption.
   *
   * Why this exists:
   * Counterspell is not merely "a reaction spell." It changes whether another
   * spell's effects run, whether the casting action is wasted, and whether the
   * target's spell slot is preserved. Keeping those outcomes in structured
   * spell data lets the shared interruption hook reason about them without
   * embedding Counterspell-specific prose checks.
   */
  interruptionState?: SpellInterruptionState;
  /**
   * Structured event that stores spell power until a later attack resolves.
   *
   * Why this exists:
   * Lightning Arrow-style spells are cast before the weapon attack, then wait
   * for the next matching attack to hit or miss. This field keeps that pending
   * attack contract visible to both data validators and the shared rider
   * runtime instead of hiding the timing rule in prose.
   */
  pendingAttackTrigger?: PendingAttackTrigger;
  range: Range;
  components: Components;
  duration: Duration;

  // --- System Components ---
  targeting: SpellTargeting;
  /**
   * Optional menu of mutually exclusive spell modes.
   *
   * Why this exists:
   * many utility spells say "choose one of the following effects." That is not
   * the same as choosing a target; it changes which operation the spell performs.
   * The menu lives here while the actual damage, terrain, utility, or control
   * payloads remain in `effects[]`.
   */
  modeChoice?: ModeChoice;
  /**
   * Optional turn or phase schedule for spells whose effects change over time.
   *
   * Why this exists:
   * some spells, such as Storm of Vengeance, already have separate effect
   * packets for each damage/control event, but a plain `turn_start` trigger
   * cannot say "this packet happens on Turn 2, that packet happens on Turn 3,
   * and this other packet repeats on Turns 5 through 10." The schedule keeps
   * that order machine-readable without flattening the underlying effects.
   */
  effectSchedule?: EffectSchedule;
  effects: SpellEffect[];

  // --- Visual Representation ---
  visual?: SpellVisualSpec;

  // --- AI & Advanced Systems ---
  arbitrationType?: ArbitrationType;
  aiContext?: AIContext;

  // --- Legacy/Convenience Fields ---
  // TODO(Taxonomist): Remove these once all spell data uses the new targeting/effects structure
  /** @deprecated Use targeting.areaOfEffect instead */
  areaOfEffect?: AreaOfEffect;
  /** @deprecated Use effects[].damage.type instead */
  damageType?: DamageType;
}
/**
 * Defines the time required to cast a spell.
 *
 * Ritual note:
 * `ritual` is intentionally not part of `unit`. A ritual spell still keeps its
 * normal timing here and then marks the ritual-capable status with the separate
 * top-level `ritual` flag above.
 */
export interface CastingTime {
  value: number;
  unit: "action" | "bonus_action" | "reaction" | "free" | "minute" | "hour" | "special";
  reactionCondition?: string; // e.g., "which you take when you are hit by an attack"
  combatCost?: {
    type: "action" | "bonus_action" | "reaction" | "free";
    condition?: string;
  };
  explorationCost?: { value: number; unit: "minute" | "hour" };
}

/**
 * Describes the combat event that permits a spell cast.
 *
 * This is deliberately spell-owned metadata, not a replacement for the combat
 * event bus. The event bus proves that something happened; this contract tells
 * the spell command layer which event is eligible to become the spell's cast.
 */
export interface SpellCastingTrigger {
  type: "after_attack_hit" | "when_visible_creature_casts_spell";
  timing: "immediate_after_event" | "during_event";
  requiredCost: "reaction" | "bonus_action" | "action" | "free";
  attackFilter?: {
    attackType?: "weapon" | "spell" | "unarmed" | "any";
    weaponType?: "melee" | "ranged" | "melee_weapon" | "ranged_weapon" | "unarmed" | "any";
    includesUnarmedStrike?: boolean;
  };
  targetBinding: "triggering_attack_target" | "triggering_spell_caster";
  maxRangeFeet?: number;
  notes?: string;
}

/**
 * Describes what an interruption spell does to the spell it is answering.
 *
 * The runtime hook can use this to stop original command execution while later
 * resource-accounting slices finish exact action-waste and slot-preservation
 * behavior for each spellcasting surface.
 */
export interface SpellInterruptionState {
  event: "visible_creature_casts_spell";
  saveType: SavingThrowAbility;
  failureOutcome?: "spell_has_no_effect";
  failedSaveOutcome: "interrupted_spell_has_no_effect_and_casting_action_is_wasted";
  slotPolicy: "interrupted_spell_slot_is_not_expended";
  preservesInterruptedSlot?: boolean;
  actionPolicy: "interrupted_casting_action_bonus_action_or_reaction_is_wasted";
  visibilityRequired: boolean;
  rangeFeet: number;
  runtimeBoundary?: string;
}

/**
 * Describes a spell that waits for a later attack instead of resolving now.
 *
 * The existing rider system can already store hit-based damage and status
 * payloads. This metadata adds the missing spell-level timing contract so
 * later slices can finish miss handling and splash targeting without inventing
 * Lightning Arrow-specific branches.
 */
export interface PendingAttackTrigger {
  type: "next_attack";
  attackFilter: {
    attackType: "weapon" | "spell" | "unarmed" | "any";
    weaponType: "melee" | "ranged" | "melee_weapon" | "ranged_weapon" | "unarmed" | "any";
  };
  resolvesOn: "hit" | "hit_or_miss";
  primaryTargetBinding: "attack_target";
  consumption: "first_matching_attack";
  missResolution?: "half_primary_damage" | "no_primary_damage";
  notes?: string;
}

//==============================================================================
// Range And Targeting Re-Exports
//==============================================================================
// Range, geometry, scalable target counts, and full targeting shapes live in
// `spellTargeting.ts`. They are imported above and re-exported here so older
// callers can keep using `types/spells` while the file stays reviewable.
/**
 * Defines the components required to cast a spell.
 */
export interface Components {
  verbal: boolean;
  somatic: boolean;
  material: boolean;
  materialDescription?: string;
  materialCost?: number; // in GP
  isConsumed?: boolean;
}

/**
 * Defines how long a spell's effects last.
 */
export interface Duration {
  type: "instantaneous" | "timed" | "special" | "until_dispelled" | "until_dispelled_or_triggered";
  value?: number; // in rounds, minutes, or hours
  unit?: "round" | "minute" | "hour" | "day";
  concentration: boolean;
}

//==============================================================================
// Targeting System
//==============================================================================
// The targeting contract was moved to `spellTargeting.ts` during the mechanics
// closure modularization checkpoint. This file re-exports that public surface so
// existing imports from `types/spells` continue to work while targeting can grow
// in a smaller, reviewable module.
//==============================================================================
// Effect System (Moved to spellEffectTypes.ts)
//==============================================================================
import type { SpellEffect, SavingThrowAbility } from "./spellEffectTypes";
export * from "./spellEffectTypes";

//==============================================================================
// Type Guards & Validation Helpers
//==============================================================================

/**
 * A type guard that checks if an object is a valid `Spell`.
 * @param obj The object to check.
 * @returns `true` if the object is a `Spell`, `false` otherwise.
 */
export function isSpell(obj: unknown): obj is Spell {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'level' in obj &&
    'targeting' in obj &&
    'effects' in obj
  );
}
