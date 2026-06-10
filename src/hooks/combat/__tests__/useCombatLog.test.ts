/**
 * Regression coverage for the combat log hook.
 *
 * This file now proves the log still behaves like a short in-memory buffer,
 * but also survives a reload when the same encounter key is used. That keeps
 * the existing combat log behavior intact while testing the persistence slice
 * needed for G23.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCombatLog } from '../useCombatLog';
import { CombatLogEntry } from '../../../types/combat';

describe('useCombatLog', () => {
  const storageKey = 'aralia-test-combat-log';

  const createMockEntry = (id: string, message: string): CombatLogEntry => ({
    id,
    timestamp: Date.now(),
    type: 'action',
    message,
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it('should initialize with empty logs', () => {
    const { result } = renderHook(() => useCombatLog({ storageKey }));
    expect(result.current.logs).toEqual([]);
  });

  it('should add a log entry', () => {
    const { result } = renderHook(() => useCombatLog({ storageKey }));
    const entry = createMockEntry('1', 'Test Log');

    act(() => {
      result.current.addLogEntry(entry);
    });

    expect(result.current.logs).toHaveLength(1);
    expect(result.current.logs[0]).toEqual(entry);
  });

  it('should truncate logs when exceeding the limit', () => {
    const { result } = renderHook(() => useCombatLog({ storageKey }));

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
    const { result } = renderHook(() => useCombatLog({ storageKey }));

    act(() => {
      result.current.addLogEntry(createMockEntry('1', 'Test'));
      result.current.clearLogs();
    });

    expect(result.current.logs).toEqual([]);
  });

  it('should restore a persisted log after remounting the same encounter', async () => {
    const entry = createMockEntry('persisted-1', 'Persisted combat log entry');

    const firstMount = renderHook(() => useCombatLog({ storageKey }));

    act(() => {
      firstMount.result.current.addLogEntry(entry);
    });

    await waitFor(() => {
      expect(localStorage.getItem(storageKey)).toContain('Persisted combat log entry');
    });

    firstMount.unmount();

    const secondMount = renderHook(() => useCombatLog({ storageKey }));

    expect(secondMount.result.current.logs).toEqual([entry]);
  });

  it('should remove the persisted history when logs are cleared', async () => {
    const entry = createMockEntry('clear-1', 'Clearable combat log entry');
    const { result } = renderHook(() => useCombatLog({ storageKey }));

    act(() => {
      result.current.addLogEntry(entry);
    });

    await waitFor(() => {
      expect(localStorage.getItem(storageKey)).toContain('Clearable combat log entry');
    });

    act(() => {
      result.current.clearLogs();
    });

    expect(result.current.logs).toEqual([]);
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it('should not copy the previous encounter log into a new storage key', async () => {
    const firstKey = `${storageKey}-first`;
    const secondKey = `${storageKey}-second`;
    const firstEntry = createMockEntry('first-1', 'First encounter entry');
    const secondEntry = createMockEntry('second-1', 'Second encounter entry');

    localStorage.setItem(secondKey, JSON.stringify([secondEntry]));

    const { result, rerender } = renderHook(
      ({ activeKey }) => useCombatLog({ storageKey: activeKey }),
      { initialProps: { activeKey: firstKey } }
    );

    act(() => {
      result.current.addLogEntry(firstEntry);
    });

    await waitFor(() => {
      expect(localStorage.getItem(firstKey)).toContain('First encounter entry');
    });

    rerender({ activeKey: secondKey });

    await waitFor(() => {
      expect(result.current.logs).toEqual([secondEntry]);
    });

    expect(localStorage.getItem(secondKey)).toContain('Second encounter entry');
    expect(localStorage.getItem(secondKey)).not.toContain('First encounter entry');
  });
});
