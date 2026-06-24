import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
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
});
