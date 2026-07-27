/**
 * @file useGlossaryModal.ts
 * Custom hook for managing glossary modal position, size, drag, and resize state.
 * Extracted from Glossary.tsx for better modularity and testability.
 */
import { RefObject } from 'react';
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
/**
 * Hook to manage the modal size, position, drag, and resize functionality.
 */
export declare function useGlossaryModal(isOpen: boolean, modalRef: RefObject<HTMLDivElement | null>): {
    modalSize: ModalSize;
    modalPosition: ModalPosition;
    resizeState: ResizeState;
    dragState: DragState;
    columnResizeState: ColumnResizeState;
    handleResizeStart: (e: React.MouseEvent, handle: string) => void;
    handleDragStart: (e: React.MouseEvent) => void;
    handleColumnResizeStart: (e: React.MouseEvent) => void;
    handleResetLayout: () => void;
    handleMaximize: (spacer?: number) => void;
};
