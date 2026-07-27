/**
 * @file src/data/quests/index.ts
 * Defines quest templates and helpers to produce runtime quest instances.
 */
import { Quest, QuestTemplate } from '../../types';
/**
 * Quest templates are immutable blueprints. The reducer clones these into
 * fresh runtime instances to avoid cross-quest mutation.
 */
export declare const QUEST_TEMPLATES: Record<string, QuestTemplate>;
/**
 * Creates a quest instance from a template, stamping runtime fields that
 * should not live in the immutable template (dates, status, completion flags).
 */
export declare function instantiateQuest(template: QuestTemplate): Quest;
/**
 * Convenience helper used by action handlers to grab a fresh quest instance
 * without having to know about the template mechanics.
 */
export declare function getQuestById(questId: string): Quest | null;
/**
 * A ready-to-use map of starter quests. Each entry is a fresh instance so
 * reducers can safely store and mutate the runtime copy.
 */
export declare const INITIAL_QUESTS: Record<string, Quest>;
