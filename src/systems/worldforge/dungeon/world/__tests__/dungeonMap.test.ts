/**
 * This file proves that dungeon movement inks a concealed sheet from the canonical plan.
 *
 * A fixed world-attached dungeon starts with only the entrance area visible. The test then walks
 * the existing legal path to an authored treasure room, accumulating exactly the same cell reveal
 * events the mounted 3D controls emit. The resulting parchment must remember that landmark while
 * never drawing undiscovered floor. A second assertion proves vertical annotations stay concealed
 * until their real transition or deepest-objective cell is inked.
 */

import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../generateDungeon';
import { CellKind, type Cell } from '../../types';
import { canonicalDungeonId, type DungeonIdentity } from '../dungeonIdentity';
import {
  dungeonEntrancePlayerCell,
  dungeonPathToTreasureInteraction,
  findNextDungeonTreasureInteraction,
} from '../dungeonGameplay';
import {
  buildDungeonParchmentSheet,
  dungeonCellKey,
  revealedDungeonCellKeys,
} from '../dungeonMap';

// ============================================================================
// Canonical Plan Fixture
// ============================================================================
// This is the same deterministic world-attached input used by the gameplay lane. No second map
// generator or hand-authored topology enters the proof.
// ============================================================================

const SEED_PATH = 'wf:1784445698735/burg:1/dungeon:sewer';
const IDENTITY: DungeonIdentity = {
  dungeonId: canonicalDungeonId(SEED_PATH),
  seedPath: SEED_PATH,
};
const PLAN = generateDungeon({
  seed: 1784445698735,
  seedPath: SEED_PATH,
  params: {
    roomCount: 32,
    theme: 'sewer',
    loopChance: 0.22,
    decorDensity: 0.55,
  },
});

// ============================================================================
// Reveal, Concealment, and Landmark Memory
// ============================================================================

describe('canonical dungeon parchment model', () => {
  it('conceals unseen topology and landmarks at initial entry', () => {
    const entrance = dungeonEntrancePlayerCell(PLAN);
    const revealed = revealedDungeonCellKeys(PLAN, entrance);
    const sheet = buildDungeonParchmentSheet(PLAN, revealed);

    expect(sheet.discoveredCellCount).toBe(revealed.length);
    expect(sheet.hiddenFloorCellCount).toBeGreaterThan(0);
    expect(sheet.visibleLandmarks.map((landmark) => landmark.kind)).toContain('entrance');
    expect(sheet.visibleLandmarks.map((landmark) => landmark.kind)).not.toContain('treasure');
    expect(sheet.hiddenLandmarkCount).toBeGreaterThan(0);

    // A far canonical floor cell exists in the plan but does not enter the explored drawing.
    const unseenFloor = Array.from(PLAN.grid).findIndex((kind, index) => (
      kind === CellKind.Floor && !revealed.includes(`${index % PLAN.W},${Math.floor(index / PLAN.W)}`)
    ));
    expect(unseenFloor).toBeGreaterThanOrEqual(0);
    expect(sheet.exploredCells.map(dungeonCellKey)).not.toContain(
      `${unseenFloor % PLAN.W},${Math.floor(unseenFloor / PLAN.W)}`,
    );
  });

  it('inks movement cells and remembers an authored landmark only after entering its room', () => {
    const entrance = dungeonEntrancePlayerCell(PLAN);
    const treasure = findNextDungeonTreasureInteraction(PLAN, IDENTITY, [], entrance);
    expect(treasure).not.toBeNull();
    if (!treasure) throw new Error('Canonical map fixture has no reachable treasure room.');
    const path = dungeonPathToTreasureInteraction(PLAN, entrance, treasure);
    const discovered = new Set<string>();

    // Accumulate the same local reveal around every real movement cell. No room rectangle or
    // generated map shortcut is used to reveal the route.
    for (const playerCell of path) {
      for (const key of revealedDungeonCellKeys(PLAN, playerCell as Cell)) discovered.add(key);
    }
    const afterTreasure = buildDungeonParchmentSheet(PLAN, [...discovered]);

    expect(afterTreasure.discoveredCellCount).toBeGreaterThan(
      revealedDungeonCellKeys(PLAN, entrance).length,
    );
    expect(afterTreasure.visibleLandmarks).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'treasure', roomId: treasure.roomId }),
    ]));
    expect(afterTreasure.hiddenFloorCellCount).toBeGreaterThan(0);
    expect(afterTreasure.visibleLandmarks.map((landmark) => landmark.kind)).not.toContain('boss');
  });

  it('reveals a stable stair or boss annotation only when its canonical floor cell is explored', () => {
    const bossRoom = PLAN.rooms.find((room) => room.id === PLAN.bossId);
    expect(bossRoom).toBeDefined();
    const bossFloorIndex = Array.from(PLAN.grid).findIndex((kind, index) => {
      if (kind !== CellKind.Floor || !bossRoom) return false;
      const x = index % PLAN.W;
      const y = Math.floor(index / PLAN.W);
      return x >= Math.floor(bossRoom.x / PLAN.cellFt)
        && x < Math.ceil((bossRoom.x + bossRoom.w) / PLAN.cellFt)
        && y >= Math.floor(bossRoom.y / PLAN.cellFt)
        && y < Math.ceil((bossRoom.y + bossRoom.h) / PLAN.cellFt);
    });
    expect(bossFloorIndex).toBeGreaterThanOrEqual(0);
    const bossCell = { x: bossFloorIndex % PLAN.W, y: Math.floor(bossFloorIndex / PLAN.W) };
    const annotation = {
      id: `objective.v1:${IDENTITY.dungeonId}:boss:${PLAN.bossId}`,
      kind: 'boss' as const,
      label: 'Deepest boss objective',
      cell: bossCell,
      roomId: PLAN.bossId,
    };

    const concealed = buildDungeonParchmentSheet(PLAN, [], [annotation]);
    const revealed = buildDungeonParchmentSheet(PLAN, [dungeonCellKey(bossCell)], [annotation]);
    expect(concealed.visibleLandmarks).toEqual([]);
    expect(concealed.hiddenLandmarkCount).toBeGreaterThan(revealed.hiddenLandmarkCount);
    expect(revealed.visibleLandmarks).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'boss', cell: bossCell }),
    ]));
  });
});
