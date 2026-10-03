/**
 * Combat Messaging System Types
 * 
 * Defines the structure and types for rich combat feedback system.
 * This system provides contextual, categorized messaging to enhance
 * player experience during combat encounters.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 20/09/2026, 21:00:39
 * Dependents: components/Combat/CombatLog.tsx, hooks/combat/useCombatMessaging.ts, services/combatLogService.ts, utils/combat/combatLogToMessageAdapter.ts, utils/combat/messageFactory.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
// EVENT CLASSIFICATION (CMB-GAP-003)
// -----------------------------------------------------------------------------

/**
 * CombatEventClass — the typed taxonomy of things that can happen in combat.
 *
 * WHAT CHANGED (2026-09-09, CMB-GAP-003): before this enum existed, the only way to
 * decide what a combat log record meant was to switch on `CombatLogEntry.type` and then
 * pattern-match the human-readable `message` string inside the adapter. That made the
 * classifier break silently on a copy edit or a localization pass.
 *
 * WHY: an event class is the emitter's own statement of intent. `CombatMessageType` is a
 * *presentation* category (several classes legitimately share one), so it cannot serve as
 * the routing key on its own — for example COMBAT_ENTER is produced both by "Combat begins!"
 * (HIGH) and by "X joins the combat!" (MEDIUM), which need different channels.
 *
 * WHAT IS PRESERVED: every branch of the old string-matching classifier now has exactly one
 * class here, at the same CombatMessageType/priority/channels it produced before, so the
 * enum is a superset of the previous behavior rather than a replacement for it.
 *
 * BUFF AND DEBUFF (2026-09-20, agora-6acd): these are no longer deferred. A status record in
 * the domain carries `StatusEffect.type` (buff | debuff | neutral | dot | hot), and
 * STATUS_KIND_DISCRIMINATORS below turns that kind into the matching class. The adapter reads
 * the kind off the affected character's live status list rather than off the message text, so
 * a record whose status cannot be found stays STATUS_CHANGE instead of being guessed at.
 */
export enum CombatEventClass {
  // Damage and its outcomes
  DAMAGE = 'damage',
  CRITICAL_DAMAGE = 'critical_damage',
  OPPORTUNITY_ATTACK_HIT = 'opportunity_attack_hit',
  KILL = 'kill',
  MISS = 'miss',

  // Restoration
  HEAL = 'heal',

  // Status and conditions
  BUFF = 'buff',
  DEBUFF = 'debuff',
  STATUS_CHANGE = 'status_change',
  STATUS_RESIST = 'status_resist',
  STATUS_SAVE_FAILED = 'status_save_failed',
  STATUS_EXPIRE = 'status_expire',
  DEATH_SAVE = 'death_save',

  // World and positioning
  ENVIRONMENTAL = 'environmental',
  MOVEMENT = 'movement',

  // Actions, spells, summons
  ABILITY = 'ability',
  SPELL_CAST = 'spell_cast',
  SPELL_SUSTAIN = 'spell_sustain',
  SUMMON = 'summon',
  ACTION_BLOCKED = 'action_blocked',

  // Structure of the encounter
  TURN_START = 'turn_start',
  TURN_END = 'turn_end',
  ROUND_START = 'round_start',
  COMBAT_ENTER = 'combat_enter',
  COMBAT_JOIN = 'combat_join',
  COMBAT_EXIT = 'combat_exit',

  // Progression and economy
  LEVEL_UP = 'level_up',
  RESOURCE_GAINED = 'resource_gained',
  RESOURCE_SPENT = 'resource_spent',

  // Explicit "we could not tell" bucket. Routed like a routine ability event.
  UNKNOWN = 'unknown',
}

/**
 * CombatEventRouting — what one event class turns into on the presentation side.
 *
 * `visualEffect` and `soundCue` are the payload the VISUAL_EFFECT and AUDIO_CUE channels
 * carry. They are declared here (not invented per call site) so a future VFX/SFX consumer
 * has one table to subscribe to instead of re-deriving effects from message text.
 */
export interface CombatEventRouting {
  type: CombatMessageType;
  priority: MessagePriority;
  channels: MessageChannel[];
  /** Named visual effect for the VISUAL_EFFECT channel. Only set when that channel is listed. */
  visualEffect?: string;
  /** Named audio cue for the AUDIO_CUE channel. Only set when that channel is listed. */
  soundCue?: string;
}

