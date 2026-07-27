/**
 * Combat Messaging System Types
 *
 * Defines the structure and types for rich combat feedback system.
 * This system provides contextual, categorized messaging to enhance
 * player experience during combat encounters.
 */
export declare enum CombatMessageType {
    DAMAGE_DEALT = "damage_dealt",
    DAMAGE_TAKEN = "damage_taken",
    CRITICAL_HIT = "critical_hit",
    KILLING_BLOW = "killing_blow",
    MISSED_ATTACK = "missed_attack",
    DEFENDED = "defended",
    ABILITY_USED = "ability_used",
    SPELL_CAST = "spell_cast",
    SPELL_RESISTED = "spell_resisted",
    SPELL_IMMUNE = "spell_immune",
    STATUS_APPLIED = "status_applied",
    STATUS_RESISTED = "status_resisted",
    STATUS_EXPIRED = "status_expired",
    CONDITION_CLEARED = "condition_cleared",
    TURN_START = "turn_start",
    ROUND_START = "round_start",
    COMBAT_ENTER = "combat_enter",
    COMBAT_EXIT = "combat_exit",
    LEVEL_UP = "level_up",
    MILESTONE_ACHIEVED = "milestone_achieved",
    STREAK_CONTINUED = "streak_continued",
    ENVIRONMENTAL_DAMAGE = "environmental_damage",
    HEALING_RECEIVED = "healing_received",
    RESOURCE_GAINED = "resource_gained",
    RESOURCE_SPENT = "resource_spent"
}
export declare enum MessagePriority {
    LOW = "low",// Routine actions (minor damage, basic attacks)
    MEDIUM = "medium",// Standard combat events (normal hits, spell casts)
    HIGH = "high",// Significant events (critical hits, kills)
    CRITICAL = "critical"
}
export declare enum MessageChannel {
    COMBAT_LOG = "combat_log",
    NOTIFICATION = "notification",
    VISUAL_EFFECT = "visual_effect",
    AUDIO_CUE = "audio_cue"
}
export interface CombatMessage {
    id: string;
    type: CombatMessageType;
    priority: MessagePriority;
    timestamp: number;
    channels: MessageChannel[];
    title: string;
    description: string;
    flavorText?: string;
    sourceEntityId?: string;
    targetEntityId?: string;
    combatId?: string;
    data: CombatMessageData;
    duration?: number;
    isSticky?: boolean;
    soundCue?: string;
}
export interface BaseMessageData {
    rawValue?: number | string;
    formattedValue?: string;
}
export interface DamageMessageData extends BaseMessageData {
    damageType: string;
    isCritical: boolean;
    isSneakAttack: boolean;
    weaponName?: string;
    spellName?: string;
    resistanceApplied?: boolean;
    vulnerabilityApplied?: boolean;
}
export interface HealMessageData extends BaseMessageData {
    healType: 'hit_points' | 'temporary_hit_points' | 'stat_restore';
    isCritical: boolean;
    spellName?: string;
    itemName?: string;
}
export interface StatusMessageData extends BaseMessageData {
    statusName: string;
    statusType: 'buff' | 'debuff' | 'condition';
    duration?: number;
    stacks?: number;
    isResisted: boolean;
}
export interface AbilityMessageData extends BaseMessageData {
    abilityName: string;
    abilityType: 'spell' | 'skill' | 'feat' | 'item';
    manaCost?: number;
    cooldown?: number;
    targetType: 'self' | 'single' | 'area' | 'cone' | 'line';
}
export interface AchievementMessageData extends BaseMessageData {
    achievementType: 'first_critical' | 'streak' | 'milestone' | 'challenge';
    threshold?: number;
    previousBest?: number;
}
export type CombatMessageData = DamageMessageData | HealMessageData | StatusMessageData | AbilityMessageData | AchievementMessageData | BaseMessageData;
export interface MessageTemplate {
    type: CombatMessageType;
    titleTemplate: string;
    descriptionTemplate: string;
    defaultPriority: MessagePriority;
    defaultChannels: MessageChannel[];
    dataSchema?: Record<string, any>;
}
export interface CombatMessagingConfig {
    enableCombatLog: boolean;
    enableNotifications: boolean;
    enableVisualEffects: boolean;
    enableAudioCues: boolean;
    notificationDuration: number;
    maxConcurrentNotifications: number;
    groupSimilarMessages: boolean;
    showFlavorText: boolean;
    minimumPriority: MessagePriority;
    excludedTypes: CombatMessageType[];
    maxLogEntries: number;
    enableVirtualScrolling: boolean;
}
export interface CombatMessageQueue {
    pending: CombatMessage[];
    active: CombatMessage[];
    history: CombatMessage[];
}
export interface CombatMessageFilters {
    types: CombatMessageType[];
    priorities: MessagePriority[];
    sources: string[];
    targets: string[];
    searchText: string;
}
export interface UseCombatMessagingReturn {
    messages: CombatMessage[];
    filters: CombatMessageFilters;
    config: CombatMessagingConfig;
    addMessage: (message: Omit<CombatMessage, 'id' | 'timestamp'>) => void;
    removeMessage: (messageId: string) => void;
    clearMessages: () => void;
    updateFilters: (filters: Partial<CombatMessageFilters>) => void;
    updateConfig: (config: Partial<CombatMessagingConfig>) => void;
    getMessagesByType: (type: CombatMessageType) => CombatMessage[];
    getMessagesByPriority: (priority: MessagePriority) => CombatMessage[];
    getRecentMessages: (count: number) => CombatMessage[];
    getMessageCount: () => number;
    hasActiveMessages: () => boolean;
    addDamageMessage: (params: any) => CombatMessage;
    addKillMessage: (params: any) => CombatMessage;
    addMissMessage: (params: any) => CombatMessage;
    addSpellMessage: (params: any) => CombatMessage;
    addStatusMessage: (params: any) => CombatMessage;
    addLevelUpMessage: (params: any) => CombatMessage;
    getMessageColor: (messageType: CombatMessageType) => string;
}
