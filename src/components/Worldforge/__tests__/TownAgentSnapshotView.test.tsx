import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import TownAgentSnapshotView from '../TownAgentSnapshotView';
import type { TownPlan } from '../../../systems/worldforge/artifacts';
import type { TownRoster } from '../../../systems/worldforge/roster/types';

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
});
