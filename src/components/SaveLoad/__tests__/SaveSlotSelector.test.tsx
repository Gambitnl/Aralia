/**
 * Accessibility coverage for the manual save-slot chooser (SaveLoad G7).
 *
 * Save/load is a high-risk surface for keyboard-only players: an untrapped
 * dialog lets Tab wander onto the game behind it, and a missing Escape key
 * leaves no quick way out short of a mouse click. These tests pin the
 * focus-management contract SaveSlotSelector now inherits from useFocusTrap:
 *   - focus moves inside the dialog when it opens,
 *   - Tab / Shift+Tab cycle stays within the dialog (focus trap),
 *   - Escape dismisses via onClose,
 *   - slots are real, keyboard-activatable buttons whose selection gates saving,
 *   - saving a fresh (non-colliding) entry forwards to onSaveSlot and closes.
 *
 * The resizable-window geometry hook is faked (as in WindowFrame's own tests)
 * so the checks exercise focus behavior rather than layout math, and the
 * dev-only axe probe is stubbed so axe-core never runs under jsdom.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveSlotSelector from '../SaveSlotSelector';
import type { SaveSlotSummary } from '../../../services/saveLoadService';

// Stable window chrome: the real hook owns drag/resize/storage; the focus
// tests only need the frame to mount with deterministic geometry.
vi.mock('../../../hooks/useResizableWindow', () => ({
  useResizableWindow: () => ({
    size: { width: 640, height: 520 },
    position: { left: 20, top: 20 },
    resizeState: { isResizing: false },
    dragState: { isDragging: false },
    isMaximized: false,
    handleResizeStart: vi.fn(),
    handleDragStart: vi.fn(),
    handleMaximize: vi.fn(),
    handleReset: vi.fn(),
  }),
}));

// The component fires a dev-only axe probe through a dynamic import; keep it a
// no-op so axe-core does not run against jsdom during these tests.
vi.mock('../../../utils/core/testUtils', () => ({
  runAxe: vi.fn(),
}));

const makeSlots = (): SaveSlotSummary[] => [
  {
    slotId: 'slot-alpha',
    slotName: 'Alpha',
    lastSaved: 1_000,
    locationName: 'Riverbend',
    partyLevel: 3,
    playtimeSeconds: 3_720,
  },
  {
    slotId: 'slot-beta',
    slotName: 'Beta',
    lastSaved: 2_000,
    locationName: 'Hollow Cave',
    partyLevel: 5,
    playtimeSeconds: 90,
  },
];

const renderSelector = (overrides: Partial<React.ComponentProps<typeof SaveSlotSelector>> = {}) => {
  const onSaveSlot = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <SaveSlotSelector
      slots={makeSlots()}
      onSaveSlot={onSaveSlot}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onSaveSlot, onClose, ...utils };
};

/** The two manual slots render as buttons; grab them by their visible names. */
const slotButton = (name: string): HTMLButtonElement =>
  screen.getByText(name).closest('button') as HTMLButtonElement;

describe('SaveSlotSelector accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders as a labelled dialog listing the manual save slots', () => {
    renderSelector();
    expect(screen.getByRole('dialog', { name: 'Chronicle Journey' })).toBeInTheDocument();
    expect(slotButton('Alpha')).toBeInTheDocument();
    expect(slotButton('Beta')).toBeInTheDocument();
  });

  it('moves focus into the dialog when it opens (focus trap activation)', () => {
    renderSelector();
    // useFocusTrap focuses the first focusable element inside the content,
    // which is the first manual slot button.
    expect(slotButton('Alpha')).toHaveFocus();
  });

  it('wraps focus forward with Tab from the last focusable element', () => {
    renderSelector();
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    cancel.focus();
    expect(cancel).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });

    // Trap wraps to the first focusable (the first slot button) instead of
    // letting focus escape onto the surface behind the dialog.
    expect(slotButton('Alpha')).toHaveFocus();
  });

  it('wraps focus backward with Shift+Tab from the first focusable element', () => {
    renderSelector();
    const first = slotButton('Alpha');
    first.focus();
    expect(first).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('closes via the Escape key', () => {
    const { onClose } = renderSelector();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the Cancel button is activated', () => {
    const { onClose } = renderSelector();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('gates "Save to Selected" on choosing a slot, then saves the selection', () => {
    const { onSaveSlot, onClose } = renderSelector();
    const saveSelected = screen.getByRole('button', { name: 'Save to Selected' });

    // No slot chosen yet: the destructive save action is disabled.
    expect(saveSelected).toBeDisabled();

    // Activating a slot button selects it (buttons are natively keyboard-usable).
    fireEvent.click(slotButton('Alpha'));
    expect(saveSelected).toBeEnabled();

    fireEvent.click(saveSelected);
    expect(onSaveSlot).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('scribes a fresh entry (no name collision) and closes', () => {
    const { onSaveSlot, onClose } = renderSelector();
    fireEvent.change(screen.getByPlaceholderText('Name this memory...'), {
      target: { value: 'Gamma' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Scribe Entry' }));

    expect(onSaveSlot).toHaveBeenCalledTimes(1);
    expect(onSaveSlot.mock.calls[0][1]).toBe('Gamma');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
