/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 08:32:34
 * Dependents: utils/core/index.ts, utils/factories.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { Spell } from '@/types/spells';
import { GameState, PlayerCharacter, CombatCharacter, Item, GameMessage, Monster, CombatState, Faction } from '@/types/index';
import type { Quest, QuestDefinition } from '@/types/quests';
import { CommandContext } from '@/commands/base/SpellCommand';
/**
 * Creates a mock Spell object with sensible defaults.
 * @param overrides Partial<Spell> to override default values.
 * @returns A complete Spell object.
 */
export declare function createMockSpell(overrides?: Partial<Spell>): Spell;
/**
 * Creates a mock Faction object.
 */
export declare function createMockFaction(overrides?: Partial<Faction>): Faction;
/**
 * Creates a mock CommandContext object with sensible defaults.
 * @param overrides Partial<CommandContext> to override default values.
 * @returns A complete CommandContext object.
 */
export declare function createMockCommandContext(overrides?: Partial<CommandContext>): CommandContext;
/**
 * Creates a mock PlayerCharacter object with sensible defaults.
 */
export declare function createMockPlayerCharacter(overrides?: Partial<PlayerCharacter>): PlayerCharacter;
/**
 * Creates a mock GameState object with sensible defaults.
 * @param overrides Partial<GameState> to override default values.
 * @returns A complete GameState object.
 */
export declare function createMockGameState(overrides?: Partial<GameState>): GameState;
/**
 * Creates a mock CombatCharacter object with sensible defaults.
 */
export declare function createMockCombatCharacter(overrides?: Partial<CombatCharacter>): CombatCharacter;
/**
 * Creates a mock CombatState object with sensible defaults.
 * @param overrides Partial<CombatState> to override default values.
 * @returns A complete CombatState object.
 */
export declare function createMockCombatState(overrides?: Partial<CombatState>): CombatState;
/**
 * Creates a mock Item object.
 */
export declare function createMockItem(overrides?: Partial<Item>): Item;
/**
 * Creates a mock Quest object.
 */
export declare function createMockQuest(overrides?: Partial<QuestDefinition>): QuestDefinition;
/**
 * Creates a mock legacy Quest object for reducer-facing tests.
 *
 * `createMockQuest` returns the authoring-time `QuestDefinition` shape, but the
 * reducer, QuestManager, and data layer all consume the flattened legacy
 * `Quest` shape. This helper builds a `QuestDefinition` (via `createMockQuest`)
 * and runs it through the runtime adapter so tests can feed the result straight
 * into `questReducer`/`QuestManager` without a type cast (GQ-7).
 *
 * @param definitionOverrides Partial<QuestDefinition> applied before adaptation.
 * @param questOverrides Partial<Quest> applied to the adapted legacy shape.
 * @returns A complete legacy Quest object.
 */
export declare function createMockLegacyQuest(definitionOverrides?: Partial<QuestDefinition>, questOverrides?: Partial<Quest>): Quest;
/**
 * Creates a mock Monster object.
 */
export declare function createMockMonster(overrides?: Partial<Monster>): Monster;
/**
 * Creates a mock GameMessage object.
 */
export declare function createMockGameMessage(overrides?: Partial<GameMessage>): GameMessage;
