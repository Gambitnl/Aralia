/**
 * The list of 3D surfaces currently being measured.
 *
 * A page can hold more than one canvas — the fluid step shows a GPU solver and
 * a FLIP solver side by side — so the overlay cannot assume a single scene.
 * Surfaces announce themselves here when they mount and drop out when they
 * unmount, and the overlay renders whatever is present.
 *
 * The registry is module state on purpose. A React context would force every
 * canvas host to sit under one provider, and several of them are mounted by
 * lazy chunks, portals, or the game shell rather than by the design preview.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 29/09/2026, 00:50:48
 * Dependents: components/World3D/World3DScene.tsx, devtools/buildingIdentityLab/BuildingSceneDiagnostics.tsx, devtools/perf/PerfFpsText.tsx, devtools/perf/PerfOverlay.tsx, devtools/perf/PerfWindowBadge.tsx, devtools/perf/index.ts, devtools/perf/rendererProbe.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { PerfSession, type SceneDiagnostics } from './perfSession';

const sessions = new Map<string, { session: PerfSession; refs: number }>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

/**
 * Claim the session for a surface, creating it on first use.
 *
 * Repeated calls with the same id return the same session and add a reference,
 * so React StrictMode's double mount does not produce two of them.
 */
export function acquirePerfSession(id: string, label: string): PerfSession {
  const existing = sessions.get(id);
  if (existing) {
    existing.refs++;
    existing.session.label = label;
    return existing.session;
  }
  const session = new PerfSession(id, label);
  sessions.set(id, { session, refs: 1 });
  notify();
  return session;
}

/** Release one reference. The session disappears when the last one goes. */
export function releasePerfSession(id: string): void {
  const entry = sessions.get(id);
  if (!entry) return;
  entry.refs--;
  if (entry.refs > 0) return;
  sessions.delete(id);
  notify();
}

/** Every live session, in the order the surfaces mounted. */
export function getPerfSessions(): PerfSession[] {
  return [...sessions.values()].map((e) => e.session);
}

export function getPerfSession(id: string): PerfSession | undefined {
  return sessions.get(id)?.session;
}

/**
 * Attach a component-level scene inventory without coupling the scene probe to
 * the overlay. A surface that has no diagnostic probe continues to work with
 * the ordinary renderer counters alone.
 */
export function setPerfSceneDiagnostics(id: string, diagnostics: SceneDiagnostics | null): void {
  sessions.get(id)?.session.setSceneDiagnostics(diagnostics);
  notify();
}

/** Watch for surfaces appearing and disappearing. Returns the unsubscribe. */
export function subscribePerfSessions(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Drop every session. For tests, which must not leak state between cases. */
export function clearPerfSessions(): void {
  sessions.clear();
  notify();
}

/**
 * An id no live session holds yet, built from `base`.
 *
 * The renderer probe names a surface after the window it sits in, and two
 * canvases in one window would otherwise share an id and so share a session.
 * Two renderers feeding one session count every display frame twice.
 */
export function uniquePerfSessionId(base: string): string {
  if (!sessions.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!sessions.has(candidate)) return candidate;
  }
}

/* A REQUEST TO SHOW ONE SURFACE, across React roots.
 *
 * The panel lives in a React root of its own (see PerfOverlayHost.tsx), so a
 * badge in a window title bar cannot reach its state. A plain listener set is
 * the one channel both roots can see without sharing a React tree. */
const panelListeners = new Set<(id: string) => void>();

/** Open the performance panel on the surface with this id. */
export function requestPerfPanel(id: string): void {
  for (const fn of panelListeners) fn(id);
}

/** Listen for `requestPerfPanel`. Returns the unsubscribe. */
export function subscribePerfPanelRequests(fn: (id: string) => void): () => void {
  panelListeners.add(fn);
  return () => {
    panelListeners.delete(fn);
  };
}

/**
 * The same readings, reachable from a headless capture script.
 *
 * The screenshot rigs drive a real browser and read the page through
 * `page.evaluate`. Without this they would have to scrape the overlay's text,
 * which ties a capture to the panel's layout and breaks the moment it moves.
 * This is the same data the panel draws, as plain objects.
 */
if (typeof window !== 'undefined') {
  (window as unknown as { __araliaPerf?: unknown }).__araliaPerf = {
    ids: () => getPerfSessions().map((s) => s.id),
    snapshots: () => getPerfSessions().map((s) => s.snapshot()),
    report: (id?: string) =>
      (id ? [getPerfSession(id)].filter(Boolean) : getPerfSessions())
        .map((s) => s!.report())
        .join('\n\n'),
    record: (id: string) => getPerfSession(id)?.startRecording(),
    stop: (id: string) => getPerfSession(id)?.stopRecording() ?? null,
    // Added 2026-09-29 with the renderer probe. Existing keys keep their shape.
    open: (id: string) => requestPerfPanel(id),
  };
}
