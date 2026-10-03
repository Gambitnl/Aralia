/**
 * ARCHITECTURAL CONTEXT:
 * This factory creates 'Rich Combat Messages'. It translates mechanical 
 * events (like damage, kills, or spells) into human-readable notifications 
 * and log entries.
 *
 * Recent updates focus on 'Dead Code Pruning'. The `formatTemplate` helper 
 * was removed as the factory moved towards direct template literals for 
 * string construction, which is more performant and type-safe in the 
 * current TypeScript environment. 
 * 
 * @file src/utils/combat/messageFactory.ts
 */

import {
  CombatEventClass,
  CombatMessageType,
  MessagePriority,
  MessageChannel,
  getEventRouting,
} from '../../types/combatMessages';
import type {
  CombatMessage,
  DamageMessageData,
  StatusMessageData,
  AbilityMessageData,
  AchievementMessageData,
} from '../../types/combatMessages';
import type { CombatCharacter } from '../../types/combat.js';

// --- Message Factory ---
// WHAT CHANGED: Removed formatTemplate helper.
// WHY IT CHANGED: The factory was updated to use standard ES6 Template 
// Literals instead of a custom regex-based template formatter. This 
// reduces runtime overhead and simplifies the codebase by removing 
// unused utility functions that were originally for a more dynamic 
// (but less type-safe) message system.

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getDuration(priority: MessagePriority): number {
  switch (priority) {
    case MessagePriority.LOW: return 3000;
    case MessagePriority.MEDIUM: return 4000;
    case MessagePriority.HIGH: return 6000;
    case MessagePriority.CRITICAL: return 8000;
    default: return 4000;
  }
}

function getCharacterName(character: CombatCharacter): string {
  return character.name || 'Unknown';
}

/**
 * NOTIFICATION_PRIORITY_FLOOR — how loud an event must be to interrupt the player.
 *
 * The NOTIFICATION channel is listed on plenty of routine events (ordinary damage, a status
 * being applied) because those events ARE notification-worthy in a summary sense. Turning
 * every one of them into a toast would bury the screen during a normal round, so the toast
 * consumer additionally requires HIGH or CRITICAL priority: critical hits, killing blows,
 * death saves, combat start/end and level ups.
 */
export const NOTIFICATION_PRIORITY_FLOOR: MessagePriority[] = [
  MessagePriority.HIGH,
  MessagePriority.CRITICAL,
];

export interface CombatNotificationDraft {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration: number;
}

/**
 * toNotificationDraft — turns a CombatMessage into an ADD_NOTIFICATION payload, or null.
 *
 * WHAT CHANGED (2026-09-09, CMB-GAP-004/005): before this, MessageChannel.NOTIFICATION was
 * stored on messages and never read by anything. This is the translation step that lets the
 * existing toast surface (state.notifications -> components/ui/NotificationSystem.tsx) act as
 * that channel's consumer, without inventing a second notification system.
 *
 * Returns null when the message does not carry the channel or is below the priority floor,
 * so callers can treat "no notification" as a normal outcome rather than an error.
 */
export function toNotificationDraft(message: CombatMessage): CombatNotificationDraft | null {
  if (!message.channels?.includes(MessageChannel.NOTIFICATION)) return null;
  if (!NOTIFICATION_PRIORITY_FLOOR.includes(message.priority)) return null;

  // Toast severity is a reading of tone, not of success: a killing blow or a critical hit is
  // loud regardless of who landed it, and the log entry text already names the participants.
  let type: CombatNotificationDraft['type'] = 'info';
  if (
    message.type === CombatMessageType.CRITICAL_HIT ||
    message.type === CombatMessageType.KILLING_BLOW
  ) {
    type = 'warning';
  } else if (
    message.type === CombatMessageType.LEVEL_UP ||
    message.type === CombatMessageType.MILESTONE_ACHIEVED
  ) {
    type = 'success';
  }

  return {
    message: message.description || message.title,
    type,
    duration: message.duration ?? getDuration(message.priority),
  };
}

// Message Creation Functions

