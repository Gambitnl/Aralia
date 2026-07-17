/**
 * These tests prove that a hostile opening can only use the WorldForge crop
 * matching its game-authored seed/cell receipt.
 *
 * They also pin deterministic source entity authoring, role topology, ecological
 * evidence, a persistent activity site, world-meter replay, and the remaining
 * omitted-history contract.
 */
import { describe, expect, it } from "vitest";
import type { OpeningBattlefieldSource } from "@/systems/gameEntry/types";
import type {
  BattleMapData,
  BattleMapTile,
  CombatEnemySnapshotEntry,
} from "@/types/combat";
import {
  projectOpeningThreatBattlefield,
  projectResolvedOpeningThreatReturnBattlefield,
} from "../openingThreatBattlefield";
import { resolveOpeningThreatSceneAfterCombat } from "../openingThreatOutcome";

// ============================================================================
// Source Fixtures
// ============================================================================

const SOURCE: OpeningBattlefieldSource = {
  kind: "worldforge-opening-location",
  receiptId: "opening:42:cell:476",
  worldSeed: 42,
  cellId: 476,
  centerPx: [120, 240],
  locationLabel: "Legium",
};
const ROSTER = [
  { name: "Goblin", quantity: 3, cr: "1/4" },
  { name: "Wolf", quantity: 1, cr: "1/4" },
];

function makeTile(x: number, y: number, blocked = false): BattleMapTile {
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: "floor",
    elevation: 0,
    movementCost: blocked ? Infinity : 1,
    blocksLoS: blocked,
    blocksMovement: blocked,
    decoration: null,
    effects: [],
  };
}

function makeMap(
  options: {
    worldSeed?: number;
    cellId?: number;
    allBlocked?: boolean;
  } = {},
): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 15; y += 1) {
    for (let x = 0; x < 15; x += 1) {
      // The exact center is intentionally blocked in the normal fixture. This
      // proves the adapter chooses the closest legal cell deterministically.
      const blocked = options.allBlocked || (x === 7 && y === 7);
      const tile = makeTile(x, y, blocked);
      if (x === 7 && y === 1) tile.decoration = "bush";
      tiles.set(`${x}-${y}`, tile);
    }
  }

  return {
    dimensions: { width: 15, height: 15 },
    tiles,
    theme: "forest",
    seed: 99,
    provenance: {
      kind: "worldforge",
      worldSeed: options.worldSeed ?? 42,
      anchorCellId: options.cellId ?? 476,
      anchorWorldMeters: { x: 300, z: 180 },
      generationPath: ["WorldForge", "GroundWorld", "Tactical crop"],
    },
  };
}

// ============================================================================
// Projection Contract
// ============================================================================

