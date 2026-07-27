/**
 * @file src/hooks/useKeyboardNavigation.ts
 * Reusable hook for keyboard navigation in grids and lists.
 */
import { RefObject } from 'react';
interface UseKeyboardNavigationProps {
    /** The container element holding the focusable items */
    containerRef: RefObject<HTMLElement | null>;
    /** Optional orientation for list navigation ('vertical' | 'horizontal') */
    orientation?: 'vertical' | 'horizontal';
    /** Grid dimensions if navigating a grid */
    gridSize?: {
        rows: number;
        cols: number;
    };
    /** Current coordinates if in grid mode */
    currentCoords?: {
        x: number;
        y: number;
    };
    /** Callback when coordinates change in grid mode */
    onCoordsChange?: (coords: {
        x: number;
        y: number;
    }) => void;
    /** Callback when an item is activated (Enter/Space) */
    onActivate?: (coords?: {
        x: number;
        y: number;
    }) => void;
    /** Callback to close/escape the component */
    onClose?: () => void;
}
export declare function useKeyboardNavigation({ containerRef, orientation, gridSize, currentCoords, onCoordsChange, onActivate, onClose }: UseKeyboardNavigationProps): {
    handleKeyDown: (event: React.KeyboardEvent | KeyboardEvent) => void;
};
export {};
