/**
 * @file src/types/memory.ts
 * Type definitions for NPC memory and social knowledge.
 *
 * This module defines how NPCs track past interactions, learn facts about the player,
 * and evolve their attitude over time.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 28/10/2026, 23:58:05
 * Dependents: services/dialogueService.ts, systems/social/npcDialogueMemory.ts, types/index.ts, types/town.ts, utils/world/memoryUtils.ts, utils/world/provenanceUtils.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Represents a specific date/time in the game world.
 * We use a number (timestamp) for simple serialization and comparison.
 */
export type GameDate = number;

/**
 * The type of interaction that occurred.
 * Distinct from TownInteractionType which is about UI actions.
 * These are the categories stored in memory.
 */
export type MemoryInteractionType =
  | 'dialogue'
  | 'trade'
  | 'combat'
  | 'gift'
  | 'theft'
  | 'quest_given'
  | 'quest_complete'
  | 'insult'
  | 'aid'
  | 'observation';

/**
 * Importance level for memory retention.
 */
export enum MemoryImportance {
  Trivial = 0,    // Forgotten after a day
  Minor = 1,      // Forgotten after a week
  Standard = 3,   // Forgotten after a month
  Major = 5,      // Retained for a year
  Critical = 10   // Never forgotten
}

/**
 * A record of a single past interaction between an NPC and a player.
 */
/** Provenance for a factual reply actually delivered in conversation.
 * This is part of existing interaction history, never a second accounts ledger. */
export interface NpcWorkDialoguePublication {
  topicId: 'household_work';
  speakerKey: string;
  source: {kind: 'business-report'; businessId: string; day: number; revenue: number; costs: number; profit: number; supplyIssues?: string[]; competitorActions?: string[]; staffIssues?: string[]};
}

/** Personal snapshots preserve the admitted source behind the exact spoken words.
 * The existing interaction date owns delivery time; recall never republishes it. */
export interface NpcPersonalDialoguePublication {
  topicId: 'global_who_are_you' | 'household_family';
  speakerKey: string;
  source: {kind:'household-personal'; snapshot:string};
}
/** The words of an open conversation are remembered as attributed speech.
 * Neither a model's answer nor the player's question establishes a world fact. */
export interface NpcGeneratedDialoguePublication {
  topicId: 'generated_exchange';
  speakerKey: string;
  source: {kind:'generated-exchange'; requestId:string; playerPrompt:string};
}
/** Public institution and career words retain the exact source snapshot that
 * supported delivery. They confer no private belief, service or quest. */
export interface NpcInstitutionDialoguePublication {
  topicId:'household_temple'|'household_office_history'|'household_public_history';
  speakerKey:string;
  source:{kind:'institution-statement';snapshot:string};
}
export type NpcDialoguePublication = NpcWorkDialoguePublication | NpcPersonalDialoguePublication | NpcGeneratedDialoguePublication | NpcInstitutionDialoguePublication;

export interface Interaction {
  /** When present, summary is the exact spoken reply, not a new world fact. */
  dialogue?: NpcDialoguePublication;
  /** Unique ID for referencing this memory */
  id: string;
  /** When the interaction occurred */
  date: GameDate;
  /** The nature of the interaction */
  type: MemoryInteractionType;
  /** A brief summary of what happened (e.g., "Sold 50 healing potions", "Insulted their mother") */
  summary: string;
  /** How much the NPC's attitude changed as a result of this interaction */
  attitudeChange: number;
  /** Importance score determining retention (0-10) */
  significance: number;
  /** IDs of other entities who witnessed this event */
  witnesses?: string[];
  /** Emotional context associated with this memory */
  emotion?: 'joy' | 'anger' | 'fear' | 'sadness' | 'surprise' | 'trust' | 'disgust' | 'anticipation';
}

/**
 * The forked richer memory model (`NPCMemory`/`Fact`) has been merged onto the canonical live
 * `NpcMemory`/`KnownFact` in `./world`. `NPCMemory` is kept as an alias so the handful of
 * type-only importers (Gemini item prompts, the game-guide modal) keep resolving; new code should
 * import `NpcMemory` from `./world` directly. `Fact`'s contribution (semantic key, confidence,
 * significance, richer source labels) now lives on the optional fields of `KnownFact`.
 */
export type { NpcMemory as NPCMemory } from './world';
