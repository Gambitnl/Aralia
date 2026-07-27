/**
 * Shared imports for the AbilityCommandFactory spell-family test files.
 *
 * The original AbilityCommandFactory.test.ts covered ability translation,
 * weapon-attack proficiency, active-effect riders, smite data contracts,
 * Lightning Arrow, Frostbite, Sneak Attack, reaction arbitration, and mode-choice
 * damage typing in a single file. It was split into sibling test files by spell
 * family; this module re-exports the shared factory, command classes, combat
 * factories, and types so each sibling imports them from one place.
 */
export { createMockCombatCharacter, createMockCombatState } from '../../../utils/factories';
export { AbilityCommandFactory, WeaponAttackCommand } from '../AbilityCommandFactory';
export { SpellCommandFactory } from '../SpellCommandFactory';
export { combatEvents } from '../../../systems/events/CombatEvents';
export { DismissFamiliarToPocketCommand, RecallFamiliarFromPocketCommand } from '../../effects/FamiliarPocketCommands';
export { CommandedSummonCommand } from '../../effects/CommandedSummonCommand';
export { RegisterRiderCommand } from '../../effects/RegisterRiderCommand';
export type { Ability, ActiveRider, CombatState } from '../../../types/combat';
export type { GameState } from '../../../types';
export type { Spell } from '../../../types/spells';
