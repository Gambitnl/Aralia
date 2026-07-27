/**
 * This file proves the bounded world-entrance runtime handoff.
 *
 * It starts from a real seed-42 world attachment, selects the same entrance the 3D ground uses,
 * opens the canonical generated plan, and checks that the exact world position survives for the
 * return action. Separate assertions cover interaction distance and visible-failure inputs without
 * introducing persistence, dungeon gameplay, or deeper-level state.
 */
import { describe, expect, it } from 'vitest';
import { getWorldforgeLocalForCell } from '../../../systems/worldforge/bridge/legacySubmapBridge';
import { dungeonEntrancesForWindow } from '../../../systems/worldforge/bridge/dungeonEntrances';
import type { GroundDungeonEntrance } from '../../../systems/worldforge/bridge/groundChunkLoader';
import { canonicalDungeonId } from '../../../systems/worldforge/dungeon/world/deriveIdentity';
import { enumerateDungeonSites } from '../../../systems/worldforge/dungeon/world/dungeonSites';
import {
  createDungeonEntry,
  DUNGEON_ENTRY_INTERACTION_RADIUS_M,
  nearestEnterableDungeon,
  type DungeonWorldReturnContext,
} from '../dungeonEntryRuntime';

const WORLD_SEED = 42;

// ============================================================================
// Real Ground Entrance Fixture
// ============================================================================
// The fixture asks the authoritative world attachment and ground-window bridge for its entrance;
// no synthetic dungeon id, seed path, or generated plan is invented by the test.
// ============================================================================

function realEntrance(): GroundDungeonEntrance {
  const site = enumerateDungeonSites(WORLD_SEED).find((candidate) => candidate.origin === 'marker');
  if (!site) throw new Error('Dungeon entry test world has no marker-backed dungeon site.');
  const { local } = getWorldforgeLocalForCell(WORLD_SEED, site.cellId);
  const entrance = dungeonEntrancesForWindow(WORLD_SEED, local).find(
    (candidate) => candidate.sitePath === site.sitePath,
  );
  if (!entrance) throw new Error('Marker-backed dungeon did not surface in its ground window.');
  return entrance;
}

// ============================================================================
// Enter and Return Contract
// ============================================================================

describe('playable dungeon entry runtime', () => {
  it('opens the correct canonical plan and preserves the exact originating world context', () => {
    const entrance = realEntrance();
    const returnContext: DungeonWorldReturnContext = {
      worldSeed: WORLD_SEED,
      cellId: entrance.cellId,
      tileX: 25,
      tileY: 16,
      xM: entrance.xM - 1.25,
      zM: entrance.zM + 0.75,
    };

    const entry = createDungeonEntry(entrance, returnContext);

    expect(entry.identity).toEqual({
      dungeonId: canonicalDungeonId(entrance.sitePath),
      seedPath: entrance.sitePath,
    });
    expect(entry.plan.seed).toBe(WORLD_SEED);
    expect(entry.plan.name.length).toBeGreaterThan(0);
    expect(entry.returnContext).toEqual(returnContext);
    expect(entry.returnContext).not.toBe(returnContext);
  });

  it('offers entry only when the player is close to the nearest world entrance', () => {
    const entrance = realEntrance();

    expect(
      nearestEnterableDungeon(
        [entrance],
        entrance.xM + DUNGEON_ENTRY_INTERACTION_RADIUS_M - 0.1,
        entrance.zM,
      )?.id,
    ).toBe(entrance.id);
    expect(
      nearestEnterableDungeon(
        [entrance],
        entrance.xM + DUNGEON_ENTRY_INTERACTION_RADIUS_M + 0.1,
        entrance.zM,
      ),
    ).toBeNull();
  });

  it('rejects an unavailable attachment instead of generating a fallback interior', () => {
    const entrance = realEntrance();
    const staleEntrance = { ...entrance, id: 'wf-dungeon-stale-attachment' };
    const returnContext: DungeonWorldReturnContext = {
      worldSeed: WORLD_SEED,
      cellId: entrance.cellId,
      tileX: 25,
      tileY: 16,
      xM: entrance.xM,
      zM: entrance.zM,
    };

    expect(() => createDungeonEntry(staleEntrance, returnContext)).toThrow(/identity mismatch/i);
  });
});
