/**
 * @file ResizeHandles.tsx
 * This file renders the invisible hit targets around every resizable game window.
 *
 * WindowFrame uses these handles to let players resize party, glossary, map,
 * creator, and other 2D panels. The visible amber marks stay small so the frame
 * does not look bulky, while the actual buttons are touch-sized for cramped
 * screens and pointer use.
 * @component-owner UI Team / Core UI
 */
import React from 'react';
import { Z_INDEX } from '../../styles/zIndex';

type ResizeHandle =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right';

interface ResizeHandlesProps {
    onResizeStart: (e: React.MouseEvent, handle: ResizeHandle) => void;
}

interface HandleDefinition {
    handle: ResizeHandle;
    label: string;
    buttonClassName: string;
    markerClassName: string;
    zIndex: number;
}

// ============================================================================
// Resize Handle Layout
// ============================================================================
// Each handle is a 44px minimum button. The nested span is only the visual mark,
// which preserves the old lightweight frame chrome while fixing tiny hit areas.
// ============================================================================
const cornerMarkerClass =
  'absolute h-2.5 w-2.5 rounded-full bg-amber-400/30 transition-all duration-200 group-hover:bg-amber-400 group-hover:shadow-[0_0_6px_rgba(251,191,36,0.6)]';
const edgeMarkerClass =
  'absolute rounded-full bg-amber-400/20 transition-all duration-200 group-hover:bg-amber-400/80 group-hover:shadow-[0_0_4px_rgba(251,191,36,0.5)]';

const handleDefinitions: HandleDefinition[] = [
  {
    handle: 'top-left',
    label: 'Resize top-left',
    buttonClassName: 'absolute left-0 top-0 h-11 w-11 cursor-nwse-resize',
    markerClassName: `${cornerMarkerClass} left-0 top-0`,
    zIndex: Z_INDEX.RESIZE_HANDLES_CORNERS,
  },
  {
    handle: 'top-right',
    label: 'Resize top-right',
    buttonClassName: 'absolute right-0 top-0 h-11 w-11 cursor-nesw-resize',
    markerClassName: `${cornerMarkerClass} right-0 top-0`,
    zIndex: Z_INDEX.RESIZE_HANDLES_CORNERS,
  },
  {
    handle: 'bottom-left',
    label: 'Resize bottom-left',
    buttonClassName: 'absolute bottom-0 left-0 h-11 w-11 cursor-nesw-resize',
    markerClassName: `${cornerMarkerClass} bottom-0 left-0`,
    zIndex: Z_INDEX.RESIZE_HANDLES_CORNERS,
  },
  {
    handle: 'bottom-right',
    label: 'Resize bottom-right',
    buttonClassName: 'absolute bottom-0 right-0 h-11 w-11 cursor-nwse-resize',
    markerClassName: `${cornerMarkerClass} bottom-0 right-0`,
    zIndex: Z_INDEX.RESIZE_HANDLES_CORNERS,
  },
  {
    handle: 'top',
    label: 'Resize top edge',
    buttonClassName: 'absolute left-1/2 top-0 h-11 w-12 -translate-x-1/2 cursor-ns-resize',
    markerClassName: `${edgeMarkerClass} left-1/2 top-0 h-1 w-12 -translate-x-1/2`,
    zIndex: Z_INDEX.RESIZE_HANDLES_HORIZONTAL,
  },
  {
    handle: 'bottom',
    label: 'Resize bottom edge',
    buttonClassName: 'absolute bottom-0 left-1/2 h-11 w-12 -translate-x-1/2 cursor-ns-resize',
    markerClassName: `${edgeMarkerClass} bottom-0 left-1/2 h-1 w-12 -translate-x-1/2`,
    zIndex: Z_INDEX.RESIZE_HANDLES_HORIZONTAL,
  },
  {
    handle: 'left',
    label: 'Resize left edge',
    buttonClassName: 'absolute left-0 top-1/2 h-12 w-11 -translate-y-1/2 cursor-ew-resize',
    markerClassName: `${edgeMarkerClass} left-0 top-1/2 h-12 w-1 -translate-y-1/2`,
    zIndex: Z_INDEX.RESIZE_HANDLES_HORIZONTAL,
  },
  {
    handle: 'right',
    label: 'Resize right edge',
    buttonClassName: 'absolute right-0 top-1/2 h-12 w-11 -translate-y-1/2 cursor-ew-resize',
    markerClassName: `${edgeMarkerClass} right-0 top-1/2 h-12 w-1 -translate-y-1/2`,
    zIndex: Z_INDEX.RESIZE_HANDLES_HORIZONTAL,
  },
];

export const ResizeHandles: React.FC<ResizeHandlesProps> = ({ onResizeStart }) => {
    return (
        <>
            {handleDefinitions.map(({ handle, label, buttonClassName, markerClassName, zIndex }) => (
                // These are pointer-only drag hit zones. They stay out of the
                // keyboard and screen-reader control order because there is no
                // keyboard resize behavior behind them; real window buttons and
                // gameplay content should receive focus first.
                <div
                    key={handle}
                    aria-hidden="true"
                    data-resize-handle={handle}
                    className={`${buttonClassName} group appearance-none border-0 bg-transparent p-0 pointer-events-auto select-none`}
                    onMouseDown={(e) => onResizeStart(e, handle)}
                    style={{ zIndex }}
                    title={label}
                >
                    <span aria-hidden="true" className={markerClassName} />
                </div>
            ))}
        </>
    );
};
