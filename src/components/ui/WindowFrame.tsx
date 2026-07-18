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
import React, { useRef } from 'react';
import { useResizableWindow, type WindowSize } from '../../hooks/useResizableWindow';
import Tooltip from './Tooltip';
import { ResizeHandles } from './ResizeHandles';
import { Z_INDEX } from '../../styles/zIndex';

// ============================================================================
// Component Contract
// ============================================================================
// Callers provide a title, content, and optional title-bar actions. WindowFrame
// owns the outer chrome and keeps the controls reachable on cramped viewports.
// ============================================================================
interface WindowFrameProps {
    title: string;
    children: React.ReactNode;
    onClose?: () => void;
    storageKey?: string;
    headerActions?: React.ReactNode;
    initialMaximized?: boolean;
    minimumSize?: Partial<WindowSize>;
}

export const WindowFrame: React.FC<WindowFrameProps> = ({
    title,
    children,
    onClose,
    storageKey = 'generic-window',
    headerActions,
    initialMaximized = true,
    minimumSize,
}) => {
    // The hook owns persisted size, drag state, resize state, and viewport
    // clamping. The frame uses those values directly as fixed-position chrome.
    const windowRef = useRef<HTMLDivElement>(null);
    const {
        size,
        position,
        resizeState,
        dragState,
        isMaximized,
        handleResizeStart,
        handleDragStart,
        handleMaximize,
        handleReset
    } = useResizableWindow(windowRef, storageKey, { initialMaximized, minimumSize });

    // If position is not calculated yet, center the frame temporarily so the
    // first paint does not jump from a corner to the stored or clamped position.
    const style: React.CSSProperties = {
        width: `${size.width}px`,
        height: `${size.height}px`,
        position: 'fixed',
        left: position ? `${position.left}px` : '50%',
        top: position ? `${position.top}px` : '50%',
        transform: position ? 'none' : 'translate(-50%, -50%)',
        margin: position ? '0' : undefined,
        zIndex: Z_INDEX.WINDOW_FRAME,
        userSelect: resizeState.isResizing || dragState.isDragging ? 'none' : undefined,
    };

    return (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: Z_INDEX.WINDOW_FRAME }}>
            {/* The outer window keeps pointer events enabled while the backdrop
                remains transparent to game surfaces behind it. */}
            <div
                ref={windowRef}
                id={`window-${storageKey}`}
                data-testid={`window-${storageKey}`}
                // WindowFrame panels are modal-like 2D surfaces: the app locks
                // background scroll and focuses the owning wrapper while they
                // are open. Exposing the shared shell as a named dialog lets
                // players using assistive tech and tests find the active window
                // by the same title sighted players see in the title bar.
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
                style={style}
            >
                <ResizeHandles onResizeStart={handleResizeStart} />

                {/* The title bar is draggable, but it also wraps. This prevents
                    custom header actions from pushing reset, maximize, or close
                    controls offscreen in phone-width WindowFrames. */}
                <div
                    data-testid="window-frame-header"
                    className={`
                        flex flex-wrap items-start justify-between gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700
                        ${dragState.isDragging ? 'cursor-grabbing' : 'cursor-grab'}
`}
                    onMouseDown={handleDragStart}
                >
                    <h2 className="min-w-0 basis-full flex-1 break-words text-lg leading-tight font-cinzel font-bold text-amber-400 select-none pointer-events-none sm:basis-auto sm:text-xl">
                        {title}
                    </h2>

                    <div
                        data-testid="window-frame-header-actions"
                        // Title-bar actions must sit above the generous corner resize
                        // hit zones. The top-right zone intentionally reaches 44px for
                        // touch resizing, but without this layer priority it completely
                        // intercepts the equally important Close button.
                        className="relative ml-auto flex max-w-full flex-wrap items-center justify-end gap-2"
                        onMouseDown={e => e.stopPropagation()}
                        style={{ zIndex: Z_INDEX.RESIZE_HANDLES_CORNERS + 1 }}
                    >
                        {headerActions}

                        <button
                            type="button"
                            onClick={handleReset}
                            className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-500 hover:text-amber-400 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
                            aria-label="Reset layout"
                            title="Reset to default size and position"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>

                        <button
                            type="button"
                            onClick={handleMaximize}
                            className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-500 hover:text-amber-400 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
                            aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
                            title={isMaximized ? 'Restore to default size' : 'Maximize to fit window'}
                        >
                            {isMaximized ? (
                                // Restore icon (overlapping squares)
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            ) : (
                                // Maximize icon (expand arrows)
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                </svg>
                            )}
                        </button>

                        {onClose && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-3xl leading-none text-gray-400 hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                aria-label="Close"
                            >
                                ×
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden relative">
                    {children}
                </div>
            </div>
        </div>
    );
};
