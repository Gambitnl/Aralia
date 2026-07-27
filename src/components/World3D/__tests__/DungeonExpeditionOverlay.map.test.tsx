/**
 * This file proves the player-facing expedition can unroll and close its diegetic map.
 *
 * The real overlay and parchment component receive one canonical generated stack. WebGL is replaced
 * by a semantic movement stand-in so the test can verify level-keyed discovery, stable descent and
 * return controls, deepest objective text, and reached-page navigation. Save/load fidelity and full
 * grid routes remain covered by focused model tests.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateDungeon } from '../../../systems/worldforge/dungeon/generateDungeon';
import { canonicalDungeonId } from '../../../systems/worldforge/dungeon/world/dungeonIdentity';
import {
  enterDungeonExpedition,
  recordDungeonProgress,
} from '../../../systems/worldforge/dungeon/world/dungeonLifecycle';
import {
  DUNGEON_SURFACE_LEVEL_ID,
  revealedDungeonCellKeys,
} from '../../../systems/worldforge/dungeon/world/dungeonMap';
import { dungeonEntrancePlayerCell } from '../../../systems/worldforge/dungeon/world/dungeonGameplay';
import type { ActiveDungeonEntry } from '../dungeonEntryRuntime';

// ============================================================================
// Mounted Expedition Fixture
// ============================================================================
// The identity and plan use the same world-attached seed path. Mutable state lets each test expose
// exactly one persisted ledger receipt without replacing the production overlay logic.
// ============================================================================

const fixture = vi.hoisted(() => ({
  dispatch: vi.fn(),
  state: {} as Record<string, unknown>,
}));

vi.mock('../../../state/GameContext', () => ({
  useGameState: () => ({ state: fixture.state, dispatch: fixture.dispatch }),
}));

vi.mock('../../BattleMap/dungeon/Dungeon3DPreview', () => ({
  Dungeon3DPreview: ({ gameplay }: {
    gameplay?: { onDiscoverCells: (cellKeys: readonly string[]) => void };
  }) => (
    // This control stands in for one accepted 3D grid step and calls the production gameplay seam.
    // eslint-disable-next-line no-restricted-syntax
    <button type="button" data-testid="mock-dungeon-move" onClick={() => gameplay?.onDiscoverCells(['10,11'])}>
      Move one canonical cell
    </button>
  ),
}));

const SEED_PATH = 'wf:42/cell:751/dungeon:m28';
const IDENTITY = { dungeonId: canonicalDungeonId(SEED_PATH), seedPath: SEED_PATH };
const PLAN = generateDungeon({ seed: 42, seedPath: SEED_PATH, params: { theme: 'crypt' } });
const ENTRANCE_KEYS = revealedDungeonCellKeys(PLAN, dungeonEntrancePlayerCell(PLAN));
const ENTRY: ActiveDungeonEntry = {
  identity: IDENTITY,
  entranceKind: 'dungeon',
  plan: PLAN,
  returnContext: {
    worldSeed: 42,
    cellId: 751,
    tileX: 25,
    tileY: 16,
    xM: 443.5,
    zM: 469.9,
  },
};

// ============================================================================
// Diegetic Interaction and Movement Persistence Seam
// ============================================================================

describe('DungeonExpeditionOverlay parchment map', () => {
  beforeEach(() => {
    fixture.dispatch.mockClear();
    const record = recordDungeonProgress(enterDungeonExpedition(IDENTITY), {
      exploredCellKeysByLevel: { [DUNGEON_SURFACE_LEVEL_ID]: ENTRANCE_KEYS },
    });
    fixture.state = {
      dungeonExpeditions: { [IDENTITY.dungeonId]: record },
    };
  });

  it('opens a concealed sheet, closes it, and sends movement discovery to the canonical ledger', async () => {
    const DungeonExpeditionOverlay = (await import('../DungeonExpeditionOverlay')).default;
    render(<DungeonExpeditionOverlay entry={ENTRY} onReturn={vi.fn()} />);

    expect(screen.queryByTestId('dungeon-parchment-map')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('open-dungeon-map'));

    const sheet = screen.getByTestId('dungeon-parchment-map');
    expect(sheet).toHaveAttribute('data-level-id', DUNGEON_SURFACE_LEVEL_ID);
    expect(sheet).toHaveAttribute('data-page-count', '1');
    expect(sheet).toHaveAttribute('data-discovered-cell-count', String(ENTRANCE_KEYS.length));
    expect(Number(sheet.getAttribute('data-hidden-landmark-count'))).toBeGreaterThan(0);
    expect(screen.getAllByTestId('dungeon-map-explored-cell')).toHaveLength(ENTRANCE_KEYS.length);

    fireEvent.click(screen.getByTestId('close-dungeon-map'));
    expect(screen.queryByTestId('dungeon-parchment-map')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mock-dungeon-move'));
    expect(fixture.dispatch).toHaveBeenCalledWith({
      type: 'DUNGEON_PROGRESS_RECORDED',
      payload: {
        dungeonId: IDENTITY.dungeonId,
        progress: {
          exploredCellKeysByLevel: { [DUNGEON_SURFACE_LEVEL_ID]: ['10,11'] },
        },
      },
    });
  }, 20_000);

  it('descends through stable child receipts, returns to the parent, and exposes reached map pages', async () => {
    const DungeonExpeditionOverlay = (await import('../DungeonExpeditionOverlay')).default;
    render(<DungeonExpeditionOverlay entry={ENTRY} onReturn={vi.fn()} />);

    expect(screen.getByTestId('dungeon-level-receipt')).toHaveTextContent('level:0');
    fireEvent.click(screen.getByTestId('dungeon-descend'));
    expect(screen.getByTestId('dungeon-level-receipt')).toHaveTextContent('level:1');
    expect(screen.getByTestId('dungeon-parent-link')).toHaveTextContent('level:0');
    expect(screen.getByTestId('dungeon-ascend')).toBeEnabled();

    fireEvent.click(screen.getByTestId('dungeon-ascend'));
    expect(screen.getByTestId('dungeon-level-receipt')).toHaveTextContent('level:0');

    // Re-descend and continue to the deepest generated boss page. The second descent reuses the
    // same child identity rather than allocating another route or plan.
    fireEvent.click(screen.getByTestId('dungeon-descend'));
    fireEvent.click(screen.getByTestId('dungeon-descend'));
    expect(screen.getByTestId('dungeon-level-receipt')).toHaveTextContent('level:2');
    expect(screen.queryByTestId('dungeon-descend')).not.toBeInTheDocument();
    expect(screen.getByTestId('dungeon-vertical-landmarks')).toHaveTextContent('Boss objective at');

    fireEvent.click(screen.getByTestId('open-dungeon-map'));
    const pages = screen.getAllByTestId('dungeon-map-level-page');
    expect(pages).toHaveLength(3);
    fireEvent.click(pages[0]);
    expect(screen.getByTestId('dungeon-parchment-map')).toHaveAttribute('data-level-id', 'level:0');

    expect(fixture.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'DUNGEON_PROGRESS_RECORDED',
      payload: expect.objectContaining({
        dungeonId: IDENTITY.dungeonId,
        progress: expect.objectContaining({
          levelVisits: expect.objectContaining({
            'level:1': expect.objectContaining({ parentLevelId: 'level:0' }),
          }),
        }),
      }),
    }));
  }, 20_000);
});