/**
 * COMBAT_EVENT_ROUTING — the single routing table for combat events (CMB-GAP-003/004).
 *
 * Read this as the channel audit in code form: every row states which of the four
 * MessageChannel values an event reaches. See docs/tasks/combat-messaging-enhancement/
 * NORTH_STAR.md for which of those channels currently has a live UI consumer.
 */
export const COMBAT_EVENT_ROUTING: Record<CombatEventClass, CombatEventRouting> = {
  [CombatEventClass.DAMAGE]: {
    type: CombatMessageType.DAMAGE_DEALT,
    priority: MessagePriority.MEDIUM,
    channels: [MessageChannel.COMBAT_LOG, MessageChannel.NOTIFICATION, MessageChannel.VISUAL_EFFECT],
    visualEffect: 'impact_shake',
  },
  [CombatEventClass.CRITICAL_DAMAGE]: {
    type: CombatMessageType.CRITICAL_HIT,
    priority: MessagePriority.HIGH,
    channels: [
      MessageChannel.COMBAT_LOG,
      MessageChannel.NOTIFICATION,
      MessageChannel.VISUAL_EFFECT,
      MessageChannel.AUDIO_CUE,
    ],
    visualEffect: 'critical_flash',
    soundCue: 'combat.critical_impact',
  },
  [CombatEventClass.OPPORTUNITY_ATTACK_HIT]: {
    type: CombatMessageType.DAMAGE_DEALT,
    priority: MessagePriority.HIGH,
    channels: [MessageChannel.COMBAT_LOG, MessageChannel.NOTIFICATION, MessageChannel.VISUAL_EFFECT],
    visualEffect: 'impact_shake',
  },
  [CombatEventClass.KILL]: {
    type: CombatMessageType.KILLING_BLOW,
    priority: MessagePriority.HIGH,
    channels: [
      MessageChannel.COMBAT_LOG,
      MessageChannel.NOTIFICATION,
      MessageChannel.VISUAL_EFFECT,
      MessageChannel.AUDIO_CUE,
    ],
    visualEffect: 'death_burst',
    soundCue: 'combat.killing_blow',
  },
  [CombatEventClass.MISS]: {
    type: CombatMessageType.MISSED_ATTACK,
    priority: MessagePriority.LOW,
    channels: [MessageChannel.COMBAT_LOG],
  },
  [CombatEventClass.HEAL]: {
    type: CombatMessageType.HEALING_RECEIVED,
    priority: MessagePriority.MEDIUM,
    channels: [MessageChannel.COMBAT_LOG, MessageChannel.NOTIFICATION, MessageChannel.VISUAL_EFFECT],
    visualEffect: 'heal_pulse',
  },
  [CombatEventClass.BUFF]: {
    type: CombatMessageType.STATUS_APPLIED,
    priority: MessagePriority.MEDIUM,
    channels: [MessageChannel.COMBAT_LOG, MessageChannel.NOTIFICATION, MessageChannel.VISUAL_EFFECT],
    visualEffect: 'buff_glow',
  },
  [CombatEventClass.DEBUFF]: {
    type: CombatMessageType.STATUS_APPLIED,
    priority: MessagePriority.MEDIUM,
    channels: [MessageChannel.COMBAT_LOG, MessageChannel.NOTIFICATION, MessageChannel.VISUAL_EFFECT],
    visualEffect: 'debuff_glow',
  },
  [CombatEventClass.STATUS_CHANGE]: {
    type: CombatMessageType.STATUS_APPLIED,
    priority: MessagePriority.MEDIUM,
    channels: [MessageChannel.COMBAT_LOG, MessageChannel.NOTIFICATION],
  },
  [CombatEventClass.STATUS_RESIST]: {
    type: CombatMessageType.STATUS_RESISTED,
    priority: MessagePriority.MEDIUM,
    channels: [MessageChannel.COMBAT_LOG],
  },
  [CombatEventClass.STATUS_SAVE_FAILED]: {
    type: CombatMessageType.STATUS_APPLIED,
    priority: MessagePriority.MEDIUM,
    channels: [MessageChannel.COMBAT_LOG],
  },
  [CombatEventClass.STATUS_EXPIRE]: {
    type: CombatMessageType.STATUS_EXPIRED,
    priority: MessagePriority.MEDIUM,
    channels: [MessageChannel.COMBAT_LOG, MessageChannel.NOTIFICATION],
  },
  [CombatEventClass.DEATH_SAVE]: {
    type: CombatMessageType.STATUS_APPLIED,
    priority: MessagePriority.HIGH,
    channels: [MessageChannel.COMBAT_LOG, MessageChannel.NOTIFICATION, MessageChannel.AUDIO_CUE],
    soundCue: 'combat.death_save',
  },
  [CombatEventClass.ENVIRONMENTAL]: {
    type: CombatMessageType.ENVIRONMENTAL_DAMAGE,
    priority: MessagePriority.LOW,
    channels: [MessageChannel.COMBAT_LOG],
  },
  [CombatEventClass.MOVEMENT]: {
    type: CombatMessageType.ABILITY_USED,
    priority: MessagePriority.LOW,
    channels: [MessageChannel.COMBAT_LOG],
  },
  [CombatEventClass.ABILITY]: {
    type: CombatMessageType.ABILITY_USED,
    priority: MessagePriority.MEDIUM,
    channels: [MessageChannel.COMBAT_LOG],
  },
  [CombatEventClass.SPELL_CAST]: {
    type: CombatMessageType.SPELL_CAST,
    priority: MessagePriority.MEDIUM,
    channels: [MessageChannel.COMBAT_LOG, MessageChannel.NOTIFICATION],
  },
  [CombatEventClass.SPELL_SUSTAIN]: {
    type: CombatMessageType.ABILITY_USED,
    priority: MessagePriority.LOW,
    channels: [MessageChannel.COMBAT_LOG],
  },
  [CombatEventClass.SUMMON]: {
    type: CombatMessageType.ABILITY_USED,
    priority: MessagePriority.LOW,
    channels: [MessageChannel.COMBAT_LOG],
  },
  [CombatEventClass.ACTION_BLOCKED]: {
    type: CombatMessageType.DEFENDED,
    priority: MessagePriority.LOW,
    channels: [MessageChannel.COMBAT_LOG],
  },
  [CombatEventClass.TURN_START]: {
    type: CombatMessageType.TURN_START,
    priority: MessagePriority.LOW,
    channels: [MessageChannel.COMBAT_LOG],
  },
  // There is no TURN_END presentation type; turn ends reuse TURN_START, as they did
  // before the enum existed. The distinct class is kept so a future UI can tell them apart.
  [CombatEventClass.TURN_END]: {
    type: CombatMessageType.TURN_START,
    priority: MessagePriority.LOW,
    channels: [MessageChannel.COMBAT_LOG],
  },
  [CombatEventClass.ROUND_START]: {
    type: CombatMessageType.ROUND_START,
    priority: MessagePriority.LOW,
    channels: [MessageChannel.COMBAT_LOG],
  },
  [CombatEventClass.COMBAT_ENTER]: {
    type: CombatMessageType.COMBAT_ENTER,
    priority: MessagePriority.HIGH,
    channels: [MessageChannel.COMBAT_LOG, MessageChannel.NOTIFICATION, MessageChannel.AUDIO_CUE],
    soundCue: 'combat.start',
  },
  [CombatEventClass.COMBAT_JOIN]: {
    type: CombatMessageType.COMBAT_ENTER,
    priority: MessagePriority.MEDIUM,
    channels: [MessageChannel.COMBAT_LOG, MessageChannel.NOTIFICATION],
  },
  [CombatEventClass.COMBAT_EXIT]: {
    type: CombatMessageType.COMBAT_EXIT,
    priority: MessagePriority.HIGH,
    channels: [MessageChannel.COMBAT_LOG, MessageChannel.NOTIFICATION],
  },
  [CombatEventClass.LEVEL_UP]: {
    type: CombatMessageType.LEVEL_UP,
    priority: MessagePriority.CRITICAL,
    channels: [
      MessageChannel.COMBAT_LOG,
      MessageChannel.NOTIFICATION,
      MessageChannel.VISUAL_EFFECT,
      MessageChannel.AUDIO_CUE,
    ],
    visualEffect: 'level_up_burst',
    soundCue: 'ui.level_up',
  },
  [CombatEventClass.RESOURCE_GAINED]: {
    type: CombatMessageType.RESOURCE_GAINED,
    priority: MessagePriority.LOW,
    channels: [MessageChannel.COMBAT_LOG],
  },
  [CombatEventClass.RESOURCE_SPENT]: {
    type: CombatMessageType.RESOURCE_SPENT,
    priority: MessagePriority.LOW,
    channels: [MessageChannel.COMBAT_LOG],
  },
  [CombatEventClass.UNKNOWN]: {
    type: CombatMessageType.ABILITY_USED,
    priority: MessagePriority.LOW,
    channels: [MessageChannel.COMBAT_LOG],
  },
};

