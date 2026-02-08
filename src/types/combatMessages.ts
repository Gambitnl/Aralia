/**
 * Combat Messaging System Types
 * 
 * Defines the structure and types for rich combat feedback system.
 * This system provides contextual, categorized messaging to enhance
 * player experience during combat encounters.
 */

// -----------------------------------------------------------------------------
// MESSAGE TYPES & CATEGORIES
// -----------------------------------------------------------------------------

export enum CombatMessageType {
  // Core Combat Actions
  DAMAGE_DEALT = 'damage_dealt',
  DAMAGE_TAKEN = 'damage_taken',
  CRITICAL_HIT = 'critical_hit',
  KILLING_BLOW = 'killing_blow',
  MISSED_ATTACK = 'missed_attack',
  DEFENDED = 'defended',
  
  // Abilities & Spells
  ABILITY_USED = 'ability_used',
  SPELL_CAST = 'spell_cast',
  SPELL_RESISTED = 'spell_resisted',
  SPELL_IMMUNE = 'spell_immune',
  
  // Status Effects
  STATUS_APPLIED = 'status_applied',
  STATUS_RESISTED = 'status_resisted',
  STATUS_EXPIRED = 'status_expired',
  CONDITION_CLEARED = 'condition_cleared',
  
  // Combat Events
  TURN_START = 'turn_start',
  ROUND_START = 'round_start',
  COMBAT_ENTER = 'combat_enter',
  COMBAT_EXIT = 'combat_exit',
  
  // Player Achievements
  LEVEL_UP = 'level_up',
  MILESTONE_ACHIEVED = 'milestone_achieved',
  STREAK_CONTINUED = 'streak_continued',
  
  // Environmental & System
  ENVIRONMENTAL_DAMAGE = 'environmental_damage',
  HEALING_RECEIVED = 'healing_received',
  RESOURCE_GAINED = 'resource_gained',
  RESOURCE_SPENT = 'resource_spent'
}

export enum MessagePriority {
  LOW = 'low',      // Routine actions (minor damage, basic attacks)
  MEDIUM = 'medium', // Standard combat events (normal hits, spell casts)
  HIGH = 'high',    // Significant events (critical hits, kills)
  CRITICAL = 'critical' // Game-changing moments (level up, boss defeat)
}

export enum MessageChannel {
  COMBAT_LOG = 'combat_log',
  NOTIFICATION = 'notification',
  VISUAL_EFFECT = 'visual_effect',
  AUDIO_CUE = 'audio_cue'
}

// -----------------------------------------------------------------------------
// CORE MESSAGE STRUCTURE
// -----------------------------------------------------------------------------

export interface CombatMessage {
  id: string;
  type: CombatMessageType;
  priority: MessagePriority;
  timestamp: number;
  channels: MessageChannel[];
  
  // Content
  title: string;
  description: string;
  flavorText?: string;
  
  // Context
  sourceEntityId?: string;    // Who initiated the action
  targetEntityId?: string;    // Who received the action
  combatId?: string;          // Which combat this belongs to
  
  // Data Payload
  data: CombatMessageData;
  
  // Presentation
  duration?: number;          // How long notification stays visible
  isSticky?: boolean;         // Requires manual dismissal
  soundCue?: string;          // Audio identifier
}

// -----------------------------------------------------------------------------
// MESSAGE DATA PAYLOADS
// -----------------------------------------------------------------------------

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

export type CombatMessageData = 
  | DamageMessageData
  | HealMessageData
  | StatusMessageData
  | AbilityMessageData
  | AchievementMessageData
  | BaseMessageData;

// -----------------------------------------------------------------------------
// MESSAGE TEMPLATES
// -----------------------------------------------------------------------------

export interface MessageTemplate {
  type: CombatMessageType;
  titleTemplate: string;
  descriptionTemplate: string;
  defaultPriority: MessagePriority;
  defaultChannels: MessageChannel[];
  dataSchema?: Record<string, any>;
}

// -----------------------------------------------------------------------------
// SYSTEM INTERFACES
// -----------------------------------------------------------------------------

export interface CombatMessagingConfig {
  // Channel Settings
  enableCombatLog: boolean;
  enableNotifications: boolean;
  enableVisualEffects: boolean;
  enableAudioCues: boolean;
  
  // Behavior
  notificationDuration: number;
  maxConcurrentNotifications: number;
  groupSimilarMessages: boolean;
  showFlavorText: boolean;
  
  // Filtering
  minimumPriority: MessagePriority;
  excludedTypes: CombatMessageType[];
  
  // Performance
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
  sources: string[];  // Entity IDs
  targets: string[];  // Entity IDs
  searchText: string;
}

// -----------------------------------------------------------------------------
// HOOK INTERFACES
// -----------------------------------------------------------------------------

export interface UseCombatMessagingReturn {
  // State
  messages: CombatMessage[];
  filters: CombatMessageFilters;
  config: CombatMessagingConfig;
  
  // Actions
  addMessage: (message: Omit<CombatMessage, 'id' | 'timestamp'>) => void;
  removeMessage: (messageId: string) => void;
  clearMessages: () => void;
  updateFilters: (filters: Partial<CombatMessageFilters>) => void;
  updateConfig: (config: Partial<CombatMessagingConfig>) => void;
  
  // Selectors
  getMessagesByType: (type: CombatMessageType) => CombatMessage[];
  getMessagesByPriority: (priority: MessagePriority) => CombatMessage[];
  getRecentMessages: (count: number) => CombatMessage[];
  
  // Utilities
  getMessageCount: () => number;
  hasActiveMessages: () => boolean;
  
  // Convenience Methods
  addDamageMessage: (params: any) => CombatMessage;
  addKillMessage: (params: any) => CombatMessage;
  addMissMessage: (params: any) => CombatMessage;
  addSpellMessage: (params: any) => CombatMessage;
  addStatusMessage: (params: any) => CombatMessage;
  addLevelUpMessage: (params: any) => CombatMessage;
  
  // Helpers
  getMessageColor: (messageType: CombatMessageType) => string;
}