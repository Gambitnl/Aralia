// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/09/2026, 09:05:07
 * Dependents: components/DesignPreview/steps/PreviewDialogue.tsx, components/Dialogue/DialogueConversationView.tsx, components/Dialogue/DialogueInterface.tsx, data/dialogue/topics.ts, services/dialogueService.ts, state/reducers/dialogueReducer.ts, types/index.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/types/dialogue.ts
 * Defines the types for the structured dialogue and conversation system.
 * This system allows for topic-based conversations, knowledge tracking, and social skill checks.
 */

import { Skill } from './core.js';

export type TopicCategory = 'rumor' | 'personal' | 'quest' | 'lore' | 'trade' | 'intimidate' | 'flirt';

export interface TopicPrerequisite {
  type: 'topic_known' | 'relationship' | 'quest_status' | 'item_owned' | 'faction_standing' | 'min_gold';
  /** The ID of the topic, quest, item, or faction needed. (Ignored for min_gold) */
  targetId?: string;
  /**
   * For relationships: minimum disposition value.
   * For quests: required status (e.g., 'Completed').
   * For items: quantity (default 1).
   * For faction standing: minimum rank/value.
   * For min_gold: amount of gold.
   */
  value?: string | number;
  /** If true, the condition is inverted (e.g., must NOT know topic) */
  negate?: boolean;
}

export interface TopicCost {
  type: 'gold' | 'item';
  /** The ID of the item to remove (ignored for gold) */
  targetId?: string;
  /** The amount of gold or number of items to remove */
  value: number;
}

export interface FailureResult {
  /** Text to display on failure */
  response: string;
  /** Disposition change on failure */
  dispositionChange?: number;
  /** If the topic becomes permanently locked for this interaction/forever */
  lockTopic?: boolean;
}

export interface SocialSkillCheck {
  skill: Skill;
  dc: number;
  /** IDs of topics unlocked on success */
  successUnlocks: string[];
  /** Consequence of failure */
  failureConsequence?: FailureResult;
  /** Experience awarded on success */
  xpReward?: number;
}

export interface ConversationTopic {
  id: string;
  /** Display name of the topic (e.g., "Ask about the ruins") */
  label: string;
  category: TopicCategory;
  /** Text prompt to send to the AI or display as player dialogue */
  playerPrompt: string;
  /** Requirements to see/select this topic */
  prerequisites?: TopicPrerequisite[];
  /** Costs to select this topic (e.g. bribes, trading items) */
  costs?: TopicCost[];
  /** IDs of topics this topic unlocks immediately when discussed */
  unlocksTopics?: string[];
  /** Optional skill check required to succeed in this topic */
  skillCheck?: SocialSkillCheck;
  /** If true, this topic is removed after being discussed once */
  isOneTime?: boolean;
  /** If true, this topic is available to all NPCs by default (e.g. "Who are you?") */
  isGlobal?: boolean;
}

/**
 * Tracks what an individual NPC knows and is willing to discuss.
 */
export interface NPCKnowledgeProfile {
  /** Map of TopicID -> Willingness/Specific Knowledge overrides */
  topicOverrides: Record<string, {
    known: boolean;
    willingnessModifier?: number; // Adjusts base disposition check
    customResponse?: string; // Static response override
  }>;
  /** Base openness of the NPC (0-100) */
  baseOpenness: number;
}

/**
 * Represents the state of a dialogue session.
 * Used by the dialogueReducer to track active conversations.
 */
export interface DialogueSession {
  npcId: string;
  /** Topics already discussed in this session */
  discussedTopicIds: string[];
}

/*
 * DIAL-003 (agora-f821.22): `availableTopicIds` and `sessionDispositionMod`
 * were removed rather than wired. Both were write-only: the reducer seeded them
 * at session start, `DialogueInterface` copied `availableTopicIds` forward
 * unchanged, and a grep across `src/` found no reader for either one. The live
 * behavior they looked like they controlled is already owned elsewhere —
 * `getAvailableTopics` recomputes the topic list from `discussedTopicIds` and
 * current game state on every render, and `checkTopicPrerequisites` reads the
 * NPC's persisted disposition directly. Keeping the fields would have meant
 * inventing a second, stale copy of both.
 */

/**
 * NPC Speech Fingerprinting (agora-9e0f).
 *
 * A `SpeechProfile` is the per-NPC voice signature used to post-process raw LLM
 * dialogue so two NPCs answering the same prompt do not sound identical. It is an
 * additive layer: `initialPersonalityPrompt`, `dialoguePromptSeed` and the TTS
 * `voice` keep their existing roles, and a missing profile is a no-op.
 *
 * Generation and transformation live in `src/systems/social/speechProfile.ts`.
 */
export type SpeechVocabularyLevel = 'scholarly' | 'common' | 'crude';
export type SpeechFormality = 'formal' | 'casual' | 'gruff';
export type SpeechDialectTag = 'coastal' | 'mountain' | 'urban' | 'rural';
export type SpeechSentenceLength = 'short' | 'medium' | 'long';

/**
 * Professional/social culture that cuts across the four geographic dialects
 * (agora-3c98, wired here by agora-db71.17).
 *
 * Dialect answers "where are they from"; culture answers "who raised them and
 * what do they do all day". The union is declared here, beside the axes it sits
 * with, rather than in `src/systems/social/speechProfile.ts` where it started:
 * that module imports this file, so a `cultureFamily` field typed from there
 * would have made the dependency circular. `speechProfile.ts` re-exports the
 * name, so its existing importers are unaffected.
 */
export type SpeechCultureFamily =
  | 'nautical'
  | 'criminal'
  | 'clergy'
  | 'military'
  | 'mercantile'
  | 'arcane'
  | 'noble'
  | 'agrarian'
  | 'artisan';

export interface SpeechProfile {
  /** Stable identifier derived from the profile axes (e.g. `coastal-casual-common`). */
  id: string;
  /** Short human-readable label for debug panels and dossiers. */
  label: string;
  /** Word choice register: scholarly swaps up, crude swaps down. */
  vocabularyLevel: SpeechVocabularyLevel;
  /** Social register: formal expands contractions, gruff contracts and drops courtesies. */
  formality: SpeechFormality;
  /** Regional flavor bank used for word substitutions. */
  dialectTag: SpeechDialectTag;
  /** Recurring interjections or tags (e.g. 'aye', 'indeed', 'hmm'). */
  verbalTics: string[];
  /** Pacing preference; drives sentence splitting/fusing, never truncation. */
  sentenceLength: SpeechSentenceLength;
  /**
   * Culture that shaped this speaker, or absent when none matched. Optional and
   * additive: a profile written before this field existed still post-processes
   * exactly as it did, because the culture lexicon is skipped when it is absent.
   *
   * Until this field existed, culture reached the voice only through
   * `verbalTics`, because `applySpeechProfile` receives the profile and nothing
   * else. It now also selects a jargon bank in `CULTURE_LEXICON`, which is the
   * layer the speech-profile module recorded as deferred on this exact field.
   */
  cultureFamily?: SpeechCultureFamily;
}
