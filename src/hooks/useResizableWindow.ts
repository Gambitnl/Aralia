// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 23/06/2026, 13:47:37
 * Dependents: components/ui/WindowFrame.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file useResizableWindow.ts
 * Generic hook for managing a resizable, draggable window's state.
 */
import { useState, useCallback, useEffect, RefObject } from 'react';
import { SafeStorage } from '../utils/storageUtils';
import { safeJSONParse } from '../utils/securityUtils';

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

const DEFAULT_SIZE = { width: 1024, height: 800 };
const MIN_WIDTH = 600;
const MIN_HEIGHT = 400;
const WINDOW_MARGIN = 20;
const TOP_CHROME_GAP = 12;

interface WindowWorkspaceBounds {
    minLeft: number;
    minTop: number;
    maxWidth: number;
    maxHeight: number;
}

export interface ResizableWindowOptions {
    initialMaximized?: boolean;
    /**
     * Lets content-heavy windows ask for more usable room than the shared
     * 600 by 400 default. The viewport still wins on phones and small screens.
     */
    minimumSize?: Partial<WindowSize>;
}

// ============================================================================
// GG-38 layout-thrash repair (2026-07-18)
// ============================================================================
// getTopChromeOffset() is the hook's only forced-layout read (querySelectorAll
// + getBoundingClientRect on page headers). A single WindowFrame mount used to
// run it three or more times — both state initializers, the center-on-mount
// effect, and the immediate resize-clamp pass — each read interleaved with
// React's style writes. That read/write/read pattern is what the Building Lab
// performance trace billed as 39 ms of forced reflow in this file. The header
// measurement is now cached for the current frame and invalidated on the next
// animation frame, so any number of geometry computations within one frame
// cost one real layout pass. Behavior is preserved: values are identical
// within a frame, and viewport/header changes arrive in later frames, which
// always re-measure. Environments without requestAnimationFrame (non-visual
// test runners) skip caching and keep the original always-measure behavior.
// ============================================================================
let topChromeOffsetCache: number | null = null;

function getTopChromeOffset(): number {
    if (typeof document === 'undefined') return 0;
    if (topChromeOffsetCache !== null) return topChromeOffsetCache;

    const topHeaders = Array.from(document.querySelectorAll('header'))
        .map((header) => header.getBoundingClientRect())
        .filter((rect) => rect.top <= 1 && rect.bottom > 0 && rect.bottom < window.innerHeight * 0.5);

    const offset = topHeaders.length === 0
        ? 0
        : Math.max(...topHeaders.map((rect) => rect.bottom)) + TOP_CHROME_GAP;

    // Only hold the cached value when a frame boundary exists to clear it.
    // Deliberately caches just the header offset — never innerWidth/innerHeight,
    // which stay live so viewport-clamping semantics (and their tests) are untouched.
    if (typeof requestAnimationFrame === 'function') {
        topChromeOffsetCache = offset;
        requestAnimationFrame(() => { topChromeOffsetCache = null; });
    }

    return offset;
}

function getWorkspaceBounds(): WindowWorkspaceBounds {
    const topChromeOffset = getTopChromeOffset();
    const minTop = Math.max(WINDOW_MARGIN, topChromeOffset);

    return {
        minLeft: WINDOW_MARGIN,
        minTop,
        maxWidth: Math.max(1, window.innerWidth - (WINDOW_MARGIN * 2)),
        maxHeight: Math.max(1, window.innerHeight - minTop - WINDOW_MARGIN),
    };
}

function getResponsiveMinimumSize(
    bounds: WindowWorkspaceBounds,
    requestedMinimum: WindowSize = { width: MIN_WIDTH, height: MIN_HEIGHT },
): WindowSize {
    return {
        width: Math.min(requestedMinimum.width, bounds.maxWidth),
        height: Math.min(requestedMinimum.height, bounds.maxHeight),
    };
}

function clampSizeToWorkspace(
    size: WindowSize,
    bounds: WindowWorkspaceBounds,
    requestedMinimum?: WindowSize,
): WindowSize {
    // Keep the normal desktop minimums, but let the frame shrink to the available
    // workspace on cramped viewports so title-bar controls and primary actions stay reachable.
    const minimumSize = getResponsiveMinimumSize(bounds, requestedMinimum);

    return {
        width: Math.min(Math.max(size.width, minimumSize.width), bounds.maxWidth),
        height: Math.min(Math.max(size.height, minimumSize.height), bounds.maxHeight),
    };
}

function isSameSize(a: WindowSize, b: WindowSize): boolean {
    return a.width === b.width && a.height === b.height;
}

function isSamePosition(a: WindowPosition, b: WindowPosition): boolean {
    return a.left === b.left && a.top === b.top;
}

function centerWindowInWorkspace(size: WindowSize, bounds: WindowWorkspaceBounds): WindowPosition {
    const clampedSize = clampSizeToWorkspace(size, bounds);
    const left = Math.max(bounds.minLeft, (window.innerWidth - clampedSize.width) / 2);
    const top = Math.max(bounds.minTop, bounds.minTop + ((bounds.maxHeight - clampedSize.height) / 2));

    return { left, top };
}

