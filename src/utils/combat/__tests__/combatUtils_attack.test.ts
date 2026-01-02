import { describe, it, expect } from 'vitest';
import { resolveAttack } from '../combatUtils';

describe('combatUtils: resolveAttack', () => {
  it('detects a standard hit', () => {
    // 15 (roll) + 2 (mod) = 17 vs AC 16 -> Hit
    const result = resolveAttack(15, 2, 16);
    expect(result.isHit).toBe(true);
    expect(result.isCritical).toBe(false);
    expect(result.isAutoMiss).toBe(false);
    expect(result.total).toBe(17);
  });

  it('detects a standard miss', () => {
    // 10 (roll) + 5 (mod) = 15 vs AC 16 -> Miss
    const result = resolveAttack(10, 5, 16);
    expect(result.isHit).toBe(false);
    expect(result.isCritical).toBe(false);
    expect(result.isAutoMiss).toBe(false);
    expect(result.total).toBe(15);
  });

  it('handles Natural 1 as Auto Miss regardless of high modifiers', () => {
    // 1 (roll) + 20 (mod) = 21 vs AC 10
    // Mathematically 21 >= 10, but Nat 1 is auto miss.
    const result = resolveAttack(1, 20, 10);
    expect(result.isHit).toBe(false);
    expect(result.isAutoMiss).toBe(true);
    expect(result.total).toBe(21);
  });

  it('handles Natural 20 as Critical Hit regardless of AC', () => {
    // 20 (roll) + 0 (mod) = 20 vs AC 25
    // Mathematically 20 < 25, but Nat 20 is auto hit.
    const result = resolveAttack(20, 0, 25);
    expect(result.isHit).toBe(true);
    expect(result.isCritical).toBe(true);
    expect(result.total).toBe(20);
  });

  it('respects expanded critical range (e.g. Champion Fighter)', () => {
    // 19 (roll), crit range 19-20
    const result = resolveAttack(19, 5, 25, 19);
    expect(result.isHit).toBe(true);
    expect(result.isCritical).toBe(true);
  });

  it('handles ties (Meet beats)', () => {
    // 10 + 5 = 15 vs AC 15 -> Hit
    const result = resolveAttack(10, 5, 15);
    expect(result.isHit).toBe(true);
  });
});
