/**
 * @file useGlossaryModal.ts
 * Custom hook for managing glossary modal position, size, drag, and resize state.
 * Extracted from Glossary.tsx for better modularity and testability.
 */
import { useState, useCallback, useEffect, RefObject } from 'react';
import { SafeStorage } from '../../../utils/storageUtils';
import { safeJSONParse } from '../../../utils/securityUtils';

export interface ModalSize {
    width: number;
    height: number;
}

export interface ModalPosition {
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

export interface ColumnResizeState {
    isResizing: boolean;
    startX: number;
    startListWidth: number;
    startEntryWidth: number;
}

const DEFAULT_SIZE = { width: 1024, height: 835 };
const MIN_WIDTH = 600;
const MIN_HEIGHT = 400;
const STORAGE_KEY = 'glossary-modal-size';

/**
 * Hook to manage the modal size, position, drag, and resize functionality.
 */
export function useGlossaryModal(
    isOpen: boolean,
    modalRef: RefObject<HTMLDivElement | null>
) {
    // Modal size - persisted to localStorage
    const [modalSize, setModalSize] = useState<ModalSize>(() => {
        const saved = SafeStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = safeJSONParse<{ width?: number; height?: number }>(saved);
            if (parsed) {
                return { width: parsed.width || DEFAULT_SIZE.width, height: parsed.height || DEFAULT_SIZE.height };
            }
        }
        return DEFAULT_SIZE;
    });

    // Modal position (null means centered via CSS transform)
    const [modalPosition, setModalPosition] = useState<ModalPosition | null>(null);

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

    // Column resize state
    const [columnResizeState, setColumnResizeState] = useState<ColumnResizeState>({
        isResizing: false,
        startX: 0,
        startListWidth: 0,
        startEntryWidth: 0,
    });

    // Calculate centered position when modal opens
    useEffect(() => {
        if (!isOpen || resizeState.isResizing || modalPosition) return;

        const left = (window.innerWidth - modalSize.width) / 2;
        const top = (window.innerHeight - modalSize.height) / 2;
        setModalPosition({ left, top });
    }, [isOpen, modalSize, resizeState.isResizing, modalPosition]);

    // Reset position when modal closes
    useEffect(() => {
        if (!isOpen) {
            setModalPosition(null);
        }
    }, [isOpen]);

