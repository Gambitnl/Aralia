/**
 * This file verifies the shared resizable WindowFrame chrome.
 *
 * WindowFrame is used by major 2D surfaces such as the character sheet, map,
 * glossary, party roster, and character creator. These tests protect the header
 * layout so narrow windows keep the title and control buttons reachable.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WindowFrame } from '../WindowFrame';

// ============================================================================
// Resizable Hook Fake
// ============================================================================
// The frame layout test only needs stable chrome geometry. The real hook owns
// drag, resize, storage, and viewport clamping behavior in its own module.
// ============================================================================
vi.mock('../../../hooks/useResizableWindow', () => ({
  useResizableWindow: () => ({
    size: { width: 280, height: 420 },
    position: { left: 20, top: 20 },
    resizeState: { isResizing: false },
    dragState: { isDragging: false },
    isMaximized: true,
    handleResizeStart: vi.fn(),
    handleDragStart: vi.fn(),
    handleMaximize: vi.fn(),
    handleReset: vi.fn(),
  }),
}));

// ============================================================================
// Window Header Contract Tests
// ============================================================================
// A cramped character creator playtest showed the header actions pushing reset,
// restore, and close controls offscreen. These class contracts keep the header
// able to wrap instead of overflowing the viewport.
// ============================================================================
describe('WindowFrame', () => {
  it('wraps header title and actions so frame controls stay reachable', () => {
    render(
      <WindowFrame
        title="Create Your Adventurer"
        onClose={vi.fn()}
        storageKey="test-window-frame"
        headerActions={<button type="button">Auto-Fill Random</button>}
      >
        <div>Frame body</div>
      </WindowFrame>
    );

    expect(screen.getByTestId('window-frame-header')).toHaveClass('flex-wrap');
    expect(screen.getByRole('heading', { name: 'Create Your Adventurer' })).toHaveClass(
      'min-w-0',
      'basis-full',
      'sm:basis-auto',
    );
    expect(screen.getByTestId('window-frame-header-actions')).toHaveClass('flex-wrap');
  });

  it('keeps shared controls and pointer resize zones usable on cramped screens', () => {
    render(
      <WindowFrame title="Glossary" onClose={vi.fn()} storageKey="test-window-frame-controls">
        <div>Frame body</div>
      </WindowFrame>
    );

    // These real window controls are repeated across glossary, party, map, and
    // creator panes, so they should not shrink back to desktop-only icon buttons.
    expect(screen.getByRole('button', { name: 'Reset layout' })).toHaveClass('h-11', 'w-11');
    expect(screen.getByRole('button', { name: 'Restore window' })).toHaveClass('h-11', 'w-11');
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('h-11', 'w-11');

    // Resize zones are pointer drag targets, not keyboard actions. They keep
    // their generous hit areas without occupying the accessible button order.
    expect(screen.queryByRole('button', { name: 'Resize top-left' })).toBeNull();
    expect(screen.getByTitle('Resize top-left')).toHaveClass('h-11', 'w-11');
    expect(screen.getByTitle('Resize top edge')).toHaveClass('h-11', 'w-12');
    expect(screen.getByTitle('Resize left edge')).toHaveClass('h-12', 'w-11');
  });
});
