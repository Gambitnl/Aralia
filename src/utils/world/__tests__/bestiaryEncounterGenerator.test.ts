import { describe, it, expect } from 'vitest';
import { calculateDifficulty } from '../../combat/encounterDifficulty';
import { generateBestiaryEncounter } from '../bestiaryEncounterGenerator';

describe('bestiaryEncounterGenerator', () => {
  const party = [
    { id: 'w1', name: 'Rook', classId: 'fighter', level: 3 },
    { id: 'w2', name: 'Lark', classId: 'wizard', level: 3 },
  ];

  it('uses the same seed source to generate stable results', () => {
    const seed = 42;
    const options = { difficulty: 'Hard' as const, seed };

    const first = generateBestiaryEncounter(party, options);
    const second = generateBestiaryEncounter(party, options);

    expect(first).toEqual(second);
  });

  it('produces difficulty values that match the encounter difficulty contract', () => {
    const result = generateBestiaryEncounter(party, { difficulty: 'Medium', seed: 2026 });
    expect(result).not.toBeNull();

    const contract = calculateDifficulty(
      result!.monsters.map(monster => ({ cr: monster.cr, quantity: monster.quantity })),
      party.map(member => member.level),
    );
    expect(result!.tier).toBe(contract.tier);
    expect(result!.adjustedXp).toBe(contract.adjustedXp);
  });
});
