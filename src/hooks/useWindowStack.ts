// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/08/2026, 03:33:29
 * Dependents: components/DesignPreview/DesignPreviewPage.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback, useState } from 'react';

/**
 * This file owns the neutral open-window ordering used by multi-window workspaces.
 *
 * A workspace supplies stable string ids for its registered panels. This hook
 * remembers which ids are open and keeps them ordered from back to front. It
 * deliberately knows nothing about React content, window chrome, colors,
 * geometry, storage, or modal accessibility; those stay with the caller and
 * the shared WindowFrame and modal hooks.
 *
 * Called by: DesignPreviewPage.tsx
 * Depends on: React state only
 */

// ============================================================================
// Pure Stack Transitions
// ============================================================================
// These helpers make the ordering rules copyable and testable without mounting
// a component. The final id in every returned list is the frontmost window.
// ============================================================================

/**
 * Removes repeated ids while preserving the last occurrence as the frontmost
 * one. Replaying the ordinary "open or bring forward" transition for every id
 * gives malformed saved or caller-provided input the same result as real use.
 */
export function normalizeWindowStack<WindowId extends string>(
  windowIds: readonly WindowId[],
): WindowId[] {
  return windowIds.reduce<WindowId[]>(
    (orderedIds, windowId) => [...moveWindowToFront(orderedIds, windowId)],
    [],
  );
}

/**
 * Opens an absent window or moves an existing one to the front. Returning the
 * original list when it is already frontmost avoids an unnecessary rerender on
 * every pointer press inside the active window.
 */
export function moveWindowToFront<WindowId extends string>(
  orderedIds: readonly WindowId[],
  windowId: WindowId,
): readonly WindowId[] {
  if (orderedIds[orderedIds.length - 1] === windowId) return orderedIds;
  return [...orderedIds.filter((id) => id !== windowId), windowId];
}

/**
 * Closes a window by removing its id from the rendered order. The window's
 * component owns any cleanup caused by unmounting; this layer only owns order.
 */
export function removeWindowFromStack<WindowId extends string>(
  orderedIds: readonly WindowId[],
  windowId: WindowId,
): readonly WindowId[] {
  if (!orderedIds.includes(windowId)) return orderedIds;
  return orderedIds.filter((id) => id !== windowId);
}

// ============================================================================
// React Workspace Adapter
// ============================================================================
// A workspace uses this small adapter to render ordered ids and wire its own
// panel launchers, close controls, and pointer-based bring-to-front boundary.
// ============================================================================

export interface WindowStackController<WindowId extends string> {
  /** Open windows ordered back-to-front; the final id should render last. */
  orderedOpenIds: readonly WindowId[];
  /** Open an absent id or bring an already-open id to the front. */
  openOrBringToFront: (windowId: WindowId) => void;
  /** Close an id without changing the order of the remaining windows. */
  closeWindow: (windowId: WindowId) => void;
  /** Report whether a registered caller id is currently open. */
  isWindowOpen: (windowId: WindowId) => boolean;
}

/**
 * Holds the ordered open ids for one workspace.
 *
 * Registration remains the caller's job because titles, content factories,
 * permissions, and domain state are not portable window behavior. This hook
 * also does not implement minimization or DOM focus: Aralia currently supports
 * close/reopen and visual bring-to-front ordering, not a minimized taskbar or
 * programmatic focus manager.
 */
export function useWindowStack<WindowId extends string>(
  initialOpenIds: readonly WindowId[],
): WindowStackController<WindowId> {
  // Normalize only the initial value. Later updates already pass through the
  // tested transitions below, so the state cannot accumulate duplicate ids.
  const [orderedOpenIds, setOrderedOpenIds] = useState<readonly WindowId[]>(() =>
    normalizeWindowStack(initialOpenIds),
  );

  // Opening and visual focusing are the same Aralia transition: remove the id
  // from its old position, then render it last so equal-z-index siblings stack.
  const openOrBringToFront = useCallback((windowId: WindowId) => {
    setOrderedOpenIds((currentIds) => moveWindowToFront(currentIds, windowId));
  }, []);

  // Closing unmounts only the named window and preserves every sibling's order.
  const closeWindow = useCallback((windowId: WindowId) => {
    setOrderedOpenIds((currentIds) => removeWindowFromStack(currentIds, windowId));
  }, []);

  // Consumers use this when a launcher needs an explicit open/closed state.
  const isWindowOpen = useCallback(
    (windowId: WindowId) => orderedOpenIds.includes(windowId),
    [orderedOpenIds],
  );

  return {
    orderedOpenIds,
    openOrBringToFront,
    closeWindow,
    isWindowOpen,
  };
}
