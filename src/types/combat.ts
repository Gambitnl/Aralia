// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 02/07/2026, 05:50:07
 * Dependents: commands/base/BaseEffectCommand.ts, commands/base/CommandExecutor.ts, commands/base/SpellCommand.ts, commands/effects/AttackRollModifierCommand.ts, commands/effects/CommandedSummonCommand.ts, commands/effects/ConcentrationCommands.ts, commands/effects/DamageCommand.ts, commands/effects/DefensiveCommand.ts, commands/effects/EnhanceAbilityCommand.ts, commands/effects/FamiliarPocketCommands.ts, commands/effects/FamiliarSharedSensesCommand.ts, commands/effects/GrantedActionCommand.ts, commands/effects/HealingCommand.ts, commands/effects/MovementCommand.ts, commands/effects/NarrativeCommand.ts, commands/effects/ReactiveEffectCommand.ts, commands/effects/RegisterRiderCommand.ts, commands/effects/StatusConditionCommand.ts, commands/effects/SummonDismissCommand.ts, commands/effects/SummonReturnHomeCommand.ts, commands/effects/SummoningCommand.ts, commands/effects/TerrainCommand.ts, commands/effects/UtilityCommand.ts, commands/effects/commandAreaMovementEffects.ts, commands/factory/AbilityCommandFactory.ts, commands/factory/AbilityEffectMapper.ts, commands/factory/SpellCommandFactory.ts, commands/factory/boomingBladeAttackBridge.ts, commands/factory/greenFlameBladeAttackBridge.ts, commands/factory/trueStrikeAttackBridge.ts, components/BattleMap/AbilityButton.tsx, components/BattleMap/AbilityPalette.tsx, components/BattleMap/ActionEconomyBar.tsx, components/BattleMap/BattleMap.tsx, components/BattleMap/BattleMap3D.tsx, components/BattleMap/BattleMapDemo.tsx, components/BattleMap/BattleMapOverlay.tsx, components/BattleMap/BattleMapTile.tsx, components/BattleMap/CharacterToken.tsx, components/BattleMap/CombatCharacterInspector.tsx, components/BattleMap/CombatLog.tsx, components/BattleMap/DamageNumberOverlay.tsx, components/BattleMap/InitiativeTracker.tsx, components/BattleMap/PartyDisplay.tsx, components/BattleMap/camera/CameraController.tsx, components/BattleMap/characters/CharacterActor.tsx, components/BattleMap/spellMapArtifacts.ts, components/BattleMap/terrain/DecorationProps.tsx, components/BattleMap/terrain/DistantTerrain.tsx, components/BattleMap/terrain/EzTreeLayer.tsx, components/BattleMap/terrain/GrassLayer.tsx, components/BattleMap/terrain/GridOverlay.tsx, components/BattleMap/terrain/GroundMist.tsx, components/BattleMap/terrain/GroundScatter.tsx, components/BattleMap/terrain/TerrainMesh.tsx, components/BattleMap/terrain/WaterSystem.tsx, components/BattleMap/vfx/LivingWorld.tsx, components/BattleMap/vfx/VFXSystem.tsx, components/BattleMap/visibilityObserverPolicy.ts, components/Combat/CombatView.tsx, components/Combat/ReactionPrompt.tsx, components/DesignPreview/steps/PreviewCombatScenarioLights.ts, components/DesignPreview/steps/PreviewCombatScenarioObjects.ts, components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/demo/CombatMessagingDemo.tsx, data/adapters/5eTools/actionsAdapter.ts, data/adapters/5eTools/index.ts, data/adapters/5eTools/legendaryAdapter.ts, data/adapters/5eTools/reactionsAdapter.ts, data/adapters/5eTools/shared.ts, data/adapters/5eTools/spellEffectMapper.ts, data/adapters/5eTools/spellcastingAdapter.ts, data/religion/blessings.ts, hooks/actionUtils.ts, hooks/combat/engine/useCombatEngine.ts, hooks/combat/useActionEconomy.ts, hooks/combat/useActionExecutor.ts, hooks/combat/useCombatAI.ts, hooks/combat/useCombatLog.ts, hooks/combat/useCombatOutcome.ts, hooks/combat/useCombatValidation.ts, hooks/combat/useCombatVisuals.ts, hooks/combat/useGridMovement.ts, hooks/combat/useSummons.ts, hooks/combat/useTargetSelection.ts, hooks/combat/useTargetValidator.ts, hooks/combat/useTargeting.ts, hooks/combat/useTurnManager.ts, hooks/combat/useTurnOrder.ts, hooks/combat/useVisibility.ts, hooks/movementUtils.ts, hooks/perTargetChoiceUtils.ts, hooks/teleportUtils.ts, hooks/useAbilitySystem.ts, hooks/useBattleMap.ts, hooks/useBattleMapGeneration.ts, services/battleMapGenerator.ts, systems/combat/AttackRiderSystem.ts, systems/combat/MovementEventEmitter.ts, systems/combat/SavePenaltySystem.ts, systems/combat/SustainActionSystem.ts, systems/combat/reactions/OpportunityAttackSystem.ts, systems/environment/EnvironmentSystem.ts, systems/environment/hazards.ts, systems/events/CombatEvents.ts, systems/logic/ConditionEvaluator.ts, systems/planar/ShadowfellMechanics.ts, systems/puzzles/puzzleRuntime.ts, systems/puzzles/puzzleSystem.ts, systems/religion/CombatReligionAdapter.ts, systems/rituals/RitualManager.ts, systems/spells/ai/AISpellArbitrator.ts, systems/spells/effects/AreaEffectTracker.ts, systems/spells/effects/triggerHandler.ts, systems/spells/mechanics/ConcentrationTracker.ts, systems/spells/targeting/ObjectTargetRegistry.ts, systems/spells/targeting/TargetAllocator.ts, systems/spells/targeting/TargetValidationUtils.ts, systems/spells/targeting/selectedSpellTargets.ts, systems/visibility/VisibilitySystem.ts, systems/worldforge/bridge/groundChunkLoader.ts, types/index.ts, types/infernal.ts, utils/character/checkUtils.ts, utils/character/concentrationUtils.ts, utils/character/savingThrowUtils.ts, utils/character/spellAbilityFactory.ts, utils/combat/actionEconomyUtils.ts, utils/combat/aoeCalculations.ts, utils/combat/combatAI.ts, utils/combat/combatLogToMessageAdapter.ts, utils/combat/combatUtils.ts, utils/combat/createEnemyFromMonster.ts, utils/combat/deathSaveUtils.ts, utils/combat/movementUtils.ts, utils/combat/physicsUtils.ts, utils/core/factories.ts, utils/planar/planarTargeting.ts, utils/sandbox/quickCharacterGenerator.ts, utils/spatial/geometry.ts, utils/spatial/lineOfSight.ts, utils/spatial/pathfinding.ts, utils/spatial/targetingUtils.ts, utils/world/religionUtils.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/types/combat.ts
 * This file contains all combat-related TypeScript type definitions and interfaces
 * used throughout the Aralia RPG application's battle map feature.
 */
import type { AbilityScoreName, CharacterStats } from './core.js';
import type { Class, SpellbookData, SpellSlots, FeatChoice, HitPointDicePool, LimitedUses, RacialBreathWeapon } from './character.js';
import type { Item } from './items.js';
import type { MaterialType } from "./materials.js";
import type { CreatureType } from './creatures.js';
import type { Spell, DamageType, ConditionName, EffectDuration, SpellEffect, RepeatSave, EscapeCheck, ConditionBreakTrigger, TargetFilter, AbilityCheckModifier, CreatedObject, IllusionMetadata, SensoryManifestation, TerrainManipulation, ConditionalEnding, BindingControl, DominationControl } from './spells.js'; // Import Spell
import { StateTag } from './elemental.js';
import { Plane } from './planes.js';
import { RitualState } from './ritual.js';

export type { CharacterStats };

// --- EFFECTS REFAC (IN PLACE) ---

/**
 * Filter criteria for selecting targets for an effect.
 * Strictly typed to avoid 'any'.
 */
export interface TargetConditionFilter {
  conditions?: ConditionName[];
  creatureTypes?: string[];
  hpStatus?: 'full' | 'bloodied' | 'unconscious';
  stats?: Partial<CharacterStats>;
  alignment?: string[]; // e.g., ['Evil', 'Chaotic']
}

/**
 * Represents a status effect applied to a character.
 */
export interface RepeatSaveProgressState {
  successes: number;
  failures: number;
}

export interface StatusEffect {
  id: string;
  name: ConditionName | string;
  type: 'buff' | 'debuff' | 'neutral' | 'dot' | 'hot';
  description?: string;
  duration: number; // in rounds
  source?: string; // Ability or spell name
  /** Character id that applied this status, needed for caster-relative rules such as Fear's line-of-sight repeat-save gate. */
  sourceCasterId?: string;
  icon?: string;
  /**
   * Spell-condition metadata that must survive the bridge into the legacy
   * statusEffects array. The combat engine reads repeat saves from this runtime
   * object today, while escape checks and break triggers are preserved here so
   * future condition-resolution work does not have to rediscover the original
   * spell payload.
   */
  repeatSave?: RepeatSave;
  /** Runtime counters for repeat-save progressions such as Flesh to Stone's three successes / three failures. */
  repeatSaveProgress?: RepeatSaveProgressState;
  escapeCheck?: EscapeCheck;
  breakTriggers?: ConditionBreakTrigger[];
  /** Existing-target command or service relationship created by spells such as Geas and Planar Binding. */
  bindingControl?: BindingControl;
  /** Existing-target domination relationship created by Dominate Beast/Person/Monster. */
  dominationControl?: DominationControl;
  // Simple effect structure (for spellAbilityFactory compatibility)
  effect?: {
    type: 'stat_modifier' | 'damage_per_turn' | 'heal_per_turn' | 'skip_turn' | 'condition';
    value?: number;
    stat?: string;
  };
  // Mechanical effects
  modifiers?: {
    stat?: AbilityScoreName;
    value?: number;
    skill?: string;
    attackBonus?: number;
    acBonus?: number;
    movementSpeed?: number;
    advantage?: ('attack' | 'save' | 'check')[];
    disadvantage?: ('attack' | 'save' | 'check')[];
    resistance?: DamageType[];
    vulnerability?: DamageType[];
    immunity?: DamageType[];
  };
  /**
   * Spell-linked check riders such as Guidance keep their structured bonus here
   * so the ability-check utility can read the same spell choice that the cast
   * command stored on the target.
   */
  abilityCheckModifier?: AbilityCheckModifier;
  // Visual effects
  visualEffect?: string;
  light?: {
    brightRadius: number;
    dimRadius?: number;
    attachedTo?: 'caster' | 'target' | 'point';
    color?: string;
    opaqueCoverBlocks?: boolean;
  };
  savePenalty?: {
    dice: string;
    flat?: number;
    applies: 'next_save' | 'all_saves';
  };
  /**
   * Hit-point state riders such as Chill Touch's "No Healing" rule.
   *
   * These are not ordinary conditions in the rules text: they change how HP
   * restoration behaves. Keeping them on the status mirror lets the shared
   * healing helper block healing without hard-coding one spell name.
   */
  hitPointState?: HitPointStateRider;
  /** Spell-specific social lifecycle metadata, currently used by Friends. */
  socialLifecycle?: SocialSpellLifecycle;
}

