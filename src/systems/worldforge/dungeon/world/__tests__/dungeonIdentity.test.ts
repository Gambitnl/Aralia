/**
 * This file proves that a dungeon entrance's identity survives the full
 * world-to-generator handoff without changing its dungeon id or seed path.
 *
 * It uses a real enumerated world site and the existing ground-window bridge,
 * then simulates exit, JSON save/load, and revisit by resolving the serialized
 * receipt again. The test deliberately stops at identity and deterministic plan
 * recovery; playable entry, expedition state, and dungeon gameplay belong to
 * their dependent Plan Map tasks.
 */
import { describe, expect, it } from 'vitest';
import { getWorldforgeLocalForCell } from '../../../bridge/legacySubmapBridge';
import {
  dungeonEntrancesForWindow,
  dungeonNameForEntrance,
} from '../../../bridge/dungeonEntrances';
import { enumerateDungeonSites } from '../dungeonSites';
import {
  canonicalDungeonId,
  deriveDungeonIdentity,
  dungeonIdentityForSite,
  generateDungeonForIdentity,
  resolveDungeonIdentity,
  type DungeonIdentity,
} from '../deriveIdentity';
import { generateDungeon } from '../../generateDungeon';

const WORLD_SEED = 42;

// ============================================================================
// Real World Attachment Fixture
// ============================================================================
// The fixture starts from the authoritative site list, then asks the same bridge
// used by GroundWorld to surface its entrance. No synthetic parallel identity
// model is introduced in the test.
// ============================================================================

function firstWorldAttachment(): {
  site: ReturnType<typeof enumerateDungeonSites>[number];
  identity: DungeonIdentity;
} {
  const sites = enumerateDungeonSites(WORLD_SEED);
  const site = sites.find((candidate) => candidate.origin === 'marker') ?? sites[0];
  if (!site) throw new Error('Identity continuity test world has no dungeon sites.');

  const { local } = getWorldforgeLocalForCell(WORLD_SEED, site.cellId);
  const entrance = dungeonEntrancesForWindow(WORLD_SEED, local).find(
    (candidate) => candidate.sitePath === site.sitePath,
  );
  if (!entrance) throw new Error('Canonical dungeon site did not surface in its ground window.');

  // GroundDungeonEntrance already carries the required persistence receipt:
  // `id` is the canonical dungeon id and `sitePath` is its frozen seed path.
  return {
    site,
    identity: { dungeonId: entrance.id, seedPath: entrance.sitePath },
  };
}

// ============================================================================
// Identity Continuity
// ============================================================================
// These assertions cover the bounded lane: one attachment, one identity receipt,
// and one deterministic runtime plan before and after a plain-data round trip.
// ============================================================================

describe('world-to-interior dungeon identity continuity', () => {
  it('surfaces the canonical dungeon id and frozen seed path from the world attachment', () => {
    const { site, identity } = firstWorldAttachment();

    expect(identity).toEqual(dungeonIdentityForSite(site));
    expect(identity.dungeonId).toBe(canonicalDungeonId(identity.seedPath));
    expect(identity.seedPath).toBe(site.sitePath);
  });

  it('resolves the same plan after exit, JSON save/load, and revisit', () => {
    const { site, identity } = firstWorldAttachment();
    const enteredPlan = generateDungeonForIdentity(identity, WORLD_SEED);

    // The runtime helper must feed the site's exact frozen path into the existing
    // generator boundary. A direct call with that canonical path therefore
    // reproduces the same plan without an extra `/dungeon` segment.
    const { params, world } = deriveDungeonIdentity(WORLD_SEED, site);
    const directPlan = generateDungeon({
      seed: WORLD_SEED,
      seedPath: identity.seedPath,
      params,
      world,
    });
    expect(Array.from(directPlan.grid)).toEqual(Array.from(enteredPlan.grid));

    // Save state keys the receipt by its canonical dungeon id. Serializing and
    // restoring this small plain object models the boundary the later lifecycle
    // task will persist without implementing that task here.
    const savedByDungeonId = {
      [identity.dungeonId]: identity,
    };
    const loadedByDungeonId = JSON.parse(JSON.stringify(savedByDungeonId)) as Record<
      string,
      DungeonIdentity
    >;

    // Returning through the same world attachment supplies the same key, so the
    // restored receipt resolves the authoritative site before regeneration.
    const { local } = getWorldforgeLocalForCell(WORLD_SEED, site.cellId);
    const revisitedEntrance = dungeonEntrancesForWindow(WORLD_SEED, local).find(
      (candidate) => candidate.sitePath === site.sitePath,
    );
    expect(revisitedEntrance?.id).toBe(identity.dungeonId);
    expect(revisitedEntrance?.sitePath).toBe(identity.seedPath);

    const loadedIdentity = loadedByDungeonId[revisitedEntrance!.id];
    const revisitedPlan = generateDungeonForIdentity(loadedIdentity, WORLD_SEED);

    expect(revisitedPlan.name).toBe(enteredPlan.name);
    expect(revisitedPlan.builderName).toBe(enteredPlan.builderName);
    expect(Array.from(revisitedPlan.grid)).toEqual(Array.from(enteredPlan.grid));
    expect(revisitedPlan.rooms).toEqual(enteredPlan.rooms);
    expect(revisitedPlan.spawns).toEqual(enteredPlan.spawns);
    expect(dungeonNameForEntrance(WORLD_SEED, identity.seedPath)).toBe(enteredPlan.name);
  });

  it('fails visibly for missing, mismatched, cross-world, or unknown identity', () => {
    const { identity } = firstWorldAttachment();

    expect(() => resolveDungeonIdentity(undefined as unknown as DungeonIdentity)).toThrow(
      /identity is missing/i,
    );
    expect(() =>
      resolveDungeonIdentity({ ...identity, dungeonId: 'wf-dungeon-wrong' }),
    ).toThrow(/identity mismatch/i);
    expect(() => resolveDungeonIdentity(identity, WORLD_SEED + 1)).toThrow(
      /world mismatch/i,
    );

    // Supplying both addressing modes would make the generation stream
    // ambiguous, so the existing generator rejects it before doing any work.
    expect(() =>
      generateDungeon({
        seed: WORLD_SEED,
        seedPath: identity.seedPath,
        basePath: identity.seedPath,
      }),
    ).toThrow(/mutually exclusive/i);

    const unknownSeedPath = `wf:${WORLD_SEED}/cell:999999/dungeon:missing`;
    expect(() =>
      resolveDungeonIdentity({
        dungeonId: canonicalDungeonId(unknownSeedPath),
        seedPath: unknownSeedPath,
      }),
    ).toThrow(/does not resolve/i);
  });
});
