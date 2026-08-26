import { useCallback, RefObject } from 'react';

/**
 * This file provides a reusable React hook for keyboard navigation inside 2D grids and 1D lists.
 *
 * In RPG menus, players can navigate spell selectors, inventory item grids, dialog choices,
 * or radial wheels using the Arrow keys, activate selections with Enter or Space, and close
 * menus with Escape without needing mouse input.
 *
 * Called by: Inventory grids, character creator skill trees, dialogue interface, action panes.
 * Depends on: Pure React hooks and standard DOM focus APIs.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================
// Options for configuring 2D grid coordinates or 1D vertical/horizontal list navigation.
// ============================================================================

export interface UseKeyboardNavigationProps {
  /** The container element holding the focusable items */
  containerRef: RefObject<HTMLElement | null>;
  /** Optional orientation for list navigation ('vertical' | 'horizontal', default: 'vertical') */
  orientation?: 'vertical' | 'horizontal';
  /** Grid dimensions if navigating a 2D grid */
  gridSize?: { rows: number; cols: number };
  /** Current coordinates if in 2D grid mode */
  currentCoords?: { x: number; y: number };
  /** Callback when coordinates change in 2D grid mode */
  onCoordsChange?: (coords: { x: number; y: number }) => void;
  /** Callback when an item is activated (Enter or Space) */
  onActivate?: (coords?: { x: number; y: number }) => void;
  /** Callback to close or dismiss the component on Escape */
  onClose?: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================
// Handles keydown events, clamps 2D boundaries, cycles 1D focus, and triggers actions.
// ============================================================================

export function useKeyboardNavigation({
  containerRef,
  orientation = 'vertical',
  gridSize,
  currentCoords,
  onCoordsChange,
  onActivate,
  onClose,
}: UseKeyboardNavigationProps) {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent | KeyboardEvent) => {
      // If modifier key is pressed (Ctrl/Cmd/Alt), pass through to browser defaults
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      // ========================================================================
      // 2D Grid Navigation Mode
      // ========================================================================
      if (gridSize && currentCoords) {
        const { x, y } = currentCoords;
        let newX = x;
        let newY = y;
        let handled = false;

        switch (event.key) {
          case 'ArrowUp':
            handled = true;
            newY = Math.max(0, y - 1);
            break;
          case 'ArrowDown':
            handled = true;
            newY = Math.min(gridSize.rows - 1, y + 1);
            break;
          case 'ArrowLeft':
            handled = true;
            newX = Math.max(0, x - 1);
            break;
          case 'ArrowRight':
            handled = true;
            newX = Math.min(gridSize.cols - 1, x + 1);
            break;
          case 'Enter':
          case ' ':
            handled = true;
            onActivate?.(currentCoords);
            break;
          case 'Escape':
            handled = true;
            onClose?.();
            break;
        }

        if (handled) {
          event.preventDefault();
          if ((newX !== x || newY !== y) && onCoordsChange) {
            onCoordsChange({ x: newX, y: newY });
          }
        }
        return;
      }

      // ========================================================================
      // 1D List Navigation Mode (Vertical or Horizontal)
      // ========================================================================
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }

      const focusable = containerRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;

      const focusableArray = Array.from(focusable) as HTMLElement[];
      const currentIndex = focusableArray.indexOf(document.activeElement as HTMLElement);

      let handled = false;
      let nextIndex = currentIndex;

      const isNextKey = orientation === 'vertical' ? event.key === 'ArrowDown' : event.key === 'ArrowRight';
      const isPrevKey = orientation === 'vertical' ? event.key === 'ArrowUp' : event.key === 'ArrowLeft';

      if (isNextKey) {
        handled = true;
        nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % focusableArray.length;
      } else if (isPrevKey) {
        handled = true;
        nextIndex =
          currentIndex === -1
            ? focusableArray.length - 1
            : (currentIndex - 1 + focusableArray.length) % focusableArray.length;
      }

      if (handled && nextIndex >= 0 && nextIndex < focusableArray.length) {
        event.preventDefault();
        focusableArray[nextIndex].focus();
      }
    },
    [containerRef, orientation, gridSize, currentCoords, onCoordsChange, onActivate, onClose]
  );

  return { handleKeyDown };
}
