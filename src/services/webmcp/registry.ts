/**
 * The tool registry — the middle two layers of the stack Remy chose.
 *
 * He picked all four structures offered, and confirmed they compose rather
 * than compete ("Yes, the stack is what I meant"):
 *
 *   1. A THIN WRAPPER over the browser API      → modelContext.ts
 *   2. FEATURES DECLARE their own tools         → each surface's tools/ file
 *   3. EACH SURFACE COLLECTS its features       → registerSurface, here
 *   4. ONE CENTRAL REGISTRY aggregates surfaces → listTools, here
 *
 * Nothing reaches the browser until `activate` is called. A surface can
 * therefore declare its tools at import time, and a page decides whether to
 * turn them on — which keeps the game build free of tools it never uses.
 */

import type { AraliaTool, SurfaceId, SurfaceTools } from './types';
import { checkSupport, registerTool, WebMcpUnsupportedError } from './modelContext';

const surfaces = new Map<SurfaceId, SurfaceTools>();
const activated = new Set<SurfaceId>();
const listeners = new Set<() => void>();

/**
 * Tell interested views the tool list changed.
 *
 * WHY THIS EXISTS. React runs a child's effects BEFORE its parent's. The test
 * page mounts inside the Design Preview page, so it rendered and read an empty
 * tool list before the page's own effect had declared anything — and nothing
 * ever told it to look again. It showed "no surface has declared tools" on a
 * page that had five. Found by eyeballing it, not by a test.
 */
function announce(): void {
  listeners.forEach((fn) => fn());
}

/** Subscribe to declarations and activations. Returns the unsubscribe function. */
export function subscribeToRegistry(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/**
 * Declare one surface's tools. Call at module scope. Registering the same
 * surface twice replaces it, so a hot reload does not double the list.
 *
 * Throws on a duplicate tool name across surfaces: two tools answering to one
 * name means an agent cannot say which it wants, and the browser would keep
 * whichever registered last.
 */
export function registerSurface(entry: SurfaceTools): void {
  const taken = new Map<string, SurfaceId>();
  surfaces.forEach((s) => {
    if (s.surface === entry.surface) return;
    s.tools.forEach((t) => taken.set(t.name, s.surface));
  });
  entry.tools.forEach((t) => {
    const owner = taken.get(t.name);
    if (owner) {
      throw new Error(
        `Tool name "${t.name}" is already declared by the ${owner} surface. `
        + 'Tool names must be unique across the whole app.',
      );
    }
  });
  surfaces.set(entry.surface, entry);
  announce();
}

/** Every tool Aralia declares, whether or not it is switched on. */
export function listTools(): AraliaTool[] {
  return [...surfaces.values()].flatMap((s) => s.tools);
}

/** Every surface, in declaration order. The test page renders this. */
export function listSurfaces(): SurfaceTools[] {
  return [...surfaces.values()];
}

/** One tool by name, or undefined. */
export function findTool(name: string): AraliaTool | undefined {
  return listTools().find((t) => t.name === name);
}

/** Which surfaces are switched on right now. */
export function activeSurfaces(): SurfaceId[] {
  return [...activated];
}

export interface ActivateResult {
  surface: SurfaceId;
  registered: number;
  /** Set when the browser cannot run WebMCP. The tools stay declared and the
   *  test page can still call them directly. */
  unsupported?: string;
}

/**
 * Switch a surface on: hand its tools to the browser.
 *
 * When the browser has no WebMCP support this does NOT throw. Support is a
 * fact about the visitor's browser, not an author mistake, and the page must
 * still render. It returns the reason instead, so the caller can show it.
 * Every other failure — a bad tool name, an unknown surface — does throw.
 */
export function activate(surface: SurfaceId): ActivateResult {
  const entry = surfaces.get(surface);
  if (!entry) {
    throw new Error(`No tools declared for surface "${surface}".`);
  }
  if (activated.has(surface)) {
    return { surface, registered: entry.tools.length };
  }

  const support = checkSupport();
  if (!support.supported) {
    return { surface, registered: 0, unsupported: support.message };
  }

  try {
    entry.tools.forEach((tool) => registerTool(tool, surface));
  } catch (err) {
    if (err instanceof WebMcpUnsupportedError) {
      return { surface, registered: 0, unsupported: err.message };
    }
    throw err;
  }

  activated.add(surface);
  announce();
  return { surface, registered: entry.tools.length };
}

/** Forget every declaration. Tests only — the browser keeps what it was given. */
export function resetRegistry(): void {
  surfaces.clear();
  activated.clear();
  announce();
}
