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

import { PerfSession } from './perfSession';

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
  };
}
