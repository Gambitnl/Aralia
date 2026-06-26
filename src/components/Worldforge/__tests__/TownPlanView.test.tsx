import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import TownPlanView from '../TownPlanView';
import { generateTownPlan } from '../../../systems/worldforge/town/townEngine';
import { rootSeedPath } from '../../../systems/worldforge/seedPath';
import type { Pt } from '../../../systems/worldforge/submap/submapEngine';

const footprint: Pt[] = [[0, 0], [120, 0], [140, 90], [70, 140], [0, 100]];

// Town layer toggles persist to localStorage; isolate tests.
beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

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

  it('colors buildings by their population-assigned type and seats rural farmsteads', () => {
    const plan = generateTownPlan(footprint, rootSeedPath(42), { population: 4000 });
    const { container } = render(<TownPlanView plan={plan} width={600} height={400} />);
    // At least cottages should be tagged with their concrete building type.
    expect(container.querySelectorAll('[data-testid^="town-building-"]').length).toBeGreaterThan(0);
    // The rural population lives in farmsteads drawn out on the farm parcels.
    expect(plan.farmsteads.length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-testid="town-farmstead"]').length).toBe(plan.farmsteads.length);
  });

  it('accepts a seedPath and renders without crashing (household naming wiring)', () => {
    // Hover-driven household naming needs real layout (jsdom has none), so the
    // household content itself is covered by household.test.ts + the headless proof.
    // Here we just ensure the seedPath prop is accepted and a residential home exists.
    const seed = rootSeedPath(42);
    const plan = generateTownPlan(footprint, seed, { population: 4000 });
    const { getByTestId } = render(<TownPlanView plan={plan} width={600} height={400} seedPath={seed} />);
    expect(getByTestId('town-plan-view')).toBeTruthy();
    expect(plan.wards.flatMap((w) => w.plots).some((p) => p.residential && (p.occupants ?? 0) > 0)).toBe(true);
  });

  it('town layer panel toggles buildings off', () => {
    const plan = generateTownPlan(footprint, rootSeedPath(42), { population: 4000 });
    const { container, getByTestId, getByLabelText } = render(
      <TownPlanView plan={plan} width={600} height={400} />,
    );
    const buildingCount = () => container.querySelectorAll('[data-testid^="town-building-"]').length;
    expect(buildingCount()).toBeGreaterThan(0); // buildings drawn by default

    fireEvent.click(getByTestId('drill-layers-toggle')); // open the town layers menu
    fireEvent.click(getByLabelText('Buildings'));
    expect(buildingCount()).toBe(0); // building plots hidden
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
