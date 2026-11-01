/**
 * The 2D town map converts the plan to an artifact plan ONCE per plan, not once
 * per building (2026-11-01). Per-building conversion made the capital's map
 * take more than 10 minutes to appear: about 2,000 buildings each converted the
 * whole 2,000-building plan, and every hover re-render did it again.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { generateTownPlan } from '../../../systems/worldforge/town/townEngine';
import { rootSeedPath } from '../../../systems/worldforge/seedPath';
import { STYLE_FAMILIES } from '../../../systems/worldforge/town/architectureStyle';

const calls = vi.hoisted(() => ({ n: 0 }));
vi.mock('../../../systems/worldforge/town/townPlanAdapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../systems/worldforge/town/townPlanAdapter')>();
  return {
    ...actual,
    toArtifactPlan: (...args: Parameters<typeof actual.toArtifactPlan>) => {
      calls.n++;
      return actual.toArtifactPlan(...args);
    },
  };
});

const { default: TownPlanView } = await import('../TownPlanView');

describe('town map artifact plan', () => {
  it('is built a fixed number of times, whatever the building count', () => {
    const plan = generateTownPlan([[0, 0], [120, 0], [140, 90], [70, 140], [0, 100]], rootSeedPath(42), { population: 4000 });
    const buildings = plan.wards.reduce((n, w) => n + w.plots.length, 0);
    expect(buildings).toBeGreaterThan(20);
    calls.n = 0;
    const view = render(<TownPlanView plan={plan} styleFamily={STYLE_FAMILIES.temperateFrame} />);
    // One per render pass at most (StrictMode can render twice), never one per building.
    expect(calls.n).toBeGreaterThan(0);
    expect(calls.n).toBeLessThanOrEqual(2);
    // Each building still gets its artifact id in its title.
    expect(view.container.querySelectorAll('path > title').length).toBeGreaterThan(0);
    expect([...view.container.querySelectorAll('path > title')].some((t) => /#\d+/.test(t.textContent ?? ''))).toBe(true);
  });
});
