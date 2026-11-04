/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/types/companions.ts
 * Defines the core types for the Companion and Relationship systems.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 03/11/2026, 17:38:23
 * Dependents: components/CharacterSheet/CharacterSheetModal.tsx, components/CharacterSheet/Details/CharacterDetailsTab.tsx, components/ConversationPanel/CompanionGoalWorkChoices.tsx, components/ConversationPanel/CompanionTravelChoices.tsx, components/DesignPreview/steps/PreviewComponents.tsx, components/Party/RelationshipsPane.tsx, components/ui/CollapsibleBanterPanel.tsx, components/ui/CompanionCard.tsx, components/ui/CompanionReaction.tsx, data/banter.ts, data/companions.ts, hooks/actions/handleNpcInteraction.ts, hooks/useCompanionBanter.ts, hooks/useCompanionCommentary.ts, services/BanterDisplayService.ts, services/ollama/banter.ts, services/ollama/facts.ts, services/ollama/index.ts, state/reducers/companionGoalDestinationReducer.ts, state/reducers/companionGoalWorkReducer.ts, state/reducers/companionPreparationReducer.ts, state/reducers/companionRumorReducer.ts, state/reducers/companionTravelReducer.ts, systems/companions/BanterManager.ts, systems/companions/CompanionReactionSystem.ts, systems/companions/RelationshipManager.ts, systems/companions/companionJourney.ts, systems/companions/companionPreparations.ts, systems/companions/companionRumors.ts, systems/companions/companionWhereabouts.ts, systems/companions/companionWorldActivities.ts, systems/companions/conversationTranscript.ts, systems/party/authoredCompanionCapabilities.ts, systems/party/authoredCompanionToRichNpc.ts, systems/party/npcToPartyMember.ts, systems/party/recruitConsent.ts, systems/party/recruitTypes.ts, systems/party/restoreAuthoredCompanionBuild.ts, types/index.ts, utils/character/companionFactories.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// Core types for companion logic
import type { Item } from './items';
// 11 relationship levels with 100-point steps from -500 to +500
export type RelationshipLevel =
  | 'hated'       // -500 to -401
  | 'enemy'       // -400 to -301
  | 'rival'       // -300 to -201
  | 'distrusted'  // -200 to -101
  | 'wary'        // -100 to -1
  | 'stranger'    // 0 to 99 (starting point)
  | 'acquaintance'// 100 to 199
  | 'friend'      // 200 to 299
  | 'close'       // 300 to 399
  | 'devoted'     // 400 to 499
  | 'romance';    // 500 (special trigger)

export interface PersonalityTraits {
  openness: number;      // 0-100: Prefer routine vs variety
  conscientiousness: number; // 0-100: Impulsive vs disciplined
  extraversion: number;  // 0-100: Reserved vs outgoing
  agreeableness: number; // 0-100: Antagonistic vs cooperative
  neuroticism: number;   // 0-100: Confident vs sensitive
  values: string[];      // e.g. "Honesty", "Power", "Nature"
  fears: string[];
  quirks: string[];
}

export interface CompanionGoal {
  id: string;
  description: string;
  isSecret: boolean;
  status: 'active' | 'completed' | 'failed' | 'abandoned';
  progress: number; // 0-100
  /** A public destination actually shared; never a visit, promise or consent. */
  disclosedDestination?: CompanionGoalDestination;
}

/** Retains the exact source-world place and first disclosure date. */
export interface CompanionGoalDestination {
  worldSeed: number; sourceId: string; sitePath: string; cellId: number;
  name: string; nearbyBurgId: number; nearbyBurgName: string; sharedAt: number;
}
export interface CompanionGoalDestinationSelection {
  companionId: string; goalId: string; worldSeed: number; sitePath: string;
}

export interface ApprovalEvent {
  id: string;
  timestamp: number;
  source: string; // e.g., "Quest: Save the Cat", "Dialogue: Insulted the King"
  change: number;
  reason: string;
}

export interface RelationshipUnlock {
  id: string;
  type: 'ability' | 'quest' | 'dialogue' | 'item' | 'passive';
  description: string;
  isUnlocked: boolean;
  // Requirements to unlock
  requiredLevel?: RelationshipLevel;
  requiredApproval?: number;
}

export interface RelationshipEvent {
  id: string;
  timestamp: number;
  description: string;
  type: 'milestone' | 'betrayal' | 'gift' | 'conversation';
}

export interface Relationship {
  targetId: string; // The ID of the character this relationship is with (usually the player)
  level: RelationshipLevel;
  approval: number; // -500 to 500, matching the runtime approval clamp
  history: RelationshipEvent[];
  unlocks: RelationshipUnlock[];

  // Romance uses the game's saved clock to distinguish a temporary conflict from
  // a sustained collapse. Older saves omit this field and begin timing only when
  // the live relationship manager next observes hostile approval.
  romanceHostileSinceGameTimeMs?: number;
}

