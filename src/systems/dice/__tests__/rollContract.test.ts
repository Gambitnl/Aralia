/**
 * @file rollContract.test.ts
 * Tests for the shared deterministic + audit dice contract (D-G3).
 *
 * The contract's promises:
 * 1. Same seed + same spec => same roll, regardless of silent/visual mode.
 * 2. Every roll is recorded in the audit log with the exact seed used, so any
 *    silent roll can be reproduced and inspected after the fact.
 * 3. Visual rolls are presentation layered on the same underlying roll; the
 *    audit record captures what the 3D dice displayed so mismatches are visible.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  executeRoll,
  deriveRollSeed,
  DiceAuditLog,
  ROLL_AUDIT_CAPACITY,
} from '../rollContract';

describe('executeRoll (pure deterministic core)', () => {
  it('produces identical outcomes for the same spec and seed', () => {
    const a = executeRoll({ notation: '2d6+3' }, 12345);
    const b = executeRoll({ notation: '2d6+3' }, 12345);
    expect(a).toEqual(b);
  });

  it('produces different outcomes for different seeds (statistically)', () => {
    // With 20d20 the chance of two different seeds colliding on every die is nil.
    const a = executeRoll({ notation: '20d20' }, 1);
    const b = executeRoll({ notation: '20d20' }, 2);
    expect(a.dice.map(d => d.value)).not.toEqual(b.dice.map(d => d.value));
  });

  it('parses dice notation into per-die results with correct ranges and totals', () => {
    const outcome = executeRoll({ notation: '2d6+3' }, 777);
    expect(outcome.dice).toHaveLength(2);
    for (const die of outcome.dice) {
      expect(die.sides).toBe(6);
      expect(die.value).toBeGreaterThanOrEqual(1);
      expect(die.value).toBeLessThanOrEqual(6);
    }
    expect(outcome.modifier).toBe(3);
    expect(outcome.total).toBe(outcome.dice[0].value + outcome.dice[1].value + 3);
  });

  it('handles multi-group formulas and negative modifiers', () => {
    const outcome = executeRoll({ notation: '1d8 + 1d6 - 2' }, 4242);
    expect(outcome.dice).toHaveLength(2);
    expect(outcome.dice[0].sides).toBe(8);
    expect(outcome.dice[1].sides).toBe(6);
    expect(outcome.modifier).toBe(-2);
    expect(outcome.total).toBe(outcome.dice[0].value + outcome.dice[1].value - 2);
  });

  it('returns an empty zero outcome for empty/zero notation (parity with silent roller)', () => {
    expect(executeRoll({ notation: '' }, 9).total).toBe(0);
    expect(executeRoll({ notation: '0' }, 9).total).toBe(0);
    expect(executeRoll({ notation: '' }, 9).dice).toHaveLength(0);
  });

  it('advantage rolls each d20 twice and keeps the higher', () => {
    const outcome = executeRoll({ notation: '1d20', advantage: true }, 555);
    expect(outcome.dice).toHaveLength(2);
    const kept = outcome.dice.filter(d => !d.dropped);
    const dropped = outcome.dice.filter(d => d.dropped);
    expect(kept).toHaveLength(1);
    expect(dropped).toHaveLength(1);
    expect(kept[0].value).toBeGreaterThanOrEqual(dropped[0].value);
    expect(outcome.total).toBe(kept[0].value);
  });

  it('disadvantage keeps the lower die', () => {
    const outcome = executeRoll({ notation: '1d20', disadvantage: true }, 555);
    const kept = outcome.dice.filter(d => !d.dropped);
    const dropped = outcome.dice.filter(d => d.dropped);
    expect(kept[0].value).toBeLessThanOrEqual(dropped[0].value);
    expect(outcome.total).toBe(kept[0].value);
  });
});

describe('deriveRollSeed', () => {
  it('is deterministic and varies with index', () => {
    expect(deriveRollSeed(42, 0)).toBe(deriveRollSeed(42, 0));
    expect(deriveRollSeed(42, 0)).not.toBe(deriveRollSeed(42, 1));
    expect(deriveRollSeed(42, 0)).not.toBe(deriveRollSeed(43, 0));
  });

  it('always yields a positive seed usable by SeededRandom', () => {
    for (let i = 0; i < 50; i++) {
      const seed = deriveRollSeed(123456789, i);
      expect(seed).toBeGreaterThan(0);
      expect(Number.isInteger(seed)).toBe(true);
    }
  });
});

describe('DiceAuditLog', () => {
  beforeEach(() => {
    DiceAuditLog.clear();
    DiceAuditLog.configure({ baseSeed: 42 });
  });

  it('silent and visual rolls with the same base seed produce the same roll', () => {
    const silent = DiceAuditLog.perform({ notation: '1d20' }, { mode: 'silent' });

    DiceAuditLog.clear();
    DiceAuditLog.configure({ baseSeed: 42 });
    const visual = DiceAuditLog.perform({ notation: '1d20' }, { mode: 'visual' });

    expect(silent.outcome).toEqual(visual.outcome);
    expect(silent.seed).toBe(visual.seed);
    expect(silent.mode).toBe('silent');
    expect(visual.mode).toBe('visual');
  });

  it('records every roll with seed, spec, mode, and context', () => {
    DiceAuditLog.perform({ notation: '2d6+1' }, { mode: 'silent', context: 'goblin damage' });
    DiceAuditLog.perform({ notation: '1d20' }, { mode: 'visual', context: 'persuasion check' });

    const records = DiceAuditLog.getRecords();
    expect(records).toHaveLength(2);
    expect(records[0].context).toBe('goblin damage');
    expect(records[0].spec.notation).toBe('2d6+1');
    expect(records[1].mode).toBe('visual');
    expect(records[0].index).toBe(0);
    expect(records[1].index).toBe(1);
  });

  it('reproduces a past silent roll exactly from its audit record', () => {
    const record = DiceAuditLog.perform({ notation: '3d8+2' }, { mode: 'silent' });
    const result = DiceAuditLog.reproduce(record.id);
    expect(result).toBeDefined();
    expect(result!.matches).toBe(true);
    expect(result!.outcome).toEqual(record.outcome);
  });

  it('reproduce works from a detached record object (e.g. exported log)', () => {
    const record = DiceAuditLog.perform({ notation: '1d20', advantage: true }, { mode: 'visual' });
    const detached = JSON.parse(JSON.stringify(record));
    DiceAuditLog.clear();
    const result = DiceAuditLog.reproduce(detached);
    expect(result!.matches).toBe(true);
  });

  it('attachPresentation records displayed values and flags mismatches', () => {
    const record = DiceAuditLog.perform({ notation: '2d6' }, { mode: 'visual' });
    const trueValues = record.outcome.dice.map(d => d.value);

    DiceAuditLog.attachPresentation(record.id, trueValues);
    let stored = DiceAuditLog.getRecords().find(r => r.id === record.id)!;
    expect(stored.presented).toEqual({ values: trueValues, matchesOutcome: true });

    // Simulate the physics engine landing on different faces.
    const wrongValues = trueValues.map(v => (v % 6) + 1);
    DiceAuditLog.attachPresentation(record.id, wrongValues);
    stored = DiceAuditLog.getRecords().find(r => r.id === record.id)!;
    expect(stored.presented!.matchesOutcome).toBe(false);
  });

  it('keeps at most ROLL_AUDIT_CAPACITY records (ring buffer)', () => {
    for (let i = 0; i < ROLL_AUDIT_CAPACITY + 10; i++) {
      DiceAuditLog.perform({ notation: '1d4' }, { mode: 'silent' });
    }
    const records = DiceAuditLog.getRecords();
    expect(records).toHaveLength(ROLL_AUDIT_CAPACITY);
    // Oldest records were evicted; indices keep counting.
    expect(records[0].index).toBe(10);
    expect(records[records.length - 1].index).toBe(ROLL_AUDIT_CAPACITY + 9);
  });

  it('un-configured log still records reproducible rolls (self-seeded)', () => {
    DiceAuditLog.clear();
    // No configure() call — the log self-seeds; the per-roll seed in the record
    // is still enough to reproduce the roll after the fact.
    const record = DiceAuditLog.perform({ notation: '1d12+1' }, { mode: 'silent' });
    expect(DiceAuditLog.reproduce(record.id)!.matches).toBe(true);
  });
});
