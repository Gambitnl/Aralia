import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DungeonParchmentMap from '../DungeonParchmentMap';
import { generateDungeon } from '../../../systems/worldforge/dungeon/generateDungeon';
import { dungeonEntrancePlayerCell } from '../../../systems/worldforge/dungeon/world/dungeonGameplay';
import { revealedDungeonCellKeys } from '../../../systems/worldforge/dungeon/world/dungeonMap';
afterEach(cleanup);
const plan = generateDungeon({ seed: 42, seedPath: 'wf:42/cell:751/dungeon:m28', params: { theme: 'crypt' } });
const cell = dungeonEntrancePlayerCell(plan);
const page = { levelId: 'level:0', plan, discoveredCellKeys: revealedDungeonCellKeys(plan, cell), annotations: [], playerCell: cell };
describe('remembered dungeon party position', () => {
  it('marks the accepted party only on its current reached page and closes by keyboard', () => {
    const close = vi.fn();
    render(<DungeonParchmentMap pages={[page, { ...page, levelId: 'level:1', playerCell: undefined }]} initialLevelId="level:0" onClose={close} />);
    expect(screen.getByRole('img', { name: 'Current party position' })).toHaveAttribute('transform', `translate(${cell.x + 0.5} ${cell.y + 0.5})`);
    fireEvent.click(screen.getByRole('button', { name: 'level 1' }));
    expect(screen.queryByRole('img', { name: 'Current party position' })).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
  });
  it('does not reveal unexplored cells or expand the sheet for an unremembered position', () => {
    const { rerender } = render(<DungeonParchmentMap pages={[page]} initialLevelId="level:0" onClose={vi.fn()} />);
    const before = screen.getByLabelText(`${page.discoveredCellKeys.length} explored dungeon cells`).getAttribute('viewBox');
    const count = screen.getAllByTestId('dungeon-map-explored-cell').length;
    rerender(<DungeonParchmentMap pages={[{ ...page, playerCell: { x: 10000, y: 10000 } }]} initialLevelId="level:0" onClose={vi.fn()} />);
    expect(screen.queryByRole('img', { name: 'Current party position' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(`${page.discoveredCellKeys.length} explored dungeon cells`)).toHaveAttribute('viewBox', before);
    expect(screen.getAllByTestId('dungeon-map-explored-cell')).toHaveLength(count);
  });
});
