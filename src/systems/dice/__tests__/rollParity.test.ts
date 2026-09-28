/**
 * @file rollParity.test.ts
 * Pins the retired combatUtils roller arithmetic onto the roll contract.
 *
 * agora-f821.2 required `RollSpec` to grow `isCritical` and `minRoll` so damage
 * rolls could migrate off `combatUtils.rollDamage`. The migration is only safe
 * if the contract produces the SAME number the retired roller produced from the
 * same random stream, otherwise every weapon in the game quietly changes.
 *
 * `legacyRollDamage` below is the retired implementation, copied verbatim from
 * `src/utils/combat/combatUtils.ts` as it stood before agora-f821.4 deleted it.
 * It is the reference, not a re-export, so this test keeps pinning the old
 * behaviour after the original is gone.
 */

import { describe, it, expect } from 'vitest';
import { SeededRandom } from '../../../utils/random/seededRandom';
import { executeRollWithSource, executeRoll, DiceAuditLog } from '../rollContract';

type DiceRandomSource = () => number;

/** The retired `rollDieGroup` from combatUtils, verbatim. */
function legacyRollDieGroup(
  count: number,
  sides: number,
  minRoll: number,
  random: DiceRandomSource
): number {
  let subTotal = 0;
  for (let i = 0; i < count; i++) {
    let roll = Math.floor(random() * sides) + 1;
    if (roll < minRoll) roll = minRoll;
    subTotal += roll;
  }
  return subTotal;
}

/** The retired `rollDamage` from combatUtils, verbatim. */
function legacyRollDamage(
  diceString: string,
  isCritical: boolean,
  minRoll: number,
  random: DiceRandomSource
): number {
  if (!diceString || diceString === '0') return 0;
  const formula = diceString.replace(/\s+/g, '');
  const regex = /([+-]?)(?:(\d+)d(\d+)|(\d+))/g;
  let total = 0;
  let match;
  while ((match = regex.exec(formula)) !== null) {
    if (match.index === regex.lastIndex) regex.lastIndex++;
    const sign = match[1] === '-' ? -1 : 1;
    if (match[2] && match[3]) {
      const numDice = parseInt(match[2], 10);
      const dieSize = parseInt(match[3], 10);
      const actualNumDice = isCritical ? numDice * 2 : numDice;
      total += sign * legacyRollDieGroup(actualNumDice, dieSize, minRoll, random);
    } else if (match[4]) {
      total += sign * parseInt(match[4], 10);
    }
  }
  return total;
}

/** The retired `rollD20` from combatUtils, verbatim. */
function legacyRollD20(options: {
  advantage?: boolean;
  disadvantage?: boolean;
  rng: DiceRandomSource;
}): number {
  const { advantage, disadvantage, rng } = options;
  const roll1 = Math.floor(rng() * 20) + 1;
  if (!advantage && !disadvantage) return roll1;
  if (advantage && !disadvantage) return Math.max(roll1, Math.floor(rng() * 20) + 1);
  if (disadvantage && !advantage) return Math.min(roll1, Math.floor(rng() * 20) + 1);
  return roll1;
}

const FORMULA_CORPUS = [
  '1d4',
  '2d6',
  '2d6+3',
  '3d8-2',
  '1d8 + 1d6 + 2',
  '10d10',
  '1d12+1d4+1d4-1',
  '4',
  '0',
  '',
];

