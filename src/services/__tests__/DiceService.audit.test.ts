/**
 * @file DiceService.audit.test.ts
 * Proves DiceService routes BOTH its silent and visual paths through the one
 * shared deterministic + audit contract (D-G3).
 *
 * The visual path is exercised via its not-initialized branch (no DOM/WebGL in
 * this environment) — that branch must still produce a contract-backed,
 * audited result, not an ad-hoc Math.random roll.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DiceService } from '../DiceService';
import { DiceAuditLog } from '../../systems/dice/rollContract';

describe('DiceService + shared roll contract', () => {
  beforeEach(() => {
    DiceAuditLog.clear();
    DiceAuditLog.configure({ baseSeed: 1337 });
  });

  it('silent roll() is recorded in the audit log with a matching total', () => {
    const total = DiceService.roll('2d6+1');
    const records = DiceAuditLog.getRecords();
    expect(records).toHaveLength(1);
    expect(records[0].mode).toBe('silent');
    expect(records[0].spec.notation).toBe('2d6+1');
    expect(records[0].outcome.total).toBe(total);
    expect(total).toBeGreaterThanOrEqual(3);
    expect(total).toBeLessThanOrEqual(13);
  });

  it('visualRoll() (fallback path) resolves with the contract outcome and audits as visual', async () => {
    const result = await DiceService.visualRoll('1d20', { modifier: 2 });
    const records = DiceAuditLog.getRecords();
    expect(records).toHaveLength(1);
    expect(records[0].mode).toBe('visual');
    expect(result.total).toBe(records[0].outcome.total + 2);
    expect(result.modifier).toBe(2);
    expect(result.rolls).toHaveLength(1);
    expect(result.rolls[0].sides).toBe(20);
    expect(result.rolls[0].value).toBe(records[0].outcome.total);
  });

  it('same base seed => silent and visual paths produce the same roll', async () => {
    const silentTotal = DiceService.roll('1d20');

    DiceAuditLog.clear();
    DiceAuditLog.configure({ baseSeed: 1337 });
    const visual = await DiceService.visualRoll('1d20');

    expect(visual.total).toBe(silentTotal);
  });

  it('a silent roll can be reproduced after the fact from its audit record', () => {
    DiceService.roll('4d6');
    const record = DiceAuditLog.getRecords()[0];
    const replay = DiceAuditLog.reproduce(record.id);
    expect(replay!.matches).toBe(true);
  });
});