function maximizeWindowInWorkspace(bounds: WindowWorkspaceBounds): { size: WindowSize; position: WindowPosition } {
    return {
        size: { width: bounds.maxWidth, height: bounds.maxHeight },
        position: { left: bounds.minLeft, top: bounds.minTop },
    };
}

function clampPositionToWorkspace(
    position: WindowPosition,
    size: WindowSize,
    bounds: WindowWorkspaceBounds,
): WindowPosition {
    const maxLeft = Math.max(bounds.minLeft, window.innerWidth - size.width - WINDOW_MARGIN);
    const maxTop = Math.max(bounds.minTop, window.innerHeight - size.height - WINDOW_MARGIN);

    return {
        left: Math.min(Math.max(position.left, bounds.minLeft), maxLeft),
        top: Math.min(Math.max(position.top, bounds.minTop), maxTop),
    };
}

export function useResizableWindow(
    windowRef: RefObject<HTMLDivElement | null>,
    storageKey: string = 'generic-window-size',
    options: ResizableWindowOptions = {}
) {
    const { initialMaximized = false, minimumSize } = options;
    const requestedMinimum: WindowSize = {
        width: minimumSize?.width ?? MIN_WIDTH,
        height: minimumSize?.height ?? MIN_HEIGHT,
    };

    // Only consider maximized if initialMaximized is set AND there's no saved data
    const hasSavedData = !!SafeStorage.getItem(storageKey);
    const [isMaximized, setIsMaximized] = useState<boolean>(initialMaximized && !hasSavedData);

    // Window size - persisted
    const [size, setSize] = useState<WindowSize>(() => {
        const saved = SafeStorage.getItem(storageKey);
        if (saved) {
            const parsed = safeJSONParse<{ width?: number; height?: number }>(saved);
            if (parsed) {
                return { width: parsed.width || DEFAULT_SIZE.width, height: parsed.height || DEFAULT_SIZE.height };
            }
        }

        if (initialMaximized) {
            return maximizeWindowInWorkspace(getWorkspaceBounds()).size;
        }

        return DEFAULT_SIZE;
    });

    // Window position
    const [position, setPosition] = useState<WindowPosition | null>(() => {
        if (initialMaximized && !SafeStorage.getItem(storageKey)) {
            return maximizeWindowInWorkspace(getWorkspaceBounds()).position;
        }
        return null;
    });

    // Resize state
    const [resizeState, setResizeState] = useState<ResizeState>({
        isResizing: false,
        handle: null,
        startX: 0,
        startY: 0,
        startWidth: 0,
        startHeight: 0,
        startLeft: 0,
        startTop: 0,
    });

    // Drag state
    const [dragState, setDragState] = useState<DragState>({
        isDragging: false,
        startX: 0,
        startY: 0,
        startLeft: 0,
        startTop: 0,
    });

    // Center on mount
    useEffect(() => {
        if (position) return;
        const bounds = getWorkspaceBounds();
        const clampedSize = clampSizeToWorkspace(size, bounds, requestedMinimum);
        setSize(clampedSize);
        setPosition(centerWindowInWorkspace(clampedSize, bounds));
    }, []); // Run once on mount (or if position is explicitly nullified)

    // Respond to window/monitor resize when maximized
    useEffect(() => {
        const handleWindowResize = () => {
            const bounds = getWorkspaceBounds();
            if (isMaximized) {
                const maximized = maximizeWindowInWorkspace(bounds);
                setSize((currentSize) => isSameSize(currentSize, maximized.size) ? currentSize : maximized.size);
                setPosition((currentPosition) => {
                    if (!currentPosition) return maximized.position;
                    return isSamePosition(currentPosition, maximized.position) ? currentPosition : maximized.position;
                });
                return;
            }

            setSize((currentSize) => {
                const clampedSize = clampSizeToWorkspace(currentSize, bounds, requestedMinimum);
                setPosition((currentPosition) => {
                    if (!currentPosition) return currentPosition;
                    const clampedPosition = clampPositionToWorkspace(currentPosition, clampedSize, bounds);
                    return isSamePosition(currentPosition, clampedPosition) ? currentPosition : clampedPosition;
                });
                return isSameSize(currentSize, clampedSize) ? currentSize : clampedSize;
            });
        };

        handleWindowResize();
        window.addEventListener('resize', handleWindowResize);
        return () => window.removeEventListener('resize', handleWindowResize);
    }, [isMaximized, requestedMinimum.height, requestedMinimum.width]);


    // Handle Resize Start
    const handleResizeStart = useCallback((e: React.MouseEvent, handle: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!windowRef.current) return;

        const rect = windowRef.current.getBoundingClientRect();
        setResizeState({
            isResizing: true,
            handle,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: rect.width,
            startHeight: rect.height,
            startLeft: rect.left,
            startTop: rect.top,
        });
    }, [windowRef]);

    // Resize Effect
    useEffect(() => {
        if (!resizeState.isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - resizeState.startX;
            const deltaY = e.clientY - resizeState.startY;
            const { handle, startWidth, startHeight, startLeft, startTop } = resizeState;

            let newWidth = startWidth;
            let newHeight = startHeight;
            let newLeft = startLeft;
            let newTop = startTop;

            const bounds = getWorkspaceBounds();
            const maxWidth = bounds.maxWidth;
            const maxHeight = bounds.maxHeight;
            const responsiveMinimumSize = getResponsiveMinimumSize(bounds, requestedMinimum);

            if (handle?.includes('right')) newWidth = Math.min(Math.max(startWidth + deltaX, responsiveMinimumSize.width), maxWidth);
            if (handle?.includes('left')) {
                const widthChange = startWidth - deltaX;
                if (widthChange >= responsiveMinimumSize.width && widthChange <= maxWidth) {
                    newWidth = widthChange;
                    newLeft = Math.max(bounds.minLeft, startLeft + deltaX);
                }
            }
            if (handle?.includes('bottom')) newHeight = Math.min(Math.max(startHeight + deltaY, responsiveMinimumSize.height), maxHeight);
            if (handle?.includes('top')) {
                const heightChange = startHeight - deltaY;
                if (heightChange >= responsiveMinimumSize.height && heightChange <= maxHeight) {
                    newHeight = heightChange;
                    newTop = Math.max(bounds.minTop, startTop + deltaY);
                }
            }

            setSize({ width: newWidth, height: newHeight });
            if (handle?.includes('left') || handle?.includes('top')) {
                setPosition({ left: newLeft, top: newTop });
            }
        };

        const handleMouseUp = () => {
            setResizeState(prev => ({ ...prev, isResizing: false, handle: null }));
            SafeStorage.trySetItem(storageKey, JSON.stringify(size));
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [requestedMinimum.height, requestedMinimum.width, resizeState, size, storageKey]);

    // Handle Drag Start
    const handleDragStart = useCallback((e: React.MouseEvent) => {
        if (resizeState.isResizing) return;
        if (!windowRef.current || e.button !== 0) return;

        const target = e.target as HTMLElement;
        if (target.closest('button, input, textarea, select, [role="button"], a')) return;

        e.preventDefault();

        const rect = windowRef.current.getBoundingClientRect();
        setDragState({
            isDragging: true,
            startX: e.clientX,
            startY: e.clientY,
            startLeft: rect.left,
            startTop: rect.top,
        });
    }, [resizeState.isResizing, windowRef]);

    // Drag Effect
    useEffect(() => {
        if (!dragState.isDragging) return;

        // GG-38 layout-thrash repair: the frame's rect was re-measured on every
        // mousemove, forcing a synchronous layout per pointer event right after
        // the previous move's setPosition style write. The window cannot change
        // size mid-drag (resizing and dragging are mutually exclusive), so
        // measure once when the drag activates and reuse the dimensions for
        // clamping. Clamp math and drag behavior are unchanged.
        const draggedRect = windowRef.current?.getBoundingClientRect();

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - dragState.startX;
            const deltaY = e.clientY - dragState.startY;
            const rect = draggedRect;
            if (!rect) return;

            const bounds = getWorkspaceBounds();
            const minLeft = bounds.minLeft;
            const minTop = bounds.minTop;
            const maxLeft = Math.max(minLeft, window.innerWidth - rect.width - WINDOW_MARGIN);
            const maxTop = Math.max(minTop, window.innerHeight - rect.height - WINDOW_MARGIN);

            const nextLeft = Math.min(Math.max(dragState.startLeft + deltaX, minLeft), maxLeft);
            const nextTop = Math.min(Math.max(dragState.startTop + deltaY, minTop), maxTop);

            setPosition({ left: nextLeft, top: nextTop });
        };

        const handleMouseUp = () => {
            setDragState(prev => ({ ...prev, isDragging: false }));
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState, windowRef]);

    const handleMaximize = useCallback(() => {
        if (isMaximized) {
            // Toggle to smaller default size
            const bounds = getWorkspaceBounds();
            const defaultSize = clampSizeToWorkspace(DEFAULT_SIZE, bounds, requestedMinimum);
            setSize(defaultSize);
            setPosition(centerWindowInWorkspace(defaultSize, bounds));
            setIsMaximized(false);
        } else {
            // Toggle to maximized
            const maximized = maximizeWindowInWorkspace(getWorkspaceBounds());
            setSize(maximized.size);
            setPosition(maximized.position);
            setIsMaximized(true);
        }
    }, [isMaximized, requestedMinimum.height, requestedMinimum.width]);

    const handleReset = useCallback(() => {
        const bounds = getWorkspaceBounds();
        const defaultSize = clampSizeToWorkspace(DEFAULT_SIZE, bounds, requestedMinimum);
        setSize(defaultSize);
        setPosition(centerWindowInWorkspace(defaultSize, bounds));
        SafeStorage.removeItem(storageKey);
    }, [requestedMinimum.height, requestedMinimum.width, storageKey]);

    return {
        size,
        position,
        resizeState,
        dragState,
        isMaximized,
        handleResizeStart,
        handleDragStart,
        handleMaximize,
        handleReset
    };
}
