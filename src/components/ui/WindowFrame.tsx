/**
 * @file WindowFrame.tsx
 * A generic, resizable, draggable window frame similar to the Glossary modal.
 */
import React, { useRef } from 'react';
import { useResizableWindow } from '../../hooks/useResizableWindow';
import { ResizeHandles } from './ResizeHandles';

interface WindowFrameProps {
    title: string;
    children: React.ReactNode;
    onClose?: () => void;
    storageKey?: string;
    headerActions?: React.ReactNode;
}

export const WindowFrame: React.FC<WindowFrameProps> = ({
    title,
    children,
    onClose,
    storageKey = 'generic-window',
    headerActions
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
    } = useResizableWindow(windowRef, storageKey);

    // If position isn't calculated yet, don't render or render hidden to avoid jump
    const style: React.CSSProperties = {
        width: `${size.width}px`,
        height: `${size.height}px`,
        position: 'fixed',
        left: position ? `${position.left}px` : '50%',
        top: position ? `${position.top}px` : '50%',
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
                        flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700
                        ${dragState.isDragging ? 'cursor-grabbing' : 'cursor-grab'}
                    `}
                    onMouseDown={handleDragStart}
                >
                    <h2 className="text-xl font-cinzel font-bold text-amber-400 select-none pointer-events-none">
                        {title}
                    </h2>
                    
                    <div className="flex items-center gap-2" onMouseDown={e => e.stopPropagation()}>
                        {headerActions}
                        
                        <button
                            onClick={handleReset}
                            className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-700 transition-colors"
                            title="Reset Size"
                        >
                            ↺
                        </button>
                        <button
                            onClick={handleMaximize}
                            className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-700 transition-colors"
                            title="Maximize"
                        >
                            □
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-1 text-gray-400 hover:text-red-400 rounded hover:bg-gray-700 transition-colors ml-2"
                                title="Close"
                            >
                                ✕
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
