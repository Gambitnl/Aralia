import { describe, it, expect } from 'vitest';
import type { RoutePlan } from '../routePlanning';
import { segmentRoute, type CellKind } from '../multiModalRoute';
import { formatMultiModalSummary } from '../travelReadout';

/**
 * These tests protect the player-facing shape of mixed land-and-sea routes.
 *
 * The route planner already knows the total fastest path. These tests prove the
 * next layer can split that path into visible land and sea legs, then summarize
 * those legs in language the map can show before the player commits to travel.
 */

const route: RoutePlan = {
  cells: [0, 1, 2, 3, 4],
  points: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  miles: 4,
  minutes: 200,
  danger: 0.4,
};

const kindOf = (cell: number): CellKind => (cell === 2 || cell === 3 ? 'sea' : 'land');

describe('segmentRoute', () => {
  it('splits the polyline into contiguous land and sea segments with mile totals', () => {
    const multimodal = segmentRoute(route, kindOf, 1);

    expect(multimodal.segments.map((segment) => segment.kind)).toEqual(['land', 'sea', 'land']);
    expect(multimodal.landMiles).toBeCloseTo(2, 5);
    expect(multimodal.seaMiles).toBeCloseTo(2, 5);
    expect(multimodal.minutes).toBe(200);
  });
});

describe('formatMultiModalSummary', () => {
  it('reports total time, land and sea miles, and danger', () => {
    const multimodal = segmentRoute(route, kindOf, 1);
    const summary = formatMultiModalSummary(multimodal);

    expect(summary).toContain('3h 20m');
    expect(summary).toContain('2.0 mi land');
    expect(summary).toContain('2.0 mi sea');
    expect(summary).toContain('Danger: Moderate');
  });
});
