/** Door persistence must change passage without rewriting the source or revealing secret ways. */
import {describe, expect, it} from 'vitest';
import {generateDungeon} from '../../generateDungeon';
import {CellKind, type DungeonPlan} from '../../types';
import {canonicalDungeonId} from '../dungeonIdentity';
import {moveDungeonPlayer} from '../dungeonGameplay';
import {enterDungeonExpedition, recordDungeonProgress} from '../dungeonLifecycle';
import {dungeonDoorRouteId, openDungeonDoorProgress, withOpenedDungeonDoors} from '../dungeonDoorActions';

const seedPath = 'wf:42/cell:751/dungeon:m28';
const identity = {seedPath, dungeonId: canonicalDungeonId(seedPath)};
// A small corridor isolates the actual movement boundary, while retaining a
// complete generated contract for callers that consume other plan fields.
function corridor(): DungeonPlan {
  const original = generateDungeon({seed: 42, seedPath, params: {theme: 'crypt'}});
  return {...original, W: 5, H: 3, grid: new Uint8Array([
    2, 2, 2, 2, 2,
    2, 1, 1, 1, 2,
    2, 2, 2, 2, 2,
  ]), doors: [{cell: {x: 2, y: 1}, state: 'door'}]};
}

describe('ordinary dungeon door actions', () => {
  it('opens from adjacent footing, survives ledger save/revisit, and unlocks the same floor', () => {
    const plan = corridor(), player = {x: 1, y: 1}, target = {x: 2, y: 1};
    expect(moveDungeonPlayer(plan, player, 'east')).toEqual(player);
    const patch = openDungeonDoorProgress(plan, identity, player, target)!;
    const saved = JSON.parse(JSON.stringify(recordDungeonProgress(enterDungeonExpedition(identity), patch)));
    const revisited = withOpenedDungeonDoors(plan, identity, saved.progress.openedRouteIds);
    expect(moveDungeonPlayer(revisited, player, 'east')).toEqual(target);
    expect(revisited.grid).toBe(plan.grid);
    expect(revisited.rooms).toBe(plan.rooms);
    expect(revisited.spawns).toBe(plan.spawns);
    expect(revisited.traps).toBe(plan.traps);
    expect(plan.doors[0].state).toBe('door');
    expect(openDungeonDoorProgress(revisited, identity, player, target)).toBeNull();
    expect(recordDungeonProgress(saved, patch).progress.openedRouteIds).toHaveLength(1);
  });

  it('rejects remote, diagonal, nonfloor and occupied closed-door footing', () => {
    const plan = corridor(), target = {x: 2, y: 1};
    for (const player of [{x: 0, y: 1}, {x: 2, y: 0}, {x: 1, y: 0}, target, {x: NaN, y: 1}]) {
      expect(openDungeonDoorProgress(plan, identity, player, target)).toBeNull();
    }
    plan.grid[1 * plan.W + 2] = CellKind.Wall;
    expect(openDungeonDoorProgress(plan, identity, {x: 1, y: 1}, target)).toBeNull();
  });

  it('never reveals secrets, demolishes brickwork, or reuses another level’s route', () => {
    for (const state of ['secret', 'bricked'] as const) {
      const plan = corridor(); plan.doors[0].state = state;
      expect(openDungeonDoorProgress(plan, identity, {x: 1, y: 1}, {x: 2, y: 1})).toBeNull();
      expect(withOpenedDungeonDoors(plan, identity, [dungeonDoorRouteId(identity, {x: 2, y: 1})])).toBe(plan);
    }
    const plan = corridor(), child = {...identity, dungeonId: `${identity.dungeonId}/level:1`};
    expect(withOpenedDungeonDoors(plan, identity, [dungeonDoorRouteId(child, {x: 2, y: 1}), 'unknown'])).toBe(plan);
  });
});
