import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import TownAgentSnapshotView from '../TownAgentSnapshotView';
import type { TownPlan } from '../../../systems/worldforge/artifacts';
import type { TownRoster } from '../../../systems/worldforge/roster/types';
import { occupantLocationAt } from '../../../systems/worldforge/roster/occupantSchedule';

const plan = {
  burgId: 1,
  streets: [],
  plots: [
    { id: 10, role: 'house', storeys: 1, footprint: [[0, 0], [20, 0], [20, 20], [0, 20]] },
    { id: 20, role: 'market', storeys: 1, footprint: [[100, 0], [120, 0], [120, 20], [100, 20]] },
  ],
} as unknown as TownPlan;

const roster: TownRoster = {
  burgId: 1,
  occupants: [
    { id: 1, name: 'Aldric', ageBand: 'adult', homePlotId: 10, workPlotId: 20, occupation: 'shopkeeper' },
    { id: 2, name: 'Bess', ageBand: 'adult', homePlotId: 10, occupation: 'resident' },
    { id: 3, name: 'Cal', ageBand: 'child', homePlotId: 10, occupation: 'resident' },
  ],
};

describe('TownAgentSnapshotView', () => {
  it('renders one dot per occupant plus the building plots', () => {
    const { container, getByTestId } = render(<TownAgentSnapshotView plan={plan} roster={roster} hour={12} />);
    expect(getByTestId('town-agent-snapshot').getAttribute('data-hour')).toBe('12');
    expect(container.querySelectorAll('circle[data-activity]')).toHaveLength(3); // 3 occupants
    expect(container.querySelectorAll('path')).toHaveLength(2);                  // 2 plots
  });

  it('shows everyone asleep in the dead of night', () => {
    const { container } = render(<TownAgentSnapshotView plan={plan} roster={roster} hour={3} />);
    const dots = [...container.querySelectorAll('circle[data-activity]')];
    expect(dots).toHaveLength(3);
    expect(dots.every((d) => d.getAttribute('data-activity') === 'sleeping')).toBe(true);
  });

  it('puts the worker on shift at midday (an "working" dot exists)', () => {
    const { container } = render(<TownAgentSnapshotView plan={plan} roster={roster} hour={12} />);
    const activities = [...container.querySelectorAll('circle[data-activity]')].map((d) => d.getAttribute('data-activity'));
    expect(activities).toContain('working');
  });

  it('wraps an out-of-range hour for display', () => {
    const { getByTestId } = render(<TownAgentSnapshotView plan={plan} roster={roster} hour={27} />);
    expect(getByTestId('town-agent-snapshot').getAttribute('data-hour')).toBe('3');
  });

  it('draws the street network only in motion mode', () => {
    const discrete = render(<TownAgentSnapshotView plan={plan} roster={roster} hour={12} />);
    expect(discrete.container.querySelectorAll('[data-testid="street-edge"]')).toHaveLength(0);
    discrete.unmount();
    // streetPlan carries a centerline so buildStreetGraph yields edges.
    const streetPlan = {
      burgId: 1,
      streets: [{ id: 1, centerline: [[0, 10], [60, 10], [110, 10]] }],
      plots: plan.plots,
    } as unknown as TownPlan;
    const motion = render(<TownAgentSnapshotView plan={streetPlan} roster={roster} hour={12} clock={12.25} />);
    expect(motion.container.querySelectorAll('[data-testid="street-edge"]').length).toBeGreaterThan(0);
  });

  it('renders externally-driven sim agents (behaviour layer) with their own colours', () => {
    const external = [
      { occupantId: 1, x: 5, y: 5, colorHex: '#f5a742' },
      { occupantId: 2, x: 110, y: 5, colorHex: '#d68cff' },
    ];
    const { container } = render(
      <TownAgentSnapshotView plan={plan} roster={roster} hour={12} externalAgents={external} />,
    );
    const simDots = container.querySelectorAll('[data-testid="sim-agent"]');
    expect(simDots).toHaveLength(2);
    // The schedule snapshot is suppressed in external mode.
    expect(container.querySelectorAll('circle[data-activity]')).toHaveLength(0);
    // Sim agents carry the colours the behaviour layer assigned.
    const fills = [...simDots].map((d) => d.getAttribute('fill'));
    expect(fills).toContain('#f5a742');
    expect(fills).toContain('#d68cff');
  });

  it('motion mode (clock) draws a walking ring for a commuting agent', () => {
    // Find Aldric's commute hour, then render mid-window (frac 0.25 < 0.5).
    let transition = 0;
    for (let h = 0; h < 24; h++) {
      if (occupantLocationAt(roster.occupants[0], h - 1).plotId !== occupantLocationAt(roster.occupants[0], h).plotId) { transition = h; break; }
    }
    const { container, getByTestId } = render(
      <TownAgentSnapshotView plan={plan} roster={roster} hour={transition} clock={transition + 0.25} />,
    );
    expect(getByTestId('town-agent-snapshot').getAttribute('data-motion')).toBe('1');
    expect(container.querySelectorAll('[data-testid="agent-walking"]').length).toBeGreaterThan(0);
    // Still exactly one dot per occupant (no agent lost in motion mode).
    expect(container.querySelectorAll('circle[data-activity]')).toHaveLength(3);
  });
});
