import { describe, it, expect } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import TownPlanView from '../TownPlanView';
import { generateTownPlan } from '../../../systems/worldforge/town/townEngine';
import { rootSeedPath } from '../../../systems/worldforge/seedPath';
import type { Pt } from '../../../systems/worldforge/submap/submapEngine';

const footprint: Pt[] = [[0, 0], [120, 0], [140, 90], [70, 140], [0, 100]];

describe('TownPlanView', () => {
  it('renders a generated town plan as an SVG with ward + plot paths', () => {
    const plan = generateTownPlan(footprint, rootSeedPath(42), { population: 4000 });
    const { getByTestId, container } = render(
      <TownPlanView plan={plan} width={600} height={400} />,
    );
    expect(getByTestId('town-plan-view')).toBeTruthy();
    // Footprint + wards + plots + civic should yield many path elements.
    expect(container.querySelectorAll('path').length).toBeGreaterThan(plan.wards.length);
  });

  it('survives a pan drag that ends before the final move (no null drag-ref crash)', () => {
    // Regression: onMove scheduled a setView updater that read drag.current.x
    // asynchronously; onMouseUp/Leave could null the ref first → "Cannot read
    // properties of null (reading 'x')". The handlers now capture the ref locally.
    const plan = generateTownPlan(footprint, rootSeedPath(42), { population: 4000 });
    const { getByTestId } = render(<TownPlanView plan={plan} width={600} height={400} />);
    const svg = getByTestId('town-plan-view');
    expect(() => {
      fireEvent.mouseDown(svg, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(svg, { clientX: 130, clientY: 120 });
      fireEvent.mouseUp(svg);
      // A move after the drag has ended must hit the hover branch, never read a null ref.
      fireEvent.mouseMove(svg, { clientX: 150, clientY: 140 });
      fireEvent.mouseLeave(svg);
    }).not.toThrow();
  });
});
