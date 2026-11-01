/**
 * This file proves the player-facing expedition can unroll and close its diegetic map.
 *
 * The real overlay and parchment component receive one canonical generated stack. WebGL is replaced
 * by a semantic movement stand-in so the test can verify level-keyed discovery, stable descent and
 * return controls, deepest objective text, and reached-page navigation. Save/load fidelity and full
 * grid routes remain covered by focused model tests.
 */

import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { dungeonEntrancePlayerCell, dungeonSpawnCell, moveDungeonPlayer, dungeonEncounterEventId } from '../../../systems/worldforge/dungeon/world/dungeonGameplay';
import { buildDungeonLevelStack } from '../../../systems/worldforge/dungeon/world/dungeonLevels';
import type { Cell, DungeonPlan } from '../../../systems/worldforge/dungeon/types';
import {dungeonDoorRouteId, openDungeonDoorProgress} from '../../../systems/worldforge/dungeon/world/dungeonDoorActions';
import { ItemType, type PlayerCharacter } from '../../../types';
import {createMockGameState, createMockPlayerCharacter} from '../../../utils/core/factories';
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
  stepTo: {x: 0, y: 0},
  prepare: vi.fn(),
  startEncounter: null as null | ((id: string, cell: {x: number; y: number}) => Promise<void>),
  initialCell: null as null | {x: number; y: number},
  openDoor: null as null | ((target: Cell, player: Cell) => void),
  renderedPlan: null as DungeonPlan | null,
  paused: false,
  renderedCharacter: null as PlayerCharacter | null,
}));

vi.mock('../../../state/GameContext', () => ({
  useGameState: () => ({ state: fixture.state, dispatch: fixture.dispatch }),
}));

vi.mock('../../../systems/worldforge/dungeon/world/dungeonCombat', async (original) => ({
  ...await original<typeof import('../../../systems/worldforge/dungeon/world/dungeonCombat')>(),
  prepareDungeonCombat: fixture.prepare,
}));

vi.mock('../../BattleMap/dungeon/Dungeon3DPreview', () => ({
  Dungeon3DPreview: ({ gameplay, plan }: {
    plan: DungeonPlan;
    gameplay?: { playerCharacter?: PlayerCharacter; paused?: boolean; onDiscoverCells: (cellKeys: readonly string[]) => void; onPlayerCellChange?: (cell: Cell) => void; onStartEncounter?: (id: string, cell: Cell) => Promise<void>; initialPlayerCell?: Cell; onOpenDoor?: (target: Cell, player: Cell) => void };
  }) => {
    fixture.startEncounter = gameplay?.onStartEncounter ?? null;
    fixture.initialCell = gameplay?.initialPlayerCell ?? null;
    fixture.openDoor = gameplay?.onOpenDoor ?? null;
    fixture.renderedPlan = plan;
    fixture.renderedCharacter = gameplay?.playerCharacter ?? null;
    fixture.paused = gameplay?.paused ?? false;
    return (
    // This control stands in for one accepted 3D grid step and calls the production gameplay seam.
    // eslint-disable-next-line no-restricted-syntax
    <button type="button" data-testid="mock-dungeon-move" onClick={() => { gameplay?.onDiscoverCells(['10,11']); gameplay?.onPlayerCellChange?.(fixture.stepTo); }}>
      Move one canonical cell
    </button>
    );
  },
}));

