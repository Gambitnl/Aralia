/**
 * @file PerfOverlayHost.tsx
 * Mounts the performance display in a React root of its own.
 *
 * WHY A SECOND ROOT, AND WHY A PORTAL IS NOT ENOUGH
 *
 * The display refreshes four times a second, and each refresh calls setState.
 * React gives a timer update the default priority. A Suspense boundary that
 * has just received its lazy chunk renders on the retry lane, which is LOWER
 * than default. So every refresh threw away the retry render in progress and
 * started it from the top.
 *
 * A tree that renders in under 250 ms never notices this. The 2D battle map
 * does: it lays out 10,800 tiles and needs several seconds of uninterrupted
 * work. Each refresh discarded that work, so `misc/design.html?step=battlemap`
 * printed "Loading battle map demo…" forever — no console error, no page
 * error, no pending request, every module 200 OK. The only visible symptom was
 * a pair of ~400 ms tasks per second: the same render, built and binned again
 * and again. Turning the display off dropped the mount from "never" to about
 * seven seconds. The main game mounts the same display in dev, so any heavy
 * lazy screen there was open to the same stall.
 *
 * A portal does NOT fix this. A portal moves where the DOM lands; it does not
 * move which root owns the work, so the refreshes stay in the page's work
 * loop. A separate root has a work loop of its own, and one root cannot
 * restart another root's render. The view already draws through
 * `createPortal(..., document.body)`, so nothing about its position changes.
 *
 * The root is shared and reference counted. React StrictMode mounts, unmounts,
 * and remounts every effect in development; counting keeps that from building
 * and tearing down a root on each pass.
 */
import React, { createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PerfOverlayView } from './PerfOverlay';

/** Named so the element is obvious to anyone reading the DOM. */
const CONTAINER_ID = 'aralia-perf-hud-root';

let mountCount = 0;
let container: HTMLDivElement | null = null;
let root: Root | null = null;

function attach(): void {
  mountCount += 1;
  if (root) return;
  container = document.createElement('div');
  container.id = CONTAINER_ID;
  document.body.appendChild(container);
  root = createRoot(container);
  root.render(createElement(PerfOverlayView));
}

function detach(): void {
  mountCount -= 1;
  // Tear down after the current commit finishes. React refuses to unmount a
  // root while it is already rendering, and a StrictMode remount runs this
  // cleanup mid-commit. Re-reading the count here also means a remount that
  // lands in the same tick keeps the existing root.
  window.setTimeout(() => {
    if (mountCount > 0 || !root) return;
    root.unmount();
    container?.remove();
    root = null;
    container = null;
  }, 0);
}

/**
 * Put the performance display on the page. Render this once, anywhere in the
 * tree; it adds nothing to the tree it sits in.
 */
export const PerfOverlay: React.FC = () => {
  useEffect(() => {
    attach();
    return detach;
  }, []);
  return null;
};

export default PerfOverlay;