export interface HitPointStateRider {
  mode: "healing_lockout" | string;
  duration?: string;
  target?: string;
  preventsHitPointRegain?: boolean;
}

export interface SocialSpellLifecycle {
  kind: 'friends_charm' | string;
  targetKnowsOnEnd?: boolean;
  recastMemoryDurationRounds?: number;
  durationDays?: number;
  endsIfDamagedByCasterOrAllies?: boolean;
  targetChoosesAttitudeOnEnd?: boolean;
}

/**
 * Represents an active, ongoing effect on a character (e.g., from a spell like Shield of Faith or Mage Armor).
 * These are distinct from Conditions (Prone, Stunned) as they often carry specific mechanics or durations.
 */
  export interface ActiveEffect {
  id: string;
  spellId: string;
  casterId: string;
  sourceName: string;
  type: "buff" | "debuff" | "utility";
  duration: EffectDuration;
  startTime: number; // Round number
  /**
   * Mechanical impacts of this effect.
   * Can be used to modify AC, saving throws, etc.
   */
  mechanics?: {
    /** Flat AC bonus preserved from structured defensive spell data such as Shield of Faith. */
    acBonus?: number;
    /** Base AC value used by Mage Armor-style effects before adding the relevant ability modifier. */
    baseAC?: number;
    /** Human-readable formula kept so later recalculation/UI can explain how the base AC was derived. */
    baseACFormula?: string;
    /** Minimum AC floor used by Barkskin-style effects. */
    acMinimum?: number;
    savingThrowBonus?: number;
    damageResistance?: DamageType[];
    damageImmunity?: DamageType[];
    damageVulnerability?: DamageType[];
    /**
     * Flat damage-reduction riders such as Resistance keep their dice, chosen
     * damage type, and once-per-turn consumption marker here so the damage
     * engine can spend the rider without flattening it into generic resistances.
     */
    damageReduction?: {
      dice: string;
      appliesTo: "damage_taken";
      frequency: "once_per_turn" | "every_time";
      damageType?: DamageType;
      lastAppliedTurn?: number;
    };
    /**
     * Negative Energy Flood creates a delayed hostile Zombie when its damage
     * kills a non-Undead creature. The pending record stays on the caster so
     * turn-start logic can later raise the Zombie without re-reading the
     * original damage log.
     */
    negativeEnergyFloodZombieRise?: {
      targetId: string;
      targetName: string;
      targetCreatureTypes?: string[];
      position: Position;
      entityType: string;
      timing: string;
      behavior?: string;
      statBlock?: string;
    };
    attackBonus?: number;
    /**
     * Held-weapon spell augments, such as Shillelagh, are stored on the
     * caster as active-effect mechanics because the current combat item model
     * does not yet persist temporary enchantments directly on Item instances.
     * The weapon attack command re-checks the live weapon before consuming this
     * block so releasing or swapping away from the registered weapon naturally
     * stops applying the buff without needing a separate inventory event hook.
     */
    heldWeaponAugment?: {
      sourceWeaponId?: string;
      sourceWeaponName?: string;
      sourceSpellId?: string;
      sourceCasterId?: string;
      sourceSpellcastingAbilityModifier?: number;
      sourceCasterLevel?: number;
      isMagical?: boolean;
      eligibleWeaponTypes?: string[];
      attackType?: string;
      useSpellcastingAbilityForAttack?: boolean;
      useSpellcastingAbilityForDamage?: boolean;
      consumesOnAttackHitOrMiss?: boolean;
      damageDiceByLevel?: {
        base: string;
        level5?: string;
        level11?: string;
        level17?: string;
      };
      damageTypeChoice?: {
        chooser?: string;
        options: string[];
        defaultType?: string;
      };
      endsOnRecast?: boolean;
      endsIfReleased?: boolean;
    };
    damageBonus?: {
      amount: number;
      type: DamageType;
    };
    // Defensive reaction triggers (e.g. Shield spell)
    triggerCondition?: "on_hit" | "on_damaged" | "on_save";
    /**
     * Filter to determine if the effect applies against a specific attacker.
     * Replaces 'any' with strict typing.
     */
    attackerFilter?: TargetConditionFilter;

    // Planar Mechanics
    planarPhase?: string; // The ID of the plane the character is shifted to (e.g., 'ethereal')
    planarVision?: string[]; // IDs of planes the character can see into while in this state

    // Combat Modifiers (e.g., from Slasher feat)
    /** When true, this effect imposes disadvantage on attack rolls */
    disadvantageOnAttacks?: boolean;
    /** When true, this effect grants advantage on attack rolls */
    advantageOnAttacks?: boolean;

    /**
     * Attack-roll riders are not conditions. They live here so combat can
     * decide later whether the rider modifies attacks made by this creature
     * or attacks aimed at this creature.
     */
    attackRollDirection?: "incoming" | "outgoing";
    attackRollModifier?: "advantage" | "disadvantage" | "bonus" | "penalty";
    attackRollKind?: "any" | "weapon" | "melee_weapon" | "ranged_weapon" | "spell";
    attackRollConsumption?: "next_attack" | "first_attack" | "while_active";
    attackRollValue?: number;
        attackRollDice?: string;
    /**
     * Optional target gate for outgoing attack-roll riders.
     *
     * Chill Touch's Undead rider only penalizes attacks against the caster who
     * hit the Undead. Storing that caster id here lets the ordinary attack
     * factory read the rider without making the affected Undead worse against
     * every creature on the battlefield.
     */
    attackRollTargetId?: string;
    /**
     * Some attack-roll riders also shut off a condition's combat benefit.
     * Shining Smite is the current shared use: the target still may carry the
     * Invisible condition record, but attacks against it should not suffer the
     * Invisible-target disadvantage while this rider is active.
     */
    suppressedConditionBenefit?: string;

    /**
     * Saving throw riders.
     */
    savingThrowModifier?: "advantage" | "disadvantage" | "bonus" | "penalty";
    savingThrowConsumption?: "next_save" | "while_active";
    savingThrowValue?: number;
    savingThrowDice?: string;
    savingThrowAbility?: "Strength" | "Dexterity" | "Constitution" | "Intelligence" | "Wisdom" | "Charisma";
    /**
     * Find Familiar-style observer handoff. The active effect marks that the
     * caster is currently using a familiar's senses, while the actual 2D/3D
     * visibility and camera consumers can decide how to present that observer
     * change without re-parsing summon metadata.
     */
    familiarSharedSenses?: boolean;
    observerCharacterId?: string;
    telepathyRange?: number;
    sharedSensesCost?: 'action' | 'bonus_action' | 'free' | 'none';
  };
}

export type { SpellSlots };

// --- NEW COMBAT SYSTEM TYPES ---

export interface Position {
  x: number;
  y: number;
}

export type LightLevel = 'bright' | 'dim' | 'darkness' | 'magical_darkness';

export interface ActionEconomyState {
  action: { used: boolean; remaining: number };
  bonusAction: { used: boolean; remaining: number };
  reaction: { used: boolean; remaining: number };
  legendary: { used: number; total: number }; // Tracks legendary actions per round
  movement: { used: number; total: number }; // in feet
  freeActions: number;
}

export type Direction = 'north' | 'south' | 'east' | 'west' | 'northeast' | 'northwest' | 'southeast' | 'southwest';

/** Tracks 5e conditions (prone, restrained, custom, etc.) currently affecting a character. */
export interface ActiveCondition {
  name: ConditionName | string;
  duration: EffectDuration | { type: 'permanent'; value?: number };
  appliedTurn: number;
  source?: string; // Spell or effect that applied the condition
  /** Character id that applied this condition, preserved for caster-relative repeat-save and break rules. */
  sourceCasterId?: string;
  /**
   * Keep spell-condition metadata on the structured condition mirror as well as
   * statusEffects. statusEffects is still the engine-readable bridge, but this
   * field prevents the newer conditions array from becoming a lossy copy.
   */
  repeatSave?: RepeatSave;
  escapeCheck?: EscapeCheck;
  breakTriggers?: ConditionBreakTrigger[];
  /** Existing-target command or service relationship mirrored from statusEffects for non-lossy condition state. */
  bindingControl?: BindingControl;
  /** Existing-target domination relationship mirrored from statusEffects for non-lossy condition state. */
  dominationControl?: DominationControl;
  /** Runtime-facing hit-point rider copied from the spell status payload. */
  hitPointState?: HitPointStateRider;
  /** Social aftermath metadata mirrored from statusEffects for non-lossy cleanup. */
  socialLifecycle?: SocialSpellLifecycle;
}

export interface SpellMemoryEntry {
  spellId: string;
  spellName?: string;
  casterId: string;
  affectedTurn: number;
  expiresAtTurn: number;
  kind: 'cast_by_caster' | string;
}

export interface SocialAwarenessEntry {
  sourceSpellId: string;
  sourceSpellName?: string;
  casterId: string;
  learnedTurn: number;
  kind: 'post_charm_awareness' | string;
  targetKnows: string;
}

