/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/types/companions.ts
 * Defines the core types for the Companion and Relationship systems.
 */

// Core types for companion logic
import { NPC } from './index';

export type RelationshipLevel = 'stranger' | 'acquaintance' | 'friend' | 'close' | 'devoted' | 'romance' | 'rival' | 'enemy';

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
  approval: number; // -100 to 100
  history: RelationshipEvent[];
  unlocks: RelationshipUnlock[];
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
}

export interface NPCIdentity {
  id: string;
  name: string;
  race: string;
  class: string;
  background: string;
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

/**
 * Rule defining how a companion reacts to specific tags.
 */
export interface CompanionReactionRule {
  triggerTags: string[]; // Matches ANY of these tags
  approvalChange: number; // Base change for magnitude 1
  dialoguePool: string[]; // Randomly selected response
  requirements?: {
    minRelationship?: RelationshipLevel;
    maxRelationship?: RelationshipLevel;
  };
}

export interface Companion {
  id: string;
  identity: NPCIdentity;
  personality: PersonalityTraits;
  goals: CompanionGoal[];
  relationships: Record<string, Relationship>; // Keyed by Character ID
  loyalty: number; // 0-100, determines chance of leaving/betrayal
  approvalHistory: ApprovalEvent[];
  questline?: CompanionQuestline;

  // New: Reaction Logic
  reactionRules: CompanionReactionRule[];

  // Combat stats could link to a CombatCharacter or be defined here
  // For now, we assume they map to a CombatCharacter via ID
}
