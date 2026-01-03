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

export function useResizableWindow(
    windowRef: RefObject<HTMLDivElement | null>,
    storageKey: string = 'generic-window-size',
    options: { initialMaximized?: boolean } = {}
) {
    const { initialMaximized = false } = options;

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
            return {
                width: window.innerWidth - 40,
                height: window.innerHeight - 40
            };
        }

        return DEFAULT_SIZE;
    });

    // Window position
    const [position, setPosition] = useState<WindowPosition | null>(() => {
        if (initialMaximized && !SafeStorage.getItem(storageKey)) {
            return { left: 20, top: 20 };
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
        const left = (window.innerWidth - size.width) / 2;
        const top = (window.innerHeight - size.height) / 2;
        setPosition({ left, top });
    }, []); // Run once on mount (or if position is explicitly nullified)

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

            const maxWidth = window.innerWidth - 40;
            const maxHeight = window.innerHeight - 40;

            if (handle?.includes('right')) newWidth = Math.min(Math.max(startWidth + deltaX, MIN_WIDTH), maxWidth);
            if (handle?.includes('left')) {
                const widthChange = startWidth - deltaX;
                if (widthChange >= MIN_WIDTH && widthChange <= maxWidth) {
                    newWidth = widthChange;
                    newLeft = startLeft + deltaX;
                }
            }
            if (handle?.includes('bottom')) newHeight = Math.min(Math.max(startHeight + deltaY, MIN_HEIGHT), maxHeight);
            if (handle?.includes('top')) {
                const heightChange = startHeight - deltaY;
                if (heightChange >= MIN_HEIGHT && heightChange <= maxHeight) {
                    newHeight = heightChange;
                    newTop = startTop + deltaY;
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
    }, [resizeState, size, storageKey]);

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

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - dragState.startX;
            const deltaY = e.clientY - dragState.startY;
            const rect = windowRef.current?.getBoundingClientRect();
            if (!rect) return;

            const minLeft = 20;
            const minTop = 20;
            const maxLeft = Math.max(minLeft, window.innerWidth - rect.width - 20);
            const maxTop = Math.max(minTop, window.innerHeight - rect.height - 20);

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
        const spacer = 20;
        const width = window.innerWidth - (spacer * 2);
        const height = window.innerHeight - (spacer * 2);
        setSize({ width, height });
        setPosition({ left: spacer, top: spacer });
    }, []);

    const handleReset = useCallback(() => {
        setSize(DEFAULT_SIZE);
        const left = (window.innerWidth - DEFAULT_SIZE.width) / 2;
        const top = (window.innerHeight - DEFAULT_SIZE.height) / 2;
        setPosition({ left, top });
        SafeStorage.removeItem(storageKey);
    }, [storageKey]);

    return {
        size,
        position,
        resizeState,
        dragState,
        handleResizeStart,
        handleDragStart,
        handleMaximize,
        handleReset
    };
}
