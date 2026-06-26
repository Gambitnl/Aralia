import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import SubmapSvgView from '../SubmapSvgView';

// Drill layer toggles persist to localStorage; isolate tests.
beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

const model = {
  boundary: [[0, 0], [100, 0], [100, 100], [0, 100]],
  biome: 'Temperate forest',
  cells: [
    { siteIndex: 0, polygon: [[10, 10], [40, 10], [40, 40], [10, 40]], feature: { kind: 'burg', x: 25, y: 25, name: 'Burgton' } },
    { siteIndex: 1, polygon: [[50, 50], [90, 50], [90, 90], [50, 90]] },
  ],
  burgCellIndex: 0,
} as any;

const riverModel = { ...model, polylines: [{ kind: 'river', points: [[0, 50], [100, 50]] }] } as any;

describe('SubmapSvgView', () => {
  it('renders a path per cell + the boundary, and the burg label', () => {
    const { container } = render(<SubmapSvgView model={model} width={300} height={300} />);
    expect(container.querySelector('[data-testid="submap-svg-view"]')).toBeTruthy();
    // 2 cell polygons + 1 boundary outline = 3 <path>
    expect(container.querySelectorAll('path')).toHaveLength(3);
    expect(container.textContent).toContain('Burgton');
  });

  it('drill layer panel toggles rivers and labels off', () => {
    const { container, getByTestId, getByLabelText } = render(
      <SubmapSvgView model={riverModel} width={300} height={300} />,
    );
    const riverCount = () =>
      Array.from(container.querySelectorAll('path')).filter((p) => p.getAttribute('stroke') === '#5d97bb').length;
    expect(riverCount()).toBe(1);                      // river drawn by default
    expect(container.textContent).toContain('Burgton'); // label drawn by default

    fireEvent.click(getByTestId('drill-layers-toggle')); // open the drill layers menu
    fireEvent.click(getByLabelText('Rivers'));
    expect(riverCount()).toBe(0);                        // river hidden

    fireEvent.click(getByLabelText('Labels'));
    expect(container.textContent).not.toContain('Burgton'); // label hidden
  });
});