export interface CompanionQuestline {
  id: string;
  title: string;
  currentStageId: string;
  stages: Record<string, {
    description: string;
    objectives: string[];
    isCompleted: boolean;
  }>;
  /** Where this chapter was offered. Saves retain its world rather than
   * silently attaching an old promise to a new world with the same NPC id. */
  origin?: { worldSeed: number; locationId: string };
}

/** Fixed, authored conversation choices; free text still uses the intent reader. */
export type CompanionPreparationChoice = 'ask' | 'promise' | 'decline' | 'deliver' | 'withdraw' | 'recall' | 'resupply';

/** A public work offer remains separate from a recruitment invitation. */
export type CompanionGoalWorkChoice = 'ask' | 'accept' | 'decline' | 'withdraw' | 'report' | 'recall';

export interface NPCIdentity {
  id: string;
  name: string;
  race: string;
  class: string;
  background: string;
  sex: string;
  age: number | string; // e.g., 25 or "Young Adult"
  physicalDescription: string;
  avatarUrl?: string;
}

/**
 * Context for a decision made by the player that might trigger companion reactions.
 */
export interface DecisionContext {
  id: string;
  type: string; // e.g. "crime", "charity", "combat_victory"
  tags: string[]; // e.g. ["theft", "violent", "generous"]
  magnitude: number; // 1 (minor) to 5 (major)
  description?: string;
}

/**
 * Result of a companion evaluating a decision.
 */
export interface ReactionResult {
  companionId: string;
  approvalChange: number;
  dialogue?: string;
  isSilent: boolean; // If true, approval changes but no dialogue (e.g. if far away or strictly internal)
}

export interface BanterLine {
  /** Original conversation message identity; absent on legacy ambient banter. */
  messageId?: string;
  /** Authored choices/events already have their own memory owner. */
  memoryHandled?: boolean;
  speakerId: string;
  speakerName?: string;
  text: string;
  emotion?: string; // Optional emotion/anim
  delay?: number; // Time before next line
}

/** Provenance that lets exact spoken transcripts be scoped without treating
 * legacy/ambient banter as world-qualified NPC knowledge. */
export interface PlayerConversationArchiveSource {
  kind: 'player-conversation';
  conversationId: string;
  /** Missing only when an older save did not retain a usable world identity. */
  worldSeed?: number;
  capture: 'ended' | 'loaded-open' | 'conflict';
  pendingAtCapture: boolean;
  /** Attempt is recorded before summary work so reload cannot duplicate effects. */
  semanticStatus: 'not-run' | 'attempted';
}

export interface BanterDefinition {
  id: string;
  participants: string[]; // IDs of required companions
  conditions?: {
    locationId?: string;
    minRelationship?: Record<string, RelationshipLevel>;
    chance?: number;
    cooldown?: number; // Minutes
  };
  lines: BanterLine[];
  generatedMemory?: { // Optional memory to commit after banter completes
    text: string;
    tags: string[];
  };
}

export interface BanterMoment {
  id: string;
  timestamp: number;
  locationId: string;
  participants: string[];
  lines: BanterLine[];
  /** Absent on legacy/ambient banter, which remains displayable but is not recalled. */
  source?: PlayerConversationArchiveSource;
}

/**
 * Triggers that can initiate a companion reaction.
 */
export type ReactionTriggerType =
  | 'decision'     // Player made a choice (dialogue/quest)
  | 'location'     // Entered a new area/biome
  | 'combat_start' // Battle begins
  | 'combat_end'   // Battle ends
  | 'combat_hit'   // Companion did big damage
  | 'combat_hurt'  // Companion took big damage
  | 'loot'         // Player picked up something interesting
  | 'idle'         // Time passed without action
  | 'banter'       // Interaction with another companion
  | 'crime_committed'; // Player committed a crime

/**
 * Rule defining how a companion reacts to specific tags.
 */
export interface CompanionReactionRule {
  triggerType?: ReactionTriggerType; // Defaults to 'decision' for backward compatibility
  triggerTags: string[]; // Matches ANY of these tags
  approvalChange: number; // Base change for magnitude 1
  dialoguePool: string[]; // Randomly selected response
  requirements?: {
    minRelationship?: RelationshipLevel;
    maxRelationship?: RelationshipLevel;
    locationId?: string; // Only triggers in specific location
  };
  chance?: number; // 0-1 probability (default 1)
  cooldown?: number; // Minutes before this specific rule can trigger again
  priority?: number; // Higher overrides lower (default 0)
}

export interface CompanionMemory {
  id: string;
  type: 'banter' | 'event' | 'observation';
  text: string;
  tags: string[];
  timestamp: number;
  importance: number; // 1-10, for filtering relevance
  /** What the player reported, kept apart from first-hand events and promises. */
  hearsay?: {
    sourceId: string; itemId: string; subject: string; account: string;
    sharedById: string; sharedByName: string; sharedInWorldSeed: number;
  };
}

