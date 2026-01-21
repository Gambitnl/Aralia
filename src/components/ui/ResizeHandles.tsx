/**
 * @file ResizeHandles.tsx
 * Generic resize handle buttons for any resizable window.
 */
import React from 'react';
import { Z_INDEX } from '../../styles/zIndex';

interface ResizeHandlesProps {
    onResizeStart: (e: React.MouseEvent, handle: string) => void;
}

export const ResizeHandles: React.FC<ResizeHandlesProps> = ({ onResizeStart }) => {
    return (
        <>
            {/* Corner handles */}
            <button
                key="handle-top-left"
                type="button"
                aria-label="Resize top-left"
                className={`absolute -top-1 -left-1 w-2.5 h-2.5 cursor-nwse-resize rounded-full z-[${Z_INDEX.RESIZE_HANDLES_CORNERS}] bg-amber-400/30 hover:bg-amber-400 hover:shadow-[0_0_6px_rgba(251,191,36,0.6)] transition-all duration-200 select-none pointer-events-auto`}
                onMouseDown={(e) => onResizeStart(e, 'top-left')}
                title="Resize"
            />
            <button
                key="handle-top-right"
                type="button"
                aria-label="Resize top-right"
                className={`absolute -top-1 -right-1 w-2.5 h-2.5 cursor-nesw-resize rounded-full z-[${Z_INDEX.RESIZE_HANDLES_CORNERS}] bg-amber-400/30 hover:bg-amber-400 hover:shadow-[0_0_6px_rgba(251,191,36,0.6)] transition-all duration-200 select-none pointer-events-auto`}
                onMouseDown={(e) => onResizeStart(e, 'top-right')}
                title="Resize"
            />
            <button
                key="handle-bottom-left"
                type="button"
                aria-label="Resize bottom-left"
                className="absolute -bottom-1 -left-1 w-2.5 h-2.5 cursor-nesw-resize rounded-full z-[${Z_INDEX.RESIZE_HANDLES_CORNERS}] bg-amber-400/30 hover:bg-amber-400 hover:shadow-[0_0_6px_rgba(251,191,36,0.6)] transition-all duration-200 select-none pointer-events-auto"
                onMouseDown={(e) => onResizeStart(e, 'bottom-left')}
                title="Resize"
            />
            <button
                key="handle-bottom-right"
                type="button"
                aria-label="Resize bottom-right"
                className="absolute -bottom-1 -right-1 w-2.5 h-2.5 cursor-nwse-resize rounded-full z-[${Z_INDEX.RESIZE_HANDLES_CORNERS}] bg-amber-400/30 hover:bg-amber-400 hover:shadow-[0_0_6px_rgba(251,191,36,0.6)] transition-all duration-200 select-none pointer-events-auto"
                onMouseDown={(e) => onResizeStart(e, 'bottom-right')}
                title="Resize"
            />

            {/* Edge handles */}
            <button
                key="handle-top"
                type="button"
                aria-label="Resize top edge"
                className="absolute -top-0.5 left-1/2 transform -translate-x-1/2 w-12 h-1 cursor-ns-resize z-[${Z_INDEX.RESIZE_HANDLES_HORIZONTAL}] rounded-full bg-amber-400/20 hover:bg-amber-400/80 hover:shadow-[0_0_4px_rgba(251,191,36,0.5)] transition-all duration-200 select-none pointer-events-auto"
                onMouseDown={(e) => onResizeStart(e, 'top')}
                title="Resize"
            />
            <button
                key="handle-bottom"
                type="button"
                aria-label="Resize bottom edge"
                className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-12 h-1 cursor-ns-resize z-[${Z_INDEX.RESIZE_HANDLES_HORIZONTAL}] rounded-full bg-amber-400/20 hover:bg-amber-400/80 hover:shadow-[0_0_4px_rgba(251,191,36,0.5)] transition-all duration-200 select-none pointer-events-auto"
                onMouseDown={(e) => onResizeStart(e, 'bottom')}
                title="Resize"
            />
            <button
                key="handle-left"
                type="button"
                aria-label="Resize left edge"
                className="absolute -left-0.5 top-1/2 transform -translate-y-1/2 w-1 h-12 cursor-ew-resize z-[${Z_INDEX.RESIZE_HANDLES_HORIZONTAL}] rounded-full bg-amber-400/20 hover:bg-amber-400/80 hover:shadow-[0_0_4px_rgba(251,191,36,0.5)] transition-all duration-200 select-none pointer-events-auto"
                onMouseDown={(e) => onResizeStart(e, 'left')}
                title="Resize"
            />
            <button
                key="handle-right"
                type="button"
                aria-label="Resize right edge"
                className="absolute -right-0.5 top-1/2 transform -translate-y-1/2 w-1 h-12 cursor-ew-resize z-[${Z_INDEX.RESIZE_HANDLES_HORIZONTAL}] rounded-full bg-amber-400/20 hover:bg-amber-400/80 hover:shadow-[0_0_4px_rgba(251,191,36,0.5)] transition-all duration-200 select-none pointer-events-auto"
                onMouseDown={(e) => onResizeStart(e, 'right')}
                title="Resize"
            />
        </>
    );
};
