import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import NeighbourhoodSvgView from '../NeighbourhoodSvgView';
import { buildAtlasNeighbourhood } from '../../../systems/worldforge/submap/neighbourhood';
import { rootSeedPath } from '../../../systems/worldforge/seedPath';

const atlas = {
  biomesData: { name: ['Marine', 'Forest', 'Hills', 'Plains'] },
  pack: {
    vertices: {
      p: [
        [0, 0], [10, 0], [10, 10], [0, 10],
        [10, 0], [20, 0], [20, 10], [10, 10],
        [0, 10], [10, 10], [10, 20], [0, 20],
      ],
    },
    cells: {
      v: [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11]],
      c: [[1, 2], [0], [0]],
      biome: [1, 2, 3],
      burg: [0, 0, 0],
      p: [[5, 5], [15, 5], [5, 15]],
      h: [50, 50, 50],
    },
    burgs: [], rivers: [], routes: [],
  },
} as any;

describe('NeighbourhoodSvgView', () => {
  it('renders the focus + explored cells as submaps and unexplored cells as grey', () => {
    const nbh = buildAtlasNeighbourhood(atlas, 0, (id) => id === 1, rootSeedPath(7), { submapCount: 30 });
    const { container, getByTestId } = render(
      <NeighbourhoodSvgView neighbourhood={nbh} width={400} height={400} />,
    );
    expect(getByTestId('neighbourhood-svg-view')).toBeTruthy();
    expect(container.querySelectorAll('[data-testid="nbh-grey-cell"]')).toHaveLength(1);  // cell 2 unexplored
    expect(container.querySelectorAll('[data-testid="nbh-focus"]')).toHaveLength(1);      // cell 0 focus
    expect(container.querySelectorAll('[data-testid="nbh-explored"]')).toHaveLength(1);   // cell 1 explored
  });

  it('renders every cell as grey when nothing is explored except the focus', () => {
    const nbh = buildAtlasNeighbourhood(atlas, 0, () => false, rootSeedPath(7), { submapCount: 30 });
    const { container } = render(<NeighbourhoodSvgView neighbourhood={nbh} width={400} height={400} />);
    expect(container.querySelectorAll('[data-testid="nbh-grey-cell"]')).toHaveLength(2); // both neighbours grey
    expect(container.querySelectorAll('[data-testid="nbh-focus"]')).toHaveLength(1);
  });

  // The user's request: drilling into the region tier should show the player's
  // PRECISE sub-cell (gold polygon), not just the coarse cell-level ring. The
  // gold-polygon `nbh-player-subcell` is the precise-only marker.
  it('shows the precise gold sub-cell highlight when playerCellIndex is supplied', () => {
    const nbh = buildAtlasNeighbourhood(atlas, 0, (id) => id === 1, rootSeedPath(7), { submapCount: 30 });
    const { container } = render(
      <NeighbourhoodSvgView neighbourhood={nbh} width={400} height={400} playerCellId={0} playerCellIndex={0} />,
    );
    // Precise gold sub-cell polygon present (the fine-grained party indicator).
    expect(container.querySelectorAll('[data-testid="nbh-player-subcell"]')).toHaveLength(1);
  });

  it('omits the precise sub-cell highlight when only playerCellId is known', () => {
    const nbh = buildAtlasNeighbourhood(atlas, 0, (id) => id === 1, rootSeedPath(7), { submapCount: 30 });
    const { container } = render(
      <NeighbourhoodSvgView neighbourhood={nbh} width={400} height={400} playerCellId={0} />,
    );
    // No precise index → no gold sub-cell; the coarse cell-level "you are here" shows instead.
    expect(container.querySelectorAll('[data-testid="nbh-player-subcell"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-testid="nbh-you-are-here"]')).toHaveLength(1);
  });
});