describe("opening threat battlefield projection", () => {
  it("authors deterministic source entities, roles, approach, and ecological evidence", () => {
    const mapData = makeMap();

    const first = projectOpeningThreatBattlefield(mapData, SOURCE, ROSTER);
    const second = projectOpeningThreatBattlefield(mapData, SOURCE, ROSTER);

    expect(first).toEqual(second);
    expect(first.status).toBe("ready");
    if (first.status !== "ready") return;

    const context = first.mapData.encounterContext;
    expect(context).toMatchObject({
      kind: "opening-standoff",
      source: "worldforge-opening",
      sourceReceiptId: SOURCE.receiptId,
      sourceWorldCellId: SOURCE.cellId,
      anchorTile: { x: 7, y: 6 },
      deployment: {
        player: "current-position",
        enemy: "source-world-entities",
      },
      omittedFacts: { preContactHistory: "not-authored" },
    });
    expect(context?.kind).toBe("opening-standoff");
    if (context?.kind !== "opening-standoff") return;
    expect(context.sourceEntities.map((entity) => entity.socialRole)).toEqual([
      "contact-lead",
      "screen-left",
      "screen-right",
      "scent-flanker",
    ]);
    expect(
      context.sourceEntities.map((entity) => entity.bodyState?.posture),
    ).toEqual(["upright", "crouched-left", "crouched-right", "scenting"]);
    expect(
      context.sourceEntities.map((entity) => entity.bodyState?.carriedProfile),
    ).toEqual(["salvage-pack", "long-tool", "buckler", "none"]);
    expect(
      context.sourceEntities.every(
        (entity) =>
          entity.bodyState &&
          Math.hypot(
            entity.bodyState.facingDirection.x,
            entity.bodyState.facingDirection.z,
          ) > 0.999,
      ),
    ).toBe(true);
    expect(context.sourceEntities.map((entity) => entity.monsterName)).toEqual([
      "Goblin",
      "Goblin",
      "Goblin",
      "Wolf",
    ]);
    expect(
      new Set(
        context.sourceEntities.map(
          (entity) => `${entity.position.x}-${entity.position.y}`,
        ),
      ).size,
    ).toBe(4);
    expect(
      context.sourceEntities.every(
        (entity) =>
          first.mapData.tiles.get(`${entity.position.x}-${entity.position.y}`)
            ?.blocksMovement === false,
      ),
    ).toBe(true);
    expect(context.ecologicalTraces.map((trace) => trace.kind)).toEqual(
      expect.arrayContaining([
        "tracks",
        "territorial-scrape",
        "disturbed-vegetation",
      ]),
    );
    expect(context.ecologicalTraces.map((trace) => trace.ageBand)).toEqual(
      expect.arrayContaining(["fresh", "recent", "weathered"]),
    );
    expect(context.activitySite).toMatchObject({
      kind: "claimed-cache",
      ageBand: "fresh",
      claimedByEntityIds: context.sourceEntities.map(
        (entity) => entity.entityId,
      ),
      contents: ["salvaged-container", "torn-bedding", "gnawed-remains"],
    });
    expect(context.terrainImprints?.map((imprint) => imprint.kind)).toEqual([
      "flattened-ground",
      "trampled-run",
      "drag-furrow",
      "refuse-scatter",
    ]);
    expect(
      context.terrainImprints?.every(
        (imprint) =>
          Math.hypot(imprint.direction.x, imprint.direction.y) > 0.999 &&
          imprint.activitySiteId === context.activitySite?.id &&
          imprint.sourceEntityIds.length === context.sourceEntities.length,
      ),
    ).toBe(true);
    expect(first.mapData.targetableObjects).toContainEqual(
      expect.objectContaining({
        id: context.activitySite?.id,
        name: "Claimed scavenger cache",
        source: expect.objectContaining({ kind: "worldforge-monster-site" }),
      }),
    );
    expect(
      Math.hypot(context.approachDirection.x, context.approachDirection.y),
    ).toBeCloseTo(1, 6);
    expect(first.receipt).toMatchObject({
      id: context.sourceSceneReceiptId,
      kind: "opening-threat-scene",
      policyVersion: "opening-threat-scene-v2",
      sourceOpeningReceiptId: SOURCE.receiptId,
      activitySite: context.activitySite,
      terrainImprints: context.terrainImprints,
      entities: context.sourceEntities.map((entity) =>
        expect.objectContaining({
          entityId: entity.entityId,
          worldGroundMeters: entity.worldGroundMeters,
          bodyState: entity.bodyState,
          sourcePatchTile: entity.position,
        }),
      ),
    });
    expect(first.mapData.provenance?.generationPath).toContain(
      `Opening threat ${SOURCE.receiptId}`,
    );
    expect(first.mapData.provenance?.generationPath).toContain(
      `Opening scene ${first.receipt.id}`,
    );
    expect(mapData.encounterContext).toBeUndefined();
  });

  it("replays the saved site and bodies exactly, and rejects roster drift", () => {
    const mapData = makeMap();
    const authored = projectOpeningThreatBattlefield(mapData, SOURCE, ROSTER);
    expect(authored.status).toBe("ready");
    if (authored.status !== "ready") return;

    const replayed = projectOpeningThreatBattlefield(
      mapData,
      SOURCE,
      ROSTER,
      authored.receipt,
    );
    expect(replayed.status).toBe("ready");
    if (replayed.status !== "ready") return;
    expect(replayed.detail).toContain("reused saved scene");
    expect(replayed.receipt).toBe(authored.receipt);
    // Replay changes only the continuity marker; every frozen physical fact
    // must remain byte-for-byte identical to the authored scene.
    expect(replayed.mapData.encounterContext).toEqual({
      ...authored.mapData.encounterContext,
      sceneContinuity: "saved-replay",
    });

    const rosterDrift = projectOpeningThreatBattlefield(
      mapData,
      SOURCE,
      [{ name: "Goblin", quantity: 2, cr: "1/4" }],
      authored.receipt,
    );
    expect(rosterDrift).toEqual({
      status: "source-gap",
      detail: `Saved opening scene ${authored.receipt.id} does not match the current threat roster.`,
    });
  });

  it("records exact mixed creature outcomes and projects only physical return-site bodies", () => {
    const mapData = makeMap();
    const authored = projectOpeningThreatBattlefield(mapData, SOURCE, ROSTER);
    expect(authored.status).toBe("ready");
    if (authored.status !== "ready") return;
    const context = authored.mapData.encounterContext;
    if (context?.kind !== "opening-standoff") {
      throw new Error("Expected an opening standoff context");
    }

    // Two creatures fall where WorldForge placed them; two survivors withdraw
    // from the scene. This is the same mixed outcome the deterministic visual
    // return recipe exercises.
    const finalEnemies: CombatEnemySnapshotEntry[] = context.sourceEntities.map(
      (entity, index) => {
        const { position, ...worldSource } = entity;
        return {
          id: `combatant:${entity.entityId}`,
          currentHP: index < 2 ? 0 : 3,
          position: { ...position },
          worldSource,
        };
      },
    );
    const resolved = resolveOpeningThreatSceneAfterCombat(
      authored.receipt,
      authored.mapData,
      finalEnemies,
      "victory",
      123_456,
    );
    expect(resolved.status).toBe("ready");
    if (resolved.status !== "ready") return;
    expect(
      resolved.receipt.resolution?.entityOutcomes.map(
        (outcome) => outcome.status,
      ),
    ).toEqual(["downed", "downed", "withdrew", "withdrew"]);
    expect(resolved.receipt.resolution).toMatchObject({
      outcome: "party-victory",
      activitySiteCondition: "abandoned-disturbed",
      combatDisturbance: {
        kind: "combat-churn",
        severity: "heavy",
        sourceEntityIds: context.sourceEntities.map(
          (entity) => entity.entityId,
        ),
      },
    });
    expect(
      Math.hypot(
        resolved.receipt.resolution!.combatDisturbance.direction.x,
        resolved.receipt.resolution!.combatDisturbance.direction.y,
      ),
    ).toBeCloseTo(1, 6);

    const returnSite = projectResolvedOpeningThreatReturnBattlefield(
      mapData,
      SOURCE,
      ROSTER,
      resolved.receipt,
    );
    expect(returnSite.status).toBe("ready");
    if (returnSite.status !== "ready") return;
    const returnContext = returnSite.mapData.encounterContext;
    expect(returnContext).toMatchObject({
      kind: "opening-standoff",
      sceneContinuity: "resolved-return",
      deployment: { enemy: "resolved-source-bodies" },
      activitySite: {
        label: "Abandoned claimed scavenger cache",
        claimedByEntityIds: [],
      },
      sceneResolution: {
        outcome: "party-victory",
        activitySiteCondition: "abandoned-disturbed",
      },
    });
    if (returnContext?.kind !== "opening-standoff") return;
    expect(returnContext.sourceEntities).toHaveLength(2);
    expect(
      returnContext.sourceEntities.map((entity) => entity.entityId),
    ).toEqual(
      context.sourceEntities.slice(0, 2).map((entity) => entity.entityId),
    );
    expect(returnSite.mapData.provenance?.generationPath).toContain(
      "Resolved return party-victory",
    );

    // The active encounter projector must reject the same resolved history.
    const relaunched = projectOpeningThreatBattlefield(
      mapData,
      SOURCE,
      ROSTER,
      resolved.receipt,
    );
    expect(relaunched).toEqual({
      status: "source-gap",
      detail: `Saved opening scene ${resolved.receipt.id} already resolved as party-victory and cannot start combat again.`,
    });
  });

  it("fails closed when final combat snapshots omit one saved source entity", () => {
    const authored = projectOpeningThreatBattlefield(makeMap(), SOURCE, ROSTER);
    expect(authored.status).toBe("ready");
    if (authored.status !== "ready") return;
    const context = authored.mapData.encounterContext;
    if (context?.kind !== "opening-standoff") return;
    const partial = context.sourceEntities.slice(0, 3).map((entity) => {
      const { position, ...worldSource } = entity;
      return {
        id: `combatant:${entity.entityId}`,
        currentHP: 0,
        position: { ...position },
        worldSource,
      };
    });

    const result = resolveOpeningThreatSceneAfterCombat(
      authored.receipt,
      authored.mapData,
      partial,
      "victory",
      123_456,
    );
    expect(result).toEqual({
      status: "source-gap",
      detail: `Opening scene ${authored.receipt.id} expected 4 final creature snapshots but received 3.`,
    });
  });

  it("upgrades an early v2 scene with terrain memory without moving its saved facts", () => {
    const mapData = makeMap();
    const authored = projectOpeningThreatBattlefield(mapData, SOURCE, ROSTER);
    expect(authored.status).toBe("ready");
    if (authored.status !== "ready") return;
    const { terrainImprints: _terrainImprints, ...earlyV2 } = authored.receipt;

    const upgraded = projectOpeningThreatBattlefield(
      mapData,
      SOURCE,
      ROSTER,
      earlyV2,
    );
    expect(upgraded.status).toBe("ready");
    if (upgraded.status !== "ready") return;
    expect(upgraded.detail).toContain("upgraded saved scene");
    expect(upgraded.receipt.terrainImprints).toHaveLength(4);
    expect(upgraded.receipt.entities).toEqual(earlyV2.entities);
    expect(upgraded.receipt.ecologicalTraces).toEqual(earlyV2.ecologicalTraces);
    expect(upgraded.receipt.activitySite).toEqual(earlyV2.activitySite);
  });

  it("fails closed instead of replaying partial terrain memory", () => {
    const mapData = makeMap();
    const authored = projectOpeningThreatBattlefield(mapData, SOURCE, ROSTER);
    expect(authored.status).toBe("ready");
    if (authored.status !== "ready") return;
    const malformed = {
      ...authored.receipt,
      terrainImprints: authored.receipt.terrainImprints?.slice(0, 1),
    };

    const replayed = projectOpeningThreatBattlefield(
      mapData,
      SOURCE,
      ROSTER,
      malformed,
    );

    expect(replayed).toEqual({
      status: "source-gap",
      detail: `Saved opening scene ${authored.receipt.id} has incomplete terrain memory and cannot be replayed authoritatively.`,
    });
  });

  it("upgrades a matching v1 scene to a v2 activity site without changing identity", () => {
    const mapData = makeMap();
    const authored = projectOpeningThreatBattlefield(mapData, SOURCE, ROSTER);
    expect(authored.status).toBe("ready");
    if (authored.status !== "ready") return;
    const {
      activitySite: _activitySite,
      terrainImprints: _terrainImprints,
      ...legacyFields
    } = authored.receipt;
    const legacyReceipt = {
      ...legacyFields,
      policyVersion: "opening-threat-scene-v1" as const,
    };

    const upgraded = projectOpeningThreatBattlefield(
      mapData,
      SOURCE,
      ROSTER,
      legacyReceipt,
    );
    expect(upgraded.status).toBe("ready");
    if (upgraded.status !== "ready") return;
    expect(upgraded.detail).toContain("upgraded saved scene");
    expect(upgraded.receipt).toMatchObject({
      id: legacyReceipt.id,
      policyVersion: "opening-threat-scene-v2",
      activitySite: expect.objectContaining({ kind: "claimed-cache" }),
      terrainImprints: expect.arrayContaining([
        expect.objectContaining({ kind: "flattened-ground" }),
        expect.objectContaining({ kind: "trampled-run" }),
      ]),
    });
  });

  it("fails closed when the live crop belongs to another world or atlas cell", () => {
    const wrongSeed = projectOpeningThreatBattlefield(
      makeMap({ worldSeed: 43 }),
      SOURCE,
      ROSTER,
    );
    const wrongCell = projectOpeningThreatBattlefield(
      makeMap({ cellId: 477 }),
      SOURCE,
      ROSTER,
    );

    expect(wrongSeed.status).toBe("source-gap");
    expect(wrongCell.status).toBe("source-gap");
    expect(wrongSeed.detail).toContain("expected world 42, cell 476");
    expect(wrongCell.detail).toContain("world 42, cell 477");
  });

  it("fails closed when the source crop offers no legal player anchor", () => {
    const result = projectOpeningThreatBattlefield(
      makeMap({ allBlocked: true }),
      SOURCE,
      ROSTER,
    );

    expect(result).toEqual({
      status: "source-gap",
      detail: `Opening receipt ${SOURCE.receiptId} has no legal player anchor in its WorldForge crop.`,
    });
  });

  it("fails closed when no validated threat roster can be placed", () => {
    const result = projectOpeningThreatBattlefield(makeMap(), SOURCE, []);

    expect(result).toEqual({
      status: "source-gap",
      detail: `Opening receipt ${SOURCE.receiptId} could not author every threat entity on legal WorldForge cells.`,
    });
  });
});
