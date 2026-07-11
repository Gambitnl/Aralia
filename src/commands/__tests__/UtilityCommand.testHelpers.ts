/**
 * Shared fixtures and imports for the UtilityCommand spell-family test files.
 *
 * The original UtilityCommand.test.ts defined one caster, target, combat state,
 * and command context at the top of a single `describe('UtilityCommand')` block
 * and then exercised every spell family beneath it. That file was split into
 * sibling test files by spell family; this module holds the shared setup so each
 * sibling imports the same fixtures instead of redefining them.
 */
import { UtilityCommand } from '../effects/UtilityCommand'
import { GrantedActionCommand } from '../effects/GrantedActionCommand'
import { BreakConcentrationCommand, StartConcentrationCommand } from '../effects/ConcentrationCommands'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import type { CommandContext } from '../base/SpellCommand'
import type { CombatCharacter, CombatState } from '@/types/combat'

export const mockCaster: CombatCharacter = createMockCombatCharacter({
    id: 'caster-1',
    name: 'Wizard',
    position: { x: 5, y: 5 },
    stats: { ...createMockCombatCharacter().stats, speed: 30 },
})

export const mockTarget: CombatCharacter = createMockCombatCharacter({
    id: 'target-1',
    name: 'Goblin',
    position: { x: 7, y: 7 }, // 2 tiles away (approx 10-14ft)
    stats: { ...createMockCombatCharacter().stats, speed: 30 },
    statusEffects: [],
})

export const mockState: CombatState = createMockCombatState({
    characters: [mockCaster, mockTarget],
    turnState: { currentTurn: 1, turnOrder: [mockCaster.id, mockTarget.id], currentCharacterId: mockCaster.id, phase: 'action', actionsThisTurn: [] },
    combatLog: [],
    activeLightSources: [],
})

export const mockContext: CommandContext = {
    spellId: 'spell-1',
    spellName: 'Test Spell',
    castAtLevel: 1,
    caster: mockCaster,
    targets: [mockTarget],
    gameState: createMockGameState()
}

export { UtilityCommand, GrantedActionCommand, StartConcentrationCommand, BreakConcentrationCommand }
export { createMockCombatCharacter, createMockCombatState }
export type { Spell, SpellEffect, UtilityEffect } from '@/types/spells'
export type { CombatCharacter, CombatState, SelectedSpellTarget } from '@/types/combat'
export type { CommandContext } from '../base/SpellCommand'
