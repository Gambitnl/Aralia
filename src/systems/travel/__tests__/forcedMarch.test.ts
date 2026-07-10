/**
 * @file forcedMarch.test.ts — travel G1 proof.
 *
 * Covers the two halves of forced-march exhaustion:
 *  1. The THRESHOLD/DC path (calculateForcedMarchStatus): a ~9-hour day triggers
 *     the DC 11 forced-march save; a normal 8-hour day does not; the 8<h<9 gap
 *     is a forced march with no completed hour yet, so no save fires.
 *  2. The APPLY path (resolveForcedMarch): each member rolls a Constitution save
 *     vs the DC (deterministic here via an injected d20), and failing members are
 *     flagged so App can apply the party 'exhaustion' condition.
 */
import { describe, it, expect } from 'vitest';
import { calculateForcedMarchStatus } from '../TravelCalculations';
import { resolveForcedMarch } from '../forcedMarch';
import type { PlayerCharacter } from '../../../types/character';

/** Minimal party member for the Con-save resolver (only fields it reads). */
function member(opts: {
  id: string;
  name: string;
  con: number;
  level?: number;
  conSaveProficient?: boolean;
}): PlayerCharacter {
  return {
    id: opts.id,
    name: opts.name,
    level: opts.level ?? 1,
    finalAbilityScores: { Constitution: opts.con } as unknown as PlayerCharacter['finalAbilityScores'],
    savingThrowProficiencies: opts.conSaveProficient ? (['Constitution'] as unknown as PlayerCharacter['savingThrowProficiencies']) : [],
  } as unknown as PlayerCharacter;
}

describe('calculateForcedMarchStatus — threshold + DC (travel G1 proof)', () => {
  it('a ~9-hour day is a forced march at DC 11', () => {
    const status = calculateForcedMarchStatus(9);
    expect(status.isForcedMarch).toBe(true);
    expect(status.constitutionSaveDC).toBe(11);
  });

  it('a normal 8-hour day is NOT a forced march and carries no save', () => {
    const status = calculateForcedMarchStatus(8);
    expect(status.isForcedMarch).toBe(false);
    expect(status.constitutionSaveDC).toBe(0);
  });

  it('the DC scales +1 per full hour past the safe day (10h → DC 12)', () => {
    expect(calculateForcedMarchStatus(10).constitutionSaveDC).toBe(12);
  });

  it('between 8 and 9 hours the 9th hour is unfinished — forced march, but no save yet', () => {
    const status = calculateForcedMarchStatus(8.5);
    expect(status.isForcedMarch).toBe(true);
    expect(status.constitutionSaveDC).toBe(0); // deriveForcedMarch omits the meta here → short trips unaffected
  });
});

describe('resolveForcedMarch — per-member Constitution saves (apply path)', () => {
  const party = [
    member({ id: 'a', name: 'Alia', con: 10 }),   // +0 mod
    member({ id: 'b', name: 'Borin', con: 16 }),  // +3 mod
  ];

  it('flags a member who fails the save and applies exhaustion (deterministic low roll)', () => {
    // Everyone rolls a 5. Alia: 5+0=5 < 11 → fail. Borin: 5+3=8 < 11 → fail.
    const outcome = resolveForcedMarch(party, 11, () => 5);
    expect(outcome.anyFailed).toBe(true);
    expect(outcome.failedNames).toEqual(['Alia', 'Borin']);
    expect(outcome.results.every((r) => r.failed)).toBe(true);
  });

  it('a member who beats the DC does not grow exhausted', () => {
    // Everyone rolls 18. Alia: 18+0=18 ≥ 11 → pass. Borin: 18+3=21 → pass.
    const outcome = resolveForcedMarch(party, 11, () => 18);
    expect(outcome.anyFailed).toBe(false);
    expect(outcome.failedNames).toEqual([]);
  });

  it('resolves each member independently — mixed pass/fail', () => {
    // Sequence: Alia rolls 3 (3+0=3 → fail), Borin rolls 12 (12+3=15 → pass).
    const rolls = [3, 12];
    let i = 0;
    const outcome = resolveForcedMarch(party, 11, () => rolls[i++]);
    expect(outcome.anyFailed).toBe(true);
    expect(outcome.failedNames).toEqual(['Alia']);
    expect(outcome.results[1].failed).toBe(false);
  });

  it('adds proficiency bonus for a Con-save-proficient member', () => {
    // Level 5 (prof +3), Con 10 (+0), rolls 8 → 8+0+3=11 ≥ 11 → passes on the bonus.
    const prof = [member({ id: 'c', name: 'Cade', con: 10, level: 5, conSaveProficient: true })];
    const outcome = resolveForcedMarch(prof, 11, () => 8);
    expect(outcome.results[0].total).toBe(11);
    expect(outcome.anyFailed).toBe(false);
  });
});