/**
 * Post-combat snapshot of a party member's mutable resources. Combat runs on
 * transient CombatCharacter copies; when a battle ends this carries each surviving
 * player's final HP, spent spell slots, and used limited-use abilities back to the
 * persistent PlayerCharacter so attrition sticks instead of resetting every fight.
 */
export interface CombatPartySnapshotEntry {
  id: string;
  currentHP: number;
  spellSlots?: SpellSlots;
  limitedUses?: LimitedUses;
}

export interface CombatCharacter {
  id: string;
  name: string;
  level: number; // For scaling calculations (CR for monsters, Level for PCs)
  /**
   * Creature types for targeting (e.g., ['Humanoid', 'Elf']).
   * Used by spells like Charm Person or Hold Person.
   * Migrated to canonical CreatureType[] to align with the taxonomy enum.
   */
  creatureTypes?: CreatureType[];
  alignment?: string; // e.g., 'Chaotic Evil', 'Lawful Good'
  class: Class;
  savingThrowProficiencies?: AbilityScoreName[]; // For characters that have additional saving throw proficiencies (e.g. from feats)
  position: Position;
  stats: CharacterStats;
  abilities: Ability[];
  team: 'player' | 'enemy';
  currentHP: number;
  maxHP: number;
  /** Minimum d20 roll for a critical hit (default 20; 19 for Champion fighters). */
  critThreshold?: number;
  /**
   * Dark One's Blessing (Fiend warlock, level 3): when this character reduces a
   * hostile creature to 0 HP, they gain temporary hit points equal to this
   * value (Charisma modifier + warlock level, minimum 1). Set once at combat
   * character construction so the damage engine can grant the temp HP without
   * re-deriving subclass/level state mid-combat.
   */
  darkOnesBlessingTempHp?: number;
  /** Optional death saving throw tracking for downed player characters (at 0 HP). */
  deathSaves?: {
    successes: number;
    failures: number;
    isStable?: boolean;
  };
  savePenaltyRiders?: SavePenaltyRider[];
  /** Optional: tracks remaining/total Hit Point Dice for rest-like mechanics. */
  hitPointDice?: HitPointDicePool[];
  initiative: number;
  statusEffects: StatusEffect[];
  conditions?: ActiveCondition[];
  /**
   * Long-lived spell interaction memory used for recast gates such as Friends'
   * "cast on this target within 24 hours" auto-success rule.
   */
  spellMemory?: SpellMemoryEntry[];
  /**
   * Character-facing aftermath facts such as knowing a caster charmed them.
   * This is intentionally factual state, not a full relationship system.
   */
  socialAwareness?: SocialAwarenessEntry[];
  /**
   * Character ids that can currently hear this creature well enough to use
   * hearing-based target acquisition. This is intentionally narrow: it gives
   * spells such as Vicious Mockery a runtime hook without pretending the full
   * stealth/noise system already exists.
   */
  audibleTo?: string[];
  facing?: Direction; // For directional abilities
  actionEconomy: ActionEconomyState;
  spellbook?: SpellbookData;
  spellSlots?: SpellSlots;
  limitedUses?: LimitedUses;
  concentratingOn?: ConcentrationState;
  currentRitual?: RitualState;

  /**
   * List of feats the character possesses (e.g., "Slasher", "Sentinel").
   * Used for conditional logic in commands (e.g., Slasher slows on hit).
   */
  feats?: string[];
  featChoices?: Record<string, FeatChoice>;

  /** Elemental states (Wet, Frozen, etc.) affecting the character */
  stateTags?: StateTag[];

  // Summoning fields
  isSummon?: boolean;
  summonMetadata?: {
    casterId: string;
    spellId: string;
    entityType?: string;
    formName?: string;
    sourceName?: string;
    persistent?: boolean;
    dismissAction?: 'action' | 'bonus_action' | 'free' | 'none';
    commandCost?: 'action' | 'bonus_action' | 'free' | 'none';
    commandsPerTurn?: number;
    commandsUsedThisTurn?: number;
    initiativePolicy?: 'immediate' | 'rolled' | 'shared';
    followDistance?: number;
    hoverHeight?: number;
    carriedWeightPounds?: number;
    telepathyRange?: number;
    sharedSenses?: boolean;
    sharedSensesCost?: 'action' | 'bonus_action' | 'free' | 'none';
    travelDetails?: Record<string, unknown>;
    conditionalEndings?: ConditionalEnding[];
    lifecycle?: {
      hitPointMaximum?: string;
      repairOnly?: string;
      zeroHpEnding?: string;
      recastEnding?: string;
      spellEnding?: string;
    };
    control?: {
      entityType?: string;
      source?: string;
      allegiance?: string;
      obedience?: string;
      initiative?: string;
      restrictions?: string[];
      destruction?: string;
      bargainingRequired?: boolean;
      noCompulsion?: boolean;
      serviceLimit?: string;
      return?: string;
      bondLimit?: string;
      noCommandBehavior?: string;
    };
    actionPermissions?: {
      canAttack?: boolean;
      canDeliverTouchSpells?: boolean;
      touchDeliveryRangeFeet?: number;
      touchDeliveryCost?: 'reaction' | 'action' | 'bonus_action' | 'free' | 'none';
      independentInitiative?: boolean;
      obeysCasterCommands?: boolean;
      notes?: string;
    };
    formTraits?: Array<{
        name: string;
        appliesToForms?: string[];
        opportunityAttackPolicy?: 'does_not_provoke_when_flying_out_of_reach' | 'normal';
        movementModeRequired?: 'fly' | 'walk' | 'swim' | 'climb' | 'any';
        notes?: string;
      }>;
      aftermathState?: Record<string, unknown>;
      durationRemaining?: number;
      dismissable?: boolean;
    };

  // Defensive tracking (for DefensiveCommand)
  armorClass?: number;      // Current AC (including bonuses)
  baseAC?: number;          // Base AC before temporary bonuses
  resistances?: DamageType[];
  vulnerabilities?: DamageType[]; // Added for full 5e mechanics support
  immunities?: DamageType[];
  /** Damage types resisted only against nonmagical attacks (e.g. lycanthropes). */
  nonMagicalResistances?: string[];
  /** Damage types that grant immunity only against nonmagical attacks. */
  nonMagicalImmunities?: string[];
  conditionImmunities?: ConditionName[];
  tempHP?: number;          // Temporary hit points
  /** Spell or feature that supplied the current temporary hit points. */
  temporaryHitPointSource?: {
    spellId: string;
    spellName: string;
    casterId: string;
  };
  /**
   * Combat-facing armor material shortcut for spells that care about metal.
   *
   * Shocking Grasp is the pilot: the broader item system does not yet expose a
   * canonical material taxonomy for every equipped item, so combat can carry
   * this derived flag without forcing an inventory-wide migration first.
   */
  hasMetalArmor?: boolean;
  activeEffects?: ActiveEffect[];  // Active spell effects
  riders?: ActiveRider[];   // Active damage riders (smites, hex, etc)
  damagedThisTurn?: boolean; // Track if character took damage this turn (for concentration/repeat saves)
  weaponProficiencies?: string[];
  armorProficiencies?: string[];
  modifiers?: {
    advantage: string[];
    disadvantage: string[];
    bonuses: string[];
    baseArmorClass?: number;
    acBonus?: number;
    reachBonus?: number;
    powerfulBuild?: boolean;
    unendingBreath?: boolean;
    languages?: string[];
    skillProficiencies?: string[];
    weaponProficiencies?: string[];
    armorProficiencies?: string[];
    initiativeBonus?: number;
    initiativeProficiency?: boolean;
    ignoreDifficultTerrain?: boolean;
    breathWeapon?: RacialBreathWeapon;
    savageAttacks?: boolean;
    reactions?: RacialReaction[];
  };
  /** Tracks which feat effects have been used this turn (e.g., 'slasher_slow' for once-per-turn limit) */
  featUsageThisTurn?: string[];
  initiativeBonus?: number;
  initiativeProficiency?: boolean;
  ignoreDifficultTerrain?: boolean;
  // Optional bookkeeping for analytics/logs; these were used in factories/tests.
  damageDealt?: unknown[];
  healingDone?: unknown[];
  // Some mocks still pass extra save proficiencies; keep optional until model is unified.
  additionalSavingThrowProficiencies?: AbilityScoreName[];
}

export type AbilityType = 'attack' | 'spell' | 'skill' | 'movement' | 'utility';
export type TargetingType = 'single_enemy' | 'single_ally' | 'single_any' | 'area' | 'self' | 'all_enemies' | 'all_allies';
export type ActionCostType = 'action' | 'bonus' | 'reaction' | 'legendary' | 'lair' | 'free' | 'movement-only';

export interface AbilityCost {
  type: ActionCostType;
  movementCost?: number;
  spellSlotLevel?: number;
  quantity?: number;
  castSource?: {
    type: 'racial';
    spellId: string;
    allowSlotFallback?: boolean;
  };
  limitations?: {
    oncePerTurn?: boolean;
    oncePerRound?: boolean;
    requiresOtherAction?: ActionCostType;
  };
}

export interface AreaOfEffect {
  shape: 'circle' | 'cone' | 'line' | 'square';
  size: number; // radius for circle, length for line/cone, side for square
  angle?: number; // for cone abilities
  followsCaster?: boolean;
}

