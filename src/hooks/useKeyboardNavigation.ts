/**
 * @file src/hooks/useKeyboardNavigation.ts
 * Reusable hook for keyboard navigation in grids and lists.
 */
import { useCallback, RefObject } from 'react';

interface UseKeyboardNavigationProps {
  /** The container element holding the focusable items */
  containerRef: RefObject<HTMLElement | null>;
  /** Optional orientation for list navigation ('vertical' | 'horizontal') */
  orientation?: 'vertical' | 'horizontal';
  /** Grid dimensions if navigating a grid */
  gridSize?: { rows: number; cols: number };
  /** Current coordinates if in grid mode */
  currentCoords?: { x: number; y: number };
  /** Callback when coordinates change in grid mode */
  onCoordsChange?: (coords: { x: number; y: number }) => void;
  /** Callback when an item is activated (Enter/Space) */
  onActivate?: (coords?: { x: number; y: number }) => void;
  /** Callback to close/escape the component */
  onClose?: () => void;
}

export function useKeyboardNavigation({
  containerRef,
  orientation = 'vertical',
  gridSize,
  currentCoords,
  onCoordsChange,
  onActivate,
  onClose
}: UseKeyboardNavigationProps) {
  
  const handleKeyDown = useCallback((event: React.KeyboardEvent | KeyboardEvent) => {
    // If modifier key is pressed, don't interfere
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    // Grid Navigation Mode
    if (gridSize && currentCoords && onCoordsChange) {
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
        if (newX !== x || newY !== y) {
          onCoordsChange({ x: newX, y: newY });
        }
      }
      return;
    }

    // List Navigation Mode (Vertical or Horizontal)
    const focusable = containerRef.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
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
      nextIndex = currentIndex === -1 ? focusableArray.length - 1 : (currentIndex - 1 + focusableArray.length) % focusableArray.length;
    } else if (event.key === 'Escape') {
      handled = true;
      onClose?.();
    }

    if (handled) {
      event.preventDefault();
      focusableArray[nextIndex].focus();
    }
  }, [containerRef, orientation, gridSize, currentCoords, onCoordsChange, onActivate, onClose]);

  return { handleKeyDown };
}
