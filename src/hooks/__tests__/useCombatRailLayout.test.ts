/**
 * This file proves that combat rail choices survive a remount without making
 * first-time or corrupted browser storage hide important combat information.
 * It exercises the shared hook directly so both combat shells inherit the same
 * persistence contract.
 *
 * Covers: useCombatRailLayout.ts
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COMBAT_COMMAND_WIDTH_DEFAULT,
  COMBAT_COMMAND_WIDTH_MAX,
  COMBAT_RAIL_LAYOUT_STORAGE_KEY,
  COMBAT_ROSTER_WIDTH_DEFAULT,
  COMBAT_ROSTER_WIDTH_MIN,
  createCombatRailGridStyle,
  useCombatRailLayout,
} from '../useCombatRailLayout';

// ============================================================================
// Saved Combat Layout
// ============================================================================
// Every example starts with isolated browser storage so one layout choice cannot
// leak into another example and create order-dependent results.
// ============================================================================

describe('useCombatRailLayout', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('shows both rails for a first-time player', () => {
    const { result } = renderHook(() => useCombatRailLayout());

    expect(result.current.rosterVisible).toBe(true);
    expect(result.current.commandVisible).toBe(true);
    expect(result.current.rosterWidth).toBe(COMBAT_ROSTER_WIDTH_DEFAULT);
    expect(result.current.commandWidth).toBe(COMBAT_COMMAND_WIDTH_DEFAULT);
    expect(result.current.layoutIsDefault).toBe(true);
    expect(localStorage.getItem(COMBAT_RAIL_LAYOUT_STORAGE_KEY)).toBeNull();
  });

  it('restores the last deliberate rail layout after remounting combat', () => {
    const firstCombat = renderHook(() => useCombatRailLayout());

    // Hide each rail through the same separate click sequence used by the UI.
    // React completes the first interaction before the next button can fire.
    act(() => {
      firstCombat.result.current.setRosterVisible(visible => !visible);
    });
    act(() => {
      firstCombat.result.current.setCommandVisible(visible => !visible);
    });

    expect(JSON.parse(localStorage.getItem(COMBAT_RAIL_LAYOUT_STORAGE_KEY) ?? '{}')).toEqual({
      rosterVisible: false,
      commandVisible: false,
      rosterWidth: COMBAT_ROSTER_WIDTH_DEFAULT,
      commandWidth: COMBAT_COMMAND_WIDTH_DEFAULT,
    });

    firstCombat.unmount();
    const returningCombat = renderHook(() => useCombatRailLayout());

    expect(returningCombat.result.current.rosterVisible).toBe(false);
    expect(returningCombat.result.current.commandVisible).toBe(false);
  });

  it('migrates the earlier visibility-only preference without losing it', () => {
    // The first shell pass used this same versioned key before widths existed.
    localStorage.setItem(COMBAT_RAIL_LAYOUT_STORAGE_KEY, JSON.stringify({
      rosterVisible: false,
      commandVisible: true,
    }));

    const { result } = renderHook(() => useCombatRailLayout());

    expect(result.current.rosterVisible).toBe(false);
    expect(result.current.commandVisible).toBe(true);
    expect(result.current.rosterWidth).toBe(COMBAT_ROSTER_WIDTH_DEFAULT);
    expect(result.current.commandWidth).toBe(COMBAT_COMMAND_WIDTH_DEFAULT);
  });

  it('falls back to both rails when the saved shape is invalid', () => {
    // An older or manually edited value must not start combat with hidden tools.
    localStorage.setItem(COMBAT_RAIL_LAYOUT_STORAGE_KEY, JSON.stringify({
      rosterVisible: 'sometimes',
      commandVisible: false,
    }));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { result } = renderHook(() => useCombatRailLayout());

    expect(result.current.rosterVisible).toBe(true);
    expect(result.current.commandVisible).toBe(true);
  });

  it('keeps the chosen layout usable when browser storage rejects the write', () => {
    // Privacy modes and full storage quotas can reject persistence. The current
    // combat should still respond immediately even though the next one resets.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage unavailable', 'QuotaExceededError');
    });
    const { result } = renderHook(() => useCombatRailLayout());

    act(() => {
      result.current.setCommandVisible(false);
    });

    expect(result.current.commandVisible).toBe(false);
  });

  it('bounds resized rails and resets every panel choice together', () => {
    const { result } = renderHook(() => useCombatRailLayout());

    act(() => {
      result.current.setRosterWidth(-500);
    });
    act(() => {
      result.current.setCommandWidth(900);
    });
    act(() => {
      result.current.setRosterVisible(false);
    });

    expect(result.current.rosterWidth).toBe(COMBAT_ROSTER_WIDTH_MIN);
    expect(result.current.commandWidth).toBe(COMBAT_COMMAND_WIDTH_MAX);
    expect(result.current.layoutIsDefault).toBe(false);

    act(() => {
      result.current.resetLayout();
    });

    expect(result.current.rosterVisible).toBe(true);
    expect(result.current.commandVisible).toBe(true);
    expect(result.current.rosterWidth).toBe(COMBAT_ROSTER_WIDTH_DEFAULT);
    expect(result.current.commandWidth).toBe(COMBAT_COMMAND_WIDTH_DEFAULT);
    expect(localStorage.getItem(COMBAT_RAIL_LAYOUT_STORAGE_KEY)).toBeNull();
  });

  it('creates responsive grid variables that preserve a battlefield share', () => {
    const style = createCombatRailGridStyle(275, 360);

    expect(style['--combat-roster-width']).toContain('275px');
    expect(style['--combat-roster-width']).toContain('24vw');
    expect(style['--combat-command-width']).toContain('360px');
    expect(style['--combat-command-width']).toContain('30vw');
  });
});