export interface AbilityEffect {
  type: 'damage' | 'heal' | 'status' | 'movement' | 'teleport' | 'familiar_pocket' | 'familiar_shared_senses' | 'commanded_summon' | 'granted_action' | 'summon_dismiss' | 'summon_return_home';
  value?: number;
  dice?: string; // Dice formula (e.g. "1d8+2") to be rolled at execution time
  damageType?: 'physical' | 'bludgeoning' | 'piercing' | 'slashing' | 'magical' | 'fire' | 'ice' | 'lightning' | 'acid' | 'poison' | 'necrotic' | 'radiant' | 'force' | 'psychic' | 'thunder';
  statusEffect?: StatusEffect;
  duration?: number;
  familiarPocketAction?: 'dismiss' | 'recall';
  familiarId?: string;
  sharedSensesAction?: 'activate';
  commandedSummonAction?: 'issue_command';
  summonCommandDescription?: string;
  summonId?: string;
  summonDismissAction?: 'dismiss';
  summonReturnHomeAction?: 'no_agreement' | 'service_complete';
  grantedActionLabel?: string;
  grantedActionCost?: 'action' | 'bonus_action' | 'reaction';
  grantedActionFrequency?: 'once' | 'each_turn' | 'while_active';
  grantedActionRangeLimit?: number;
  grantedActionPrerequisites?: ('target_object_within_spell_range' | 'target_within_spell_range' | 'not_applicable')[];
  grantedActionAttackType?: 'ranged_spell_attack' | 'melee_spell_attack' | 'not_applicable';
  grantedActionAreaShape?: 'Cone' | 'Line' | 'Sphere' | 'Cube' | 'Cylinder' | 'not_applicable';
  grantedActionAreaSize?: number | 'not_applicable';
  grantedActionAreaSizeUnit?: 'feet' | 'miles' | 'not_applicable';
  grantedActionDamageDice?: string;
  grantedActionDamageType?: 'physical' | 'bludgeoning' | 'piercing' | 'slashing' | 'magical' | 'fire' | 'ice' | 'lightning' | 'acid' | 'poison' | 'necrotic' | 'radiant' | 'force' | 'psychic' | 'thunder';
  grantedActionSaveType?: 'Strength' | 'Dexterity' | 'Constitution' | 'Intelligence' | 'Wisdom' | 'Charisma';
  grantedActionSaveEffect?: 'none' | 'half' | 'negates_condition';
  grantedActionDamageAbilityModifier?: 'spellcasting_ability' | 'not_applicable';
  grantedActionWallLengthReduction?: number;
  grantedActionEndsWhenLengthZero?: boolean;
  grantedActionNotes?: string;
}

export interface AbilityGrantedAction {
  type: 'action' | 'bonus_action' | 'reaction';
  action: string;
  frequency: 'once' | 'each_turn' | 'while_active';
  actor?: 'caster' | 'target' | 'summoned_entity' | 'affected_creature';
  actionKind?: 'magic_action' | 'standard_action' | 'bonus_action' | 'reaction' | 'not_applicable';
  areaShape?: 'Cone' | 'Line' | 'Sphere' | 'Cube' | 'Cylinder' | 'not_applicable';
  areaSize?: number | 'not_applicable';
  areaSizeUnit?: 'feet' | 'miles' | 'not_applicable';
  effectIndices?: number[];
  prerequisites?: ('target_object_within_spell_range' | 'target_within_spell_range' | 'not_applicable')[];
  rangeLimit?: number;
  attackType?: 'ranged_spell_attack' | 'melee_spell_attack' | 'not_applicable';
  saveType?: 'Strength' | 'Dexterity' | 'Constitution' | 'Intelligence' | 'Wisdom' | 'Charisma';
  saveEffect?: 'none' | 'half' | 'negates_condition';
  damageDice?: string;
  damageType?: 'physical' | 'bludgeoning' | 'piercing' | 'slashing' | 'magical' | 'fire' | 'ice' | 'lightning' | 'acid' | 'poison' | 'necrotic' | 'radiant' | 'force' | 'psychic' | 'thunder';
  damage?: {
    dice: string;
    type: string;
  };
  damageAbilityModifier?: 'spellcasting_ability' | 'not_applicable';
  wallLengthReduction?: number;
  endsWhenLengthZero?: boolean;
  notes?: string;
}

export interface RacialReaction {
  id: string;
  name: string;
  description: string;
  trigger?: {
    type: string;
  };
  effect?: SpellEffect;
}

export interface Ability {
  id: string;
  name: string;
  description: string;
  type: AbilityType;
  cost: AbilityCost;
  alternativeCosts?: AbilityCost[];
  prerequisites?: {
    position?: 'adjacent' | 'range';
    otherAbilityUsed?: string;
    minimumMovement?: number;
  };
  movementType?: 'before' | 'after' | 'integrated';
  interruptsMovement?: boolean;
  tags?: string[];
  /** Original spell id that created this runtime ability, when different from the button id. */
  sourceSpellId?: string;
  targeting: TargetingType;
  range: number;
  /**
   * AoE metadata flattened onto the ability for quick inspection by AI/preview UIs.
   * areaShape/areaSize mirror AreaOfEffect but remain optional so single-target
   * abilities do not need to specify them. When present they should always align
   * with D&D 5e templates (5 ft grid squares). size is expressed in tiles.
   */
  areaShape?: 'circle' | 'cone' | 'line' | 'square';
  areaSize?: number;
  areaOfEffect?: AreaOfEffect;
  effects: AbilityEffect[];
  /**
   * Actions a spell grants after the initial cast, such as using an illusion,
   * repeating a spell beam, or commanding an ongoing effect. The raw spell JSON
   * already carries this data on effects; keeping a copy on the combat ability
   * gives UI/action surfaces a direct place to read it without reparsing the
   * original spell every time the player opens their buttons.
   */
  grantedActions?: AbilityGrantedAction[];
  cooldown?: number;
  currentCooldown?: number;
  saveDC?: number;
  saveAbility?: AbilityScoreName;
  /**
   * Explicit attack bonus extracted from 5eTools `{@hit N}` markup (e.g. +14 for an Adult Red Dragon Rend).
   * When present, `AbilityCommandFactory` uses this instead of recomputing from STR/DEX + proficiency.
   * Ensures that monsters with atypical attack bonuses (finesse, multi-stat, racial bonuses) roll correctly.
   */
  attackBonus?: number;
  /**
   * Explicitly marks an attack-roll button as a weapon, spell, or unarmed
   * attack for shared rider matching. Most old attack buttons omit this and
   * keep the historical weapon default, but spell-attack buttons need this so
   * next-weapon-attack riders such as Lightning Arrow do not wake up from a
   * ranged spell attack.
   */
  attackType?: 'weapon' | 'spell' | 'unarmed';
  recharge?: {
    /** Recharge threshold (e.g. 5 = must roll 5+ to recharge) */
    threshold: number;
    /** Description shown in UI (e.g. "Recharge 5-6") */
    description: string;
  };
  /** When true, the ability is in d6-recharge mode instead of standard countdown */
  isRecharging?: boolean;
  /** Maximum number of uses (e.g. 3 for 3/Day) */
  maxUses?: number;
  /** Current remaining uses */
  usesRemaining?: number;
  /**
   * Round when a spell-created object button expires in combat time.
   * Long-duration objects such as Goodberries can also carry readable duration
   * metadata below until the broader party-inventory/world-clock layer owns
   * hour and day cleanup.
   */
  createdObjectExpiresAtRound?: number;
  createdObjectDuration?: {
    type: 'rounds' | 'minutes' | 'hours' | 'days' | 'special';
    value?: number;
  };
  icon?: string;
  spell?: any; // Reference to the original spell data for AI arbitration
  weapon?: Item; // Reference to the source weapon for proficiency checks
  isProficient?: boolean; // Whether caster is proficient with this ability/weapon
  mastery?: string; // Active weapon mastery property (e.g., 'Topple', 'Sap') if unlocked and proficient
  /** True when the ability is magical (spell attack, innate magic, etc.).
   *  Used by ResistanceCalculator to bypass "resistance to nonmagical attacks". */
  isMagical?: boolean;
  /**
   * Number of sub-attacks this Multiattack resolves into (e.g. 3 for "makes three Rend attacks").
   * Present only on abilities whose name is "Multiattack".
   * The ability's `effects[]` are pre-multiplied to represent the full N-hit damage for AI scoring.
   */
  multiattackCount?: number;
  /**
   * IDs of the sub-attack abilities that Multiattack resolves into.
   * Used by the execution engine to chain individual attack rolls instead of a lump hit.
   */
  subAttackIds?: string[];
  /**
   * Creature types this ability can target (e.g. `["Humanoid"]` for Hold Person).
   * Empty/absent means no type restriction. Used by AI target filtering and validator.
   */
  validCreatureTypes?: string[];
}

export interface TurnState {
  currentTurn: number;
  turnOrder: string[]; // character IDs in initiative order
  currentCharacterId: string | null;
  phase: 'planning' | 'action' | 'resolution' | 'end_turn';
  actionsThisTurn: CombatAction[];
}

/**
 * Represents the state of a character concentrating on a spell.
 * Tracks which spell is active, when it started, and related effects.
 */
export interface ConcentrationState {
  spellId: string;
  spellName: string;
  spellLevel: number; // The slot level used to cast the spell (important for dispelling/countering)
  startedTurn: number; // The combat turn index when concentration began
  effectIds: string[]; // IDs of any active temporary effects (buffs/debuffs) tied to this concentration
  canDropAsFreeAction: boolean; // Whether the player can voluntarily end this (standard D&D rule: yes)
  sustainCost?: {
    actionType: "action" | "bonus_action" | "reaction";
    optional: boolean;
  };
  sustainedThisTurn?: boolean;
}

// ============================================================================
// Combat Action Target Envelope
// ============================================================================
// Combat actions historically carried only creature IDs and one map position.
// Spell targeting now needs to preserve whether the chosen thing was a creature,
// a map object, or a ground point, so this envelope travels beside the legacy
// fields without replacing them.
// ============================================================================

/** Runtime object details preserved when a spell targets an object instead of a creature. */
export interface SelectedSpellObjectTarget {
  id: string;
  name?: string;
  position: Position;
  size?: string;
  weightPounds?: number;
  isWornOrCarried?: boolean;
  isMagical?: boolean;
  isFixedToSurface?: boolean;
  isCoveredByOpaqueMaterial?: boolean;
  /** Optional damage facts preserved for Mending-style repair spells. */
  damageState?: SelectedSpellObjectDamageState;
}

/**
 * Optional damage facts preserved alongside a targetable object.
 *
 * The combat runtime does not yet track object HP, so this keeps the
 * break-or-tear size and magic-item hints available without inventing a fake
 * durability pool.
 */
export interface SelectedSpellObjectDamageState {
  kind: 'break_or_tear' | 'broken' | 'torn' | string;
  breakOrTearDimensionFeet?: number;
}

