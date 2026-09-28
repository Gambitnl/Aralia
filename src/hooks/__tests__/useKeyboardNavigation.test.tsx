import { describe, it, expect, vi } from 'vitest';
import React, { useRef } from 'react';
import { render, fireEvent, renderHook } from '@testing-library/react';
import { useKeyboardNavigation } from '../useKeyboardNavigation';

/**
 * This test suite verifies the behavior of the useKeyboardNavigation hook.
 *
 * Keyboard navigation powers inventory grids, party selection lists, dialog choices,
 * and quick-bar radial menus. This hook supports both 2D grid coordinates (XY cursor)
 * and 1D DOM element focus cycles (vertical/horizontal lists).
 *
 * Covers: useKeyboardNavigation.ts
 * Tests: Grid arrow bounds, Enter/Space activation, Escape closing, List focus cycles,
 * and modifier key passthrough.
 */

// ============================================================================
// Grid Navigation Mode Tests
// ============================================================================
// Tests verifying 2D grid coordinate movement, bounding boxes, and action keys.
// ============================================================================

describe('useKeyboardNavigation - Grid Mode', () => {
  it('should navigate grid coordinates with arrow keys and respect grid bounds', () => {
    const onCoordsChange = vi.fn();
    const onActivate = vi.fn();
    const onClose = vi.fn();
    const containerRef = { current: null };

    const { result } = renderHook(() =>
      useKeyboardNavigation({
        containerRef,
        gridSize: { rows: 4, cols: 4 },
        currentCoords: { x: 1, y: 1 },
        onCoordsChange,
        onActivate,
        onClose,
      })
    );

    // ArrowUp -> y: 0
    result.current.handleKeyDown({ key: 'ArrowUp', preventDefault: vi.fn() } as unknown as React.KeyboardEvent);
    expect(onCoordsChange).toHaveBeenCalledWith({ x: 1, y: 0 });

    // ArrowDown -> y: 2
    result.current.handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as unknown as React.KeyboardEvent);
    expect(onCoordsChange).toHaveBeenCalledWith({ x: 1, y: 2 });

    // ArrowLeft -> x: 0
    result.current.handleKeyDown({ key: 'ArrowLeft', preventDefault: vi.fn() } as unknown as React.KeyboardEvent);
    expect(onCoordsChange).toHaveBeenCalledWith({ x: 0, y: 1 });

    // ArrowRight -> x: 2
    result.current.handleKeyDown({ key: 'ArrowRight', preventDefault: vi.fn() } as unknown as React.KeyboardEvent);
    expect(onCoordsChange).toHaveBeenCalledWith({ x: 2, y: 1 });
  });

  it('should clamp movement at grid edges (min 0, max cols/rows - 1)', () => {
    const onCoordsChange = vi.fn();
    const containerRef = { current: null };

    // At top-left corner (0, 0)
    const { result, rerender } = renderHook(
      ({ coords }) =>
        useKeyboardNavigation({
          containerRef,
          gridSize: { rows: 3, cols: 3 },
          currentCoords: coords,
          onCoordsChange,
        }),
      { initialProps: { coords: { x: 0, y: 0 } } }
    );

    // Pressing ArrowUp or ArrowLeft at (0, 0) should not emit new change
    result.current.handleKeyDown({ key: 'ArrowUp', preventDefault: vi.fn() } as unknown as React.KeyboardEvent);
    expect(onCoordsChange).not.toHaveBeenCalled();

    result.current.handleKeyDown({ key: 'ArrowLeft', preventDefault: vi.fn() } as unknown as React.KeyboardEvent);
    expect(onCoordsChange).not.toHaveBeenCalled();

    // Move to bottom-right corner (2, 2)
    rerender({ coords: { x: 2, y: 2 } });

    result.current.handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as unknown as React.KeyboardEvent);
    expect(onCoordsChange).not.toHaveBeenCalled();

    result.current.handleKeyDown({ key: 'ArrowRight', preventDefault: vi.fn() } as unknown as React.KeyboardEvent);
    expect(onCoordsChange).not.toHaveBeenCalled();
  });

  it('should trigger onActivate for Enter and Space in grid mode', () => {
    const onActivate = vi.fn();
    const containerRef = { current: null };

    const { result } = renderHook(() =>
      useKeyboardNavigation({
        containerRef,
        gridSize: { rows: 3, cols: 3 },
        currentCoords: { x: 1, y: 2 },
        onActivate,
      })
    );

    result.current.handleKeyDown({ key: 'Enter', preventDefault: vi.fn() } as unknown as React.KeyboardEvent);
    expect(onActivate).toHaveBeenCalledWith({ x: 1, y: 2 });

    result.current.handleKeyDown({ key: ' ', preventDefault: vi.fn() } as unknown as React.KeyboardEvent);
    expect(onActivate).toHaveBeenCalledWith({ x: 1, y: 2 });
  });

  it('should trigger onClose on Escape in grid mode', () => {
    const onClose = vi.fn();
    const containerRef = { current: null };

    const { result } = renderHook(() =>
      useKeyboardNavigation({
        containerRef,
        gridSize: { rows: 3, cols: 3 },
        currentCoords: { x: 0, y: 0 },
        onClose,
      })
    );

    result.current.handleKeyDown({ key: 'Escape', preventDefault: vi.fn() } as unknown as React.KeyboardEvent);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should ignore events with modifier keys (Ctrl/Meta/Alt)', () => {
    const onCoordsChange = vi.fn();
    const containerRef = { current: null };

    const { result } = renderHook(() =>
      useKeyboardNavigation({
        containerRef,
        gridSize: { rows: 3, cols: 3 },
        currentCoords: { x: 1, y: 1 },
        onCoordsChange,
      })
    );

    result.current.handleKeyDown({ key: 'ArrowUp', ctrlKey: true, preventDefault: vi.fn() } as unknown as React.KeyboardEvent);
    result.current.handleKeyDown({ key: 'ArrowUp', altKey: true, preventDefault: vi.fn() } as unknown as React.KeyboardEvent);
    result.current.handleKeyDown({ key: 'ArrowUp', metaKey: true, preventDefault: vi.fn() } as unknown as React.KeyboardEvent);

    expect(onCoordsChange).not.toHaveBeenCalled();
  });
});