/**
 * getEventRouting — safe lookup into COMBAT_EVENT_ROUTING.
 * Falls back to the UNKNOWN row when a caller hands over a value that is not in the enum
 * (persisted saves from an older build, for example), so routing never throws.
 */
export function getEventRouting(eventClass: CombatEventClass | undefined): CombatEventRouting {
  return COMBAT_EVENT_ROUTING[eventClass as CombatEventClass] ?? COMBAT_EVENT_ROUTING[CombatEventClass.UNKNOWN];
}

// -----------------------------------------------------------------------------
// STATUS DISCRIMINATORS (agora-6acd)
// -----------------------------------------------------------------------------

/**
 * StatusEffectKind — the buff/debuff discriminator carried by the domain status record.
 *
 * This union is a deliberate MIRROR of `StatusEffect['type']` in types/combat.ts, not an
 * import of it. types/combat.ts states in a comment that combatMessages.ts imports nothing,
 * so importing back would make that comment false; instead the adapter, which already reads
 * both modules, holds a compile-time guard that fails if the two unions ever drift apart.
 */
export type StatusEffectKind = 'buff' | 'debuff' | 'neutral' | 'dot' | 'hot';

/**
 * StatusDiscriminator — what one status kind means to the messaging system.
 *
 * `eventClass` is the routing key (BUFF and DEBUFF finally have a producer), and
 * `statusType` is the field StatusMessageData exposes to the log UI. They are declared
 * together so a reader can never end up labelled a debuff while it routes as a buff.
 */
