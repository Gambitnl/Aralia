// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 17/08/2026, 22:33:35
 * Dependents: components/layout/GameModals.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback, useEffect, useRef } from 'react';

/**
 * The shared overlay-orchestration contract (GG-20).
 *
 * WHAT THIS SETTLES
 * `GameModals.tsx` used to carry three hand-maintained lists that had to agree
 * with each other by inspection:
 *   1. the fallback Escape handler's topmost-first `if` chain (~17 modals),
 *   2. the `shouldLockBackgroundScroll` boolean (~23 modals),
 *   3. the `backgroundLockKey` array (~23 modals).
 * A modal added to one list but not the other silently broke either Escape
 * dismissal or scroll locking. This contract replaces those three lists with a
 * single registry of `ModalEntry` records plus one `useModalOrchestration`
 * hook, so a modal's Escape priority, close action, and scroll-lock membership
 * live in exactly one place.
 *
 * HOW FUTURE MANAGERS PLUG IN
 * The GG-20 decomposition (GG-86–GG-116) moves modal render blocks into
 * categorized managers (SystemModals / GameplayModals / EconomyModals). Each
 * manager should export a `ModalEntry[]` fragment (its own open-state flags +
 * close handlers) and the parent composes them into one ordered list before
 * calling this hook. Array order IS the Escape priority: index 0 is the
 * topmost modal and is dismissed first.
 *
 * BEHAVIOR PRESERVED (verbatim from GameModals.tsx)
 * - Escape is handled on a capture-phase `document` listener, topmost-first,
 *   and defers to any child that already called `preventDefault()`.
 * - Opening any scroll-locking modal sets `body.overflow: hidden` and
 *   `overscroll-behavior: contain`, and restores them on close.
 * - The background scroll position is captured when the lock activates and
 *   re-applied when the set of open, scroll-locking modals changes.
 */
export interface ModalEntry {
  /**
   * Stable id. Also becomes the fragment used in the background scroll-lock
   * key, so ids must stay stable across renders (they are the only thing the
   * scroll-restore effect keys on).
   */
  id: string;
  /** Whether the modal is currently open. */
  isOpen: boolean;
  /**
   * Close action for the fallback Escape handler. Omit when the modal binds
   * its own Escape (its child `useFocusTrap` receives an `onClose`), so it is
   * not part of the fallback priority chain.
   */
  close?: () => void;
  /** Whether opening this modal locks background page scroll. */
  locksBackgroundScroll: boolean;
}

/**
 * Returns the topmost (highest-priority) open modal that participates in the
 * fallback Escape chain, or `undefined` when none is open. Priority is array
 * order: the first matching entry wins.
 */
export function resolveTopmostOpenModal(
  entries: readonly ModalEntry[],
): ModalEntry | undefined {
  for (const entry of entries) {
    if (entry.isOpen && entry.close) return entry;
  }
  return undefined;
}

/** Whether any open, scroll-locking modal requires the background lock. */
export function shouldLockBackgroundScroll(
  entries: readonly ModalEntry[],
): boolean {
  return entries.some((entry) => entry.isOpen && entry.locksBackgroundScroll);
}

/**
 * Stable key over the SET of open, scroll-locking modals. It changes only when
 * that membership changes, not on unrelated renders, so it can re-run the
 * scroll-restore effect when modal ownership moves while the lock stays active
 * (e.g. Party Overlay -> Character Sheet).
 */
export function backgroundLockKey(entries: readonly ModalEntry[]): string {
  return entries
    .filter((entry) => entry.isOpen && entry.locksBackgroundScroll)
    .map((entry) => entry.id)
    .join('|');
}

/**
 * Consumes a combined modal registry and drives the two shared overlay
 * behaviors: the topmost-first fallback Escape handler and the background
 * page scroll lock + scroll-position restore.
 *
 * @param entries Ordered modal registry (index 0 = topmost Escape priority).
 */
export function useModalOrchestration(entries: readonly ModalEntry[]): void {
  // ---- Fallback Escape (capture phase, topmost-first) ----
  const handleFallbackEscape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      resolveTopmostOpenModal(entries)?.close?.();
    },
    [entries],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleFallbackEscape, true);
    return () =>
      document.removeEventListener('keydown', handleFallbackEscape, true);
  }, [handleFallbackEscape]);

  // ---- Background scroll lock ----
  const lock = shouldLockBackgroundScroll(entries);
  const lockKey = backgroundLockKey(entries);
  const backgroundReturnScrollRef = useRef({ x: 0, y: 0 });
  const previousLockRef = useRef(false);

  useEffect(() => {
    if (!lock) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverscroll = document.documentElement.style.overscrollBehavior;
    // Window-backed modals handle their own internal scrolling. Locking the
    // page beneath them keeps phone wheel/touch scroll from stranding the
    // main play controls under closed logbook or map overlays.
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'contain';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overscrollBehavior = previousRootOverscroll;
    };
  }, [lock]);

  useEffect(() => {
    const wasLocked = previousLockRef.current;
    if (lock && !wasLocked) {
      backgroundReturnScrollRef.current = { x: window.scrollX, y: window.scrollY };
    }
    previousLockRef.current = lock;
  }, [lock]);

  useEffect(() => {
    if (!lock) return;

    const restoreBackgroundScroll = () => {
      const { x, y } = backgroundReturnScrollRef.current;
      if (window.scrollX !== x || window.scrollY !== y) {
        window.scrollTo(x, y);
      }
    };

    // Run after modal focus traps so focusing the first field/button inside
    // a logbook surface cannot leave the page scrolled under the overlay.
    // Also rerun when modal ownership changes while the lock remains active
    // (for example Party Overlay -> Character Sheet from a party card).
    restoreBackgroundScroll();
    const raf = requestAnimationFrame(restoreBackgroundScroll);
    const timeout = window.setTimeout(restoreBackgroundScroll, 0);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [lock, lockKey]);
}
