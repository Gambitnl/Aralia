import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useRef } from 'react';
import { render, screen, fireEvent, renderHook } from '@testing-library/react';
import { useFocusTrap } from '../useFocusTrap';

/**
 * This test suite verifies the behavior of the modal focus trap hook.
 *
 * In an accessible game UI, when a modal (like a character sheet, shop, or confirmation
 * popup) opens, keyboard focus must stay trapped inside the modal so the player cannot
 * accidentally Tab into background buttons or lose their place. When the modal closes,
 * focus must return to the button that opened it.
 *
 * Covers: useFocusTrap.ts
 * Tests: Initial focus, Tab cycling, Shift+Tab reverse cycling, Escape handling,
 * focus restoration on close, and cleanup on unmount.
 */

// ============================================================================
// Test Components and Fixtures
// ============================================================================
// Mock dialog and container components to test focus trapping in a simulated DOM.
// ============================================================================

interface TestModalProps {
  isOpen: boolean;
  onClose?: () => void;
  restoreFocusTo?: React.RefObject<HTMLElement | null>;
  hasInputs?: boolean;
}

function TestModal({ isOpen, onClose, restoreFocusTo, hasInputs = true }: TestModalProps) {
  const containerRef = useFocusTrap<HTMLDivElement>(isOpen, onClose, restoreFocusTo);

  if (!isOpen) return null;

  return (
    <div ref={containerRef} tabIndex={-1} data-testid="modal-container">
      {hasInputs ? (
        <>
          <button data-testid="button-first">First Button</button>
          <input data-testid="input-middle" placeholder="Type here" />
          <button data-testid="button-last">Last Button</button>
        </>
      ) : (
        <p>No focusable elements here</p>
      )}
    </div>
  );
}

// ============================================================================
// Focus Trap Unit Tests
// ============================================================================
// Tests verifying focus containment, keyboard navigation, and cleanup behavior.
// ============================================================================

describe('useFocusTrap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should focus the first focusable element when opened', () => {
    // Render an opener button outside the modal
    const { getByTestId, rerender } = render(
      <div>
        <button data-testid="opener-button">Open Modal</button>
        <TestModal isOpen={false} />
      </div>
    );

    const opener = getByTestId('opener-button');
    opener.focus();
    expect(document.activeElement).toBe(opener);

    // Open the modal
    rerender(
      <div>
        <button data-testid="opener-button">Open Modal</button>
        <TestModal isOpen={true} />
      </div>
    );

    // Focus should move automatically to the first button inside the modal
    const firstBtn = getByTestId('button-first');
    expect(document.activeElement).toBe(firstBtn);
  });

  it('should focus the container itself if no focusable children exist', () => {
    const { getByTestId } = render(<TestModal isOpen={true} hasInputs={false} />);
    const container = getByTestId('modal-container');
    expect(document.activeElement).toBe(container);
  });

  it('should cycle focus from the last element to the first element on Tab', () => {
    const { getByTestId } = render(<TestModal isOpen={true} />);
    const firstBtn = getByTestId('button-first');
    const lastBtn = getByTestId('button-last');

    // Move focus to the last element
    lastBtn.focus();
    expect(document.activeElement).toBe(lastBtn);

    // Press Tab on the last element
    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab' });

    // Focus should wrap back around to the first element
    expect(document.activeElement).toBe(firstBtn);
  });

  it('should cycle focus from the first element to the last element on Shift+Tab', () => {
    const { getByTestId } = render(<TestModal isOpen={true} />);
    const firstBtn = getByTestId('button-first');
    const lastBtn = getByTestId('button-last');

    // Ensure focus is on the first element
    firstBtn.focus();
    expect(document.activeElement).toBe(firstBtn);

    // Press Shift+Tab on the first element
    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab', shiftKey: true });

    // Focus should wrap backward to the last element
    expect(document.activeElement).toBe(lastBtn);
  });

  it('should call onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<TestModal isOpen={true} onClose={onClose} />);

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should ignore other non-trapping keys', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<TestModal isOpen={true} onClose={onClose} />);
    const firstBtn = getByTestId('button-first');
    firstBtn.focus();

    // Press Enter or ArrowDown
    fireEvent.keyDown(document, { key: 'Enter', code: 'Enter' });
    fireEvent.keyDown(document, { key: 'ArrowDown', code: 'ArrowDown' });

    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(firstBtn);
  });

  it('should restore focus to the previously active element when closed', () => {
    // Setup an opener button
    const { getByTestId, rerender } = render(
      <div>
        <button data-testid="opener-button">Open Modal</button>
        <TestModal isOpen={false} />
      </div>
    );

    const opener = getByTestId('opener-button');
    opener.focus();
    expect(document.activeElement).toBe(opener);

    // Open modal
    rerender(
      <div>
        <button data-testid="opener-button">Open Modal</button>
        <TestModal isOpen={true} />
      </div>
    );

    // Close modal
    rerender(
      <div>
        <button data-testid="opener-button">Open Modal</button>
        <TestModal isOpen={false} />
      </div>
    );

    // Run animation frames for focus restoration
    vi.runAllTimers();

    // Focus should return to the original opener button
    expect(document.activeElement).toBe(opener);
  });

  it('should restore focus to a custom restoreFocusTo target ref if provided', () => {
    function ContainerWithCustomRestore() {
      const customTargetRef = useRef<HTMLButtonElement>(null);
      const [isOpen, setIsOpen] = React.useState(true);

      return (
        <div>
          <button ref={customTargetRef} data-testid="custom-target">
            Custom Target
          </button>
          <button onClick={() => setIsOpen(false)} data-testid="close-trigger">
            Close
          </button>
          <TestModal isOpen={isOpen} restoreFocusTo={customTargetRef} />
        </div>
      );
    }

    const { getByTestId } = render(<ContainerWithCustomRestore />);
    const customTarget = getByTestId('custom-target');
    const closeTrigger = getByTestId('close-trigger');

    // Trigger close
    fireEvent.click(closeTrigger);
    vi.runAllTimers();

    expect(document.activeElement).toBe(customTarget);
  });

  it('should prevent default Tab navigation when no focusable elements exist', () => {
    render(<TestModal isOpen={true} hasInputs={false} />);
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    document.dispatchEvent(event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});
