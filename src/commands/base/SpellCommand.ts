import { CombatState, CombatCharacter } from '@/types/combat'
import { GameState } from '@/types'
import { EffectDuration, SpellAttackType } from '@/types/spells'

export interface SpellCommand {
  /**
   * Execute the command, applying its effects to the combat state
   * @returns New combat state with effects applied
   */
  execute(state: CombatState): CombatState

  /**
   * Optional: Undo the command (for turn rewind feature)
   * @returns Combat state before command was executed
   */
  undo?(state: CombatState): CombatState

  /**
   * Human-readable description for combat log
   */
  readonly description: string

  /**
   * Unique identifier for this command instance
   */
  readonly id: string

  /**
   * Command metadata for debugging/logging
   */
  readonly metadata: CommandMetadata
}

export interface CommandMetadata {
  spellId: string
  spellName: string
  casterId: string
  casterName: string
  targetIds: string[]
  effectType: string
  timestamp: number
}

export interface CommandContext {
  spellId: string
  spellName: string
  castAtLevel: number
  caster: CombatCharacter
  targets: CombatCharacter[]
  gameState: GameState
  effectDuration?: EffectDuration
  attackType?: SpellAttackType
  isCritical?: boolean // Tracks if this execution is a critical hit (5e: doubles damage dice)
}
