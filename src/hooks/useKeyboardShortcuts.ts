import { useEffect, useCallback } from 'react';

/**
 * This file provides a flexible React hook for binding custom keyboard shortcuts
 * and hotkey combinations across the game's user interface.
 *
 * It allows components to register hotkeys (such as [Escape], [Ctrl+S], [Space],
 * or letter keys) while automatically preventing unwanted triggers when the player
 * is actively typing inside text boxes or form inputs.
 *
 * Called by: Modal dialogs, inventory panels, battle map overlays, developer menus.
 * Depends on: Standard browser keyboard event APIs and React hooks.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================
// Data structures representing shortcut definitions, combinations, and handler options.
// ============================================================================

export type ShortcutHandler = (event: KeyboardEvent) => void;

export interface ShortcutDefinition {
  /** The key string or combination, e.g. 'Escape', 'Enter', 'ctrl+s', 'Shift+Tab' */
  key: string;
  /** Function to execute when the shortcut matches */
  handler: ShortcutHandler;
  /** Whether to prevent the browser's default action (default: true) */
  preventDefault?: boolean;
  /** Whether to stop event propagation (default: false) */
  stopPropagation?: boolean;
  /** Allow this shortcut even when typing inside an input/textarea (default: false) */
  allowInInputs?: boolean;
  /** Optional disabled state for this specific shortcut */
  disabled?: boolean;
  /** Optional human-readable description for tooltips/help menus */
  description?: string;
}

export type ShortcutMap = Record<string, ShortcutHandler | Omit<ShortcutDefinition, 'key'>>;

export interface UseKeyboardShortcutsOptions {
  /** Master toggle to enable or disable all shortcuts in this hook instance (default: true) */
  enabled?: boolean;
  /** Target DOM element or window to listen on (default: window) */
  target?: EventTarget | null;
  /** Allow all shortcuts in this hook instance inside inputs (default: false) */
  allowInInputs?: boolean;
}

// ============================================================================
// Input Focus Guard Helper
// ============================================================================
// Detects whether the player is currently typing inside an editable form element.
// ============================================================================

/**
 * Checks if the currently focused element is a text input, textarea, select, or contenteditable element.
 *
 * @returns True if the player is typing in an editable field.
 */
export function isEditableElement(element: Element | null): boolean {
  if (!element) return false;
  const tagName = element.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  const el = element as HTMLElement;
  if (
    el.isContentEditable === true ||
    el.contentEditable === 'true' ||
    el.contentEditable === '' ||
    (typeof element.getAttribute === 'function' &&
      (element.getAttribute('contenteditable') === 'true' ||
        element.getAttribute('contenteditable') === '' ||
        element.getAttribute('contenteditable') === 'plaintext-only'))
  ) {
    return true;
  }
  return false;
}

// ============================================================================
// Key Combo Normalization Helper
// ============================================================================
// Standardizes shortcut strings into a uniform representation for matching.
// ============================================================================

/**
 * Parses and normalizes a key string into its modifier flags and primary key.
 *
 * @param combo - The shortcut string (e.g. "Control+Alt+KeyS" or "shift+enter").
 */
export function parseKeyCombo(combo: string): {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
} {
  const parts = combo.split('+').map(p => p.trim().toLowerCase());
  let ctrl = false;
  let alt = false;
  let shift = false;
  let meta = false;
  let primaryKey = '';

  for (const part of parts) {
    if (part === 'ctrl' || part === 'control') {
      ctrl = true;
    } else if (part === 'alt' || part === 'option') {
      alt = true;
    } else if (part === 'shift') {
      shift = true;
    } else if (part === 'meta' || part === 'cmd' || part === 'command' || part === 'win') {
      meta = true;
    } else {
      primaryKey = part;
    }
  }

  return { key: primaryKey, ctrl, alt, shift, meta };
}

/**
 * Checks if an active browser KeyboardEvent matches a parsed shortcut definition.
 */
function matchesEvent(event: KeyboardEvent, parsed: ReturnType<typeof parseKeyCombo>): boolean {
  const eventKey = event.key.toLowerCase();
  const eventCode = event.code.toLowerCase();

  const ctrlMatches = parsed.ctrl ? (event.ctrlKey || event.metaKey) : (!event.ctrlKey && !event.metaKey);
  const altMatches = parsed.alt ? event.altKey : !event.altKey;
  const shiftMatches = parsed.shift ? event.shiftKey : !event.shiftKey;

  // Primary key matches either the character value (.key) or physical code (.code)
  const keyMatches =
    parsed.key === eventKey ||
    parsed.key === eventCode ||
    (parsed.key === 'space' && (eventKey === ' ' || eventCode === 'space')) ||
    (parsed.key === 'esc' && eventKey === 'escape');

  return ctrlMatches && altMatches && shiftMatches && keyMatches;
}

// ============================================================================
// Hook Implementation
// ============================================================================
// Attaches event listeners and triggers handlers when matched keyboard combinations occur.
// ============================================================================

/**
 * Custom React hook for registering keyboard shortcuts.
 *
 * Accepts either an array of `ShortcutDefinition` objects or a `ShortcutMap` dictionary.
 *
 * @example
 * useKeyboardShortcuts({
 *   'Escape': () => setIsOpen(false),
 *   'Control+s': () => handleSave(),
 *   'ArrowRight': () => handleNextPage()
 * });
 *
 * @param shortcuts - Map or array of shortcut definitions.
 * @param options - Configuration options such as enabled state and input behavior.
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutMap | ShortcutDefinition[],
  options: UseKeyboardShortcutsOptions = {}
): void {
  const { enabled = true, target = typeof window !== 'undefined' ? window : null, allowInInputs = false } = options;

  const handleKeyDown = useCallback(
    (event: Event) => {
      if (!enabled) return;
      const keyEvent = event as KeyboardEvent;

      // Check if user is typing in a form field
      const isInput = isEditableElement(document.activeElement);

      // Normalize input into an array of ShortcutDefinition items
      const definitions: ShortcutDefinition[] = Array.isArray(shortcuts)
        ? shortcuts
        : Object.entries(shortcuts).map(([combo, config]) => {
            if (typeof config === 'function') {
              return { key: combo, handler: config };
            }
            return { key: combo, ...config };
          });

      for (const def of definitions) {
        if (def.disabled) continue;

        // Skip if typing in an input and this shortcut does not allow inputs
        if (isInput && !def.allowInInputs && !allowInInputs) {
          continue;
        }

        const parsed = parseKeyCombo(def.key);
        if (matchesEvent(keyEvent, parsed)) {
          if (def.preventDefault !== false) {
            keyEvent.preventDefault();
          }
          if (def.stopPropagation) {
            keyEvent.stopPropagation();
          }
          def.handler(keyEvent);
          break;
        }
      }
    },
    [shortcuts, enabled, allowInInputs]
  );

  useEffect(() => {
    if (!enabled || !target) return;

    target.addEventListener('keydown', handleKeyDown as EventListener);
    return () => {
      target.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [enabled, target, handleKeyDown]);
}
