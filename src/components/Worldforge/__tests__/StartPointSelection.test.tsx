import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import StartPointSelection from '../StartPointSelection';

// Heavy SVG atlas → stub it; we only test the selection panel behavior here.
vi.mock('../AtlasSvgView', () => ({
  default: ({ marker, prefsScope }: { marker: { x: number; y: number } | null; prefsScope?: string | number }) => (
    <div
      data-testid="atlas-stub"
      data-marker={marker ? `${marker.x},${marker.y}` : 'none'}
      data-prefs-scope={prefsScope}
    />
  ),
}));

// Deterministic fake world: two states plus enough burgs to exercise the same
// bounded paging contract used by canonical 700+ town worlds.
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
        ...Array.from({ length: 202 }, (_, index) => ({
          i: index + 4,
          cell: index + 40,
          name: `Town ${String(index + 1).padStart(3, '0')}`,
          x: index + 2,
          y: index + 3,
          state: 1,
          population: 0.5,
        })),
      ],
    },
  }),
}));

beforeEach(() => {
  // jsdom lacks ResizeObserver.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
});

describe('StartPointSelection', () => {
  it('scopes saved map colors to the selected world seed', () => {
    render(<StartPointSelection worldSeed={5678} onConfirm={vi.fn()} />);

    expect(screen.getByTestId('atlas-stub')).toHaveAttribute('data-prefs-scope', '5678');
  });

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
    // Named fixtures remain available in the larger catalogue.
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

  it('stacks the atlas above the selection panel on cramped viewports', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 480 });

    render(<StartPointSelection worldSeed={123} onConfirm={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByTestId('start-select-layout')).toHaveStyle({ flexDirection: 'column' });
    expect(screen.getByTestId('start-select-map')).toHaveStyle({ flex: '0 0 32vh', width: '100%' });
    expect(screen.getByTestId('start-select-panel')).toHaveStyle({ width: '100%' });
    expect(screen.getByTestId('start-select-panel')).toHaveStyle({ borderTop: '1px solid #1e293b' });
    // The final start decision stays visible in the short stacked panel, but
    // sits above the town list so it does not cover selectable rows.
    expect(screen.getByTestId('start-action-bar')).toHaveStyle({ order: '1' });
    expect(screen.getByTestId('start-town-list')).toHaveStyle({ order: '2' });
    // Rendered mobile play found these controls under the 44px touch target
    // floor; keep the compact layout playable without removing any choices.
    expect(screen.getByTestId('start-search')).toHaveStyle({ minHeight: '44px' });
    expect(screen.getByTestId('start-region-filter')).toHaveStyle({ minHeight: '44px' });
    expect(screen.getAllByTestId('start-town-row')[0]).toHaveStyle({ minHeight: '44px' });
    expect(screen.getByRole('button', { name: 'Back' })).toHaveStyle({ minHeight: '44px' });
    expect(screen.getByTestId('start-surprise')).toHaveStyle({ minHeight: '44px' });
    expect(screen.getByTestId('start-confirm')).toHaveStyle({ minHeight: '44px' });
  });

  it('exposes the town list as a bounded ARIA listbox with keyboard navigation (GG-40)', () => {
    render(<StartPointSelection worldSeed={123} onConfirm={vi.fn()} />);

    // One listbox (a single tab stop) that announces the result count, instead
    // of hundreds of sibling buttons flooding the accessibility tree.
    const list = screen.getByTestId('start-town-list');
    expect(list).toHaveAttribute('role', 'listbox');
    expect(list).toHaveAttribute('tabindex', '0');
    expect(list.getAttribute('aria-label')).toMatch(/Selectable towns, \d+ result/);

    // Rows are options carrying selection state; the active option is referenced.
    const rows = screen.getAllByTestId('start-town-row');
    expect(rows[0]).toHaveAttribute('role', 'option');
    expect(rows.every((r) => r.getAttribute('tabindex') === '-1')).toBe(true);
    const selected = rows.find((r) => r.getAttribute('aria-selected') === 'true')!;
    expect(selected).toBeTruthy();
    expect(list.getAttribute('aria-activedescendant')).toBe(selected.id);

    // Arrow-down moves the active option to the next town without leaving the listbox.
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    const nextSelected = screen
      .getAllByTestId('start-town-row')
      .find((r) => r.getAttribute('aria-selected') === 'true')!;
    expect(nextSelected.id).not.toBe(selected.id);
    expect(screen.getByTestId('start-town-list').getAttribute('aria-activedescendant')).toBe(nextSelected.id);
  });

  it('keeps broad search results bounded and makes every result reachable by page or exact search', () => {
    render(<StartPointSelection worldSeed={123} onConfirm={vi.fn()} />);

    expect(screen.getAllByTestId('start-town-row')).toHaveLength(150);
    expect(screen.getByTestId('start-town-results')).toHaveTextContent('Showing towns 1 to 150 of 205. Page 1 of 2.');

    // A broad query still exposes one bounded page, rather than rebuilding a
    // 202-option accessibility tree.
    fireEvent.change(screen.getByTestId('start-search'), { target: { value: 'Town' } });
    expect(screen.getAllByTestId('start-town-row')).toHaveLength(150);
    expect(screen.getByTestId('start-town-results')).toHaveTextContent('Showing towns 1 to 150 of 202. Page 1 of 2.');

    fireEvent.click(screen.getByRole('button', { name: 'Next towns' }));
    expect(screen.getAllByTestId('start-town-row')).toHaveLength(52);
    expect(screen.getByTestId('start-town-results')).toHaveTextContent('Showing towns 151 to 202 of 202. Page 2 of 2.');
    expect(within(screen.getByTestId('start-town-list')).getByText('Town 202')).toBeTruthy();

    // Exact search remains the shortest route to any canonical town.
    fireEvent.change(screen.getByTestId('start-search'), { target: { value: 'Town 202' } });
    expect(screen.getAllByTestId('start-town-row')).toHaveLength(1);
    expect(within(screen.getByTestId('start-town-list')).getByText('Town 202')).toBeTruthy();
  });

  it('never confirms a town hidden by filtering and supports the full listbox key set', () => {
    const onConfirm = vi.fn();
    render(<StartPointSelection worldSeed={123} onConfirm={onConfirm} />);

    // The default capital is not Aldermoor. Filtering must move the active
    // option before Enter is allowed to confirm anything.
    fireEvent.change(screen.getByTestId('start-search'), { target: { value: 'Aldermoor' } });
    const list = screen.getByTestId('start-town-list');
    expect(list).toHaveAttribute('aria-activedescendant', 'start-town-opt-1');
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(onConfirm).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Aldermoor' }));

    // Home and End stay within the visible page; Space confirms its visible
    // active option just like Enter.
    fireEvent.change(screen.getByTestId('start-search'), { target: { value: 'Town' } });
    fireEvent.keyDown(list, { key: 'End' });
    expect(list).toHaveAttribute('aria-activedescendant', 'start-town-opt-153');
    fireEvent.keyDown(list, { key: 'Home' });
    expect(list).toHaveAttribute('aria-activedescendant', 'start-town-opt-4');
    fireEvent.keyDown(list, { key: ' ' });
    expect(onConfirm).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Town 001' }));

    fireEvent.change(screen.getByTestId('start-search'), { target: { value: 'not a real town' } });
    expect(screen.getByTestId('start-confirm')).toBeDisabled();
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});
