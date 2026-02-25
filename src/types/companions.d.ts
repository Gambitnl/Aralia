/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/types/companions.ts
 * Defines the core types for the Companion and Relationship systems.
 */
export type RelationshipLevel = 'hated' | 'enemy' | 'rival' | 'distrusted' | 'wary' | 'stranger' | 'acquaintance' | 'friend' | 'close' | 'devoted' | 'romance';
export interface PersonalityTraits {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
    values: string[];
    fears: string[];
    quirks: string[];
}
export interface CompanionGoal {
    id: string;
    description: string;
    isSecret: boolean;
    status: 'active' | 'completed' | 'failed' | 'abandoned';
    progress: number;
}
export interface ApprovalEvent {
    id: string;
    timestamp: number;
    source: string;
    change: number;
    reason: string;
}
export interface RelationshipUnlock {
    id: string;
    type: 'ability' | 'quest' | 'dialogue' | 'item' | 'passive';
    description: string;
    isUnlocked: boolean;
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
    targetId: string;
    level: RelationshipLevel;
    approval: number;
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
    sex: string;
    age: number | string;
    physicalDescription: string;
    avatarUrl?: string;
}
/**
 * Context for a decision made by the player that might trigger companion reactions.
 */
export interface DecisionContext {
    id: string;
    type: string;
    tags: string[];
    magnitude: number;
    description?: string;
}
/**
 * Result of a companion evaluating a decision.
 */
export interface ReactionResult {
    companionId: string;
    approvalChange: number;
    dialogue?: string;
    isSilent: boolean;
}
export interface BanterLine {
    speakerId: string;
    speakerName?: string;
    text: string;
    emotion?: string;
    delay?: number;
}
export interface BanterDefinition {
    id: string;
    participants: string[];
    conditions?: {
        locationId?: string;
        minRelationship?: Record<string, RelationshipLevel>;
        chance?: number;
        cooldown?: number;
    };
    lines: BanterLine[];
    generatedMemory?: {
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
}
/**
 * Triggers that can initiate a companion reaction.
 */
export type ReactionTriggerType = 'decision' | 'location' | 'combat_start' | 'combat_end' | 'combat_hit' | 'combat_hurt' | 'loot' | 'idle' | 'banter' | 'crime_committed';
/**
 * Rule defining how a companion reacts to specific tags.
 */
export interface CompanionReactionRule {
    triggerType?: ReactionTriggerType;
    triggerTags: string[];
    approvalChange: number;
    dialoguePool: string[];
    requirements?: {
        minRelationship?: RelationshipLevel;
        maxRelationship?: RelationshipLevel;
        locationId?: string;
    };
    chance?: number;
    cooldown?: number;
    priority?: number;
}
export interface CompanionMemory {
    id: string;
    type: 'banter' | 'event' | 'observation';
    text: string;
    tags: string[];
    timestamp: number;
    importance: number;
}
/**
 * A fact discovered about a companion through conversation or events.
 * These expand the player's knowledge of the character over time.
 */
export interface DiscoveredFact {
    id: string;
    category: 'backstory' | 'family' | 'occupation' | 'belief' | 'relationship' | 'preference' | 'other';
    fact: string;
    discoveredAt: number;
    source: 'banter' | 'quest' | 'conversation';
}
export interface Companion {
    id: string;
    identity: NPCIdentity;
    personality: PersonalityTraits;
    goals: CompanionGoal[];
    relationships: Record<string, Relationship>;
    loyalty: number;
    approvalHistory: ApprovalEvent[];
    memories: CompanionMemory[];
    discoveredFacts: DiscoveredFact[];
    questline?: CompanionQuestline;
    progression?: RelationshipUnlock[];
    reactionRules: CompanionReactionRule[];
}