export function createDamageMessage(params: {
  source: CombatCharacter;
  target: CombatCharacter;
  damage: number;
  damageType: string;
  isCritical?: boolean;
  weaponName?: string;
  spellName?: string;
  isResisted?: boolean;
  resistanceApplied?: boolean;
  isVulnerable?: boolean;
  vulnerabilityApplied?: boolean;
  isImmune?: boolean;
  immunityApplied?: boolean;
  defenseTags?: string[];
  defenseMultiplier?: number;
}): CombatMessage {
  const {
    source,
    target,
    damage,
    damageType,
    isCritical = false,
    weaponName,
    spellName,
    isResisted = false,
    resistanceApplied = isResisted,
    isVulnerable = false,
    vulnerabilityApplied = isVulnerable,
    isImmune = false,
    immunityApplied = isImmune,
    defenseTags,
    defenseMultiplier,
  } = params;
  
  const messageType = isImmune
    ? CombatMessageType.SPELL_IMMUNE
    : isCritical
      ? CombatMessageType.CRITICAL_HIT
      : CombatMessageType.DAMAGE_DEALT;

  const tagText = defenseTags?.length ? ` ${defenseTags.join(' ')}` : '';
  
  const variables = {
    source: getCharacterName(source),
    target: getCharacterName(target),
    value: damage.toString(),
    damageType,
    critText: isCritical ? ' (Critical!)' : '',
    weapon: weaponName || '',
    spell: spellName || ''
  };
  
  const title = isImmune
    ? `${variables.target} is immune!`
    : isCritical
      ? 'Critical Hit!'
      : `${variables.source} hits ${variables.target}`;

  const description = isImmune
    ? `${variables.target} is immune to ${variables.damageType} damage from ${variables.source}!${tagText}`
    : isCritical 
      ? `${variables.source} lands a devastating critical hit on ${variables.target} for ${variables.value} damage!${tagText}`
      : `${variables.source} deals ${variables.value} ${variables.damageType} damage to ${variables.target}${variables.critText}${tagText}`;
  
  const data: DamageMessageData = {
    rawValue: damage,
    formattedValue: `${damage} ${damageType}`,
    damageType,
    isCritical,
    isSneakAttack: false,
    weaponName,
    spellName,
    resistanceApplied,
    vulnerabilityApplied,
    isResisted,
    isVulnerable,
    isImmune,
    immunityApplied,
    defenseTags,
    defenseMultiplier,
  };
  
  // WHAT CHANGED (2026-09-09, CMB-GAP-004): channels and channel payloads now come from the
  // shared routing table so the factory and combatLogToMessageAdapter cannot drift apart.
  // The presentation type is still computed above, because SPELL_IMMUNE is a factory-only
  // refinement that the log-entry path has no way to express.
  const routing = getEventRouting(isCritical ? CombatEventClass.CRITICAL_DAMAGE : CombatEventClass.DAMAGE);

  return {
    id: generateId(),
    type: messageType,
    eventClass: isCritical ? CombatEventClass.CRITICAL_DAMAGE : CombatEventClass.DAMAGE,
    priority: routing.priority,
    timestamp: Date.now(),
    channels: routing.channels,
    visualEffect: routing.visualEffect,
    soundCue: routing.soundCue,
    title,
    description,
    sourceEntityId: source.id,
    targetEntityId: target.id,
    data,
    duration: getDuration(isCritical ? MessagePriority.HIGH : MessagePriority.MEDIUM)
  };
}

export function createKillMessage(params: {
  killer: CombatCharacter;
  victim: CombatCharacter;
}): CombatMessage {
  const { killer, victim } = params;
  
  const variables = {
    killer: getCharacterName(killer),
    victim: getCharacterName(victim)
  };
  
  const routing = getEventRouting(CombatEventClass.KILL);

  return {
    id: generateId(),
    type: routing.type,
    eventClass: CombatEventClass.KILL,
    priority: routing.priority,
    timestamp: Date.now(),
    channels: routing.channels,
    visualEffect: routing.visualEffect,
    soundCue: routing.soundCue,
    title: `${variables.victim} defeated!`,
    description: `${variables.killer} delivers the killing blow to ${variables.victim}!`,
    sourceEntityId: killer.id,
    targetEntityId: victim.id,
    data: {
      rawValue: 'kill',
      formattedValue: 'defeated'
    },
    duration: getDuration(MessagePriority.HIGH)
  };
}

export function createMissMessage(params: {
  attacker: CombatCharacter;
  defender: CombatCharacter;
}): CombatMessage {
  const { attacker, defender } = params;
  
  const variables = {
    attacker: getCharacterName(attacker),
    defender: getCharacterName(defender)
  };
  
  const routing = getEventRouting(CombatEventClass.MISS);

  return {
    id: generateId(),
    type: routing.type,
    eventClass: CombatEventClass.MISS,
    priority: routing.priority,
    timestamp: Date.now(),
    channels: routing.channels,
    title: `${variables.attacker} misses`,
    description: `${variables.attacker}'s attack misses ${variables.defender}`,
    sourceEntityId: attacker.id,
    targetEntityId: defender.id,
    data: {
      rawValue: 'miss',
      formattedValue: 'missed'
    },
    duration: getDuration(MessagePriority.LOW)
  };
}

