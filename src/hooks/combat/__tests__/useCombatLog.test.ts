// TODO(lint-intent): 'vi' is unused in this test; use it in the assertion path or remove it.
import { describe, it, expect, vi as _vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCombatLog } from '../useCombatLog';
import { CombatLogEntry } from '../../../types/combat';

describe('useCombatLog', () => {
  const createMockEntry = (id: string, message: string): CombatLogEntry => ({
    id,
    timestamp: Date.now(),
    type: 'action',
    message,
  });

  it('should initialize with empty logs', () => {
    const { result } = renderHook(() => useCombatLog());
    expect(result.current.logs).toEqual([]);
  });

  it('should add a log entry', () => {
    const { result } = renderHook(() => useCombatLog());
    const entry = createMockEntry('1', 'Test Log');

    act(() => {
      result.current.addLogEntry(entry);
    });

    expect(result.current.logs).toHaveLength(1);
    expect(result.current.logs[0]).toEqual(entry);
  });

  it('should truncate logs when exceeding the limit', () => {
    const { result } = renderHook(() => useCombatLog());

    // Add 55 entries (limit is 50)
    act(() => {
      for (let i = 0; i < 55; i++) {
        result.current.addLogEntry(createMockEntry(`${i}`, `Log ${i}`));
      }
    });

    // Should have 50 entries
    expect(result.current.logs).toHaveLength(50);

    // Should contain the last 50 entries (5 to 54)
    expect(result.current.logs[0].id).toBe('5');
    expect(result.current.logs[49].id).toBe('54');
  });

  it('should clear logs', () => {
    const { result } = renderHook(() => useCombatLog());

    act(() => {
      result.current.addLogEntry(createMockEntry('1', 'Test'));
      result.current.clearLogs();
    });

    expect(result.current.logs).toEqual([]);
  });
});