describe('roll contract parity with the retired combatUtils rollers', () => {
  it.each(FORMULA_CORPUS)('matches legacy rollDamage for "%s" (normal hit)', formula => {
    const a = new SeededRandom(12345);
    const b = new SeededRandom(12345);
    const legacy = legacyRollDamage(formula, false, 1, () => a.next());
    const contract = executeRollWithSource({ notation: formula }, () => b.next());
    expect(contract.total).toBe(legacy);
  });

  it.each(FORMULA_CORPUS)('matches legacy rollDamage for "%s" (critical hit)', formula => {
    const a = new SeededRandom(777);
    const b = new SeededRandom(777);
    const legacy = legacyRollDamage(formula, true, 1, () => a.next());
    const contract = executeRollWithSource({ notation: formula, isCritical: true }, () => b.next());
    expect(contract.total).toBe(legacy);
  });

  it.each([2, 3, 5])('matches legacy rollDamage with minRoll %i', minRoll => {
    for (const formula of FORMULA_CORPUS) {
      const a = new SeededRandom(2026);
      const b = new SeededRandom(2026);
      const legacy = legacyRollDamage(formula, false, minRoll, () => a.next());
      const contract = executeRollWithSource({ notation: formula, minRoll }, () => b.next());
      expect(contract.total).toBe(legacy);
    }
  });

  it('matches legacy rollDamage for a critical with a minRoll floor together', () => {
    const a = new SeededRandom(99);
    const b = new SeededRandom(99);
    const legacy = legacyRollDamage('3d6+4', true, 3, () => a.next());
    const contract = executeRollWithSource(
      { notation: '3d6+4', isCritical: true, minRoll: 3 },
      () => b.next()
    );
    expect(contract.total).toBe(legacy);
  });

  it.each([
    ['plain', {}],
    ['advantage', { advantage: true }],
    ['disadvantage', { disadvantage: true }],
    ['advantage and disadvantage cancel', { advantage: true, disadvantage: true }],
  ])('matches legacy rollD20 with %s', (_label, mods: { advantage?: boolean; disadvantage?: boolean }) => {
    const a = new SeededRandom(4242);
    const b = new SeededRandom(4242);
    const legacy = legacyRollD20({ ...mods, rng: () => a.next() });
    const contract = executeRollWithSource({ notation: '1d20', ...mods }, () => b.next());
    expect(contract.total).toBe(legacy);
  });

  it('doubles the die count, never the total, on a critical', () => {
    const outcome = executeRollWithSource({ notation: '2d6+5', isCritical: true }, () => 0.5);
    // 4 dice of 4 each, plus the flat 5 — the flat term is NOT doubled.
    expect(outcome.dice.filter(d => !d.dropped)).toHaveLength(4);
    expect(outcome.total).toBe(4 * 4 + 5);
  });

  it('floors every individual die at minRoll', () => {
    const outcome = executeRollWithSource({ notation: '4d6', minRoll: 5 }, () => 0);
    expect(outcome.dice.map(d => d.value)).toEqual([5, 5, 5, 5]);
    expect(outcome.total).toBe(20);
  });

  it('ignores a minRoll that cannot bite', () => {
    const outcome = executeRollWithSource({ notation: '3d6', minRoll: 1 }, () => 0);
    expect(outcome.dice.map(d => d.value)).toEqual([1, 1, 1]);
  });

  it('keeps executeRoll(spec, seed) identical to the source-driven core', () => {
    const rng = new SeededRandom(31337);
    const viaSource = executeRollWithSource({ notation: '3d8+2', isCritical: true }, () => rng.next());
    const viaSeed = executeRoll({ notation: '3d8+2', isCritical: true }, 31337);
    expect(viaSeed).toEqual(viaSource);
  });
});

describe('DiceAuditLog explicit seed (agora-f821.3)', () => {
  it('reproduces the same outcome for the same explicit seed and records both rolls', () => {
    DiceAuditLog.clear();
    const first = DiceAuditLog.perform({ notation: '4d6+1' }, { mode: 'silent', seed: 555 });
    const second = DiceAuditLog.perform({ notation: '4d6+1' }, { mode: 'silent', seed: 555 });

    expect(second.outcome).toEqual(first.outcome);
    expect(first.seed).toBe(555);
    expect(second.seed).toBe(555);
    expect(first.id).not.toBe(second.id);
    expect(DiceAuditLog.getRecords()).toHaveLength(2);
  });

  it('still advances the session index so a later derived roll cannot collide', () => {
    DiceAuditLog.clear();
    DiceAuditLog.configure({ baseSeed: 1000 });
    const pinned = DiceAuditLog.perform({ notation: '1d20' }, { mode: 'silent', seed: 42 });
    const derived = DiceAuditLog.perform({ notation: '1d20' }, { mode: 'silent' });

    expect(pinned.index).toBe(0);
    expect(derived.index).toBe(1);
    expect(derived.seed).not.toBe(42);
  });

  it('keeps the derived-seed behaviour when no seed is supplied', () => {
    DiceAuditLog.clear();
    DiceAuditLog.configure({ baseSeed: 2468 });
    const a = DiceAuditLog.perform({ notation: '2d10' }, { mode: 'silent' });
    DiceAuditLog.configure({ baseSeed: 2468 });
    const b = DiceAuditLog.perform({ notation: '2d10' }, { mode: 'silent' });

    expect(b.seed).toBe(a.seed);
    expect(b.outcome).toEqual(a.outcome);
  });

  it('reproduces an explicit-seed record from its stored seed', () => {
    DiceAuditLog.clear();
    const record = DiceAuditLog.perform(
      { notation: '2d6', isCritical: true, minRoll: 2 },
      { mode: 'silent', seed: 8080, context: 'parity check' }
    );
    const replay = DiceAuditLog.reproduce(record.id);
    expect(replay?.matches).toBe(true);
  });
});