// ============================================================================
// List Navigation Mode Tests
// ============================================================================
// Tests verifying 1D focus cycles across HTML list elements.
// ============================================================================

describe('useKeyboardNavigation - List Mode', () => {
  function TestList({ orientation = 'vertical', onClose }: { orientation?: 'vertical' | 'horizontal'; onClose?: () => void }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { handleKeyDown } = useKeyboardNavigation({ containerRef, orientation, onClose });

    return (
      <div ref={containerRef} onKeyDown={handleKeyDown} data-testid="list-container">
        <button data-testid="item-0">Item 1</button>
        <button data-testid="item-1">Item 2</button>
        <button data-testid="item-2">Item 3</button>
      </div>
    );
  }

  it('should navigate vertical list with ArrowDown and ArrowUp, wrapping around', () => {
    const { getByTestId } = render(<TestList orientation="vertical" />);
    const container = getByTestId('list-container');
    const item0 = getByTestId('item-0');
    const item1 = getByTestId('item-1');
    const item2 = getByTestId('item-2');

    item0.focus();
    expect(document.activeElement).toBe(item0);

    // ArrowDown -> item 1
    fireEvent.keyDown(container, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(item1);

    // ArrowDown -> item 2
    fireEvent.keyDown(container, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(item2);

    // ArrowDown at end -> wrap back to item 0
    fireEvent.keyDown(container, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(item0);

    // ArrowUp at start -> wrap backward to item 2
    fireEvent.keyDown(container, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(item2);
  });

  it('should navigate horizontal list with ArrowRight and ArrowLeft', () => {
    const { getByTestId } = render(<TestList orientation="horizontal" />);
    const container = getByTestId('list-container');
    const item0 = getByTestId('item-0');
    const item1 = getByTestId('item-1');

    item0.focus();

    // ArrowRight -> item 1
    fireEvent.keyDown(container, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(item1);

    // ArrowLeft -> item 0
    fireEvent.keyDown(container, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(item0);
  });

  it('should call onClose on Escape in list mode', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<TestList onClose={onClose} />);
    const container = getByTestId('list-container');

    fireEvent.keyDown(container, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
