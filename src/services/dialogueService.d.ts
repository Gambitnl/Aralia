/**
 * @file src/services/dialogueService.ts
 * Service for managing dialogue topics, checking prerequisites, and handling conversation flow.
 */
import { ConversationTopic, DialogueSession, TopicCost } from '../types/dialogue';
import { GameState, NPC } from '../types/index';
export declare function registerTopic(topic: ConversationTopic): void;
export declare function getTopic(topicId: string): ConversationTopic | undefined;
/**
 * Checks if a player meets the prerequisites for a specific topic with a given NPC.
 */
export declare function checkTopicPrerequisites(topic: ConversationTopic, gameState: GameState, npcId: string): boolean;
/**
 * Checks if the player can afford the costs associated with a topic.
 */
export declare function canAffordTopic(topic: ConversationTopic, gameState: GameState): boolean;
/**
 * Determines if an NPC knows about a topic and is willing to discuss it.
 * This logic enforces that even if a player unlocks a topic globally, a specific NPC
 * must also have the knowledge or it must be a global topic.
 */
export declare function canNPCDiscuss(topic: ConversationTopic, npc: NPC, _disposition: number): boolean;
/**
 * Upper bound on how many rumor-derived ("Hear anything about…?") topics a
 * single NPC will surface at once.
 *
 * The living-world chronicle can accumulate dozens of buyable rumors in a busy
 * town (every marriage / succession / disaster syncs one), and each becomes a
 * near-identical dynamic topic. Left uncapped, they bury the authored core
 * topics (Who are you?, Show me your wares., Heard any rumors?, I need
 * directions., Invite to party). We keep only the top few — ranked by
 * prominence (virality) then recency — so the Topics list stays readable while
 * the "Heard any rumors?" flow still fronts the town's freshest talk.
 */
export declare const MAX_DYNAMIC_RUMOR_TOPICS = 3;
/**
 * Generates dynamic topics based on active rumors in the game state.
 * NPCs will gossip about things relevant to their faction or location.
 */
export declare function getDynamicRumorTopics(gameState: GameState, npc: NPC): ConversationTopic[];
/**
 * Filters the list of all potential topics to find valid ones for the current context.
 */
export declare function getAvailableTopics(gameState: GameState, npcId: string, session: DialogueSession, npc?: NPC): ConversationTopic[];
export interface ProcessTopicResult {
    status: 'success' | 'failure' | 'neutral';
    responsePrompt: string;
    unlocks: string[];
    dispositionChange?: number;
    xpReward?: number;
    lockTopic?: boolean;
    deductions?: TopicCost[];
}
/**
 * Handles the outcome of selecting a topic.
 * Performs skill checks if present.
 *
 * @param topicId The ID of the selected topic
 * @param gameState Current game state
 * @param session Active dialogue session
 * @param skillModifier (Optional) The player's bonus for the skill being checked (e.g. +5 for Persuasion)
 */
export declare function processTopicSelection(topicId: string, gameState: GameState, session: DialogueSession, skillModifier?: number, npc?: NPC): ProcessTopicResult;
