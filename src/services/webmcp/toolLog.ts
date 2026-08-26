/**
 * The tool log.
 *
 * WHY IT EXISTS. Remy asked for it directly, as a comment on the question
 * about the poisoning risk: "would like a 'log' type system for these things
 * as well. something that let's me see what tools are frequented. which tools
 * require approval. tools that end up being blockers?"
 *
 * He then picked three of the four shapes offered: a live panel, a running
 * count per tool, and a blocker list. All three read from this one store, so
 * a call is recorded once and shown three ways.
 *
 * The three questions it answers:
 *   - Which tools are frequented?  → the counts.
 *   - Which stop to ask?           → outcome 'refused'.
 *   - Which end up as blockers?    → the blocker list: tools whose calls fail
 *                                    or get refused more often than they work.
 *
 * A blocker is the important one. A tool that always stops is a tool designed
 * wrong, and it is invisible until something counts it.
 */

import type { SurfaceId, ToolCount, ToolKind, ToolLogEntry } from './types';

/** How many entries the live panel keeps. Older ones fall off; the counts
 *  survive, because a count is cheap and an entry is not. */
const MAX_ENTRIES = 200;

const STORAGE_KEY = 'aralia-webmcp-tool-counts-v1';

let seq = 0;
const entries: ToolLogEntry[] = [];
const counts = new Map<string, ToolCount>();
const listeners = new Set<() => void>();

/** Load the counts a previous session left behind, so "frequented" means more
 *  than the last five minutes. A private window or blocked storage just
 *  starts empty; that is not an error worth reporting. */
function loadCounts(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as ToolCount[];
    if (!Array.isArray(saved)) return;
    saved.forEach((c) => {
      if (c && typeof c.tool === 'string') counts.set(c.tool, c);
    });
  } catch {
    /* storage unavailable; counts start empty */
  }
}

function saveCounts(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...counts.values()]));
  } catch {
    /* storage unavailable; the live panel still works */
  }
}

loadCounts();

export interface CallRecord {
  tool: string;
  surface: SurfaceId | 'unknown';
  kind: ToolKind | 'unknown';
  input: Record<string, unknown>;
  ms: number;
  outcome: 'ok' | 'error' | 'refused';
  detail: string;
}

/** Called by the wrapper on every tool call. Nothing else should call it. */
export function recordCall(rec: CallRecord): void {
  seq += 1;
  const at = new Date().toISOString();

  entries.unshift({
    seq,
    at,
    tool: rec.tool,
    surface: rec.surface,
    kind: rec.kind,
    input: rec.input,
    ms: rec.ms,
    outcome: rec.outcome,
    detail: rec.detail.length > 400 ? `${rec.detail.slice(0, 400)}…` : rec.detail,
  });
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;

  const prev = counts.get(rec.tool) ?? {
    tool: rec.tool, calls: 0, errors: 0, refusals: 0, avgMs: 0, lastAt: at,
  };
  const okBefore = prev.calls - prev.errors - prev.refusals;
  const okNow = okBefore + (rec.outcome === 'ok' ? 1 : 0);
  counts.set(rec.tool, {
    tool: rec.tool,
    calls: prev.calls + 1,
    errors: prev.errors + (rec.outcome === 'error' ? 1 : 0),
    refusals: prev.refusals + (rec.outcome === 'refused' ? 1 : 0),
    // Mean over successful calls only. A failure that returns instantly would
    // otherwise make a slow tool look fast.
    avgMs: rec.outcome === 'ok' && okNow > 0
      ? Math.round((prev.avgMs * okBefore + rec.ms) / okNow)
      : prev.avgMs,
    lastAt: at,
  });

  saveCounts();
  listeners.forEach((fn) => fn());
}

/** Newest first. The live panel reads this. */
export function getEntries(): readonly ToolLogEntry[] {
  return entries;
}

/** Busiest first. Answers "which tools are frequented?" */
export function getCounts(): ToolCount[] {
  return [...counts.values()].sort((a, b) => b.calls - a.calls);
}

/**
 * The blocker list: tools that fail or get refused at least as often as they
 * succeed, over at least two calls. One failure is noise; a tool that never
 * works is a design mistake.
 */
export function getBlockers(): ToolCount[] {
  return getCounts().filter((c) => {
    if (c.calls < 2) return false;
    const bad = c.errors + c.refusals;
    return bad * 2 >= c.calls;
  });
}

/** Subscribe to changes. Returns the unsubscribe function. */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Drop the live entries and the stored counts. For the test page and tests. */
export function clearLog(): void {
  seq = 0;
  entries.length = 0;
  counts.clear();
  saveCounts();
  listeners.forEach((fn) => fn());
}
