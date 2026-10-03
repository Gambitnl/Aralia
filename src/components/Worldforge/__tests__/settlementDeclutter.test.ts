/**
 * These tests protect GG-40's deterministic settlement display policy.
 *
 * They use tiny canonical-looking burg records so the zoom budget, tier reveal,
 * geographic spacing, and exact identity preservation can be proved without a
 * browser or a generated world.
 */
import { describe, expect, it } from 'vitest';
import type { AtlasSvgBurg } from '../atlasSvg';
import {
  burgLabelObstacles,
  selectVisibleBurgs,
  settlementDisplayBudget,
} from '../settlementDeclutter';

// A fixed mixed hierarchy lets every test compare stable canonical ids.
const burgs: AtlasSvgBurg[] = [
  { id: 11, x: 10, y: 10, cell: 101, name: 'Capital', capital: true, tier: 'capital' },
  { id: 12, x: 30, y: 10, cell: 102, name: 'City', capital: false, tier: 'city' },
  { id: 13, x: 50, y: 10, cell: 103, name: 'Town', capital: false, tier: 'town' },
  { id: 14, x: 70, y: 10, cell: 104, name: 'Village', capital: false, tier: 'village' },
];

describe('settlement display budgets', () => {
  it('raises marker and label capacity monotonically as the player zooms', () => {
    const fit = settlementDisplayBudget(1200, 600, 1);
    const regional = settlementDisplayBudget(1200, 600, 1.5);
    const tactical = settlementDisplayBudget(1200, 600, 2.2);
    expect(regional.maxMarkers).toBeGreaterThan(fit.maxMarkers);
    expect(tactical.maxMarkers).toBeGreaterThan(regional.maxMarkers);
    expect(regional.maxLabels).toBeGreaterThan(fit.maxLabels);
    expect(tactical.maxLabels).toBeGreaterThan(regional.maxLabels);
    expect(fit.showTowns).toBe(false);
    expect(tactical.showTowns).toBe(true);
  });

  it('keeps the one-label phone overview while still expanding after zoom', () => {
    expect(settlementDisplayBudget(300, 220, 1).maxLabels).toBe(1);
    expect(settlementDisplayBudget(300, 220, 2.2).maxLabels).toBe(3);
  });
});

describe('deterministic burg selection', () => {
  it('reveals minor tiers progressively without changing exact ids or cells', () => {
    const view = { k: 1, x: 0, y: 0 };
    const fitBudget = settlementDisplayBudget(200, 100, 1);
    const tacticalBudget = settlementDisplayBudget(200, 100, 2.2);
    const closeBudget = settlementDisplayBudget(200, 100, 3);
    const fit = selectVisibleBurgs(burgs, view, 200, 100, fitBudget);
    const tactical = selectVisibleBurgs(burgs, view, 200, 100, tacticalBudget);
    const close = selectVisibleBurgs(burgs, view, 200, 100, closeBudget);
    expect(fit.map(({ burg }) => [burg.id, burg.cell])).toEqual([[11, 101], [12, 102]]);
    expect(tactical.map(({ burg }) => [burg.id, burg.cell])).toEqual([[11, 101], [12, 102], [13, 103]]);
    expect(close.map(({ burg }) => [burg.id, burg.cell])).toEqual([
      [11, 101], [12, 102], [13, 103], [14, 104],
    ]);
    expect(selectVisibleBurgs(burgs, view, 200, 100, closeBudget)).toEqual(close);
  });

  it('turns the selected silhouettes into anchored label obstacles', () => {
    const budget = { ...settlementDisplayBudget(200, 100, 3), markerSeparationPx: 1 };
    const visible = selectVisibleBurgs(burgs, { k: 1, x: 0, y: 0 }, 200, 100, budget);
    const obstacles = burgLabelObstacles(visible);
    expect(obstacles).toHaveLength(4);
    expect(obstacles[0]).toMatchObject({ anchorX: 10, anchorY: 10 });
  });
});
