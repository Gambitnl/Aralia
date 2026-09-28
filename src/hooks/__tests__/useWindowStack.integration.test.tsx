import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useWindowStack } from '../useWindowStack';

/**
 * This file verifies the mounted-state boundary around Aralia's ordered window ids.
 *
 * The stack hook deliberately owns ids rather than panel content. This small
 * workspace proves that reordering keyed panels keeps their local state alive,
 * while closing and reopening really does unmount and create the panel again.
 * That distinction is part of the behavior Character Forge must adopt knowingly.
 *
 * Exercises: useWindowStack.ts plus the caller-owned keyed rendering pattern
 * Depends on: React, React Testing Library, and Vitest
 */

type TestWindowId = 'map' | 'party';

// ============================================================================
// Stateful Test Panels
// ============================================================================
// Each panel carries a small local counter. It acts as an observable substitute
// for real panel-local form input, canvas state, or an unfinished interaction.
// ============================================================================

const StatefulPanel: React.FC<{ windowId: TestWindowId }> = ({ windowId }) => {
  const [localCount, setLocalCount] = useState(0);

  return (
    <button type="button" onClick={() => setLocalCount((count) => count + 1)}>
      {windowId} local count: {localCount}
    </button>
  );
};

// ============================================================================
// Caller-Owned Workspace
// ============================================================================
// The harness mirrors Design Preview's real ownership boundary: the hook gives
// it ordered ids, and the workspace supplies stable React keys and event wiring.
// ============================================================================

const WindowStackHarness: React.FC = () => {
  const {
    orderedOpenIds,
    openOrBringToFront,
    closeWindow,
  } = useWindowStack<TestWindowId>(['map', 'party']);

  return (
    <>
      <nav aria-label="Window launchers">
        <button type="button" onClick={() => openOrBringToFront('map')}>Open map</button>
        <button type="button" onClick={() => openOrBringToFront('party')}>Open party</button>
      </nav>

      <div data-testid="window-stack">
        {orderedOpenIds.map((windowId) => (
          <section
            key={windowId}
            data-window-id={windowId}
            onMouseDownCapture={() => openOrBringToFront(windowId)}
          >
            <StatefulPanel windowId={windowId} />
            <button type="button" onClick={() => closeWindow(windowId)}>
              Close {windowId}
            </button>
          </section>
        ))}
      </div>
    </>
  );
};

/**
 * Reads the rendered sibling order. Aralia paints equal-z-index WindowFrame
 * siblings back-to-front, so the last returned id is the visible front window.
 */
function renderedWindowOrder(): Array<string | null> {
  return Array.from(screen.getByTestId('window-stack').children).map(
    (windowElement) => windowElement.getAttribute('data-window-id'),
  );
}

// ============================================================================
// Mounted-State And Reopen Contract
// ============================================================================
// These tests distinguish bring-to-front from close: reordering preserves the
// keyed component, while closing intentionally discards its component state.
// ============================================================================

describe('useWindowStack caller integration', () => {
  it('brings a keyed panel forward without remounting or losing local state', () => {
    render(<WindowStackHarness />);

    // Interacting with the back window also requests bring-to-front at the
    // caller boundary, matching Design Preview's capture-phase pointer wiring.
    const mapPanelButton = screen.getByRole('button', { name: 'map local count: 0' });
    fireEvent.mouseDown(mapPanelButton);
    fireEvent.click(mapPanelButton);

    expect(renderedWindowOrder()).toEqual(['party', 'map']);
    expect(screen.getByRole('button', { name: 'map local count: 1' })).toBeInTheDocument();

    // Moving the sibling window forward changes paint order again but leaves
    // the map panel's local counter untouched.
    fireEvent.click(screen.getByRole('button', { name: 'Open party' }));

    expect(renderedWindowOrder()).toEqual(['map', 'party']);
    expect(screen.getByRole('button', { name: 'map local count: 1' })).toBeInTheDocument();
  });

  it('unmounts on close and creates fresh local state when the id reopens', () => {
    render(<WindowStackHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'map local count: 0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close map' }));

    expect(screen.queryByRole('button', { name: /map local count/i })).not.toBeInTheDocument();

    // Reopening appends the absent stable id, but it is a new panel mount rather
    // than a hidden/minimized instance of the old panel.
    fireEvent.click(screen.getByRole('button', { name: 'Open map' }));

    expect(renderedWindowOrder()).toEqual(['party', 'map']);
    expect(screen.getByRole('button', { name: 'map local count: 0' })).toBeInTheDocument();
  });

  it('starts from caller-supplied open ids again after the workspace remounts', () => {
    const firstWorkspace = render(<WindowStackHarness />);

    fireEvent.mouseDown(screen.getByRole('button', { name: 'map local count: 0' }));
    expect(renderedWindowOrder()).toEqual(['party', 'map']);
    firstWorkspace.unmount();

    // The stack hook has no storage boundary. A product that wants open panels
    // or stacking to survive reload must provide that state outside this hook.
    render(<WindowStackHarness />);
    expect(renderedWindowOrder()).toEqual(['map', 'party']);
  });
});