export function createSpellMessage(params: {
  caster: CombatCharacter;
  target: CombatCharacter;
  spellName: string;
  success?: boolean;
}): CombatMessage {
  const { caster, target, spellName, success = true } = params;
  const messageType = success ? CombatMessageType.SPELL_CAST : CombatMessageType.SPELL_RESISTED;
  
  const variables = {
    caster: getCharacterName(caster),
    target: getCharacterName(target),
    spell: spellName
  };
  
  const title = success 
    ? `${variables.caster} casts ${variables.spell}`
    : `${variables.target} resists ${variables.spell}`;
    
  const description = success
    ? `${variables.caster} casts ${variables.spell} on ${variables.target}`
    : `${variables.target} successfully resists ${variables.caster}'s ${variables.spell}`;
  
  const eventClass = success ? CombatEventClass.SPELL_CAST : CombatEventClass.STATUS_RESIST;
  const routing = getEventRouting(eventClass);

  return {
    id: generateId(),
    type: messageType,
    eventClass,
    priority: routing.priority,
    timestamp: Date.now(),
    channels: routing.channels,
    title,
    description,
    sourceEntityId: caster.id,
    targetEntityId: target.id,
    data: {
      rawValue: spellName,
      formattedValue: spellName,
      abilityName: spellName,
      abilityType: 'spell',
      targetType: 'single'
    } as AbilityMessageData,
    duration: getDuration(MessagePriority.MEDIUM)
  };
}

export function createStatusMessage(params: {
  target: CombatCharacter;
  statusName: string;
  statusType: 'buff' | 'debuff' | 'condition';
  duration?: number;
}): CombatMessage {
  const { target, statusName, statusType, duration } = params;
  
  const variables = {
    target: getCharacterName(target),
    status: statusName,
    durationText: duration ? ` for ${duration} rounds` : ''
  };
  
  // statusType is already known here, so a buff/debuff can be stated instead of guessed.
  const eventClass =
    statusType === 'buff'
      ? CombatEventClass.BUFF
      : statusType === 'debuff'
        ? CombatEventClass.DEBUFF
        : CombatEventClass.STATUS_CHANGE;
  const routing = getEventRouting(eventClass);

  return {
    id: generateId(),
    type: routing.type,
    eventClass,
    priority: routing.priority,
    timestamp: Date.now(),
    channels: routing.channels,
    visualEffect: routing.visualEffect,
    title: `${variables.status} applied`,
    description: `${variables.target} is affected by ${variables.status}${variables.durationText}`,
    targetEntityId: target.id,
    data: {
      rawValue: statusName,
      formattedValue: statusName,
      statusName,
      statusType,
      duration,
      stacks: undefined,
      isResisted: false
    } as StatusMessageData,
    duration: getDuration(MessagePriority.MEDIUM)
  };
}

export function createLevelUpMessage(params: {
  character: CombatCharacter;
  newLevel: number;
}): CombatMessage {
  const { character, newLevel } = params;
  
  const variables = {
    character: getCharacterName(character),
    level: newLevel.toString()
  };
  
  const routing = getEventRouting(CombatEventClass.LEVEL_UP);

  return {
    id: generateId(),
    type: routing.type,
    eventClass: CombatEventClass.LEVEL_UP,
    priority: routing.priority,
    timestamp: Date.now(),
    channels: routing.channels,
    visualEffect: routing.visualEffect,
    soundCue: routing.soundCue,
    title: `${variables.character} leveled up!`,
    description: `${variables.character} reaches level ${variables.level}!`,
    sourceEntityId: character.id,
    data: {
      rawValue: newLevel,
      formattedValue: `Level ${newLevel}`,
      achievementType: 'milestone'
    } as AchievementMessageData,
    duration: getDuration(MessagePriority.CRITICAL),
    isSticky: true
  };
}

// Utility Functions

export function getMessageColor(messageType: CombatMessageType): string {
  switch (messageType) {
    case CombatMessageType.DAMAGE_DEALT:
    case CombatMessageType.CRITICAL_HIT:
      return 'text-red-400';
    case CombatMessageType.HEALING_RECEIVED:
      return 'text-green-400';
    case CombatMessageType.STATUS_APPLIED:
      return 'text-purple-400';
    case CombatMessageType.ABILITY_USED:
    case CombatMessageType.SPELL_CAST:
      return 'text-blue-400';
    case CombatMessageType.KILLING_BLOW:
      return 'text-yellow-400';
    case CombatMessageType.LEVEL_UP:
      return 'text-amber-400';
    default:
      return 'text-gray-300';
  }
}