const SEED_PATH = 'wf:42/cell:751/dungeon:m28';
const IDENTITY = { dungeonId: canonicalDungeonId(SEED_PATH), seedPath: SEED_PATH };
const PLAN = generateDungeon({ seed: 42, seedPath: SEED_PATH, params: { theme: 'crypt' } });
const ENTRANCE_KEYS = revealedDungeonCellKeys(PLAN, dungeonEntrancePlayerCell(PLAN));
const ENTRY: ActiveDungeonEntry = {
  identity: IDENTITY,
  entranceKind: 'ruin-door',
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
const LEVELS = buildDungeonLevelStack(IDENTITY, PLAN, 42);
const arriveAt = (cell: Cell) => { fixture.stepTo = cell; fireEvent.click(screen.getByTestId('mock-dungeon-move')); };
let LoadedOverlay: typeof import('../DungeonExpeditionOverlay').default;
// Module transformation can exceed a test's interaction budget on the shared
// host. Finish it before any mounted action, so timeout cannot leak a late portal.
beforeAll(async () => { LoadedOverlay = (await import('../DungeonExpeditionOverlay')).default; }, 60_000);
afterEach(cleanup);

// ============================================================================
// Diegetic Interaction and Movement Persistence Seam
// ============================================================================

describe('DungeonExpeditionOverlay parchment map', () => {
  beforeEach(() => {
    fixture.dispatch.mockClear();
    fixture.prepare.mockReset();
    const record = recordDungeonProgress(enterDungeonExpedition(IDENTITY), {
      exploredCellKeysByLevel: { [DUNGEON_SURFACE_LEVEL_ID]: ENTRANCE_KEYS },
    });
    fixture.state = {
      // The mounted product receives a complete GameState, including carried
      // light/inventory and party fields consumed by the shared renderer.
      ...createMockGameState(),
      isDevModeEnabled: true,
      dungeonExpeditions: { [IDENTITY.dungeonId]: record },
    };
  });

  it('reuses the ordinary game menu for saving without a developer progress action', async () => {
    const DungeonExpeditionOverlay = LoadedOverlay;
    const onAction = vi.fn();
    render(<DungeonExpeditionOverlay entry={ENTRY} onReturn={vi.fn()} onAction={onAction} />);
    fixture.dispatch.mockClear();
    fireEvent.click(screen.getByRole('button', {name: 'Menu'}));
    fireEvent.click(screen.getByRole('menuitem', {name: 'Save Game'}));
    expect(onAction).toHaveBeenCalledWith({type: 'save_game', label: 'Save Game'});
    expect(fixture.dispatch).not.toHaveBeenCalled();
    expect(fixture.initialCell).toEqual(LEVELS[0].entryCell);
  }, 20_000);

  it('forwards the actual lead character and equipped gear to the expedition renderer', () => {
    const character = createMockPlayerCharacter({id:'source-lead', name:'Source Lead'});
    fixture.state.party = [character];
    render(<LoadedOverlay entry={ENTRY} onReturn={vi.fn()} />);
    expect(fixture.renderedCharacter).toBe(character);
    expect(fixture.renderedCharacter?.equippedItems).toBe(character.equippedItems);
    expect(fixture.renderedPlan?.grid).toBe(PLAN.grid);
  });

  it('permits a world retreat only after walking back to the source entrance', () => {
    const onReturn = vi.fn();
    render(<LoadedOverlay entry={ENTRY} onReturn={onReturn} />);
    const away = moveDungeonPlayer(PLAN, LEVELS[0].entryCell, 'east');
    expect(away).not.toEqual(LEVELS[0].entryCell);
    arriveAt(away);
    expect(screen.getByTestId('return-to-world-entrance')).not.toBeVisible();
    fireEvent.click(screen.getByTestId('return-to-world-entrance'));
    expect(onReturn).not.toHaveBeenCalled();
    arriveAt(LEVELS[0].entryCell);
    fireEvent.click(screen.getByTestId('return-to-world-entrance'));
    expect(onReturn).toHaveBeenCalledOnce();
  });

  it('mounts at the accepted saved floor square without reporting another entry', () => {
    const cell = moveDungeonPlayer(PLAN, LEVELS[0].entryCell, 'east');
    const ledger = fixture.state.dungeonExpeditions as Record<string, ReturnType<typeof enterDungeonExpedition>>;
    ledger[IDENTITY.dungeonId] = recordDungeonProgress(ledger[IDENTITY.dungeonId], {
      activeVisit:{depth:0,playerCell:cell,entranceKind:ENTRY.entranceKind,returnContext:ENTRY.returnContext},
    });
    render(<LoadedOverlay entry={ENTRY} onReturn={vi.fn()} />);
    expect(fixture.initialCell).toEqual(cell);
    expect(fixture.dispatch.mock.calls.some(([action]) => action.type === 'DUNGEON_ENTERED')).toBe(false);
  });

  it('rechecks door reach and projects a saved opening without changing the source plan', async () => {
    const DungeonExpeditionOverlay = LoadedOverlay;
    // This generator fixture emits open passages, not closed leaves. Exercise
    // an explicitly authored closed-door contract without changing live worlds.
    const testPlan: DungeonPlan = {...PLAN, doors: PLAN.doors.map(door => door.state === 'open' ? {...door, state: 'door' as const} : door)};
    const candidate = testPlan.doors.flatMap(door => (['north', 'east', 'south', 'west'] as const)
      .map(direction => ({door, player: moveDungeonPlayer(PLAN, door.cell, direction)})))
      .find(({door, player}) => openDungeonDoorProgress(testPlan, IDENTITY, player, door.cell));
    expect(candidate).toBeDefined();
    const {door, player} = candidate!;
    const testEntry = {...ENTRY, plan: testPlan};
    const mounted = render(<DungeonExpeditionOverlay entry={testEntry} onReturn={vi.fn()} />);
    fixture.dispatch.mockClear();
    act(() => fixture.openDoor!(door.cell, player));
    expect(fixture.dispatch).not.toHaveBeenCalled();
    arriveAt(player);
    fixture.dispatch.mockClear();
    act(() => fixture.openDoor!(door.cell, player));
    const routeId = dungeonDoorRouteId(IDENTITY, door.cell);
    expect(fixture.dispatch).toHaveBeenCalledWith({type: 'DUNGEON_PROGRESS_RECORDED',
      payload: {dungeonId: IDENTITY.dungeonId, progress: {openedRouteIds: [routeId]}}});
    const ledger = fixture.state.dungeonExpeditions as Record<string, ReturnType<typeof enterDungeonExpedition>>;
    fixture.state.dungeonExpeditions = {[IDENTITY.dungeonId]: recordDungeonProgress(ledger[IDENTITY.dungeonId], {openedRouteIds: [routeId]})};
    mounted.rerender(<DungeonExpeditionOverlay entry={testEntry} onReturn={vi.fn()} />);
    expect(fixture.renderedPlan?.doors.find(item => item.cell.x === door.cell.x && item.cell.y === door.cell.y)?.state).toBe('open');
    expect(door.state).toBe('door');
    expect(fixture.renderedPlan?.grid).toBe(testPlan.grid);
  }, 20_000);

  it('starts a prepared source battle only while its expedition is still mounted', async () => {
    const DungeonExpeditionOverlay = LoadedOverlay;
    fixture.state.party = [{level: 1}];
    const spawn = PLAN.spawns[0], enemy = dungeonSpawnCell(PLAN, spawn);
    const cell = (['north', 'east', 'south', 'west'] as const).map(d => moveDungeonPlayer(PLAN, enemy, d))
      .find(c => c.x !== enemy.x || c.y !== enemy.y)!;
    const id = dungeonEncounterEventId(LEVELS[0].identity, spawn.roomId, enemy);
    fixture.state.dungeonCombatReturn = {rootIdentity: IDENTITY, depth: 0, playerCell: cell};
    let finish!: (payload: unknown) => void;
    fixture.prepare.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const mounted = render(<DungeonExpeditionOverlay entry={ENTRY} onReturn={vi.fn()} />);
    const pending = fixture.startEncounter!(id, cell);
    expect(fixture.prepare).toHaveBeenCalledOnce();
    mounted.unmount();
    await act(async () => { finish({monsters: [], combatants: []}); await pending; });
    expect(fixture.dispatch.mock.calls.some(([a]) => a.type === 'START_BATTLE_MAP_ENCOUNTER')).toBe(false);

    fixture.prepare.mockResolvedValue({monsters: [], combatants: []});
    render(<DungeonExpeditionOverlay entry={ENTRY} onReturn={vi.fn()} />);
    await act(async () => { await fixture.startEncounter!(id, cell); });
    expect(fixture.dispatch).toHaveBeenCalledWith(expect.objectContaining({type: 'START_BATTLE_MAP_ENCOUNTER'}));
  }, 20_000);

  it('launches a revisited source encounter with its saved injuries and retains the legacy return fallback', async () => {
    const DungeonExpeditionOverlay = LoadedOverlay;
    fixture.state.party = [{level: 1}];
    const spawn = PLAN.spawns[0], enemy = dungeonSpawnCell(PLAN, spawn);
    const cell = (['north', 'east', 'south', 'west'] as const).map(d => moveDungeonPlayer(PLAN, enemy, d))
      .find(c => c.x !== enemy.x || c.y !== enemy.y)!;
    const id = dungeonEncounterEventId(LEVELS[0].identity, spawn.roomId, enemy);
    fixture.state.dungeonCombatReturn = {rootIdentity: IDENTITY, depth: 0, playerCell: cell};
    const ledger = fixture.state.dungeonExpeditions as Record<string, ReturnType<typeof enterDungeonExpedition>>;
    ledger[IDENTITY.dungeonId].progress.encounterHitPoints = {[id]: 23};
    fixture.state.dungeonCombatReturn = {rootIdentity: IDENTITY, depth: 0, playerCell: cell};
    fixture.prepare.mockResolvedValue({monsters: [], combatants: []});
    const first = render(<DungeonExpeditionOverlay entry={ENTRY} onReturn={vi.fn()} />);
    await act(async () => { await fixture.startEncounter!(id, cell); });
    expect(fixture.prepare.mock.calls.at(-1)?.[1]).toBe(23);
    first.unmount();
    // A conflicting older visit-local receipt cannot heal a source-ledger enemy.
    fixture.state.dungeonCombatReturn = {rootIdentity: IDENTITY, depth: 0, playerCell: cell, encounterId: id, enemyHP: 31};
    const second = render(<DungeonExpeditionOverlay entry={ENTRY} onReturn={vi.fn()} />);
    await act(async () => { await fixture.startEncounter!(id, cell); });
    expect(fixture.prepare.mock.calls.at(-1)?.[1]).toBe(23);
    second.unmount();
    delete ledger[IDENTITY.dungeonId].progress.encounterHitPoints;
    render(<DungeonExpeditionOverlay entry={ENTRY} onReturn={vi.fn()} />);
    await act(async () => { await fixture.startEncounter!(id, cell); });
    expect(fixture.prepare.mock.calls.at(-1)?.[1]).toBe(31);
  }, 20_000);

  it('resumes the persisted source floor and footing without a fresh entrance', async () => {
    const DungeonExpeditionOverlay = LoadedOverlay;
    const cell = LEVELS[1].entryCell;
    fixture.state.dungeonCombatReturn = {rootIdentity: IDENTITY, depth: 1, playerCell: cell};
    render(<DungeonExpeditionOverlay entry={ENTRY} onReturn={vi.fn()} />);
    expect(screen.getByTestId('dungeon-level-receipt')).toHaveTextContent('level:1');
    expect(fixture.initialCell).toEqual(cell);
    expect(screen.getByTestId('dungeon-ascend')).toBeEnabled();
  }, 20_000);

  it('opens a concealed sheet, closes it, and sends movement discovery to the canonical ledger', async () => {
    const DungeonExpeditionOverlay = LoadedOverlay;
    render(<DungeonExpeditionOverlay entry={ENTRY} onReturn={vi.fn()} />);

    expect(screen.queryByTestId('dungeon-parchment-map')).not.toBeInTheDocument();
    expect(screen.getByTestId('dungeon-expedition-overlay').parentElement).toBe(document.body);
    expect(fixture.paused).toBe(false);
    fireEvent.click(screen.getByTestId('open-dungeon-map'));

    const sheet = screen.getByTestId('dungeon-parchment-map');
    expect(sheet).toHaveAttribute('data-level-id', DUNGEON_SURFACE_LEVEL_ID);
    expect(sheet).toHaveAttribute('data-page-count', '1');
    expect(sheet).toHaveAttribute('data-discovered-cell-count', String(ENTRANCE_KEYS.length));
    expect(Number(sheet.getAttribute('data-hidden-landmark-count'))).toBeGreaterThan(0);
    expect(screen.getAllByTestId('dungeon-map-explored-cell')).toHaveLength(ENTRANCE_KEYS.length);
    expect(screen.getByRole('img', {name: 'Current party position'})).toBeInTheDocument();
    expect(fixture.paused).toBe(true);

    fireEvent.click(screen.getByTestId('close-dungeon-map'));
    expect(screen.queryByTestId('dungeon-parchment-map')).not.toBeInTheDocument();
    expect(fixture.paused).toBe(false);

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

  it('keeps bought accounts visible while raw receipts stay behind developer details', async () => {
    fixture.state.inventory = [{id: 'heard', name: 'Rumor', type: ItemType.Service,
      sourceId: `gossip_dungeon-town-${SEED_PATH}-0`, description: 'A paid local account.'}];
    const DungeonExpeditionOverlay = LoadedOverlay;
    render(<DungeonExpeditionOverlay entry={ENTRY} onReturn={vi.fn()} />);
    expect(screen.getByRole('region', {name: 'Expedition journal'})).toHaveTextContent('A paid local account.');
    expect(screen.getByTestId('dungeon-entry-receipt')).not.toBeVisible();
    expect(screen.getByTestId('dungeon-entry-receipt')).toHaveTextContent(IDENTITY.dungeonId);
  }, 20_000);

  it('omits developer receipts in ordinary player mode', async () => {
    fixture.state.isDevModeEnabled = false;
    const DungeonExpeditionOverlay = LoadedOverlay;
    render(<DungeonExpeditionOverlay entry={ENTRY} onReturn={vi.fn()} />);
    expect(screen.queryByText('Developer details', {exact: true})).not.toBeInTheDocument();
    expect(screen.queryByTestId('dungeon-entry-receipt')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/^Field notes ·/));
    expect(screen.getByRole('region', {name: 'Expedition journal'})).toBeVisible();
  }, 20_000);

  it('descends through stable child receipts, returns to the parent, and exposes reached map pages', async () => {
    const DungeonExpeditionOverlay = LoadedOverlay;
    render(<DungeonExpeditionOverlay entry={ENTRY} onReturn={vi.fn()} />);

    expect(screen.getByTestId('dungeon-level-receipt')).toHaveTextContent('level:0');
    expect(screen.getByTestId('dungeon-descend')).toBeDisabled();
    fireEvent.click(screen.getByTestId('dungeon-descend'));
    expect(screen.getByTestId('dungeon-level-receipt')).toHaveTextContent('level:0');
    arriveAt(LEVELS[0].downTransition!.cell);
    expect(screen.getByTestId('dungeon-descend')).toBeEnabled();
    fireEvent.click(screen.getByTestId('dungeon-descend'));
    expect(screen.getByTestId('dungeon-level-receipt')).toHaveTextContent('level:1');
    expect(screen.getByTestId('dungeon-parent-link')).toHaveTextContent('level:0');
    // The child arrives on its actual up-stair; moving away revokes access.
    arriveAt({x: -1, y: -1});
    expect(screen.getByTestId('dungeon-ascend')).toBeDisabled();
    arriveAt(LEVELS[1].upTransition!.cell);
    expect(screen.getByTestId('dungeon-ascend')).toBeEnabled();

    fireEvent.click(screen.getByTestId('dungeon-ascend'));
    expect(screen.getByTestId('dungeon-level-receipt')).toHaveTextContent('level:0');

    // Re-descend and continue to the deepest generated boss page. The second descent reuses the
    // same child identity rather than allocating another route or plan.
    fireEvent.click(screen.getByTestId('dungeon-descend'));
    arriveAt(LEVELS[1].downTransition!.cell);
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

it('refuses a stale encounter request from a square the mounted party has not accepted', async () => {
  fixture.state = {...createMockGameState({worldSeed: 42, party: [createMockPlayerCharacter()],
    dungeonExpeditions: {[IDENTITY.dungeonId]: enterDungeonExpedition(IDENTITY)}})};
  fixture.prepare.mockClear(); fixture.dispatch.mockClear();
  render(<LoadedOverlay entry={ENTRY} onReturn={vi.fn()} />);
  const accepted = fixture.initialCell!;
  await expect(fixture.startEncounter!('untrusted-id', {x: accepted.x + 1, y: accepted.y})).rejects.toThrow(/position changed/i);
  expect(fixture.prepare).not.toHaveBeenCalled();
  expect(fixture.dispatch.mock.calls.some(([a]) => a.type === 'START_BATTLE_MAP_ENCOUNTER')).toBe(false);
});
