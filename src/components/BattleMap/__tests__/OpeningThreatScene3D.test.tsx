/**
 * Pure contract tests for the 3D opening-scene selector.
 *
 * Rendering pixels is owned by the permanent Vistest scenario. These tests
 * protect the semantic boundary: active combatants never become duplicate
 * static bodies, withdrawals disappear, and only physical outcomes survive.
 */
import { describe, expect, it } from "vitest";
import type {
  BattleMapData,
  BattleMapEncounterContext,
} from "../../../types/combat";
import { selectOpeningThreatScene3DFacts } from "../OpeningThreatScene3D";

type OpeningContext = Extract<
  BattleMapEncounterContext,
  { kind: "opening-standoff" }
>;

function makeContext(resolved: boolean): OpeningContext {
  const sourceEntities: OpeningContext["sourceEntities"] = [
    {
      kind: "worldforge-opening-threat",
      sceneReceiptId: "scene:test",
      sourceOpeningReceiptId: "opening:test",
      entityId: "goblin:1",
      monsterName: "Goblin",
      monsterOrdinal: 1,
      socialRole: "contact-lead",
      worldGroundMeters: { x: 10, z: 12 },
      position: { x: 4, y: 5 },
      bodyState: {
        posture: "upright",
        carriedProfile: "salvage-pack",
        facingDirection: { x: 1, z: 0 },
      },
    },
    {
      kind: "worldforge-opening-threat",
      sceneReceiptId: "scene:test",
      sourceOpeningReceiptId: "opening:test",
      entityId: "wolf:1",
      monsterName: "Wolf",
      monsterOrdinal: 1,
      socialRole: "scent-flanker",
      worldGroundMeters: { x: 14, z: 12 },
      position: { x: 8, y: 5 },
      bodyState: {
        posture: "scenting",
        carriedProfile: "none",
        facingDirection: { x: -1, z: 0 },
      },
    },
  ];

  return {
    kind: "opening-standoff",
    source: "worldforge-opening",
    sourceReceiptId: "opening:test",
    sourceSceneReceiptId: "scene:test",
    sceneContinuity: resolved ? "resolved-return" : "saved-replay",
    sourceWorldCellId: 42,
    anchorTile: { x: 2, y: 3 },
    approachDirection: { x: 1, y: 0 },
    sourceEntities,
    ecologicalTraces: [],
    terrainImprints: [],
    activitySite: {
      id: "site:test",
      kind: "claimed-cache",
      label: "Claimed cache",
      position: { x: 6, y: 7 },
      worldGroundMeters: { x: 12, z: 14 },
      ageBand: "fresh",
      claimedByEntityIds: sourceEntities.map((entity) => entity.entityId),
      contents: ["salvaged-container", "flattened-ground"],
    },
    sceneResolution: resolved
      ? {
          outcome: "party-victory",
          resolvedAtGameTimeMs: 1000,
          entityOutcomes: [
            {
              sourceEntityId: "goblin:1",
              combatantId: "combat:goblin:1",
              status: "downed",
              finalHitPoints: 0,
              finalTacticalPosition: { x: 4, y: 5 },
              lastSeenWorldGroundMeters: { x: 10, z: 12 },
            },
            {
              sourceEntityId: "wolf:1",
              combatantId: "combat:wolf:1",
              status: "withdrew",
              finalHitPoints: 1,
              finalTacticalPosition: { x: 8, y: 5 },
              lastSeenWorldGroundMeters: { x: 14, z: 12 },
            },
          ],
          activitySiteCondition: "abandoned-disturbed",
          combatDisturbance: {
            kind: "combat-churn",
            position: { x: 5, y: 6 },
            worldGroundMeters: { x: 11, z: 13 },
            direction: { x: 1, y: 0 },
            extentCells: { length: 3, width: 2 },
            severity: "heavy",
            sourceEntityIds: sourceEntities.map((entity) => entity.entityId),
          },
        }
      : undefined,
    deployment: {
      player: "current-position",
      enemy: resolved ? "resolved-source-bodies" : "source-world-entities",
    },
    omittedFacts: { preContactHistory: "not-authored" },
  };
}

function makeMap(context?: BattleMapEncounterContext): BattleMapData {
  return {
    dimensions: { width: 12, height: 10 },
    tiles: new Map(),
    theme: "forest",
    seed: 42,
    encounterContext: context,
  } as BattleMapData;
}

describe("selectOpeningThreatScene3DFacts", () => {
  it("does not duplicate active opening combatants as static scene bodies", () => {
    const facts = selectOpeningThreatScene3DFacts(makeMap(makeContext(false)));

    expect(facts?.resolvedBodies).toEqual([]);
    expect(facts?.siteCondition).toBe("occupied");
  });

  it("keeps only outcomes that leave a physical creature at the resolved site", () => {
    const facts = selectOpeningThreatScene3DFacts(makeMap(makeContext(true)));

    expect(facts?.resolvedBodies.map((entity) => entity.entityId)).toEqual([
      "goblin:1",
    ]);
    expect(facts?.siteCondition).toBe("abandoned-disturbed");
    expect(facts?.focus).toEqual({ x: 5, y: 6 });
  });

  it("stays absent for non-opening battlefields", () => {
    expect(selectOpeningThreatScene3DFacts(makeMap())).toBeNull();
  });
});
