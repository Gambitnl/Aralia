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

import { CombatState, CombatCharacter } from '@/types/combat'
import { GameState } from '@/types'
import { EffectDuration, SpellAttackType, MagicSchool } from '@/types/spells'
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
  execute(state: CombatState): CombatState

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
  /** Snapshot of the caster at the moment of casting */
  caster: CombatCharacter
  /** Snapshot of the targets at the moment of targeting */
  targets: CombatCharacter[]
  /** Reference to global game state (for environmental checks, etc.) */
  gameState: GameState
  /** Duration of the effect (if applicable) */
  effectDuration?: EffectDuration
  /** Type of attack roll (melee/ranged) if applicable */
  attackType?: SpellAttackType
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
}
