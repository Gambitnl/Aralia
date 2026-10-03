/**
 * @file ResizeHandles.tsx
 * This file renders the invisible hit targets around every resizable game window.
 *
 * WindowFrame uses these handles to let players resize party, glossary, map,
 * creator, and other 2D panels. The visible amber marks stay small so the frame
 * does not look bulky, while the actual buttons are touch-sized for cramped
 * screens and pointer use.
 * @component-owner UI Team / Core UI
 */
import React from 'react';
type ResizeHandle = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom' | 'left' | 'right';
interface ResizeHandlesProps {
    onResizeStart: (e: React.MouseEvent, handle: ResizeHandle) => void;
}
export declare const ResizeHandles: React.FC<ResizeHandlesProps>;
export {};
