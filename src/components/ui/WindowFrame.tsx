/**
 * @file WindowFrame.tsx
 * A generic, resizable, draggable window frame similar to the Glossary modal.
 */
import React, { useRef } from 'react';
import { useResizableWindow } from '../../hooks/useResizableWindow';
import Tooltip from './Tooltip';
import { ResizeHandles } from './ResizeHandles';

interface WindowFrameProps {
    title: string;
    children: React.ReactNode;
    onClose?: () => void;
    storageKey?: string;
    headerActions?: React.ReactNode;
    initialMaximized?: boolean;
}

export const WindowFrame: React.FC<WindowFrameProps> = ({
    title,
    children,
    onClose,
    storageKey = 'generic-window',
    headerActions,
    initialMaximized = false
}) => {
    const windowRef = useRef<HTMLDivElement>(null);
    const {
        size,
        position,
        resizeState,
        dragState,
        handleResizeStart,
        handleDragStart,
        handleMaximize,
        handleReset
    } = useResizableWindow(windowRef, storageKey, { initialMaximized });

    // If position isn't calculated yet, don't render or render hidden to avoid jump
    const style: React.CSSProperties = {
        width: `${size.width} px`,
        height: `${size.height} px`,
        position: 'fixed',
        left: position ? `${position.left} px` : '50%',
        top: position ? `${position.top} px` : '50%',
        transform: position ? 'none' : 'translate(-50%, -50%)',
        margin: position ? '0' : undefined,
        zIndex: 100,
        userSelect: resizeState.isResizing || dragState.isDragging ? 'none' : undefined,
    };

    return (
        <div className="fixed inset-0 pointer-events-none z-50">
            {/* Window Container */}
            <div
                ref={windowRef}
                className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
                style={style}
            >
                <ResizeHandles onResizeStart={handleResizeStart} />

                {/* Header (Draggable) */}
                <div
                    className={`
                        flex items - center justify - between px - 4 py - 3 bg - gray - 800 border - b border - gray - 700
                        ${dragState.isDragging ? 'cursor-grabbing' : 'cursor-grab'}
`}
                    onMouseDown={handleDragStart}
                >
                    <h2 className="text-xl font-cinzel font-bold text-amber-400 select-none pointer-events-none">
                        {title}
                    </h2>

                    <div className="flex items-center gap-3" onMouseDown={e => e.stopPropagation()}>
                        {headerActions}

                        <button
                            type="button"
                            onClick={handleReset}
                            className="text-gray-500 hover:text-amber-400 p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
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
                            className="text-gray-500 hover:text-amber-400 p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
                            aria-label="Maximize to window"
                            title="Maximize to fit window"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                        </button>

                        {onClose && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-200 text-3xl p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-400 leading-none"
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
