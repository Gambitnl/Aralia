/**
 * This file tests the bestiary encounter generator, which picks monsters from the game's
 * bestiary to build balanced combat encounters for the player's party.
 *
 * It verifies that given a random seed and a difficulty target, the generator always
 * builds the exact same encounter (deterministic seeding) and that the resulting
 * monster group matches the expected challenge rating and XP difficulty contract.
 *
 * Called by: Vitest test runner
 * Depends on: generateBestiaryEncounter, calculateDifficulty, loadMonstersData
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { calculateDifficulty } from '../../combat/encounterDifficulty';
import { generateBestiaryEncounter } from '../bestiaryEncounterGenerator';
import { loadMonstersData } from '../../../data/monsters';

// ============================================================================
// Bestiary Encounter Generator Suite
// ============================================================================
// Loads the generated monster dataset once before running encounter generation
// checks against a sample two-character party.
// ============================================================================

describe('bestiaryEncounterGenerator', () => {
  // The generated bestiary module (monsters.generated.ts, ~12.3 MB) takes ~21s to transform
  // and import on first load in Vitest, exceeding the default 10s hook timeout. Matching
  // monsterId.test.ts and geminiServiceFallback.test.ts, we grant a 60s timeout for priming.
  beforeAll(async () => {
    await loadMonstersData();
  }, 60_000);

  // Sample party of two level-3 characters used to budget encounter XP.
  const party = [
    { id: 'w1', name: 'Rook', classId: 'fighter', level: 3 },
    { id: 'w2', name: 'Lark', classId: 'wizard', level: 3 },
  ];

  // Verify that running the generator twice with the same seed produces identical encounters.
  it('uses the same seed source to generate stable results', () => {
    const seed = 42;
    const options = { difficulty: 'Hard' as const, seed };

    const first = generateBestiaryEncounter(party, options);
    const second = generateBestiaryEncounter(party, options);

    expect(first).toEqual(second);
  });

  // Verify that the generated encounter's difficulty tier and adjusted XP match the combat calculator.
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