/**
 * Positioned object candidate stored by the live battle map.
 * It deliberately matches the selected spell object envelope so map state,
 * target selection, and command context can pass the same object facts forward.
 */
export interface TargetableMapObject extends SelectedSpellObjectTarget {}

/** First-class selected spell target reference used by combat action handoff. */
export type SelectedSpellTarget =
  | { kind: 'creature'; id: string }
  | { kind: 'object'; id: string; position: Position; name?: string; object?: SelectedSpellObjectTarget }
  | { kind: 'point'; position: Position; purpose?: 'ground_target' | 'area_origin' | 'teleport_destination' | string };

export interface CombatAction {
  id: string;
  characterId: string;
  type: 'move' | 'ability' | 'end_turn' | 'sustain' | 'break_free';
  abilityId?: string;
  targetEffectId?: string; // ID of the status effect to break free from
  targetPosition?: Position;
  /**
   * Full tile-by-tile route used for movement-sensitive spell zones.
   * The final position remains targetPosition; this path preserves the walked
   * squares so effects such as Spike Growth can count travel through an area
   * even when the move starts and ends outside that area.
   */
  movementPath?: Position[];
  /**
   * Optional movement mode used for this movement action.
   * Most current movement actions still omit this and behave as ordinary map
   * movement, but spell-created actors with form-specific traits can set it so
   * shared reaction rules know whether the creature walked, flew, swam, or
   * climbed out of reach.
   */
  movementMode?: 'fly' | 'walk' | 'swim' | 'climb' | 'any';
  targetCharacterIds?: string[];
  /** Rich spell target refs for creature, object, and point selections. */
  selectedSpellTargets?: SelectedSpellTarget[];
  /**
   * Spend and record this action, but skip ability-triggered reactive effects
   * until command-side attack rolls have produced explicit hit/miss facts.
   */
  suppressAbilityEvents?: boolean;
  /**
   * Post-command replay used only to feed resolved attackResults into reactive
   * effects. This does not represent a second normal action.
   */
  reactiveEventsOnly?: boolean;
  /**
   * Optional per-target attack results for reactive effects that only fire on
   * confirmed hits. Older callers may omit this while attack resolution is
   * still being unified; callers that know a target was missed can pass that
   * result so Armor of Agathys-style retaliation stays silent.
   */
  attackResults?: Array<{
    targetId: string;
    isHit: boolean;
    isCritical?: boolean;
    /** Whether the resolved attack was a weapon, spell, or Unarmed Strike. */
    attackType?: 'weapon' | 'spell' | 'unarmed' | 'any';
    /** Whether the resolved attack was melee, ranged, or unarmed. */
    weaponType?: 'melee' | 'ranged' | 'unarmed' | 'any';
    rollResult?: number;
    total?: number;
  }>;
  movementUsed?: number;
  cost: AbilityCost;
  timestamp: number;
}


export interface ReactiveTrigger {
  id: string;
  sourceEffect: SpellEffect;
  sourceSpellId?: string;
  sourceSpellName?: string;
  casterId: string;
  targetId?: string;
  createdTurn: number;
  expiresAtRound?: number;
}

export interface ActiveRider {
  id: string;
  spellId: string;
  casterId: string;
  sourceName: string;
  targetId?: string;
  effect: SpellEffect; // Changed to SpellEffect to be more generic, though usually DamageEffect
  consumption: "unlimited" | "first_hit" | "per_turn" | "per_instance_hit_or_miss";
  attackFilter: {
    weaponType?: "melee" | "ranged" | "any";
    attackType?: "weapon" | "spell" | "any";
  };
  usedThisTurn: boolean;
  duration: {
    type: "rounds" | "minutes" | "special";
    value?: number;
  };
}

/**
 * Save penalty rider applied to a target from effects like Mind Sliver.
 * Stored on the target character (not caster) since it modifies their saves.
 */
export interface SavePenaltyRider {
  id: string;
  spellId: string;
  casterId: string;
  sourceName: string;
  dice?: string;         // e.g. "1d4" - rolled and subtracted from save
  flat?: number;         // e.g. -2 - flat penalty
  applies: "next_save" | "all_saves";
  duration: {
    type: "rounds" | "minutes" | "special";
    value?: number;
  };
  appliedTurn: number;
}

/**
 * Represents an active light source on the map, created by spells or items.
 * Light sources can be attached to characters or fixed at a point.
 */
export interface LightSource {
  id: string;
  sourceSpellId: string;       // ID of the spell that created this light
  casterId: string;            // Character ID of the caster
  brightRadius: number;        // Radius of bright light in feet
  dimRadius: number;           // Additional radius of dim light in feet
  attachedTo: "caster" | "target" | "point";
  attachedToCharacterId?: string;  // If attached to caster or target
  position?: Position;         // Fixed position if attachedTo is "point"
  color?: string;              // Optional color tint
  opaqueCoverBlocks?: boolean; // Tracks object-mounted sources that should stop emitting when covered.
  createdTurn: number;         // Turn when this was created
  expiresAtRound?: number;     // Optional expiration (for concentration tracking)
  /**
   * Optional clustered-light metadata for spells whose "light source" is a
   * movable created artifact rather than a single torch-like glow.
   */
  clusterId?: string;
  clusterIndex?: number;
  clusterSize?: number;
  presentation?: "single" | "cluster_member" | "combined_humanoid";
  hover?: boolean;
  maxMoveDistanceFeet?: number;
  leashDistanceFeet?: number;
  vanishesBeyondRangeFeet?: number;
  originPosition?: Position;
  movementCost?: "action" | "bonus_action" | "reaction" | "free" | string;
}

/**
 * Structured record for spell effects that hit map objects rather than
 * creatures.
 *
 * Object targeting already preserves selected map-object refs, but combat
 * state does not yet maintain object HP like creature HP. This impact trail
 * keeps object damage, source spell, caster, position, and timing together so
 * UI and future durability systems can consume real execution evidence instead
 * of scraping combat-log prose.
 */
export interface SpellObjectImpact {
  id: string;
  objectId: string;
  objectName?: string;
  position: Position;
  sourceSpellId: string;
  sourceSpellName?: string;
  casterId: string;
  damage?: {
    dice: string;
    type: string;
  };
  createdTurn: number;
  expiresAtRound?: number;
}

/**
 * Structured record for spells that repair object damage.
 *
 * This is the repair-side counterpart to SpellObjectImpact. It keeps the
 * object's selected metadata, the repair contract, and the validation outcome
 * together so future object-state systems can inspect the same event without
 * scraping combat text.
 */
export interface SpellObjectRepair {
  id: string;
  objectId: string;
  objectName?: string;
  position: Position;
  sourceSpellId: string;
  sourceSpellName?: string;
  casterId: string;
  createdTurn: number;
  outcome: 'repaired' | 'no_damage' | 'too_large' | 'missing_target';
  repairState: {
    targetKind: 'object' | string;
    repairLimit: 'single_break_or_tear' | string;
    maxDamageDimensionFeet: number;
    leavesNoTrace: boolean;
    canPhysicallyRepairMagicItem: boolean;
    restoresMagicToMagicItem: boolean;
  };
  damageState?: SelectedSpellObjectDamageState;
  objectWasMagical?: boolean;
}

/**
 * Structured record for spells that change whether a map object can be opened,
 * locked, unbarred, unstuck, or temporarily bypassed.
 *
 * Access changes are intentionally separate from object damage/repair records:
 * Knock and Arcane Lock alter door/container state and player readability even
 * when the object has no HP or break/tear damage for the durability model.
 */
export interface SpellObjectAccessChange {
  id: string;
  objectId: string;
  objectName?: string;
  position: Position;
  sourceSpellId: string;
  sourceSpellName?: string;
  casterId: string;
  createdTurn: number;
  outcome: 'unlocked' | 'unstuck' | 'unbarred' | 'suppressed_magical_lock' | 'magically_locked' | 'access_changed';
  mundaneStateChanges?: string[];
  suppressesMagicalClosure?: string;
  suppressionDuration?: EffectDuration;
  targetOperableDuringSuppression?: boolean;
  soundEmission?: {
    audibleRadius: number;
    radiusUnit: string;
    source: string;
    trigger: string;
    description: string;
  };
  nonmagicalUnlockBlocked?: boolean;
  allowedOpeners?: string;
  optionalPassword?: boolean;
  passwordRangeFeet?: number;
  passwordUnlockDuration?: string;
  expiresWithSpell?: boolean;
  notes?: string;
}

/**
 * Private spell communication event produced by Message.
 *
 * Combat logs are visible narration, while Message's rules depend on exactly
 * who heard the whisper and who can hear the reply. This record keeps the
 * delivery facts structured until a richer messaging UI owns them.
 */
export interface SpellCommunicationExchange {
  id: string;
  sourceSpellId: string;
  sourceSpellName?: string;
  casterId: string;
  targetId?: string;
  deliveredText?: string;
  replyText?: string;
  privateRecipientIds: string[];
  replyRecipientIds: string[];
  createdTurn: number;
  outcome: 'delivered' | 'blocked' | 'missing_target';
  blockerReason?: string;
  throughBarrier?: boolean;
  familiarWithTarget?: boolean;
  knowsTargetBeyondBarrier?: boolean;
  authoredBlockers?: string[];
}

/**
 * Active illusion artifact created by Minor Illusion.
 *
 * Illusions are not ordinary harmless utility objects: each creature can
 * discern them independently, and image mode can be revealed by physical
 * interaction. This record keeps those reveal facts explicit while a broader
 * illusion UI and cleanup system are still future work.
 */
export interface ActiveIllusionEffect {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  mode: 'sound' | 'image' | string;
  position: Position;
  description: string;
  createdTurn: number;
  expiresAtRound?: number;
  revealRules?: IllusionMetadata['revealRules'];
  sensoryManifestation?: SensoryManifestation;
  physicalInteractionReveals: boolean;
  investigationReveal?: {
    actionCost?: string;
    ability?: string;
    skill?: string;
    dc?: string;
  };
  discernedState?: IllusionMetadata['discernedState'];
  discernedByCreatureIds: string[];
  faintToCreatureIds: string[];
  recastGroup: string;
  endsOnRecast: boolean;
}

