/**
 * @file WindowFrame.tsx
 * This file renders the shared floating window shell for major 2D panels.
 *
 * Map, glossary, party, character sheet, creator, combat, and debug panes use
 * this frame for consistent drag, resize, maximize, reset, and close controls.
 * It depends on useResizableWindow for geometry and ResizeHandles for edge
 * controls, then wraps each caller's content in the same title-bar chrome.
 * @component-owner UI Team / Core UI
 */
import React from 'react';
import { type WindowSize } from '../../hooks/useResizableWindow';
interface WindowFrameProps {
    title: string;
    children: React.ReactNode;
    onClose?: () => void;
    storageKey?: string;
    headerActions?: React.ReactNode;
    initialMaximized?: boolean;
    minimumSize?: Partial<WindowSize>;
}
export declare const WindowFrame: React.FC<WindowFrameProps>;
export {};
