/**
 * @file PerfOverlayHost.test.tsx
 * Locks the one property that keeps the performance display from stalling the
 * page it measures: the display renders in a React root of its own.
 *
 * The display shared the page's root until 2026-08-26. It refreshes four times
 * a second, and each refresh restarted the Suspense retry render of whatever
 * heavy screen was still arriving. The 2D battle map (10,808 tiles) never
 * finished, so `misc/design.html?step=battlemap` printed "Loading battle map
 * demo…" for as long as anyone waited, with no error to find. See
 * PerfOverlayHost.tsx.
 *
 * A test cannot easily reproduce that starvation. It CAN hold the shape that
 * prevents it: nothing in the host tree, everything in a container of its own.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { PerfOverlay } from '../PerfOverlayHost';

const CONTAINER_ID = 'aralia-perf-hud-root';

afterEach(() => {
  localStorage.clear();
});

describe('PerfOverlay host', () => {
  it('adds nothing to the tree it is rendered in', () => {
    const { container } = render(<PerfOverlay />);
    expect(container.innerHTML).toBe('');
  });

  it('mounts the display in a container of its own on the body', () => {
    render(<PerfOverlay />);
    const host = document.getElementById(CONTAINER_ID);
    expect(host).not.toBeNull();
    expect(host?.parentElement).toBe(document.body);
  });

  it('renders the display, so the second root really mounted', async () => {
    render(<PerfOverlay />);
    // The pill is the default mode. It reports "no 3D" with no surface probed.
    expect(await screen.findByTitle('Performance (Alt+P)')).toBeTruthy();
  });

  it('takes its container away once the last mount goes', async () => {
    const view = render(<PerfOverlay />);
    expect(document.getElementById(CONTAINER_ID)).not.toBeNull();
    view.unmount();
    // Teardown waits for the current commit to finish before it runs.
    await waitFor(() => expect(document.getElementById(CONTAINER_ID)).toBeNull());
  });
});
