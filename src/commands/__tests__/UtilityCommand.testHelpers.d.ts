/**
 * Shared fixtures and imports for the UtilityCommand spell-family test files.
 *
 * The original UtilityCommand.test.ts defined one caster, target, combat state,
 * and command context at the top of a single `describe('UtilityCommand')` block
 * and then exercised every spell family beneath it. That file was split into
 * sibling test files by spell family; this module holds the shared setup so each
 * sibling imports the same fixtures instead of redefining them.
 */
import { UtilityCommand } from '../effects/UtilityCommand';
import { GrantedActionCommand } from '../effects/GrantedActionCommand';
import { BreakConcentrationCommand, StartConcentrationCommand } from '../effects/ConcentrationCommands';
import { createMockCombatCharacter, createMockCombatState } from '@/utils/core';
import type { CommandContext } from '../base/SpellCommand';
import type { CombatCharacter, CombatState } from '@/types/combat';
export declare const mockCaster: CombatCharacter;
export declare const mockTarget: CombatCharacter;
export declare const mockState: CombatState;
export declare const mockContext: CommandContext;
export { UtilityCommand, GrantedActionCommand, StartConcentrationCommand, BreakConcentrationCommand };
export { createMockCombatCharacter, createMockCombatState };
export type { Spell, SpellEffect, UtilityEffect } from '@/types/spells';
export type { CombatCharacter, CombatState, SelectedSpellTarget } from '@/types/combat';
export type { CommandContext } from '../base/SpellCommand';
