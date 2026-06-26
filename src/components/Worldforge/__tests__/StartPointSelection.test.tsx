import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import StartPointSelection from '../StartPointSelection';

// Heavy SVG atlas → stub it; we only test the selection panel behavior here.
vi.mock('../AtlasSvgView', () => ({
  default: ({ marker }: { marker: { x: number; y: number } | null }) => (
    <div data-testid="atlas-stub" data-marker={marker ? `${marker.x},${marker.y}` : 'none'} />
  ),
}));

// Deterministic fake world: two states + three burgs (one capital each region).
vi.mock('../../../systems/worldforge/fmg/generateWorld', () => ({
  generateFmgWorld: () => ({
    pack: {
      cells: { p: [], biome: [], h: [] },
      states: [
        { i: 0, name: 'Neutrals' },
        { i: 1, name: 'Eldoria' },
        { i: 2, name: 'Marlind' },
      ],
      burgs: [
        { i: 0 },
        { i: 1, cell: 10, name: 'Aldermoor', x: 5, y: 5, state: 1, population: 3 },
        { i: 2, cell: 20, name: 'Riverford', x: 9, y: 2, state: 2, population: 6, capital: 1, port: 1 },
        { i: 3, cell: 30, name: 'Briar', x: 1, y: 8, state: 1, population: 1, capital: 1 },
      ],
    },
  }),
}));

beforeEach(() => {
  // jsdom lacks ResizeObserver.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
});

describe('StartPointSelection', () => {
  it('lists towns, defaults to a selection, and fires onConfirm with the chosen town', () => {
    const onConfirm = vi.fn();
    render(<StartPointSelection worldSeed={123} onConfirm={onConfirm} characterName="Aria" />);

    // A town is selected by default; confirm reflects it.
    const confirm = screen.getByTestId('start-confirm');
    expect(confirm.textContent).toMatch(/Begin in /);

    // Pick a specific town row by name and confirm (scope to the list — the
    // selected-detail card can also contain a town name).
    const list = screen.getByTestId('start-town-list');
    const aldermoor = within(list).getByText('Aldermoor').closest('button')!;
    fireEvent.click(aldermoor);
    expect(screen.getByTestId('start-confirm').textContent).toContain('Aldermoor');

    fireEvent.click(screen.getByTestId('start-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toMatchObject({ name: 'Aldermoor', atlasCellId: 10 });
  });

  it('filters towns by region', () => {
    render(<StartPointSelection worldSeed={123} onConfirm={vi.fn()} />);
    const list = screen.getByTestId('start-town-list');
    // All three real towns visible initially.
    expect(within(list).queryByText('Aldermoor')).toBeTruthy();
    expect(within(list).queryByText('Riverford')).toBeTruthy();

    // Filter to Marlind (state 2) → only Riverford remains.
    fireEvent.change(screen.getByTestId('start-region-filter'), { target: { value: '2' } });
    expect(within(list).queryByText('Riverford')).toBeTruthy();
    expect(within(list).queryByText('Aldermoor')).toBeNull();
  });

  it('filters towns by free-text search (name or region)', () => {
    render(<StartPointSelection worldSeed={123} onConfirm={vi.fn()} />);
    const list = screen.getByTestId('start-town-list');
    fireEvent.change(screen.getByTestId('start-search'), { target: { value: 'river' } });
    expect(within(list).queryByText('Riverford')).toBeTruthy();
    expect(within(list).queryByText('Aldermoor')).toBeNull();
    expect(within(list).queryByText('Briar')).toBeNull();

    // Region-name search matches all of that region's towns.
    fireEvent.change(screen.getByTestId('start-search'), { target: { value: 'eldoria' } });
    expect(within(list).queryByText('Aldermoor')).toBeTruthy();
    expect(within(list).queryByText('Briar')).toBeTruthy();
    expect(within(list).queryByText('Riverford')).toBeNull();
  });

  it('Surprise me selects a random town and clears active filters', () => {
    // Force the random pick to a deterministic index.
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0); // → towns[0]
    render(<StartPointSelection worldSeed={123} onConfirm={vi.fn()} />);

    // Narrow first, then Surprise me should widen back to all + pick a town.
    fireEvent.change(screen.getByTestId('start-region-filter'), { target: { value: '2' } });
    fireEvent.click(screen.getByTestId('start-surprise'));

    expect((screen.getByTestId('start-region-filter') as HTMLSelectElement).value).toBe('__all__');
    expect((screen.getByTestId('start-search') as HTMLInputElement).value).toBe('');
    // A town is selected and the confirm reflects it.
    expect(screen.getByTestId('start-confirm').textContent).toMatch(/Begin in /);
    rnd.mockRestore();
  });

  it('double-clicking a town confirms it directly', () => {
    const onConfirm = vi.fn();
    render(<StartPointSelection worldSeed={123} onConfirm={onConfirm} />);
    const list = screen.getByTestId('start-town-list');
    fireEvent.doubleClick(within(list).getByText('Aldermoor').closest('button')!);
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ name: 'Aldermoor' }));
  });
});
