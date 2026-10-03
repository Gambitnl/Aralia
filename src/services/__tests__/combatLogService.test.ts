/**
 * @file src/services/__tests__/combatLogService.test.ts
 *
 * Unit tests for CombatLogService: channel classification, channel filtering,
 * defense breakdown calculations, tag formatting, and tag parsing.
 */

import { describe, expect, it } from 'vitest';
import {
  CombatLogService,
  formatResistanceTag,
  formatVulnerabilityTag,
  formatImmunityTag,
  calculateDefenseBreakdown,
  parseDefenseTags,
  tokenizeMessageWithTags,
  classifyLogEntryChannel,
  classifyMessageChannel,
  filterLogEntriesByChannel,
  filterMessagesByChannel,
  getChannelCounts,
} from '../combatLogService';
import type { CombatCharacter, CombatLogEntry } from '../../types/combat';
import { CombatMessageType, MessagePriority, MessageChannel, type CombatMessage } from '../../types/combatMessages';

const baseTarget: CombatCharacter = {
  id: 'target-1',
  name: 'Goblin Defender',
  currentHP: 30,
  maxHP: 30,
  position: { x: 2, y: 2 },
  team: 'enemy',
} as CombatCharacter;

describe('CombatLogService - Defense Tag Formatting & Parsing', () => {
  it('formats structured resistance, vulnerability, and immunity tags', () => {
    expect(formatResistanceTag('fire', -50)).toBe('[Resisted: Fire (-50%)]');
    expect(formatVulnerabilityTag('radiant', 100)).toBe('[Vulnerable: Radiant (+100%)]');
    expect(formatImmunityTag('poison')).toBe('[Immune: Poison]');
  });

  it('parses defense tags from combat message strings', () => {
    const text = 'Aeliana deals 15 Fire damage to Goblin [Resisted: Fire (-50%)] [Crit]';
    const parsed = parseDefenseTags(text);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      tag: '[Resisted: Fire (-50%)]',
      kind: 'resisted',
      damageType: 'Fire',
      percentDelta: -50,
    });
    expect(parsed[1]).toMatchObject({
      tag: '[Crit]',
      kind: 'crit',
    });
  });

  it('tokenizes message text into text segments and badge tokens', () => {
    const text = 'Target takes 20 radiant damage [Vulnerable: Radiant (+100%)] from Sunbeam.';
    const tokens = tokenizeMessageWithTags(text);

    expect(tokens).toHaveLength(3);
    expect(tokens[0]).toEqual({
      text: 'Target takes 20 radiant damage ',
      isTag: false,
    });
    expect(tokens[1]).toMatchObject({
      text: '[Vulnerable: Radiant (+100%)]',
      isTag: true,
      tagInfo: {
        kind: 'vulnerable',
        damageType: 'Radiant',
        percentDelta: 100,
      },
    });
    expect(tokens[2]).toEqual({
      text: ' from Sunbeam.',
      isTag: false,
    });
  });
});

describe('CombatLogService - Defense Breakdown Calculation', () => {
  it('calculates resistance and attaches [Resisted: ...] tag', () => {
    const resistantTarget: CombatCharacter = {
      ...baseTarget,
      resistances: ['fire'],
    };

    const breakdown = calculateDefenseBreakdown(20, 'fire', resistantTarget);

    expect(breakdown.finalDamage).toBe(10);
    expect(breakdown.isResistant).toBe(true);
    expect(breakdown.effectiveResistance).toBe(true);
    expect(breakdown.tags).toContain('[Resisted: Fire (-50%)]');
  });

  it('calculates vulnerability and attaches [Vulnerable: ...] tag', () => {
    const vulnerableTarget: CombatCharacter = {
      ...baseTarget,
      vulnerabilities: ['radiant'],
    };

    const breakdown = calculateDefenseBreakdown(15, 'radiant', vulnerableTarget);

    expect(breakdown.finalDamage).toBe(30);
    expect(breakdown.isVulnerable).toBe(true);
    expect(breakdown.tags).toContain('[Vulnerable: Radiant (+100%)]');
  });

  it('calculates immunity and attaches [Immune: ...] tag with 0 final damage', () => {
    const immuneTarget: CombatCharacter = {
      ...baseTarget,
      immunities: ['poison'],
    };

    const breakdown = calculateDefenseBreakdown(50, 'poison', immuneTarget);

    expect(breakdown.finalDamage).toBe(0);
    expect(breakdown.isImmune).toBe(true);
    expect(breakdown.tags).toContain('[Immune: Poison]');
  });

  it('handles Elemental Adept feat bypassing resistance', () => {
    const resistantTarget: CombatCharacter = {
      ...baseTarget,
      resistances: ['fire'],
    };
    const adeptCaster: CombatCharacter = {
      id: 'caster-1',
      name: 'Pyromancer',
      featChoices: [{ featId: 'elemental_adept', selection: { selectedDamageType: 'fire' } }],
    } as unknown as CombatCharacter;

    const breakdown = calculateDefenseBreakdown(20, 'fire', resistantTarget, adeptCaster);

    expect(breakdown.finalDamage).toBe(20);
    expect(breakdown.ignoresResistance).toBe(true);
    expect(breakdown.effectiveResistance).toBe(false);
    expect(breakdown.tags).toHaveLength(0);
  });
});

