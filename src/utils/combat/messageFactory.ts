/**
 * Combat Message Factory
 * 
 * Utility functions for creating consistent, rich combat messages.
 */

import {
  CombatMessageType,
  MessagePriority,
  MessageChannel,
} from '../../types/combatMessages';
import type {
  CombatMessage,
  DamageMessageData,
  StatusMessageData,
  AbilityMessageData,
  AchievementMessageData,
} from '../../types/combatMessages';
import type { CombatCharacter } from '../../types/combat';

// Helper functions
function formatTemplate(template: string, variables: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return variables[key]?.toString() || match;
  });
}

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

// Message Creation Functions

export function createDamageMessage(params: {
  source: CombatCharacter;
  target: CombatCharacter;
  damage: number;
  damageType: string;
  isCritical?: boolean;
  weaponName?: string;
  spellName?: string;
}): CombatMessage {
  const { source, target, damage, damageType, isCritical = false, weaponName, spellName } = params;
  
  const messageType = isCritical ? CombatMessageType.CRITICAL_HIT : CombatMessageType.DAMAGE_DEALT;
  
  const variables = {
    source: getCharacterName(source),
    target: getCharacterName(target),
    value: damage.toString(),
    damageType,
    critText: isCritical ? ' (Critical!)' : '',
    weapon: weaponName || '',
    spell: spellName || ''
  };
  
  const title = isCritical ? 'Critical Hit!' : `${variables.source} hits ${variables.target}`;
  const description = isCritical 
    ? `${variables.source} lands a devastating critical hit on ${variables.target} for ${variables.value} damage!`
    : `${variables.source} deals ${variables.value} ${variables.damageType} damage to ${variables.target}${variables.critText}`;
  
  const data: DamageMessageData = {
    rawValue: damage,
    formattedValue: `${damage} ${damageType}`,
    damageType,
    isCritical,
    isSneakAttack: false,
    weaponName,
    spellName,
    resistanceApplied: false,
    vulnerabilityApplied: false
  };
  
  return {
    id: generateId(),
    type: messageType,
    priority: isCritical ? MessagePriority.HIGH : MessagePriority.MEDIUM,
    timestamp: Date.now(),
    channels: [
      MessageChannel.COMBAT_LOG,
      ...(isCritical ? [MessageChannel.NOTIFICATION, MessageChannel.VISUAL_EFFECT] : [MessageChannel.NOTIFICATION])
    ],
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
  
  return {
    id: generateId(),
    type: CombatMessageType.KILLING_BLOW,
    priority: MessagePriority.HIGH,
    timestamp: Date.now(),
    channels: [MessageChannel.COMBAT_LOG, MessageChannel.NOTIFICATION, MessageChannel.VISUAL_EFFECT],
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
  
  return {
    id: generateId(),
    type: CombatMessageType.MISSED_ATTACK,
    priority: MessagePriority.LOW,
    timestamp: Date.now(),
    channels: [MessageChannel.COMBAT_LOG],
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
  
  return {
    id: generateId(),
    type: messageType,
    priority: MessagePriority.MEDIUM,
    timestamp: Date.now(),
    channels: [MessageChannel.COMBAT_LOG, ...(success ? [MessageChannel.NOTIFICATION] : [])],
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
  
  return {
    id: generateId(),
    type: CombatMessageType.STATUS_APPLIED,
    priority: MessagePriority.MEDIUM,
    timestamp: Date.now(),
    channels: [MessageChannel.COMBAT_LOG, MessageChannel.NOTIFICATION],
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
  
  return {
    id: generateId(),
    type: CombatMessageType.LEVEL_UP,
    priority: MessagePriority.CRITICAL,
    timestamp: Date.now(),
    channels: [MessageChannel.COMBAT_LOG, MessageChannel.NOTIFICATION, MessageChannel.VISUAL_EFFECT, MessageChannel.AUDIO_CUE],
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
