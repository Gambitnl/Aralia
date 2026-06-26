import { describe, expect, it } from 'vitest';
import { convertLogEntryToMessage } from '../combatLogToMessageAdapter';
import { CombatMessageType } from '../../../types/combatMessages';
import type { CombatCharacter, CombatLogEntry } from '../../../types/combat';

const characters = [
  { id: 'fighter', name: 'Fighter' },
  { id: 'goblin', name: 'Goblin' },
] as CombatCharacter[];

describe('convertLogEntryToMessage', () => {
  it('classifies critical opportunity attacks from structured log data', () => {
    const entry: CombatLogEntry = {
      id: 'oa-crit',
      timestamp: 1,
      type: 'action',
      message: 'Fighter hits Goblin with Opportunity Attack using Longsword! (20+5=25 vs AC 13)',
      characterId: 'fighter',
      targetIds: ['goblin'],
      data: { isHit: true, isCrit: true, rollResult: 20 },
    };

    const message = convertLogEntryToMessage(entry, characters);

    expect(message.type).toBe(CombatMessageType.CRITICAL_HIT);
    expect(message.sourceEntityId).toBe('fighter');
    expect(message.targetEntityId).toBe('goblin');
    expect(message.data).toMatchObject({ isCritical: true });
  });

  it('keeps missed opportunity attacks as misses when structured data says no hit', () => {
    const entry: CombatLogEntry = {
      id: 'oa-miss',
      timestamp: 2,
      type: 'action',
      message: 'Fighter misses Opportunity Attack against Goblin using Longsword. (3+5=8 vs AC 13)',
      characterId: 'fighter',
      targetIds: ['goblin'],
      data: { isHit: false, isCrit: false, rollResult: 3 },
    };

    const message = convertLogEntryToMessage(entry, characters);

    expect(message.type).toBe(CombatMessageType.MISSED_ATTACK);
    expect(message.data).toMatchObject({ rawValue: entry.message });
  });

  it('normalizes canonical and legacy damage amount fields into the rich damage payload', () => {
    const canonicalEntry: CombatLogEntry = {
      id: 'damage-canonical',
      timestamp: 3,
      type: 'damage',
      message: 'Goblin takes 7 fire damage from Fighter.',
      characterId: 'goblin',
      data: { damageAmount: 7, damageType: 'fire', source: 'Fighter' },
    };
    const legacyEntry: CombatLogEntry = {
      id: 'damage-legacy',
      timestamp: 4,
      type: 'damage',
      message: 'Goblin takes 5 cold damage from Fighter.',
      characterId: 'goblin',
      data: { damage: 5, damageType: 'cold', source: 'Fighter' },
    };

    const canonicalMessage = convertLogEntryToMessage(canonicalEntry, characters);
    const legacyMessage = convertLogEntryToMessage(legacyEntry, characters);

    expect(canonicalMessage.type).toBe(CombatMessageType.DAMAGE_DEALT);
    expect(canonicalMessage.sourceEntityId).toBe('fighter');
    expect(canonicalMessage.targetEntityId).toBe('goblin');
    expect(canonicalMessage.data).toMatchObject({
      rawValue: 7,
      formattedValue: '7 fire',
      damageType: 'fire',
    });
    expect(legacyMessage.data).toMatchObject({
      rawValue: 5,
      formattedValue: '5 cold',
      damageType: 'cold',
    });
  });

  it('normalizes canonical and legacy healing amount fields into the rich healing payload', () => {
    const canonicalEntry: CombatLogEntry = {
      id: 'heal-canonical',
      timestamp: 5,
      type: 'heal',
      message: 'Fighter recovers 6 HP from Cure Wounds.',
      characterId: 'fighter',
      data: { healAmount: 6, source: 'Cure Wounds' },
    };
    const legacyEntry: CombatLogEntry = {
      id: 'heal-legacy',
      timestamp: 6,
      type: 'heal',
      message: 'Fighter recovers 4 HP from Second Wind.',
      characterId: 'fighter',
      data: { heal: 4, source: 'Second Wind' },
    };

    const canonicalMessage = convertLogEntryToMessage(canonicalEntry, characters);
    const legacyMessage = convertLogEntryToMessage(legacyEntry, characters);

    expect(canonicalMessage.type).toBe(CombatMessageType.HEALING_RECEIVED);
    expect(canonicalMessage.data).toMatchObject({
      rawValue: 6,
      formattedValue: '6 HP',
      spellName: 'Cure Wounds',
    });
    expect(legacyMessage.data).toMatchObject({
      rawValue: 4,
      formattedValue: '4 HP',
      spellName: 'Second Wind',
    });
  });
});
