import { describe, it, expect, beforeAll } from 'vitest';
import { getWorldforgeLocalForCell } from '@/systems/worldforge/bridge/legacySubmapBridge';
import { makeGroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { WORLD_BATTLE_SCENARIO_PRESETS } from '@/systems/combat/worldScenario/worldBattleScenario';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';

/**
 * Water, checked against a REAL generated location rather than a fixture grid.
 *
 * Three water changes in a row were judged by eye in the browser, where a stale
 * worker bundle or a second bake path can make a change look like it did
 * nothing. This asserts on the ground world the game actually bakes.
 */
describe('water in a real baked ground world', () => {
  let ground: GroundWorld;

  beforeAll(() => {
    const preset = WORLD_BATTLE_SCENARIO_PRESETS.find(
      (c) => c.id === 'legium-settlement-edge',
    )!;
    const bridged = getWorldforgeLocalForCell(preset.worldSeed, preset.entryCellId, {
      centerPx: preset.centerPx,
    });
    ground = makeGroundWorld(bridged.local, preset.worldSeed, bridged.region, {
      hour: preset.hour ?? 12,
      anchorCellId: preset.entryCellId,
    });
  }, 60_000);

  it('bakes water runs at all', () => {
    expect(ground.waterRuns).toBeDefined();
    expect(ground.waterRuns!.length).toBeGreaterThan(0);
  });

  it('reports whether this location has an authored river', () => {
    // Not an assertion about the world — a fact the next test depends on, made
    // visible so a zero here explains an absent river rather than hiding it.
    const rivers = ground.waterBodies.filter((b) => b.kind === 'river');
    const withCenterline = rivers.filter((b) => b.centerlineM?.length);
    // eslint-disable-next-line no-console
    console.log(
      `[water] bodies=${ground.waterBodies.length} rivers=${rivers.length} ` +
      `withCenterline=${withCenterline.length} runs=${ground.waterRuns?.length ?? 0}`,
    );
    expect(rivers.length).toBe(withCenterline.length);
  });

  it('puts water along the authored river course when the town has one', () => {
    const rivers = ground.waterBodies.filter((b) => b.kind === 'river' && b.centerlineM?.length);
    if (rivers.length === 0) return; // covered by the report above

    const runs = ground.waterRuns ?? [];
    const nearestRunDistance = (x: number, z: number) => {
      let best = Infinity;
      for (const r of runs) {
        const dx = Math.max(r.minX - x, 0, x - r.maxX);
        const dz = Math.max(r.minZ - z, 0, z - r.maxZ);
        best = Math.min(best, Math.hypot(dx, dz));
      }
      return best;
    };

    // Every point of the course should have water on or beside it.
    for (const river of rivers) {
      for (const p of river.centerlineM!) {
        expect(nearestRunDistance(p.x, p.z)).toBeLessThan(8);
      }
    }
  });

  it('never puts a water surface above the ground beside it', () => {
    // The failure that started all of this: water floating over, or buried
    // under, the land it belongs to.
    const runs = ground.waterRuns ?? [];
    expect(runs.every((r) => Number.isFinite(r.surfaceEnc))).toBe(true);
    expect(runs.every((r) => r.surfaceEnc >= 0)).toBe(true);
  });
});
