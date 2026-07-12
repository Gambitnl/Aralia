/**
 * This file proves that combat rail grabbers work with pointer and keyboard
 * input, respect their bounds, reverse command-side direction correctly, and
 * expose the fast double-click reset path.
 *
 * Covers: CombatRailResizeHandle.tsx
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CombatRailResizeHandle from '../CombatRailResizeHandle';

// ============================================================================
// Accessible Resize Interactions
// ============================================================================
// The tests call the same public events available in the browser rather than
// reaching into component state or implementation details.
// ============================================================================

describe('CombatRailResizeHandle', () => {
  it('resizes the roster with pointer movement and keyboard bounds', () => {
    const onChange = vi.fn();
    render(
      <div className="relative h-40">
        <CombatRailResizeHandle
          side="roster"
          value={230}
          minimum={180}
          maximum={360}
          onChange={onChange}
          onReset={vi.fn()}
        />
      </div>,
    );

    const handle = screen.getByRole('separator', { name: 'Resize combat roster' });
    fireEvent.mouseDown(handle, { clientX: 200 });
    fireEvent.mouseMove(window, { clientX: 235 });
    expect(onChange).toHaveBeenLastCalledWith(265);
    fireEvent.mouseUp(window);

    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(238);
    fireEvent.keyDown(handle, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(180);
    fireEvent.keyDown(handle, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(360);
  });

  it('reverses horizontal movement for the command rail and resets on double click', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    render(
      <div className="relative h-40">
        <CombatRailResizeHandle
          side="command"
          value={300}
          minimum={250}
          maximum={440}
          onChange={onChange}
          onReset={onReset}
        />
      </div>,
    );

    const handle = screen.getByRole('separator', { name: 'Resize combat commands' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(292);
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith(308);

    fireEvent.doubleClick(handle);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
