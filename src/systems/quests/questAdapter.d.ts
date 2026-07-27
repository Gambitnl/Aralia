/**
 * @file src/systems/quests/questAdapter.ts
 * Bridges rich quest authoring definitions into the legacy quest runtime shape.
 */
import type { Quest, QuestDefinition } from '@/types';
/**
 * Converts a QuestDefinition into the flat Quest shape that reducers and UI
 * still consume. This is the Phase 1 migration bridge: authors can model a
 * staged quest while runtime code keeps reading the currently active stage as a
 * legacy objective list.
 */
export declare const adaptQuestDefinitionToQuest: (definition: QuestDefinition) => Quest;
