import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AtlasSvgView from '../AtlasSvgView';

const stub = {
  graphWidth: 100, graphHeight: 100,
  biomesData: { color: ['#000', '#11aa33'] },
  pack: { vertices: { p: [[0,0],[10,0],[10,10],[0,10]] },
          cells: { h: [5, 50], v: [[0,1,2], [0,1,2,3]], biome: [0, 1] } },
} as any;

describe('AtlasSvgView', () => {
  it('renders an <svg> with one polygon per land cell', () => {
    const { container } = render(<AtlasSvgView atlas={stub} width={300} height={300} />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelectorAll('polygon')).toHaveLength(1);
  });
});