/**
 * First-class fire artifacts created or started by spells.
 *
 * Create Bonfire and Fire Bolt both have fire behavior that is more specific
 * than ordinary damage: one creates a spell-duration hazard and the other can
 * ignite a qualifying object. This record keeps that evidence structured while
 * object HP, fuel consumption, and full environment spread remain future work.
 */
export interface ActiveFireEffect {
  id: string;
  spellId: string;
  sourceName?: string;
  casterId: string;
  position: Position;
  createdTurn: number;
  expiresAtRound?: number;
  kind: 'hazard' | 'ignited_object';
  objectId?: string;
  objectName?: string;
  objectType?: string;
  damage?: {
    dice: string;
    type: string;
  };
  area?: {
    shape?: string;
    sizeFeet?: number;
  };
  ignitesTouchedObjects: boolean;
  excludesWornOrCarriedObjects: boolean;
  suppressedReason?: 'worn_or_carried' | 'not_flammable';
}

export interface SpellWeaponEnchantment {
  id: string;
  spellId: string;
  sourceName: string;
  casterId: string;
  itemId?: string;
  itemName?: string;
  createdTurn: number;
  expiresAtRound?: number;
  heldWeaponAugment: NonNullable<NonNullable<ActiveEffect['mechanics']>['heldWeaponAugment']>;
}

export type ShapeWaterMode = 'move_or_flow' | 'shape_and_animate' | 'color_or_opacity' | 'freeze';

export interface ActiveShapeWaterEffect {
  id: string;
  spellId: string;
  casterId: string;
  mode: ShapeWaterMode;
  position: Position;
  targetObjectId?: string;
  targetObjectName?: string;
  volumeCubicFeet: number;
  cubeSizeFeet: number;
  createdTurn: number;
  expiresAtRound?: number;
  instantaneous: boolean;
  noDamage: boolean;
  dismissed?: boolean;
}

export type ThaumaturgyMode =
  | 'altered_eyes'
  | 'booming_voice'
  | 'fire_play'
  | 'invisible_hand'
  | 'phantom_sound'
  | 'tremors';

export interface ActiveThaumaturgyEffect {
  id: string;
  spellId: string;
  casterId: string;
  mode: ThaumaturgyMode;
  position: Position;
  createdTurn: number;
  expiresAtRound?: number;
  instantaneous: boolean;
  harmless: boolean;
  sourceObjectType?: string;
  targetObjectId?: string;
  targetObjectName?: string;
  appearanceChange?: string;
  soundEmission?: string;
  fireStateChange?: string[];
  objectMotion?: string[];
  groundMotion?: string;
  abilityCheckModifier?: AbilityCheckModifier;
}

/**
 * Generic harmless utility artifact created by cantrip modes.
 *
 * Druidcraft and Elementalism have many small environmental outcomes that are
 * too concrete for a generic combat-log sentence but too harmless for damage,
 * terrain, or inventory systems. This record preserves the selected mode,
 * map position, object target, lifecycle, and data-authored created object so
 * UI and exploration systems can render them without spell-specific prose
 * parsing.
 */
export interface ActiveMinorUtilityEffect {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  mode: string;
  position?: Position;
  targetObjectId?: string;
  targetObjectName?: string;
  createdTurn: number;
  expiresAtRound?: number;
  instantaneous: boolean;
  harmless: boolean;
  createdObject: CreatedObject;
  sensorState?: Record<string, unknown>;
  aftermathState?: Record<string, unknown>;
}

// ============================================================================
// Controlled Utility Helper Records
// ============================================================================
// Mage Hand-style helpers are not creatures and should not enter turn order, but
// they still have map position, caster ownership, movement, object-use limits,
// recast replacement, and distance-based cleanup. This runtime record keeps
// those executable facts out of prose-only utility logs.
// ============================================================================

export interface ActiveSpellHelper {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  kind: 'mage_hand' | string;
  entityType: string;
  position: Position;
  size: string;
  creature: boolean;
  occupiesSpace: boolean;
  active: boolean;
  createdTurn: number;
  expiresAtRound?: number;
  control?: {
    actionType: string;
    initialUseOnCast?: boolean;
    laterControlTiming?: string;
    movementDistanceFeet?: number;
  };
  restrictions?: {
    canAttack?: boolean;
    canActivateMagicItems?: boolean;
    carryCapacityPounds?: number | 'not_applicable';
    allowedInteractions?: string[];
  };
  separationEnding?: {
    trigger: 'beyond_max_distance' | string;
    scope: 'spell' | string;
    maxDistanceFeet: number;
  };
  recastEnding?: {
    trigger: 'end_on_recast' | string;
    scope: 'spell' | string;
  };
}

export interface ActiveSpellForce {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  kind: 'spiritual_weapon' | string;
  entityType: string;
  position: Position;
  size?: string;
  reachFeet: number;
  moveDistanceFeet: number;
  moveAction: string;
  repeatAttack: string;
  damage: string;
  occupiesSpace: boolean;
  active: boolean;
  createdTurn: number;
  expiresAtRound?: number;
  placement?: {
    requiresUnoccupiedSpace?: boolean;
    lineOfSightRequired?: boolean;
    rangeAnchor?: string;
  };
  durability?: {
    armorClass?: number;
    maxHitPoints?: number;
    currentHitPoints?: number;
    endsSpellAtZeroHitPoints?: boolean;
  };
  abilityScores?: {
    strength?: number;
    dexterity?: number;
  };
  commandModes?: string[];
  forcedMovement?: Record<string, unknown>;
  grantedAction?: {
    action: string;
    type: string;
    frequency?: string;
    rangeLimit?: number;
    attackType?: string;
    damageDice?: string;
    damageType?: string;
    damageAbilityModifier?: string;
  };
}

export interface ActiveSpellGuardian {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  kind: 'guardian_of_faith' | string;
  position: Position;
  size: string;
  occupiesSpace: boolean;
  invulnerable: boolean;
  threatRadiusFeet: number;
  active: boolean;
  createdTurn: number;
  expiresAtRound?: number;
  triggerPolicy: {
    targets: 'enemy_creatures' | string;
    onEnterFrequency?: string;
    onEnterTrigger?: boolean;
    turnStartTrigger?: boolean;
    saveAbility?: string;
    saveOutcome?: string;
    damageAmount: number;
    damageDice?: string;
    damageType: string;
  };
  damageCap: {
    maxTotalDamage: number;
    dealtDamage: number;
    vanishWhenReached: boolean;
  };
  watchdog?: {
    visibleTo?: string;
    intangible?: boolean;
    truesightFeet?: number;
    barkingAlarmRadiusFeet?: number;
    barkTrigger?: string;
    password?: string;
    passwordPreventsBark?: boolean;
  };
  movement?: {
    action?: string;
    maxDistanceFeet?: number;
  };
  separationEnding?: {
    trigger?: string;
    scope?: string;
    maxDistanceFeet?: number;
  };
  elementalSpirit?: {
    origin?: string;
    element?: string;
    damageType?: string;
    initialDamageDice?: string;
    repeatDamageDice?: string;
    intangible?: boolean;
    restrainedTargetId?: string;
  };
}

// ============================================================================
// Spell Emanation Runtime Records
// ============================================================================
// Conjure Minor Elementals and Conjure Woodland Beings stay centered on the
// caster and persist as shaped emanations rather than independent creatures.
// This record keeps the following aura, damage rider, terrain, and bonus-action
// facts available to combat cleanup and future map automation.
// ============================================================================

export interface ActiveSpellEmanation {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  kind: 'elemental_spirit_emanation' | 'nature_spirit_emanation' | string;
  entityType: string;
  radiusFeet: number;
  combatEntity: false;
  followsCaster: true;
  active: boolean;
  createdTurn: number;
  expiresAtRound?: number;
  damageRider?: {
    trigger: 'on_attack_hit' | string;
    dice: string;
    damageTypeChoices: string[];
    chosenDamageType?: string;
    slotScaling?: string;
  };
  terrain?: {
    terrainType: 'difficult' | string;
    appliesTo: string;
    followsCaster?: boolean;
    createsDifficultTerrain?: boolean;
  };
  damageAura?: {
    trigger: 'emanation_entry_or_turn_end' | string;
    dice: string;
    damageType: string;
    saveAbility: string;
    saveOutcome: 'half' | 'none' | string;
    oncePerTurn: boolean;
    slotScaling?: string;
  };
  grantedActions?: Array<{
    type: string;
    action: string;
    frequency?: string;
  }>;
}

// ============================================================================
// Communication Control Runtime Records
// ============================================================================
// Speak-style spells create temporary question, command, and terrain interfaces
// instead of combat actors. This record keeps those counters and limits visible
// to runtime cleanup without pretending the corpse or plants are summons.
// ============================================================================

export interface ActiveCommunicationControl {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  kind: 'speak_with_dead' | 'speak_with_plants' | string;
  entityType: string;
  active: boolean;
  createdTurn: number;
  expiresAtRound?: number;
  targetId?: string;
  targetName?: string;
  originPosition?: Position;
  corpseInterrogation?: {
    requiresMouth?: boolean;
    failsIfCreatureWasUndeadWhenItDied?: boolean;
    cooldownDays?: number;
    questionLimit: number;
    questionsRemaining: number;
    answerWindowMinutes?: number;
    corpseKnowsOnlyLifeKnowledge?: boolean;
    includesKnownLanguages?: boolean;
    cannotLearnNewInformation?: boolean;
    cannotComprehendPostDeathEvents?: boolean;
    cannotSpeculateAboutFuture?: boolean;
    answersMayBeBriefCrypticOrRepetitive?: boolean;
    noTruthCompulsionIfAntagonisticOrRecognizesEnemy?: boolean;
  };
  plantCommunication?: {
    radiusFeet?: number;
    areaShape?: string;
    plantsGainLimitedSentience?: boolean;
    plantsCanCommunicateWithCaster?: boolean;
    plantsCanFollowSimpleCommands?: boolean;
    canQuestionAboutPastDayEvents?: boolean;
    plantCreaturesShareLanguageWithCaster?: boolean;
    cannotUprootOrMove?: boolean;
    allowedMotion?: string;
    releasesEntangleRestrainedCreatures?: boolean;
    terrainConversion?: {
      canTurnPlantDifficultTerrainToOrdinary?: boolean;
      canTurnOrdinaryPlantTerrainToDifficult?: boolean;
      requiresPlantsPresent?: boolean;
      conversions?: string[];
    };
  };
}

