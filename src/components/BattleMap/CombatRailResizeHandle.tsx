// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/07/2026, 19:13:14
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file provides the thin desktop grabber between the battlefield and a
 * combat side rail. It supports pointer dragging, arrow keys, Home/End bounds,
 * and double-click reset so resizing is available to mouse and keyboard
 * users without adding permanent visual weight to the tactical screen.
 *
 * Called by: BattleMapDemo.tsx and CombatView.tsx
 * Depends on: the parent combat layout hook for the saved width
 */
import React, { useEffect, useRef, useState } from 'react';

// ============================================================================
// Public Resize Contract
// ============================================================================
// Width is measured in CSS pixels. The parent owns persistence; this handle only
// translates pointer and keyboard movement into a bounded next width.
// ============================================================================

interface CombatRailResizeHandleProps {
  side: 'roster' | 'command';
  value: number;
  minimum: number;
  maximum: number;
  onChange: (value: number) => void;
  onReset: () => void;
}

interface DragState {
  startX: number;
  startValue: number;
}

const KEYBOARD_STEP = 8;

const clampWidth = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, Math.round(value)))
);

// ============================================================================
// Desktop Rail Grabber
// ============================================================================
// The roster grows toward the right; the command rail grows toward the left.
// Direction is therefore inverted for the command handle in both input modes.
// ============================================================================

const CombatRailResizeHandle: React.FC<CombatRailResizeHandleProps> = ({
  side,
  value,
  minimum,
  maximum,
  onChange,
  onReset,
}) => {
  const dragStateRef = useRef<DragState | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const direction = side === 'roster' ? 1 : -1;
  const label = side === 'roster' ? 'Resize combat roster' : 'Resize combat commands';

  // While a drag is active, suppress selection and show the resize cursor
  // globally. Listener cleanup itself is installed synchronously below.
  useEffect(() => {
    if (!isDragging) return undefined;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isDragging]);

  // A component can disappear mid-drag when its rail is hidden. Remove any
  // window listeners during unmount so the next screen never inherits them.
  useEffect(() => () => {
    dragCleanupRef.current?.();
  }, []);

  // Window listeners are attached during the original mouse-down event, before
  // movement can begin. This matches the repository's proven resizable panels
  // and keeps the drag alive after the pointer leaves the 16px hit target.
  const handleMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    dragCleanupRef.current?.();
    dragStateRef.current = {
      startX: event.clientX,
      startValue: value,
    };
    setIsDragging(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;
      const delta = (moveEvent.clientX - dragState.startX) * direction;
      onChange(clampWidth(dragState.startValue + delta, minimum, maximum));
    };

    const finishDrag = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', finishDrag);
      dragStateRef.current = null;
      dragCleanupRef.current = null;
      setIsDragging(false);
    };

    dragCleanupRef.current = finishDrag;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', finishDrag);
  };

  // Arrow keys move the visible separator in screen space. Home and End expose
  // the exact bounds without requiring dozens of repeated key presses.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let nextValue: number | null = null;

    if (event.key === 'ArrowLeft') nextValue = value - (KEYBOARD_STEP * direction);
    if (event.key === 'ArrowRight') nextValue = value + (KEYBOARD_STEP * direction);
    if (event.key === 'Home') nextValue = minimum;
    if (event.key === 'End') nextValue = maximum;

    if (nextValue === null) return;
    event.preventDefault();
    onChange(clampWidth(nextValue, minimum, maximum));
  };

  return (
    /* A native button supplies dependable focus and input semantics. Its
       separator role exposes the current numeric width to assistive tools. */
    /* eslint-disable-next-line no-restricted-syntax -- This borderless grabber is a separator control, not a standard command button. */
    <button
      type="button"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={minimum}
      aria-valuemax={maximum}
      aria-valuenow={value}
      aria-valuetext={`${value} pixels`}
      data-testid={`combat-${side}-resize-handle`}
      className={`group absolute bottom-0 top-0 z-30 hidden w-4 touch-none cursor-col-resize appearance-none items-center justify-center border-0 bg-transparent p-0 outline-none lg:flex ${
        side === 'roster' ? 'right-0' : 'left-0'
      }`}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      onDoubleClick={onReset}
      title="Drag or use arrow keys to resize. Double-click to reset."
    >
      {/* The line is quiet at rest but bright enough on hover, focus, or drag
          to explain that the otherwise invisible gutter is interactive. */}
      <span className={`h-16 w-0.5 rounded-full transition-all ${
        isDragging
          ? 'bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.65)]'
          : 'bg-slate-600/55 group-hover:bg-amber-400/80 group-focus:bg-amber-400/80 group-focus:shadow-[0_0_7px_rgba(251,191,36,0.5)]'
      }`} />
    </button>
  );
};

export default CombatRailResizeHandle;