export interface StatusDiscriminator {
  eventClass: CombatEventClass;
  statusType: StatusMessageData['statusType'];
}

/**
 * STATUS_KIND_DISCRIMINATORS — the one table that turns a status kind into a class.
 *
 * WHY dot AND hot COLLAPSE: a damage-over-time effect is a harmful status and a heal-over-time
 * effect is a beneficial one. They are separate domain kinds because the engine ticks them
 * differently, but to the player-facing log they read as a debuff and a buff respectively.
 *
 * WHY neutral IS NOT BUFF OR DEBUFF: `neutral` is the domain saying it does not know or does
 * not care. Mapping it to STATUS_CHANGE keeps the behavior every status record had before
 * this table existed, so nothing is guessed in the one case where the answer is absent.
 */
export const STATUS_KIND_DISCRIMINATORS: Record<StatusEffectKind, StatusDiscriminator> = {
  buff: { eventClass: CombatEventClass.BUFF, statusType: 'buff' },
  hot: { eventClass: CombatEventClass.BUFF, statusType: 'buff' },
  debuff: { eventClass: CombatEventClass.DEBUFF, statusType: 'debuff' },
  dot: { eventClass: CombatEventClass.DEBUFF, statusType: 'debuff' },
  neutral: { eventClass: CombatEventClass.STATUS_CHANGE, statusType: 'condition' },
};

/**
 * getStatusDiscriminator — safe lookup into STATUS_KIND_DISCRIMINATORS.
 *
 * Returns undefined when the caller has no kind to offer, or hands over a value outside the
 * union (a persisted save from an older build). Undefined means "no discriminator was found",
 * which callers must treat as a plain STATUS_CHANGE rather than picking a side.
 */
export function getStatusDiscriminator(
  kind: StatusEffectKind | undefined,
): StatusDiscriminator | undefined {
  if (kind === undefined) return undefined;
  return STATUS_KIND_DISCRIMINATORS[kind];
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
  /** Typed event class this message came from (CMB-GAP-003). Undefined on legacy messages. */
  eventClass?: CombatEventClass;
  
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
  soundCue?: string;          // Audio identifier (AUDIO_CUE channel payload)
  visualEffect?: string;      // Named effect identifier (VISUAL_EFFECT channel payload)
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
  isResisted?: boolean;
  isVulnerable?: boolean;
  isImmune?: boolean;
  immunityApplied?: boolean;
  resistedDamageType?: string;
  vulnerableDamageType?: string;
  immuneDamageType?: string;
  defenseTags?: string[];
  defenseMultiplier?: number;
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