// ============================================================================
// Environmental Control Runtime Records
// ============================================================================
// Wrath of Nature-style spells animate terrain features rather than creatures.
// This record keeps the area, tree, root/vine, loose-rock, and cleanup facts
// together so later automation can act on the controlled environment directly.
// ============================================================================

export interface ActiveEnvironmentalControl {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  kind: 'wrath_of_nature' | string;
  entityType: string;
  originPosition: Position;
  active: boolean;
  createdTurn: number;
  expiresAtRound?: number;
  area?: {
    shape?: string;
    sizeFeet?: number;
    lineOfSightRequired?: boolean;
  };
  terrain?: {
    difficultTerrainFor?: string;
  };
  treeAttacks?: {
    triggerTiming?: string;
    targetFilter?: string;
    radiusFeet?: number;
    saveAbility?: string;
    saveOutcome?: string;
    damageDice?: string;
    damageType?: string;
  };
  rootsAndVines?: {
    triggerTiming?: string;
    targetFilter?: string;
    saveAbility?: string;
    saveOutcome?: string;
    condition?: string;
    escapeSkill?: string;
  };
  looseRocks?: {
    actionCost?: string;
    actionName?: string;
    target?: string;
    attackType?: string;
    damageDice?: string;
    damageType?: string;
    followupSaveAbility?: string;
    failedSaveCondition?: string;
  };
}

// ============================================================================
// Extradimensional Space Runtime Records
// ============================================================================
// Mansion-style spells create playable spaces behind a boundary instead of
// normal map tiles. This record keeps the entrance, allowed entrants, floor
// limit, and end-of-spell expulsion rule visible to runtime cleanup.
// ============================================================================

export interface ActiveExtradimensionalSpace {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  kind: 'magnificent_mansion' | string;
  entrancePosition: Position;
  entranceDimensions: {
    widthFeet: number;
    heightFeet: number;
  };
  doorState: 'open' | 'closed' | string;
  imperceptibleWhenClosed: boolean;
  designatedCreatureIds: string[];
  floorPlan: {
    maxCubes: number;
    cubeSizeFeet: number;
    contiguous: boolean;
  };
  expulsion: {
    trigger?: string;
    destinationPreference?: string;
    requiresUnoccupiedSpace?: boolean;
    appliesTo?: string[];
  };
  occupants?: {
    creatureIds: string[];
    objectIds: string[];
  };
  createdTurn: number;
  expiresAtRound?: number;
}

// ============================================================================
// Spell Structure Runtime Records
// ============================================================================
// Fortress-style spells create large, damageable structures that are not
// creatures. This record keeps their footprint, section durability, safe
// crumble behavior, and permanence cadence available to future map systems.
// ============================================================================

export interface ActiveSpellStructure {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  kind: 'mighty_fortress' | string;
  originPosition: Position;
  footprint: {
    shape: 'square' | string;
    sizeFeet: number;
    placementRequirement?: string;
  };
  harmlessRiseCreatureIds: string[];
  sectionDurability: {
    armorClass: number;
    hitPointsPerInch: number;
    sectionSizeFeet: {
      width: number;
      height: number;
    };
    damageImmunities: string[];
    collapseOnZeroHp: boolean;
  };
  lifecycle: {
    durationDays: number;
    crumblesSafely: boolean;
    permanenceRequiredSameLocationCasts: number;
    permanenceCadenceDays: number;
    sameLocationRequired: boolean;
    sameLocationCastCount: number;
  };
  sections?: Array<{
    id: string;
    currentHitPoints: number;
    maxHitPoints: number;
    destroyed: boolean;
    damageType?: string;
    collapseRisk?: string;
  }>;
  permanent?: boolean;
  createdTurn: number;
  expiresAtRound?: number;
}

// ============================================================================
// Spell Ward Runtime Records
// ============================================================================
// Long-lived area wards can contain several spell-specific sub-effects. These
// records keep the active ward, its bounds, and its cleanup rules visible to
// combat and exploration systems without pretending every ward is a creature.
// ============================================================================

export interface ActiveSpellWard {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  kind: 'druid_grove' | string;
  originPosition: Position;
  active: boolean;
  createdTurn: number;
  expiresAtRound?: number;
  area: {
    shape: string;
    minSizeFeet?: number;
    maxSizeFeet?: number;
    excludesBuildingsAndStructures?: boolean;
    radiatesMagic?: boolean;
  };
  guardianTrees?: {
    maxCount: number;
    guardianIds: string[];
    statBlock?: string;
    cannotSpeak?: boolean;
    barkMarked?: boolean;
    cannotLeaveWardedArea?: boolean;
    obeysSpokenCommandsInArea?: boolean;
    intruderResponse?: string;
    rerootsWhenSpellEndsIfPossible?: boolean;
  };
  ending?: {
    trigger: 'spell_ends' | string;
    dispelRemovesOneEffectOnly?: boolean;
    endsWhenAllEffectsRemoved?: boolean;
  };
  aftermathState?: {
    kind?: string;
    recovery?: string;
    [key: string]: unknown;
  };
}

// ============================================================================
// Animated Object Runtime Records
// ============================================================================
// Tiny Servant and Animate Objects turn map objects into temporary creatures,
// then restore the original object when the spell ends or the creature hits 0
// HP. This record keeps both sides of that identity together for later map,
// damage, and cleanup systems.
// ============================================================================

export interface ActiveAnimatedObject {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  sourceObjectId: string;
  sourceObjectName?: string;
  sourceObjectPosition?: Position;
  size: string;
  sizeCost: number;
  creatureType: string;
  allegiance: 'ally' | 'enemy' | 'neutral' | string;
  initiativePolicy: 'immediate' | 'rolled' | 'shared' | string;
  armorClass: number;
  maxHitPoints: number;
  currentHitPoints: number;
  speedFeet: number;
  command?: {
    action?: string;
    rangeFeet?: number;
    scope?: string;
    noCommandBehavior?: string;
  };
  immunities?: {
    damage?: string[];
    conditions?: string[];
  };
  slam?: {
    attackBonusSource?: string;
    damage?: string;
    slotScaling?: string;
  };
  lifecycle: {
    hitPointEnding?: string;
    reversion: string;
    damageCarryover?: string;
    revertedAtTurn?: number;
    reversionReason?: string;
    excessDamageCarriedOver?: number;
  };
  active: boolean;
  createdTurn: number;
  expiresAtRound?: number;
}

// ============================================================================
// Awakened Creature Runtime Records
// ============================================================================
// Awaken permanently changes a Beast, Plant creature, or natural plant, then
// leaves a 30-day social lifecycle behind. Keep those facts as combat state so
// later relationship, map, and stat-profile systems do not need to infer them
// from the utility log.
// ============================================================================

export interface ActiveAwakenedCreature {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  targetId: string;
  targetName?: string;
  creatureType: string;
  intelligenceScore: number;
  language?: string;
  statProfile?: string;
  naturalPlantBecameCreature: boolean;
  movementParts?: string[];
  humanlikeSenses?: boolean;
  createdTurn: number;
  charmedRelationship: {
    condition: 'Charmed' | string;
    durationDays: number;
    endsIfDamagedByCasterOrAllies: boolean;
    attitudeChosenAfterCharmEnds: boolean;
    attitude?: string;
    endReason?: string;
  };
}

export interface ActiveTruePolymorphTransformation {
  id: string;
  mode?: 'object_to_creature' | 'creature_to_creature' | 'creature_to_object';
  spellId: string;
  spellName?: string;
  casterId: string;
  sourceObjectId?: string;
  sourceObjectName?: string;
  sourceObjectPosition?: Position;
  sourceCreatureId?: string;
  sourceCreatureName?: string;
  sourceCreaturePosition?: Position;
  transformedCreatureId?: string;
  transformedFormName?: string;
  transformedObjectName?: string;
  temporaryHitPoints?: number;
  retainedStatistics?: string;
  actionAndSpeechLimits?: string;
  gearMeld?: string;
  noMemoryObjectForm?: string;
  controlledUntilFullDuration?: boolean;
  controlAfterOneHour?: string;
  permanence?: string;
  deathOrDestruction?: string;
  statReplacement?: string;
  transformationDuration?: string;
  createdTurn: number;
}

/**
 * Visible dirt-or-stone marking created by Mold Earth.
 *
 * This is intentionally Mold Earth-specific rather than a generic decoration
 * system: it preserves the rules-authored cosmetic manipulation as a durable
 * spell artifact while leaving broader map rendering and authored decals for a
 * later UI consumer.
 */
export interface ActiveMoldEarthSurfaceMark {
  id: string;
  spellId: 'mold-earth' | string;
  spellName?: string;
  casterId: string;
  position: Position;
  createdTurn: number;
  expiresAtRound?: number;
  manipulation: TerrainManipulation;
}

// Battle Map Types
export type BattleMapTerrain = 'grass' | 'rock' | 'water' | 'difficult' | 'wall' | 'floor' | 'sand' | 'mud';
export type BattleMapDecoration = 'tree' | 'boulder' | 'stalagmite' | 'pillar' | 'cactus' | 'mangrove' | 'fallen_log' | 'stump' | 'bush' | null;

export interface EnvironmentalEffect {
    id: string;
    type: 'fire' | 'ice' | 'poison' | 'difficult_terrain' | 'web' | 'fog' | 'hazard';
    duration: number;
    effect: StatusEffect;
    sourceSpellId?: string;
  casterId?: string;
}


export interface BattleMapTile {
  id: string; // "x-y"
  coordinates: { x: number; y: number };
  terrain: BattleMapTerrain;
  elevation: number;
  movementCost: number;
  blocksLoS: boolean;
  blocksMovement: boolean;
  decoration: BattleMapDecoration;
  effects: string[]; // IDs of active effects
  providesCover?: boolean;
  environmentalEffects?: EnvironmentalEffect[];
  material?: MaterialType;
  thicknessInches?: number;
}

