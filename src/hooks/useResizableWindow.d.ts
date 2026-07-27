/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 02:34:24
 * Dependents: components/ui/WindowFrame.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file useResizableWindow.ts
 * Generic hook for managing a resizable, draggable window's state.
 */
import { RefObject } from 'react';
export interface WindowSize {
    width: number;
    height: number;
}
export interface WindowPosition {
    left: number;
    top: number;
}
export interface ResizeState {
    isResizing: boolean;
    handle: string | null;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startLeft: number;
    startTop: number;
}
export interface DragState {
    isDragging: boolean;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
}
export interface ResizableWindowOptions {
    initialMaximized?: boolean;
    /**
     * Lets content-heavy windows ask for more usable room than the shared
     * 600 by 400 default. The viewport still wins on phones and small screens.
     */
    minimumSize?: Partial<WindowSize>;
}
export declare function useResizableWindow(windowRef: RefObject<HTMLDivElement | null>, storageKey?: string, options?: ResizableWindowOptions): {
    size: WindowSize;
    position: WindowPosition;
    resizeState: ResizeState;
    dragState: DragState;
    isMaximized: boolean;
    handleResizeStart: (e: React.MouseEvent, handle: string) => void;
    handleDragStart: (e: React.MouseEvent) => void;
    handleMaximize: () => void;
    handleReset: () => void;
};
