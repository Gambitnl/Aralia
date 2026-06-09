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
});