/**
 * Every biome the battle-map generator can roll. ONE list — the generator,
 * the painter, the biome pill, and the dev override all derive from it.
 */
export const BATTLE_MAP_BIOMES = [
  'forest', 'cave', 'dungeon', 'desert', 'swamp',
  'snow', 'jungle', 'coast', 'ruins', 'volcanic',
] as const;
export type BattleMapBiome = (typeof BATTLE_MAP_BIOMES)[number];

export interface BattleMapData {
  dimensions: { width: number; height: number };
  tiles: Map<string, BattleMapTile>;
  /**
   * Explicit positioned objects that spells may target.
   * Visual decorations remain separate because they do not prove object weight,
   * magical status, worn/carried status, or fixed-to-surface rules.
   */
  targetableObjects?: TargetableMapObject[];
  theme: BattleMapBiome;
  seed: number;
}

export interface PocketedSummon {
  summon: CombatCharacter;
  casterId: string;
  spellId: string;
  dismissedTurn: number;
  lastKnownPosition: Position;
  reason: 'familiar_pocket' | 'manual_dismissal';
}

export interface CombatState {
  isActive: boolean;
  characters: CombatCharacter[];
  /**
   * Live spell zones carried through command execution so damage commands can
   * respect map-based resistance and immunity auras without flattening them
   * into character sheets too early.
   */
  spellZones?: Array<{
    id: string;
    spellId: string;
    casterId: string;
    position: Position;
    areaOfEffect?: { shape: string; size: number };
    direction?: Position;
    remainingWallLength?: number;
    originalWallLength?: number;
    endsWhenLengthZero?: boolean;
    effects: SpellEffect[];
    targetingValidTargets?: TargetFilter[];
  }>;
  pocketedSummons?: PocketedSummon[];
  turnState: TurnState;
  selectedCharacterId: string | null;
  selectedAbilityId: string | null;
  actionMode: 'select' | 'move' | 'target_ability' | 'preview_aoe';
  validTargets: Position[];
  validMoves: Position[];
  aoePreview?: {
    center: Position;
    affectedTiles: Position[];
    ability: Ability;
  };
  combatLog: CombatLogEntry[];
  reactiveTriggers: ReactiveTrigger[];
  activeLightSources: LightSource[];    // Active light sources on the map
  /** Spell effects that resolved against map objects instead of creatures. */
  spellObjectImpacts?: SpellObjectImpact[];
  /** Spell effects that repaired map objects instead of damaging them. */
  spellObjectRepairs?: SpellObjectRepair[];
  /** Spell effects that changed object access, such as Knock or Arcane Lock. */
  spellObjectAccessChanges?: SpellObjectAccessChange[];
  /** Private communication exchanges created by spells such as Message. */
  spellCommunicationExchanges?: SpellCommunicationExchange[];
  /** Active illusion artifacts created by spells such as Minor Illusion. */
  activeIllusionEffects?: ActiveIllusionEffect[];
  /** Spell-created fire hazards and object ignition state. */
  activeFireEffects?: ActiveFireEffect[];
  /** Items created by spell commands that should be persisted to shared inventory. */
  spellCreatedInventoryItems?: Item[];
  /**
   * Hit-gated movement riders created during command execution.
   *
   * Booming Blade is the current pilot: the weapon attack command can only know
   * whether the delayed thunder rider exists after the melee hit is resolved.
   * The combat hook publishes these records into its live movement-debuff list
   * after the command executor returns.
   */
  movementDebuffs?: Array<{
    id: string;
    spellId: string;
    casterId: string;
    targetId: string;
    effects: SpellEffect[];
    expiresAtRound: number;
    hasTriggered: boolean;
    saveDC?: number;
  }>;
  /**
   * Temporary spell enchantments that belong to an item rather than only to the
   * original caster. Shillelagh uses this bridge so the empowered club or
   * quarterstaff can be handed to another wielder before the broader inventory
   * system owns spell-duration item modifiers directly.
   */
  temporaryWeaponEnchantments?: SpellWeaponEnchantment[];
  /**
   * First-class Shape Water results. These records let combat, exploration,
   * UI, and later cleanup code inspect deterministic water-state mutations
   * instead of relying on generic narration text.
   */
  activeShapeWaterEffects?: ActiveShapeWaterEffect[];
  /**
   * First-class Thaumaturgy results. These records preserve the selected minor
   * wonder, its point of origin, expiry, and mechanical riders such as Booming
   * Voice's Intimidation advantage without asking downstream systems to parse
   * generic combat-log text.
   */
  activeThaumaturgyEffects?: ActiveThaumaturgyEffect[];
  /**
   * First-class harmless utility cantrip outcomes such as Druidcraft omens,
   * Bloom, Elementalism breezes, smoke, mist, and crude elemental shapes.
   */
  activeMinorUtilityEffects?: ActiveMinorUtilityEffect[];
  /** Active non-creature utility helpers created by spells such as Mage Hand. */
  activeSpellHelpers?: ActiveSpellHelper[];
  /** Active spell-created force objects such as Spiritual Weapon. */
  activeSpellForces?: ActiveSpellForce[];
  /** Active stationary guardian manifestations such as Guardian of Faith. */
  activeSpellGuardians?: ActiveSpellGuardian[];
  /** Active caster-following emanations such as Conjure Minor Elementals. */
  activeSpellEmanations?: ActiveSpellEmanation[];
  /** Active communication/control interfaces such as Speak with Dead and Speak with Plants. */
  activeCommunicationControls?: ActiveCommunicationControl[];
  /** Active controlled environmental areas such as Wrath of Nature. */
  activeEnvironmentalControls?: ActiveEnvironmentalControl[];
  /** Active extradimensional spaces such as Mordenkainen's Magnificent Mansion. */
  activeExtradimensionalSpaces?: ActiveExtradimensionalSpace[];
  /** Active spell-created structures such as Mighty Fortress. */
  activeSpellStructures?: ActiveSpellStructure[];
  /** Active persistent area wards such as Druid Grove. */
  activeSpellWards?: ActiveSpellWard[];
  /** Active object-to-creature records created by spells such as Tiny Servant and Animate Objects. */
  activeAnimatedObjects?: ActiveAnimatedObject[];
  /** Active Awaken transformation and post-charm relationship records. */
  activeAwakenedCreatures?: ActiveAwakenedCreature[];
  /** Active True Polymorph object-to-creature transformations and control boundaries. */
  activeTruePolymorphTransformations?: ActiveTruePolymorphTransformation[];
  /** Visible Mold Earth words, images, or patterns on dirt or stone. */
  activeMoldEarthSurfaceMarks?: ActiveMoldEarthSurfaceMark[];
  mapData?: BattleMapData;
  currentPlane?: Plane; // NEW: The plane where combat is taking place
}

export interface MoveAnimationData {
  path?: Position[];
  teleport?: boolean;
}

export interface AttackAnimationData {
  targetId: string;
  weaponId?: string;
  isCrit?: boolean;
  isMiss?: boolean;
  damage?: number;
}

export interface SpellEffectAnimationData {
  spellId?: string;
  effectType?: string;
  color?: string;
  areaOfEffect?: AreaOfEffect;
  targetPositions?: Position[];
}

export interface DamageNumberAnimationData {
  value: number;
  type: 'physical' | 'magical' | 'heal' | 'miss';
  isCrit?: boolean;
}

export interface StatusEffectAnimationData {
  statusId: string;
  action: 'apply' | 'remove' | 'tick';
  icon?: string;
}

/**
 * Discriminated union of all possible animation data payloads.
 * Used to enforce strict typing on the `data` field of Animations.
 */
export type AnimationData =
  | MoveAnimationData
  | AttackAnimationData
  | SpellEffectAnimationData
  | DamageNumberAnimationData
  | StatusEffectAnimationData;

export interface Animation {
  id: string;
  type: 'move' | 'attack' | 'spell_effect' | 'damage_number' | 'status_effect';
  characterId?: string;
  startPosition?: Position;
  endPosition?: Position;
  duration: number;
  startTime: number;
  data?: AnimationData;
}

export interface DamageNumber {
  id: string;
  value: number;
  position: Position;
  type: 'damage' | 'heal' | 'miss' | 'save' | 'resist' | 'immune';
  startTime: number;
  duration: number;
}

export interface SpellMovementVisual {
  id: string;
  spellId: string;
  targetId: string;
  type: 'teleport' | 'forced_movement';
  from: Position;
  to: Position;
  path?: Position[];
  createdAt: number;
}

export interface SpellDeliveryVisual {
  id: string;
  spellId: string;
  spellName: string;
  casterId: string;
  /**
   * Shared controlled-entity actor that delivered a touch spell.
   * Find Familiar is the current live spell using this path, but the runtime
   * permission is now actor metadata, not a familiar-only exception.
   */
  deliveryActorId: string;
  /** Backward-compatible alias for older Find Familiar visual consumers. */
  familiarId?: string;
  targetId: string;
  from: Position;
  to: Position;
  label: string;
  createdAt: number;
}

export interface CombatLogData {
  damageAmount?: number;
  damageType?: string;
  healAmount?: number;
  heal?: number; // Legacy, kept for compatibility if needed
  statusEffectName?: string;
  abilityName?: string;
  rollResult?: number;
  // Religion/Trigger Extensions
  isDeath?: boolean;
  targetTags?: string[]; // e.g. ['Undead', 'Humanoid', 'Elf']
  spellSchool?: string;
  spellName?: string;
  source?: string; // Explicitly adding source to interface
  // Allow for flexibility while we transition from 'any'
  [key: string]: string | number | boolean | undefined | object;
}

export interface CombatLogEntry {
  id: string;
  timestamp: number;
  type: 'action' | 'damage' | 'heal' | 'status' | 'summon' | 'turn_start' | 'turn_end';
  message: string;
  characterId?: string;
  targetIds?: string[];
  data?: CombatLogData;
}

export interface CharacterPosition {
  characterId: string;
  coordinates: { x: number; y: number };
}
