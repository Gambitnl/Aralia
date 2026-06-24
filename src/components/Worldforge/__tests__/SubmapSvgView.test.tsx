import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import SubmapSvgView from '../SubmapSvgView';

const model = {
  boundary: [[0, 0], [100, 0], [100, 100], [0, 100]],
  biome: 'Temperate forest',
  cells: [
    { siteIndex: 0, polygon: [[10, 10], [40, 10], [40, 40], [10, 40]], feature: { kind: 'burg', x: 25, y: 25, name: 'Burgton' } },
    { siteIndex: 1, polygon: [[50, 50], [90, 50], [90, 90], [50, 90]] },
  ],
  burgCellIndex: 0,
} as any;

describe('SubmapSvgView', () => {
  it('renders a path per cell + the boundary, and the burg label', () => {
    const { container } = render(<SubmapSvgView model={model} width={300} height={300} />);
    expect(container.querySelector('[data-testid="submap-svg-view"]')).toBeTruthy();
    // 2 cell polygons + 1 boundary outline = 3 <path>
    expect(container.querySelectorAll('path')).toHaveLength(3);
    expect(container.textContent).toContain('Burgton');
  });
});