    // Handle resize start
    const handleResizeStart = useCallback((e: React.MouseEvent, handle: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!modalRef.current) return;

        const rect = modalRef.current.getBoundingClientRect();
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
    }, [modalRef]);

    // Resize mouse move/up effect
    useEffect(() => {
        if (!resizeState.isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!modalRef.current) return;

            const deltaX = e.clientX - resizeState.startX;
            const deltaY = e.clientY - resizeState.startY;
            const { handle, startWidth, startHeight, startLeft, startTop } = resizeState;

            let newWidth = startWidth;
            let newHeight = startHeight;
            let newLeft = startLeft;
            let newTop = startTop;

            const maxWidth = window.innerWidth - 40;
            const maxHeight = window.innerHeight - 40;

            // Handle different resize directions
            if (handle?.includes('right')) {
                newWidth = Math.min(Math.max(startWidth + deltaX, MIN_WIDTH), maxWidth);
            }
            if (handle?.includes('left')) {
                const widthChange = startWidth - deltaX;
                if (widthChange >= MIN_WIDTH && widthChange <= maxWidth) {
                    newWidth = widthChange;
                    newLeft = startLeft + deltaX;
                }
            }
            if (handle?.includes('bottom')) {
                newHeight = Math.min(Math.max(startHeight + deltaY, MIN_HEIGHT), maxHeight);
            }
            if (handle?.includes('top')) {
                const heightChange = startHeight - deltaY;
                if (heightChange >= MIN_HEIGHT && heightChange <= maxHeight) {
                    newHeight = heightChange;
                    newTop = startTop + deltaY;
                }
            }

            const newSize = { width: newWidth, height: newHeight };
            setModalSize(newSize);

            // Update position when resizing from left or top
            if (handle?.includes('left') || handle?.includes('top')) {
                setModalPosition({ left: newLeft, top: newTop });
            }
        };

        const handleMouseUp = () => {
            setResizeState(prev => ({ ...prev, isResizing: false, handle: null }));
            // Save only on mouse up to avoid layout thrashing
            SafeStorage.trySetItem(STORAGE_KEY, JSON.stringify(modalSize));
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizeState, modalSize, modalRef]);

    // Handle drag start
    const handleDragStart = useCallback((e: React.MouseEvent) => {
        if (resizeState.isResizing || columnResizeState.isResizing) return;
        if (!modalRef.current || e.button !== 0) return;

        const target = e.target as HTMLElement;
        if (target.closest('button, input, textarea, select, [role="button"], a')) return;

        e.preventDefault();
        e.stopPropagation();

        const rect = modalRef.current.getBoundingClientRect();
        setDragState({
            isDragging: true,
            startX: e.clientX,
            startY: e.clientY,
            startLeft: rect.left,
            startTop: rect.top,
        });
    }, [resizeState.isResizing, columnResizeState.isResizing, modalRef]);

    // Drag mouse move/up effect
    useEffect(() => {
        if (!dragState.isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!modalRef.current) return;

            const deltaX = e.clientX - dragState.startX;
            const deltaY = e.clientY - dragState.startY;
            const rect = modalRef.current.getBoundingClientRect();

            const minLeft = 20;
            const minTop = 20;
            const maxLeft = Math.max(minLeft, window.innerWidth - rect.width - 20);
            const maxTop = Math.max(minTop, window.innerHeight - rect.height - 20);

            const nextLeft = Math.min(Math.max(dragState.startLeft + deltaX, minLeft), maxLeft);
            const nextTop = Math.min(Math.max(dragState.startTop + deltaY, minTop), maxTop);

            setModalPosition({ left: nextLeft, top: nextTop });
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
    }, [dragState, modalRef]);

    // Column resize start
    const handleColumnResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const listElement = document.querySelector('.glossary-list-container');
        const entryElement = document.querySelector('.glossary-entry-container');

        if (!listElement || !entryElement) return;

        const listRect = listElement.getBoundingClientRect();
        const entryRect = entryElement.getBoundingClientRect();

        setColumnResizeState({
            isResizing: true,
            startX: e.clientX,
            startListWidth: listRect.width,
            startEntryWidth: entryRect.width,
        });
    }, []);

    // Column resize effect
    useEffect(() => {
        if (!columnResizeState.isResizing) return;

        const handleColumnMouseMove = (e: MouseEvent) => {
            const container = document.querySelector('.glossary-main-container');
            if (!container) return;

            const containerRect = container.getBoundingClientRect();
            const deltaX = e.clientX - columnResizeState.startX;

            const totalWidth = columnResizeState.startListWidth + columnResizeState.startEntryWidth;
            let newListWidth = columnResizeState.startListWidth + deltaX;
            let newEntryWidth = columnResizeState.startEntryWidth - deltaX;

            const minWidth = containerRect.width * 0.1;
            if (newListWidth < minWidth) {
                newListWidth = minWidth;
                newEntryWidth = totalWidth - minWidth;
            }
            if (newEntryWidth < minWidth) {
                newEntryWidth = minWidth;
                newListWidth = totalWidth - minWidth;
            }

            const listElement = document.querySelector('.glossary-list-container') as HTMLElement;
            const entryElement = document.querySelector('.glossary-entry-container') as HTMLElement;

            if (listElement && entryElement) {
                listElement.style.width = `${newListWidth}px`;
                entryElement.style.width = `${newEntryWidth}px`;
            }
        };

        const handleColumnMouseUp = () => {
            setColumnResizeState(prev => ({ ...prev, isResizing: false }));
        };

        document.addEventListener('mousemove', handleColumnMouseMove);
        document.addEventListener('mouseup', handleColumnMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleColumnMouseMove);
            document.removeEventListener('mouseup', handleColumnMouseUp);
        };
    }, [columnResizeState]);

    // Reset layout to defaults
    const handleResetLayout = useCallback(() => {
        setModalSize(DEFAULT_SIZE);
        SafeStorage.removeItem(STORAGE_KEY);

        const left = (window.innerWidth - DEFAULT_SIZE.width) / 2;
        const top = (window.innerHeight - DEFAULT_SIZE.height) / 2;
        setModalPosition({ left, top });

        const listElement = document.querySelector('.glossary-list-container') as HTMLElement;
        const entryElement = document.querySelector('.glossary-entry-container') as HTMLElement;
        if (listElement && entryElement) {
            listElement.style.width = '';
            entryElement.style.width = '';
        }
    }, []);

    const handleMaximize = useCallback((spacer: number = 20) => {
        const width = window.innerWidth - (spacer * 2);
        const height = window.innerHeight - (spacer * 2);

        setModalSize({ width, height });
        setModalPosition({ left: spacer, top: spacer });

        // Also reset columns to avoid weird ratios
        const listElement = document.querySelector('.glossary-list-container') as HTMLElement;
        const entryElement = document.querySelector('.glossary-entry-container') as HTMLElement;
        if (listElement && entryElement) {
            listElement.style.width = '';
            entryElement.style.width = '';
        }
    }, []);

    // Initialize column widths when modal opens
    useEffect(() => {
        if (isOpen) {
            const listElement = document.querySelector('.glossary-list-container') as HTMLElement;
            const entryElement = document.querySelector('.glossary-entry-container') as HTMLElement;

            if (listElement && entryElement) {
                listElement.style.width = '';
                entryElement.style.width = '';
            }
        }
    }, [isOpen]);

    return {
        modalSize,
        modalPosition,
        resizeState,
        dragState,
        columnResizeState,
        handleResizeStart,
        handleDragStart,
        handleColumnResizeStart,
        handleResetLayout,
        handleMaximize,
    };
}
