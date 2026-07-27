/**
 * DOM-level proof for the WF-AGENTSIM preview collapse (task 187c0fa3):
 *
 * 1. ONE mode — the old Schedule/Behaviour toggle (`agentsim-mode`) is gone; the
 *    preview is always the behaviour sim (a static `agentsim-mode-label`).
 * 2. Scrubbing the clock DETERMINISTICALLY re-simulates the day: driving
 *    `window.__agentSimPreview.setClock(H)` to the same hour always yields the
 *    same town snapshot (activity tallies), regardless of the path taken to get
 *    there — proving `simulateMindsTo` re-derives state rather than drifting.
 *
 * 3. Settled preview positions use the production street graph's canonical doors.
 * 4. A Play-era animation callback cannot overwrite a synchronous clock scrub.
 *
 * The demo plan, roster, families, and heavy child renderers are mocked to keep
 * the component focused. The simulation engine AND street router are deliberately
 * real: endpoint and race assertions therefore protect the production contracts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';

// A tiny two-plot town: one house, one market (a gathering place).
const square = (x: number, y: number): [number, number][] => [
  [x, y], [x, y + 10], [x + 10, y + 10], [x + 10, y],
];
vi.mock('../../../systems/worldforge/town/demoTownPlan', () => ({
  DEMO_BURG_ID: 999,
  buildDemoTownPlan: () => ({
    plan: {
      plots: [
        { id: 1, footprint: square(0, 10), role: 'house' },
        { id: 2, footprint: square(40, 10), role: 'market' },
      ],
      // Both buildings face this street. Their doors settle at y=10 while their
      // centroids sit at y=15, making any endpoint regression unambiguous.
      streets: [{ id: 1, widthFt: 8, centerline: [[-20, 0], [80, 0]] }],
    },
    bounds: { x: 0, y: 0, width: 60, height: 40 },
  }),
}));

// A small deterministic roster whose homes/work reference the mocked plots.
vi.mock('../../../systems/worldforge/roster/generateTownRoster', () => ({
  generateTownRoster: () => ({
    occupants: [
      { id: 1, name: 'Ada', ageBand: 'adult', homePlotId: 1, workPlotId: 2, occupation: 'shopkeeper' },
      { id: 2, name: 'Ben', ageBand: 'adult', homePlotId: 1, workPlotId: 2, occupation: 'smith' },
      { id: 3, name: 'Cae', ageBand: 'adult', homePlotId: 1, occupation: 'resident' },
    ],
  }),
}));

vi.mock('../../../systems/worldforge/roster/family', () => ({
  assignFamilies: () => new Map(),
  familySummary: () => '',
}));

// The map renderer is replaced with a tiny receipt surface. It exposes the real
// positions AgentSimPreview passes down after the production router resolves them.
vi.mock('../TownAgentSnapshotView', () => ({
  default: ({ externalAgents }: { externalAgents?: Array<{ occupantId: number; x: number; y: number }> }) => (
    <output data-testid="sim-agent-positions">{JSON.stringify(externalAgents ?? [])}</output>
  ),
}));
vi.mock('../VillagerRegistry', () => ({ default: () => null }));

import AgentSimPreview from '../AgentSimPreview';

interface PreviewApi {
  setClock: (h: number) => void;
  setPlaying: (playing: boolean) => void;
  current: () => { clock: number; total: number; simStats: Record<string, number> };
}
const api = () => (window as unknown as { __agentSimPreview: PreviewApi }).__agentSimPreview;

// A controllable browser-frame queue lets the race test deliver a callback that
// was captured while Play was active, even after the scrub cancels its request.
let nextFrameId = 1;
let frameCallbacks = new Map<number, FrameRequestCallback>();
let cancelFrame: ReturnType<typeof vi.fn>;

function runNextFrame(timestamp: number): void {
  const next = [...frameCallbacks.entries()].sort(([left], [right]) => left - right)[0];
  if (!next) throw new Error('Expected a queued animation frame');
  frameCallbacks.delete(next[0]);
  next[1](timestamp);
}

describe('AgentSimPreview — one behaviour mode', () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).__agentSimPreview;
    nextFrameId = 1;
    frameCallbacks = new Map();
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      const id = nextFrameId++;
      frameCallbacks.set(id, callback);
      return id;
    }));
    cancelFrame = vi.fn((id: number) => frameCallbacks.delete(id));
    vi.stubGlobal('cancelAnimationFrame', cancelFrame);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('exposes no Schedule/Behaviour toggle — it is behaviour-only', () => {
    const { queryByTestId, getByTestId } = render(<AgentSimPreview />);
    expect(queryByTestId('agentsim-mode')).toBeNull(); // the old toggle is gone
    expect(getByTestId('agentsim-mode-label').textContent).toMatch(/Behaviour sim/i);
  });

  it('scrubbing the clock deterministically re-simulates the day', () => {
    render(<AgentSimPreview />);
    // Land on 09:00 from the default hour.
    act(() => api().setClock(9));
    const at9 = JSON.stringify(api().current().simStats);

    // Take a different route: go to 03:00, then back to 09:00.
    act(() => api().setClock(3));
    const at3 = JSON.stringify(api().current().simStats);
    act(() => api().setClock(9));
    const at9again = JSON.stringify(api().current().simStats);

    expect(at9again).toBe(at9);   // same hour → identical town, path-independent
    expect(at3).not.toBe(at9);    // different hours actually differ (real re-sim)
    // The whole roster is accounted for in the activity tally.
    const total = Object.values(api().current().simStats).reduce((a, b) => a + b, 0);
    expect(total).toBe(3);
  });

  it('settles every known plot position at a real street-facing door', () => {
    const { getByTestId } = render(<AgentSimPreview />);
    act(() => api().setClock(12));

    const agents = JSON.parse(getByTestId('sim-agent-positions').textContent ?? '[]') as Array<{ y: number }>;
    expect(agents).toHaveLength(3);
    expect(agents.every((agent) => agent.y === 10)).toBe(true);
    expect(agents.every((agent) => agent.y !== 15)).toBe(true); // centroids would visibly pop here
  });

  it('neutralises the queued Play frame before a scrub can be overwritten', () => {
    render(<AgentSimPreview />);
    act(() => api().setPlaying(true));

    // The first frame establishes requestAnimationFrame's timestamp baseline;
    // the second is the dangerous queued frame captured while Play is active.
    act(() => runNextFrame(1_000));
    const pending = [...frameCallbacks.entries()].sort(([left], [right]) => left - right)[0];
    if (!pending) throw new Error('Expected Play to queue its next animation frame');

    act(() => {
      api().setClock(3);
      expect(cancelFrame).toHaveBeenCalledWith(pending[0]);

      // Deliberately deliver the stale callback anyway. A generation guard must
      // make it inert before React's asynchronous playing=false state is needed.
      pending[1](61_000);
    });

    expect(api().current().clock).toBe(3);
    expect(frameCallbacks.size).toBe(0);
  });
});
