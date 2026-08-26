import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  moveWindowToFront,
  normalizeWindowStack,
  removeWindowFromStack,
  useWindowStack,
} from '../useWindowStack';

/**
 * This file proves Aralia's portable multi-window ordering contract.
 *
 * The tests cover only neutral stable ids. They intentionally do not import
 * Design Preview steps or WindowFrame styles, which demonstrates that another
 * product can reuse the behavior without inheriting Aralia's content or look.
 *
 * Exercises: useWindowStack.ts
 * Depends on: React Testing Library and Vitest
 */

// ============================================================================
// Pure Ordering Rules
// ============================================================================
// The final id is always the frontmost window. These cases protect reopening,
// pointer-based stacking, duplicate prevention, and close behavior.
// ============================================================================

describe('window stack transitions', () => {
  it('normalizes repeated ids with the last occurrence left frontmost', () => {
    expect(normalizeWindowStack(['map', 'party', 'map'])).toEqual(['party', 'map']);
  });

  it('opens an absent id and brings an existing id to the front without duplicates', () => {
    expect(moveWindowToFront(['map', 'party'], 'sheet')).toEqual(['map', 'party', 'sheet']);
    expect(moveWindowToFront(['map', 'party', 'sheet'], 'map')).toEqual(['party', 'sheet', 'map']);
  });

  it('preserves sibling order when a window closes', () => {
    expect(removeWindowFromStack(['map', 'party', 'sheet'], 'party')).toEqual(['map', 'sheet']);
  });
});

// ============================================================================
// Workspace Hook Contract
// ============================================================================
// This integration case proves callers receive one small controller for the
// same open, bring-forward, query, and close transitions used by Aralia.
// ============================================================================

describe('useWindowStack', () => {
  it('drives open, bring-to-front, open-state, and close through stable ids', () => {
    const { result } = renderHook(() => useWindowStack(['map', 'party']));

    expect(result.current.orderedOpenIds).toEqual(['map', 'party']);
    expect(result.current.isWindowOpen('map')).toBe(true);

    act(() => result.current.openOrBringToFront('map'));
    expect(result.current.orderedOpenIds).toEqual(['party', 'map']);

    act(() => result.current.closeWindow('party'));
    expect(result.current.orderedOpenIds).toEqual(['map']);
    expect(result.current.isWindowOpen('party')).toBe(false);
  });
});
