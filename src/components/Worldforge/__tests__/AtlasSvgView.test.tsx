import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import AtlasSvgView from '../AtlasSvgView';

const stub = {
  graphWidth: 100, graphHeight: 100,
  biomesData: { color: ['#000', '#11aa33'] },
  pack: { vertices: { p: [[0,0],[10,0],[10,10],[0,10]] },
          cells: { h: [5, 50], v: [[0,1,2], [0,1,2,3]], biome: [0, 1], p: [[2,2],[7,7]] } },
} as any;

describe('AtlasSvgView', () => {
  it('renders an <svg> with one merged land-region path (T2: no per-cell polygons)', () => {
    const { container } = render(<AtlasSvgView atlas={stub} width={300} height={300} />);
    expect(container.querySelector('svg')).toBeTruthy();
    const paths = container.querySelectorAll('path');
    // 1 merged biome region (filled) + 2 coastline strokes (shelf glow + crisp, T3)
    expect(paths).toHaveLength(3);
    expect(paths[0].getAttribute('fill')).toBe('#11aa33');           // biome region
    const coasts = Array.from(paths).filter((p) => p.getAttribute('fill') === 'none');
    expect(coasts).toHaveLength(2);                                   // double-stroke coast
    expect(coasts.some((p) => p.getAttribute('stroke') === '#1a3d66')).toBe(true);
    expect(container.querySelectorAll('polygon')).toHaveLength(0);
  });

  it('renders the always-on player marker when a marker prop is given (T7)', () => {
    const { container, rerender } = render(<AtlasSvgView atlas={stub} width={300} height={300} />);
    expect(container.querySelector('[data-testid="atlas-player-marker"]')).toBeNull();
    rerender(<AtlasSvgView atlas={stub} width={300} height={300} marker={{ x: 50, y: 50 }} />);
    expect(container.querySelector('[data-testid="atlas-player-marker"]')).toBeTruthy();
  });

  it('shows a Find Me button only when a player marker is given, and clicking it surfaces the player cell', () => {
    const { container, queryByTestId, getByTestId, rerender } = render(
      <AtlasSvgView atlas={stub} width={300} height={300} />,
    );
    expect(queryByTestId('atlas-center-player')).toBeNull(); // no marker → no button

    rerender(<AtlasSvgView atlas={stub} width={300} height={300} marker={{ x: 5, y: 5 }} />);
    const findMe = getByTestId('atlas-center-player');
    expect(findMe).toBeTruthy();
    fireEvent.click(findMe);
    // Clicking resolves the player's cell → info panel appears (which cell am I at).
    expect(container.querySelector('[data-testid="atlas-cell-info"]')).toBeTruthy();
  });

  it('renders a discovery pin per markers entry (SP4 atlas pins)', () => {
    const { container } = render(
      <AtlasSvgView atlas={stub} width={300} height={300} markers={[{ x: 10, y: 20, label: 'Cave' }, { x: 30, y: 40 }]} />,
    );
    expect(container.querySelectorAll('[data-testid="atlas-discovery-pin"]')).toHaveLength(2);
  });

  it('menu exposes Layers + an Info Panel detail selector', () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <AtlasSvgView atlas={stub} width={300} height={300} />,
    );
    expect(queryByTestId('atlas-info-verbosity')).toBeNull(); // panel closed initially
    fireEvent.click(getByTestId('atlas-layers-toggle'));
    expect(getByText('Layers')).toBeTruthy();
    expect(getByText('Info Panel')).toBeTruthy();
    const select = getByTestId('atlas-info-verbosity') as HTMLSelectElement;
    expect(select.value).toBe('standard');
    fireEvent.change(select, { target: { value: 'full' } });
    expect(select.value).toBe('full');
  });

  it('Layers panel toggles a layer off (Biomes hides the merged region path)', () => {
    const { container, getByTestId, getByLabelText } = render(
      <AtlasSvgView atlas={stub} width={300} height={300} />,
    );
    const biomeBefore = Array.from(container.querySelectorAll('path'))
      .some((p) => p.getAttribute('fill') === '#11aa33');
    expect(biomeBefore).toBe(true);

    fireEvent.click(getByTestId('atlas-layers-toggle')); // open the panel
    fireEvent.click(getByLabelText('Biomes'));            // toggle Biomes off

    const biomeAfter = Array.from(container.querySelectorAll('path'))
      .some((p) => p.getAttribute('fill') === '#11aa33');
    expect(biomeAfter).toBe(false); // biome region no longer rendered
  });
});