describe('CombatLogService - Channel Classification and Filtering', () => {
  const entries: CombatLogEntry[] = [
    {
      id: '1',
      timestamp: 1,
      type: 'damage',
      message: 'Kaelen strikes Goblin for 12 slashing damage [Resisted: Slashing (-50%)].',
    },
    {
      id: '2',
      timestamp: 2,
      type: 'heal',
      message: 'Aeliana casts Cure Wounds and heals Kaelen for 8 HP.',
    },
    {
      id: '3',
      timestamp: 3,
      type: 'status',
      message: 'Goblin is affected by Poisoned.',
    },
    {
      id: '4',
      timestamp: 4,
      type: 'summon',
      message: 'Aeliana conjures a Spirit Guardian.',
    },
    {
      id: '5',
      timestamp: 5,
      type: 'turn_start',
      message: 'Round 2 begins!',
    },
  ];

  it('classifies log entry channels accurately', () => {
    expect(classifyLogEntryChannel(entries[0])).toBe('damage');
    expect(classifyLogEntryChannel(entries[1])).toBe('healing');
    expect(classifyLogEntryChannel(entries[2])).toBe('conditions');
    expect(classifyLogEntryChannel(entries[3])).toBe('spells');
    expect(classifyLogEntryChannel(entries[4])).toBe('narrative/system');
  });

  it('filters log entries by channel', () => {
    expect(filterLogEntriesByChannel(entries, 'all')).toHaveLength(5);
    expect(filterLogEntriesByChannel(entries, 'damage')).toHaveLength(1);
    expect(filterLogEntriesByChannel(entries, 'healing')).toHaveLength(1);
    expect(filterLogEntriesByChannel(entries, 'conditions')).toHaveLength(1);
    expect(filterLogEntriesByChannel(entries, 'spells')).toHaveLength(1);
    expect(filterLogEntriesByChannel(entries, 'narrative/system')).toHaveLength(1);
  });

  it('classifies and filters rich combat messages', () => {
    const messages: CombatMessage[] = [
      {
        id: 'msg-1',
        type: CombatMessageType.DAMAGE_DEALT,
        priority: MessagePriority.MEDIUM,
        timestamp: 1,
        channels: [MessageChannel.COMBAT_LOG],
        title: 'Hit',
        description: 'Dealt 10 fire damage',
        data: { damageType: 'fire', isCritical: false, isSneakAttack: false },
      },
      {
        id: 'msg-2',
        type: CombatMessageType.HEALING_RECEIVED,
        priority: MessagePriority.MEDIUM,
        timestamp: 2,
        channels: [MessageChannel.COMBAT_LOG],
        title: 'Heal',
        description: 'Healed 6 HP',
        data: { healType: 'hit_points', isCritical: false },
      },
    ];

    expect(classifyMessageChannel(messages[0])).toBe('damage');
    expect(classifyMessageChannel(messages[1])).toBe('healing');
    expect(filterMessagesByChannel(messages, 'damage')).toHaveLength(1);
    expect(filterMessagesByChannel(messages, 'healing')).toHaveLength(1);
  });

  it('computes channel counts correctly', () => {
    const counts = getChannelCounts(entries);
    expect(counts.all).toBe(5);
    expect(counts.damage).toBe(1);
    expect(counts.healing).toBe(1);
    expect(counts.conditions).toBe(1);
    expect(counts.spells).toBe(1);
    expect(counts['narrative/system']).toBe(1);
  });
});

describe('CombatLogService - createDamageLogEntry', () => {
  it('creates an enriched combat log entry with structured defense metadata', () => {
    const resistantTarget: CombatCharacter = {
      ...baseTarget,
      resistances: ['fire'],
    };
    const caster: CombatCharacter = {
      id: 'caster-1',
      name: 'Fire Mage',
    } as CombatCharacter;

    const entry = CombatLogService.createDamageLogEntry({
      caster,
      target: resistantTarget,
      baseDamage: 24,
      damageType: 'fire',
      sourceName: 'Fireball',
      isCritical: false,
    });

    expect(entry.type).toBe('damage');
    expect(entry.message).toContain('takes 12 fire damage');
    expect(entry.message).toContain('[Resisted: Fire (-50%)]');
    expect(entry.data?.damageAmount).toBe(12);
    expect(entry.data?.isResisted).toBe(true);
    expect(entry.data?.resistanceApplied).toBe(true);
    expect(entry.data?.defenseTags).toContain('[Resisted: Fire (-50%)]');
  });
});
