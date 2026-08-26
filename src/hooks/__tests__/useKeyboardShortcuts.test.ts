import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useKeyboardShortcuts,
  parseKeyCombo,
  isEditableElement,
  ShortcutDefinition
} from '../useKeyboardShortcuts';

/**
 * This test suite verifies the generic keyboard shortcut binding hook.
 *
 * In Aralia RPG, shortcuts allow quick actions (e.g., closing modals with Escape,
 * saving with Ctrl+S, quick-resting with R, or navigating menus with Arrow keys).
 * This suite ensures that modifier combinations, input focus guards, and lifecycle
 * listeners work reliably across all UI screens.
 *
 * Covers: useKeyboardShortcuts.ts
 * Tests: Modifier parsing, editable element guards, key combinations, preventDefault,
 * disabled states, and cleanup.
 */

// ============================================================================
// Helper Function Unit Tests
// ============================================================================
// Tests for combo parser and editable input detector.
// ============================================================================

describe('useKeyboardShortcuts helpers', () => {
  describe('parseKeyCombo', () => {
    it('should parse simple single keys', () => {
      const parsed = parseKeyCombo('Escape');
      expect(parsed).toEqual({
        key: 'escape',
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
      });
    });

    it('should parse ctrl+s combinations', () => {
      const parsed = parseKeyCombo('Control+s');
      expect(parsed).toEqual({
        key: 's',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      });
    });

    it('should parse multi-modifier combos like ctrl+shift+alt+z', () => {
      const parsed = parseKeyCombo('ctrl+shift+alt+z');
      expect(parsed).toEqual({
        key: 'z',
        ctrl: true,
        alt: true,
        shift: true,
        meta: false,
      });
    });

    it('should handle alternative aliases like cmd, win, option', () => {
      const parsed = parseKeyCombo('cmd+option+k');
      expect(parsed).toEqual({
        key: 'k',
        ctrl: false,
        alt: true,
        shift: false,
        meta: true,
      });
    });
  });

  describe('isEditableElement', () => {
    it('should identify input, textarea, and select as editable', () => {
      const input = document.createElement('input');
      const textarea = document.createElement('textarea');
      const select = document.createElement('select');
      const div = document.createElement('div');
      const editableDiv = document.createElement('div');
      editableDiv.contentEditable = 'true';

      expect(isEditableElement(input)).toBe(true);
      expect(isEditableElement(textarea)).toBe(true);
      expect(isEditableElement(select)).toBe(true);
      expect(isEditableElement(editableDiv)).toBe(true);
      expect(isEditableElement(div)).toBe(false);
      expect(isEditableElement(null)).toBe(false);
    });
  });
});

// ============================================================================
// Hook Execution Unit Tests
// ============================================================================
// Tests verifying shortcut event dispatch, modifiers, and input safety guards.
// ============================================================================

describe('useKeyboardShortcuts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should trigger handler on matching single key press', () => {
    const handleEscape = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        Escape: handleEscape,
      })
    );

    const event = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', cancelable: true });
    window.dispatchEvent(event);

    expect(handleEscape).toHaveBeenCalledTimes(1);
  });

  it('should trigger handler on matching modifier combination', () => {
    const handleSave = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        'ctrl+s': handleSave,
      })
    );

    // Dispatch without ctrl -> should NOT fire
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: false, cancelable: true }));
    expect(handleSave).not.toHaveBeenCalled();

    // Dispatch with ctrl -> should fire
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true }));
    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it('should prevent default event action by default', () => {
    const handler = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        Enter: handler,
      })
    );

    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalled();
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('should not fire when disabled via options', () => {
    const handler = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts(
        {
          Escape: handler,
        },
        { enabled: false }
      )
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('should suppress hotkeys when an input is focused unless allowInInputs is true', () => {
    const normalHandler = vi.fn();
    const allowedHandler = vi.fn();

    const shortcuts: ShortcutDefinition[] = [
      { key: 'Escape', handler: allowedHandler, allowInInputs: true },
      { key: 'KeyM', handler: normalHandler, allowInInputs: false },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Focus an input element
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    // KeyM in input -> should be suppressed
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM', cancelable: true }));
    expect(normalHandler).not.toHaveBeenCalled();

    // Escape in input -> should still trigger because allowInInputs = true
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', cancelable: true }));
    expect(allowedHandler).toHaveBeenCalledTimes(1);

    document.body.removeChild(input);
  });

  it('should clean up listeners on unmount', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({
        Space: handler,
      })
    );

    unmount();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', cancelable: true }));
    expect(handler).not.toHaveBeenCalled();
  });
});
