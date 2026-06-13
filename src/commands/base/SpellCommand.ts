// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 12/06/2026, 23:08:42
 * Dependents: commands/base/BaseEffectCommand.ts, commands/base/CommandExecutor.ts, commands/effects/ConcentrationCommands.ts, commands/effects/DefensiveCommand.ts, commands/effects/EnhanceAbilityCommand.ts, commands/effects/FamiliarPocketCommands.ts, commands/effects/FamiliarSharedSensesCommand.ts, commands/effects/MovementCommand.ts, commands/effects/NarrativeCommand.ts, commands/effects/RegisterRiderCommand.ts, commands/effects/SummoningCommand.ts, commands/effects/TerrainCommand.ts, commands/effects/UtilityCommand.ts, commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts, commands/index.ts, utils/core/factories.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * ARCHITECTURAL CONTEXT:
 * This file defines the 'Game Command Pattern'. It is the foundation 
 * for the combat execution layer, allowing effects (damage, status, etc.) 
 * to be treated as discrete objects that can be queued, logged, or undone.
 *
 * Recent updates focus on 'Martial/Magical Distinction'. The addition 
 * of `weaponProperties` to the `CommandContext` allows commands to 
 * respect feat mechanics like 'Great Weapon Master' (GWM) or 'Heavy 
 * Armor Master' (HAM), which trigger specifically based on keywords like 
 * 'heavy' or 'non-magical weapon damage'.
 * 
 * @file src/commands/base/SpellCommand.ts
 */

import { CombatState, CombatCharacter, SelectedSpellTarget } from '@/types/combat'
import { GameState } from '@/types'
import { EffectDuration, SpellAttackType, MagicSchool, ConditionalEnding } from '@/types/spells'
import { Plane } from '@/types/planes'

/**
 * Interface for all executable spell commands.
 * Commands are responsible for applying specific game logic (damage, healing, status effects)
 * to the combat state.
 */
export interface SpellCommand {
  /**
   * Execute the command, applying its effects to the combat state.
   * This function must be pure regarding the state: it takes the current state
   * and returns a new modified state without mutating the original.
   *
   * @param state - The current state of combat.
   * @returns New combat state with effects applied.
   */
  execute(state: CombatState): CombatState | Promise<CombatState>

  /**
   * Optional: Undo the command (for turn rewind feature).
   * @returns Combat state before command was executed.
   */
  undo?(state: CombatState): CombatState

  /**
   * Human-readable description for combat log and debugging.
   * e.g. "Deals 2d6 fire damage"
   */
  readonly description: string

  /**
   * Unique identifier for this command instance.
   */
  readonly id: string

  /**
   * Structured metadata describing the command's context.
   * Useful for debugging, telemetry, or UI overlays.
   */
  readonly metadata: CommandMetadata
}

/**
 * Metadata stored on every command for tracking and logging purposes.
 */
export interface CommandMetadata {
  /** ID of the spell triggering this command */
  spellId: string
  /** Name of the spell */
  spellName: string
  /** ID of the character casting the spell */
  casterId: string
  /** Name of the caster */
  casterName: string
  /** IDs of all targets affected by this specific effect */
  targetIds: string[]
  /** The type of effect being applied (damage, heal, status, etc.) */
  effectType: string
  /** Time when the command was instantiated */
  timestamp: number
}

/**
 * Context payload provided to commands upon instantiation.
 * Contains all the "Snapshot" data needed to resolve the effect.
 */
export interface CommandContext {
  /** ID of the spell being cast */
  spellId: string
  /** Name of the spell being cast */
  spellName: string
  /** School of the spell (for planar modifiers etc.) */
  spellSchool?: MagicSchool
  /** The level at which the spell is cast (affects scaling) */
  castAtLevel: number
  /**
   * Snapshot of the caster at the moment of casting.
   * Runtime reads (HP, position, status, etc.) should read live values from the
   * `CombatState` passed into `execute()` instead of reusing this snapshot.
   */
  caster: CombatCharacter
  /**
   * Snapshot of the targets at the moment of targeting.
   * Command execution should resolve each target by `id` against current state.
   */
  targets: CombatCharacter[]
  /**
   * Rich target refs selected for this spell cast.
   * Creature commands keep using `targets`, while object-aware and point-aware
   * commands can inspect this envelope without pretending objects are creatures.
   */
  selectedSpellTargets?: SelectedSpellTarget[]
  /**
   * Optional player choice captured by the spell UI before command execution.
   * Mode-choice and Command-style spells use this to preserve the selected menu
   * label while still keeping every possible option available in spell data.
   */
  playerInput?: string
  /** Reference to global game state (for environmental checks, etc.) */
  gameState: GameState
  /** Duration of the effect (if applicable) */
  effectDuration?: EffectDuration
  /** Type of attack roll (melee/ranged) if applicable */
  attackType?: SpellAttackType
  /** Any conditional endings applied from the spell's effect metadata */
  conditionalEndings?: ConditionalEnding[]
  /** Tracks if this execution is a critical hit (5e: doubles damage dice) */
  isCritical?: boolean
  /** The plane where the spell is being cast. */
  currentPlane?: Plane
  /**
   * Properties of the source weapon (e.g., ['heavy', 'two-handed']).
   * Present only for weapon attacks — undefined for spells.
   * WHAT CHANGED: Added weaponProperties to CommandContext.
   * WHY IT CHANGED: To support 5e 'keyword-aware' feats. By passing weapon 
   * tags like 'heavy' down to the command level, damage calculators can 
   * check for the 'Great Weapon Master' perk and apply the correctly 
   * scaled bonus damage during command execution.
   */
  weaponProperties?: string[]
  /** Whether the ability is magical; used to bypass nonmagical-attack resistances. */
  isMagical?: boolean
  /** Request a manual reaction from the user via UI */
  requestReaction?: (attackerId: string, targetId: string, triggerType: 'on_hit' | 'on_take_damage', options: any[]) => Promise<string | null>
}