export interface CompanionRumorSelection {
  companionId: string;
  inventoryIndex: number;
  itemId: string;
  sourceId: string;
  description: string;
}

/**
 * A fact discovered about a companion through conversation or events.
 * These expand the player's knowledge of the character over time.
 */
export interface DiscoveredFact {
  id: string;
  category: 'backstory' | 'family' | 'occupation' | 'belief' | 'relationship' | 'preference' | 'other';
  fact: string; // e.g., "Used to be a blacksmith's apprentice"
  discoveredAt: number; // Timestamp
  source: 'banter' | 'quest' | 'conversation';
}

/** A public purpose and stable source place, retained separately from current
 * physical whereabouts so recruitment or dismissal cannot erase that life. */
export interface CompanionPublicActivity {
  version: 1; sourceId: string; worldSeed: number; companionId: string;
  kind: 'restoration-preparations' | 'seeking-independent-work';
  burgId: number; burgName: string; cellId: number; locationId: string;
  summary: string; goalId?: string; sitePath?: string;
}

/** Consent to a source-bound expedition, retained with the person's memories.
 * A proposed agreement is not membership or unrestricted loyalty. */
export interface CompanionTravelAgreement {
  worldSeed:number; sourceId:string; goalId:string; sitePath:string;
  destinationName:string; terms:string[]; offeredAt:number;
  response:'offered'|'accepted'|'declined'; respondedAt?:number;
  /** A later, mutual decision about this source site's entrance floor. It
   * survives refusal and reload without granting unrestricted following. */
  exploration?: { response:'offered'|'accepted'|'declined'|'withdrawn';
    discussedAt:number; respondedAt?:number; terms:string[]; concerns:string[] };
  /** Water stays with its owner. This budget permits extra shared consumption
   * on one source-bound return, separately from membership or entry consent. */
  returnWater?: { response:'offered'|'accepted'|'declined'|'used'; amount:number;
    journeyId:string; fromLocationId:string; destinationCellId:number;
    discussedAt:number; respondedAt?:number; usedAt?:number };

}
export type CompanionTravelChoice = 'discuss_work'|'invite'|'propose_goal'|'accept_terms'|'decline_terms'|'recall_terms'|'recall_journey'|'discuss_entry'|'accept_entry_terms'|'decline_entry_terms'|'recall_entry_terms'|'discuss_return_water'|'accept_return_water'|'decline_return_water';

export interface Companion {
  id: string;
  identity: NPCIdentity;
  personality: PersonalityTraits;
  goals: CompanionGoal[];
  relationships: Record<string, Relationship>; // Keyed by Character ID
  loyalty: number; // 0-100, determines chance of leaving/betrayal
  approvalHistory: ApprovalEvent[];
  memories: CompanionMemory[]; // Memory system for conversation recall
  /** Belongings held by this person, including while separated from the party.
   * A handover removes the same goods from the player's inventory atomically. */
  inventory?: Item[];
  publicActivity?: CompanionPublicActivity;
  travelAgreement?: CompanionTravelAgreement;
  /** Actual world placement survives replacing the temporary encounter list.
   * Position is captured from the real cast, never inferred from the player. */
  whereabouts?: {
    worldSeed: number;
    locationId: string;
    observedAt: number;
    source: 'encounter' | 'dismissed' | 'deserted' | 'world-activity' | 'party';
    position?: { xM: number; yM: number; zM: number };
  };
  /** Unresolved accepted footsteps survive saves; a destination is not a path. */
  following?: { worldSeed: number; locationId: string; trail: Array<{ xM: number; yM: number; zM: number }> };
  /** Original observed departure remains distinct from the moving party feet. */
  journeyDeparture?: Companion['whereabouts'];
  /** A committed shared journey proves why someone can arrive in another
   * locale. The destination still needs its own clear physical placement. */
  journey?: {
    id: string; worldSeed: number;
    from: { locationId: string; cellId: number; position: { xM: number; yM: number; zM: number } };
    to: { locationId: string; cellId: number };
    intendedCellId: number; routeCells: number[];
    departedAt: number; arrivalAt: number;
    status: 'awaiting-arrival' | 'arrived';
  };
  discoveredFacts: DiscoveredFact[]; // Facts learned about this character through interaction
  questline?: CompanionQuestline;

  // Progression: What can be unlocked
  progression?: RelationshipUnlock[];

  // Reaction Logic
  reactionRules: CompanionReactionRule[];

  // Party membership: true when this companion is currently in the player's party.
  // On dismiss/desert the Companion record is KEPT with inParty:false so the
  // relationship persists and they remain re-recruitable (decision #5).
  // Optional for backward compatibility with existing seeded/persisted records.
  inParty?: boolean;

  // Combat stats could link to a CombatCharacter or be defined here
  // For now, we assume they map to a CombatCharacter via ID
}
