// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 08:57:09
 * Dependents: components/World3D/World3DWrapper.tsx, systems/combat/fightInPlace/activeGroundCombatSession.ts, systems/combat/worldScenario/worldBattleScenario.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file turns a hostile opening's real mounted WorldForge crop into a
 * source-framed tactical standoff.
 *
 * The opening model supplies dialogue and a bestiary roster, but it does not
 * choose geometry. This adapter validates the game-authored seed/cell receipt,
 * asks the Ground-derived referee grid to author one deterministic entity scene,
 * and freezes exact world-meter positions plus ecological evidence in a receipt.
 *
 * Called by: World3DWrapper's mounted opening-combat provider
 * Depends on: the opening receipt and an already extracted WorldForge battle map
 */
import type { OpeningBattlefieldSource } from "@/systems/gameEntry/types";
import {
  patchTileToWorldMeters,
  worldMetersToPatchTile,
} from "@/systems/combat/fightInPlace/inSceneMovement";
import type {
  BattleMapData,
  BattleMapOpeningActivitySite,
  BattleMapOpeningEcologicalTrace,
  BattleMapOpeningTerrainImprint,
  BattleMapOpeningThreatEntity,
  BattleMapTile,
  OpeningThreatBodyState,
  OpeningThreatSocialRole,
  TargetableMapObject,
} from "@/types/combat";
import { simpleHash } from "@/utils/core/hashUtils";
import type {
  OpeningThreatSceneReceipt,
  OpeningThreatSceneReceiptV2,
} from "./worldforgeEncounterReceipt";

// ============================================================================
// Projection Result
// ============================================================================
// A rejected receipt is an actionable source gap. Callers carry that refusal to
// CombatView instead of swapping in the legacy procedural arena.
// ============================================================================

export type OpeningThreatBattlefieldResult =
  | {
      status: "ready";
      detail: string;
      mapData: BattleMapData;
      receipt: OpeningThreatSceneReceiptV2;
    }
  | {
      status: "source-gap";
      detail: string;
    };

/** Minimal roster facts needed to author source entities without combat rules. */
export interface OpeningThreatRosterEntry {
  name: string;
  quantity: number;
  cr?: string;
}

// ============================================================================
// Anchor Selection
// ============================================================================
// The Ground -> Tactical extractor centers the live player meters in the crop.
// Terrain can make that exact cell unusable, so choose the closest legal cell
// deterministically and avoid placing the party on an ambient resident.
// ============================================================================

function nearestWalkableAnchor(mapData: BattleMapData): BattleMapTile | null {
  const center = {
    x: Math.floor(mapData.dimensions.width / 2),
    y: Math.floor(mapData.dimensions.height / 2),
  };
  const occupied = new Set(
    (mapData.worldOccupants ?? []).map(
      (occupant) => `${occupant.position.x}-${occupant.position.y}`,
    ),
  );

  const candidates = [...mapData.tiles.values()]
    .filter(
      (tile) =>
        !tile.blocksMovement &&
        !occupied.has(`${tile.coordinates.x}-${tile.coordinates.y}`),
    )
    .sort((a, b) => {
      const aDistance =
        (a.coordinates.x - center.x) ** 2 + (a.coordinates.y - center.y) ** 2;
      const bDistance =
        (b.coordinates.x - center.x) ** 2 + (b.coordinates.y - center.y) ** 2;
      return (
        aDistance - bDistance ||
        a.coordinates.y - b.coordinates.y ||
        a.coordinates.x - b.coordinates.x
      );
    });

  return candidates[0] ?? null;
}

const tileKey = (tile: Pick<BattleMapTile, "coordinates">): string =>
  `${tile.coordinates.x}-${tile.coordinates.y}`;

const pointDistance = (
  left: { x: number; y: number },
  right: { x: number; y: number },
): number => Math.hypot(left.x - right.x, left.y - right.y);

/** Nearby hard edges and cover make a more credible contact position. */
function shelterScore(mapData: BattleMapData, tile: BattleMapTile): number {
  let score = tile.providesCover ? 2 : 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const neighbor = mapData.tiles.get(
        `${tile.coordinates.x + dx}-${tile.coordinates.y + dy}`,
      );
      if (!neighbor) continue;
      if (neighbor.blocksMovement || neighbor.blocksLoS) score += 0.5;
      if (neighbor.providesCover) score += 0.35;
    }
  }
  return score;
}

function isBeastLike(name: string): boolean {
  return /(wolf|hound|dog|boar|bear|lion|tiger|panther|hyena|worg)/i.test(name);
}

interface ThreatActorDraft {
  monsterName: string;
  monsterOrdinal: number;
  socialRole: OpeningThreatSocialRole;
}

/**
 * Turn social function into a physical body fact before the renderer sees it.
 * These profiles are intentionally small and composable: posture and carried
 * load change occupied shape while facing remains grounded in scene geometry.
 */
function bodyStateForDraft(
  draft: ThreatActorDraft,
  facingDirection: { x: number; y: number },
): OpeningThreatBodyState {
  const facing = { x: facingDirection.x, z: facingDirection.y };
  if (draft.socialRole === "contact-lead") {
    return {
      posture: "upright",
      carriedProfile: "salvage-pack",
      facingDirection: facing,
    };
  }
  if (draft.socialRole === "screen-left") {
    return {
      posture: "crouched-left",
      carriedProfile: "long-tool",
      facingDirection: facing,
    };
  }
  if (draft.socialRole === "screen-right") {
    return {
      posture: "crouched-right",
      carriedProfile: "buckler",
      facingDirection: facing,
    };
  }
  if (draft.socialRole === "escape-guard") {
    return {
      posture: "rear-lean",
      carriedProfile: "rolled-bedding",
      facingDirection: facing,
    };
  }
  if (draft.socialRole === "scent-flanker") {
    return {
      posture: "scenting",
      carriedProfile: "none",
      facingDirection: facing,
    };
  }
  return {
    posture: "low-scout",
    carriedProfile: "none",
    facingDirection: facing,
  };
}

/** Flatten model roster counts and author a readable social function per body. */
function createActorDrafts(
  roster: readonly OpeningThreatRosterEntry[],
): ThreatActorDraft[] {
  const flattened = roster
    .flatMap((entry) =>
      Array.from(
        { length: Math.max(0, Math.floor(entry.quantity)) },
        (_, index) => ({
          monsterName: entry.name.trim(),
          monsterOrdinal: index + 1,
        }),
      ),
    )
    .filter((entry) => entry.monsterName.length > 0);
  const firstNonBeast = flattened.findIndex(
    (entry) => !isBeastLike(entry.monsterName),
  );
  const leadIndex = firstNonBeast >= 0 ? firstNonBeast : 0;
  const humanoidRoles: OpeningThreatSocialRole[] = [
    "screen-left",
    "screen-right",
    "escape-guard",
  ];
  let humanoidRoleIndex = 0;
  let beastRoleIndex = 0;

  return flattened.map((entry, index) => {
    if (index === leadIndex) return { ...entry, socialRole: "contact-lead" };
    if (isBeastLike(entry.monsterName)) {
      const socialRole: OpeningThreatSocialRole =
        beastRoleIndex++ % 2 === 0 ? "scent-flanker" : "pack-scout";
      return { ...entry, socialRole };
    }
    const socialRole =
      humanoidRoles[humanoidRoleIndex++ % humanoidRoles.length]!;
    return { ...entry, socialRole };
  });
}

function normalized(vector: { x: number; y: number }): {
  x: number;
  y: number;
} {
  const length = Math.hypot(vector.x, vector.y);
  return length > 1e-9
    ? { x: vector.x / length, y: vector.y / length }
    : { x: 1, y: 0 };
}

/** Role topology turns a repeated ring into one legible contact group. */
function roleTarget(
  role: OpeningThreatSocialRole,
  contact: { x: number; y: number },
  towardParty: { x: number; y: number },
  ordinal: number,
): { x: number; y: number } {
  const tangent = { x: -towardParty.y, y: towardParty.x };
  const side = ordinal % 2 === 0 ? -1 : 1;
  if (role === "contact-lead") return contact;
  if (role === "screen-left") {
    return {
      x: contact.x + tangent.x * 2 - towardParty.x * 0.5,
      y: contact.y + tangent.y * 2 - towardParty.y * 0.5,
    };
  }
  if (role === "screen-right") {
    return {
      x: contact.x - tangent.x * 2 - towardParty.x * 0.5,
      y: contact.y - tangent.y * 2 - towardParty.y * 0.5,
    };
  }
  if (role === "escape-guard") {
    return {
      x: contact.x - towardParty.x * 2.5 + tangent.x * side,
      y: contact.y - towardParty.y * 2.5 + tangent.y * side,
    };
  }
  if (role === "scent-flanker") {
    return {
      x: contact.x + towardParty.x * 0.75 + tangent.x * side * 3,
      y: contact.y + towardParty.y * 0.75 + tangent.y * side * 3,
    };
  }
  return {
    x: contact.x + towardParty.x * 1.25 + tangent.x * side * 2.25,
    y: contact.y + towardParty.y * 1.25 + tangent.y * side * 2.25,
  };
}

interface AuthoredOpeningScene {
  playerAnchor: BattleMapTile;
  approachDirection: { x: number; y: number };
  entities: BattleMapOpeningThreatEntity[];
  ecologicalTraces: BattleMapOpeningEcologicalTrace[];
  activitySite: BattleMapOpeningActivitySite;
  terrainImprints: BattleMapOpeningTerrainImprint[];
  receipt: OpeningThreatSceneReceiptV2;
  reusedSavedScene: boolean;
}

// ============================================================================
// Persistent Terrain Memory
// ============================================================================
// A cache by itself looks like a prop dropped onto a neutral arena. These facts
// connect it to how the group used the ground: where bodies rested, which lane
// they repeatedly walked, where a load dragged, and where refuse accumulated.
// The renderer only depicts these saved anchors; it does not choose ecology.
// ============================================================================

/** Author one deterministic occupation footprint around an already frozen scene. */
function authorTerrainImprints(
  mapData: BattleMapData,
  patchAnchor: { playerXM: number; playerZM: number },
  sceneReceiptId: string,
  entities: readonly BattleMapOpeningThreatEntity[],
  ecologicalTraces: readonly BattleMapOpeningEcologicalTrace[],
  activitySite: BattleMapOpeningActivitySite,
  approachDirection: { x: number; y: number },
): BattleMapOpeningTerrainImprint[] {
  const allEntityIds = entities.map((entity) => entity.entityId);
  const contactAnchor =
    entities.find((entity) => entity.socialRole === "contact-lead")?.position ??
    entities[0]?.position;
  if (!contactAnchor) return [];
  const awayFromParty = { x: -approachDirection.x, y: -approachDirection.y };
  const tangent = { x: -approachDirection.y, y: approachDirection.x };
  const side = simpleHash(`${sceneReceiptId}:refuse-side`) % 2 === 0 ? -1 : 1;
  const unavailable = new Set([
    ...entities.map((entity) => `${entity.position.x}-${entity.position.y}`),
    ...ecologicalTraces.map(
      (trace) => `${trace.position.x}-${trace.position.y}`,
    ),
    `${activitySite.position.x}-${activitySite.position.y}`,
  ]);

  // Refuse is the only imprint that needs its own clear anchor. The other
  // imprints describe the ground beneath the site or along an occupied route.
  const refuseTarget = {
    x: activitySite.position.x + tangent.x * side * 1.7 + awayFromParty.x * 0.6,
    y: activitySite.position.y + tangent.y * side * 1.7 + awayFromParty.y * 0.6,
  };
  const refuseTile = [...mapData.tiles.values()]
    .filter((tile) => !tile.blocksMovement && !unavailable.has(tileKey(tile)))
    .sort(
      (left, right) =>
        pointDistance(left.coordinates, refuseTarget) -
          pointDistance(right.coordinates, refuseTarget) ||
        left.coordinates.y - right.coordinates.y ||
        left.coordinates.x - right.coordinates.x,
    )[0];
  if (!refuseTile) return [];

  const weatheredTrack =
    ecologicalTraces.find(
      (trace) => trace.kind === "tracks" && trace.ageBand === "weathered",
    ) ?? ecologicalTraces.find((trace) => trace.kind === "tracks");
  if (!weatheredTrack) return [];

  const worldFor = (point: { x: number; y: number }) => {
    const world = patchTileToWorldMeters(
      mapData,
      patchAnchor,
      point.x,
      point.y,
    );
    return { x: world.xM, z: world.zM };
  };
  const makeImprint = (
    kind: BattleMapOpeningTerrainImprint["kind"],
    label: string,
    start: { x: number; y: number },
    end: { x: number; y: number },
    extentCells: { length: number; width: number },
    ageBand: BattleMapOpeningTerrainImprint["ageBand"],
  ): BattleMapOpeningTerrainImprint => {
    const direction = normalized({ x: end.x - start.x, y: end.y - start.y });
    return {
      id: `${sceneReceiptId}:terrain-imprint:${kind}`,
      kind,
      label,
      position: { ...start },
      endPosition: { ...end },
      worldGroundMeters: worldFor(start),
      endWorldGroundMeters: worldFor(end),
      direction:
        start.x === end.x && start.y === end.y
          ? { ...awayFromParty }
          : direction,
      extentCells,
      ageBand,
      sourceEntityIds: [...allEntityIds],
      activitySiteId: activitySite.id,
    };
  };

  return [
    makeImprint(
      "flattened-ground",
      "Flattened sleeping and sorting hollow beneath the cache",
      activitySite.position,
      activitySite.position,
      { length: 3.6, width: 2.6 },
      "recent",
    ),
    makeImprint(
      "trampled-run",
      "Repeated traffic between the cache and contact line",
      activitySite.position,
      contactAnchor,
      {
        length: Math.max(
          2,
          pointDistance(activitySite.position, contactAnchor),
        ),
        width: 1.15,
      },
      "fresh",
    ),
    makeImprint(
      "drag-furrow",
      "A scavenged load was dragged from the older trail into the cache",
      weatheredTrack.position,
      activitySite.position,
      {
        length: Math.max(
          2,
          pointDistance(weatheredTrack.position, activitySite.position),
        ),
        width: 0.55,
      },
      "recent",
    ),
    makeImprint(
      "refuse-scatter",
      "Sorted bone, cord, bark, and broken salvage beside the cache",
      refuseTile.coordinates,
      refuseTile.coordinates,
      { length: 1.8, width: 1.35 },
      "fresh",
    ),
  ];
}

/**
 * Author the current contact scene from source terrain and roster facts. The
 * result is deterministic and stores world meters so it can survive combat.
 */
function authorOpeningScene(
  mapData: BattleMapData,
  source: OpeningBattlefieldSource,
  playerAnchor: BattleMapTile,
  roster: readonly OpeningThreatRosterEntry[],
): AuthoredOpeningScene | null {
  const provenance = mapData.provenance;
  if (!provenance) return null;
  const drafts = createActorDrafts(roster);
  if (drafts.length === 0) return null;

  const occupied = new Set(
    (mapData.worldOccupants ?? []).map(
      (occupant) => `${occupant.position.x}-${occupant.position.y}`,
    ),
  );
  occupied.add(tileKey(playerAnchor));
  const standoffCandidates = [...mapData.tiles.values()].filter((tile) => {
    const distance = pointDistance(tile.coordinates, playerAnchor.coordinates);
    return (
      !tile.blocksMovement &&
      !occupied.has(tileKey(tile)) &&
      distance >= 4.5 &&
      distance <= 9
    );
  });
  if (standoffCandidates.length < drafts.length) return null;

  const contactAnchor = [...standoffCandidates].sort((left, right) => {
    const leftDistance = pointDistance(
      left.coordinates,
      playerAnchor.coordinates,
    );
    const rightDistance = pointDistance(
      right.coordinates,
      playerAnchor.coordinates,
    );
    const leftScore =
      Math.abs(leftDistance - 6) * 0.45 -
      shelterScore(mapData, left) * 1.35 +
      (left.surface ? 0.75 : 0);
    const rightScore =
      Math.abs(rightDistance - 6) * 0.45 -
      shelterScore(mapData, right) * 1.35 +
      (right.surface ? 0.75 : 0);
    return (
      leftScore - rightScore ||
      left.coordinates.y - right.coordinates.y ||
      left.coordinates.x - right.coordinates.x
    );
  })[0];
  if (!contactAnchor) return null;

  const towardParty = normalized({
    x: playerAnchor.coordinates.x - contactAnchor.coordinates.x,
    y: playerAnchor.coordinates.y - contactAnchor.coordinates.y,
  });
  const selectedTiles: BattleMapTile[] = [];
  for (let index = 0; index < drafts.length; index++) {
    const draft = drafts[index]!;
    const target = roleTarget(
      draft.socialRole,
      contactAnchor.coordinates,
      towardParty,
      draft.monsterOrdinal,
    );
    const selected = [...standoffCandidates]
      .filter(
        (tile) =>
          !occupied.has(tileKey(tile)) &&
          selectedTiles.every(
            (chosen) =>
              pointDistance(tile.coordinates, chosen.coordinates) >= 1.5,
          ),
      )
      .sort((left, right) => {
        const leftScore =
          pointDistance(left.coordinates, target) * 1.1 -
          shelterScore(mapData, left) +
          (left.surface ? 0.6 : 0);
        const rightScore =
          pointDistance(right.coordinates, target) * 1.1 -
          shelterScore(mapData, right) +
          (right.surface ? 0.6 : 0);
        return (
          leftScore - rightScore ||
          left.coordinates.y - right.coordinates.y ||
          left.coordinates.x - right.coordinates.x
        );
      })[0];
    if (!selected) return null;
    selectedTiles.push(selected);
    occupied.add(tileKey(selected));
  }

  const rosterKey = drafts
    .map(
      (draft) =>
        `${draft.monsterName}:${draft.monsterOrdinal}:${draft.socialRole}`,
    )
    .join("|");
  const sceneReceiptId = `worldforge-opening-scene:${simpleHash(
    `${source.receiptId}|${rosterKey}|${contactAnchor.id}`,
  )}`;
  const patchAnchor = {
    playerXM: provenance.anchorWorldMeters.x,
    playerZM: provenance.anchorWorldMeters.z,
  };
  const entities = drafts.map((draft, index): BattleMapOpeningThreatEntity => {
    const tile = selectedTiles[index]!;
    const facingDirection = normalized({
      x: playerAnchor.coordinates.x - tile.coordinates.x,
      y: playerAnchor.coordinates.y - tile.coordinates.y,
    });
    const world = patchTileToWorldMeters(
      mapData,
      patchAnchor,
      tile.coordinates.x,
      tile.coordinates.y,
    );
    return {
      kind: "worldforge-opening-threat",
      sceneReceiptId,
      sourceOpeningReceiptId: source.receiptId,
      entityId: `${sceneReceiptId}:entity:${index + 1}`,
      monsterName: draft.monsterName,
      monsterOrdinal: draft.monsterOrdinal,
      socialRole: draft.socialRole,
      worldGroundMeters: { x: world.xM, z: world.zM },
      bodyState: bodyStateForDraft(draft, facingDirection),
      position: { ...tile.coordinates },
    };
  });

  const centroid = entities.reduce(
    (sum, entity) => ({
      x: sum.x + entity.position.x / entities.length,
      y: sum.y + entity.position.y / entities.length,
    }),
    { x: 0, y: 0 },
  );
  const approachDirection = normalized({
    x: playerAnchor.coordinates.x - centroid.x,
    y: playerAnchor.coordinates.y - centroid.y,
  });
  const awayFromParty = { x: -approachDirection.x, y: -approachDirection.y };
  const tangent = { x: -approachDirection.y, y: approachDirection.x };
  const allEntityIds = entities.map((entity) => entity.entityId);

  // Give the group one occupied place rather than scattering more clue icons.
  // The site sits behind the contact line, where a cautious group would keep
  // bedding, food remains, or scavenged goods while screens face the party.
  const siteSide =
    simpleHash(`${sceneReceiptId}:activity-site`) % 2 === 0 ? -1 : 1;
  const siteTarget = {
    x: centroid.x + awayFromParty.x * 2.25 + tangent.x * siteSide * 1.5,
    y: centroid.y + awayFromParty.y * 2.25 + tangent.y * siteSide * 1.5,
  };
  const siteTile = [...mapData.tiles.values()]
    .filter((tile) => !tile.blocksMovement && !occupied.has(tileKey(tile)))
    .sort((left, right) => {
      const leftScore =
        pointDistance(left.coordinates, siteTarget) * 1.1 -
        shelterScore(mapData, left) * 0.45;
      const rightScore =
        pointDistance(right.coordinates, siteTarget) * 1.1 -
        shelterScore(mapData, right) * 0.45;
      return (
        leftScore - rightScore ||
        left.coordinates.y - right.coordinates.y ||
        left.coordinates.x - right.coordinates.x
      );
    })[0];
  if (!siteTile) return null;
  occupied.add(tileKey(siteTile));

  // Site kind comes from the roster's physical makeup, then freezes in the
  // receipt. It is not recalculated by the renderer or inferred from a badge.
  const hasBeast = entities.some((entity) => isBeastLike(entity.monsterName));
  const hasNonBeast = entities.some(
    (entity) => !isBeastLike(entity.monsterName),
  );
  const activitySiteKind: BattleMapOpeningActivitySite["kind"] = hasNonBeast
    ? "claimed-cache"
    : hasBeast
      ? "feeding-site"
      : "resting-hollow";
  const siteContents: BattleMapOpeningActivitySite["contents"] =
    activitySiteKind === "claimed-cache"
      ? [
          "salvaged-container",
          "torn-bedding",
          ...(hasBeast ? ["gnawed-remains" as const] : []),
        ]
      : activitySiteKind === "feeding-site"
        ? ["gnawed-remains", "flattened-ground"]
        : ["torn-bedding", "flattened-ground"];
  const siteWorld = patchTileToWorldMeters(
    mapData,
    patchAnchor,
    siteTile.coordinates.x,
    siteTile.coordinates.y,
  );
  const activitySite: BattleMapOpeningActivitySite = {
    id: `${sceneReceiptId}:activity-site:1`,
    kind: activitySiteKind,
    label:
      activitySiteKind === "claimed-cache"
        ? "Claimed scavenger cache"
        : activitySiteKind === "feeding-site"
          ? "Fresh feeding site"
          : "Occupied resting hollow",
    position: { ...siteTile.coordinates },
    worldGroundMeters: { x: siteWorld.xM, z: siteWorld.zM },
    ageBand: "fresh",
    claimedByEntityIds: allEntityIds,
    contents: siteContents,
  };

  const traceTiles = new Set<string>();
  const ecologicalTraces: BattleMapOpeningEcologicalTrace[] = [];
  const addTrace = (
    kind: BattleMapOpeningEcologicalTrace["kind"],
    ageBand: NonNullable<BattleMapOpeningEcologicalTrace["ageBand"]>,
    label: string,
    tile: BattleMapTile | undefined,
    sourceEntityIds: string[],
  ) => {
    // Evidence is a physical world fact, so it cannot share a cell with an
    // actor, the player anchor, or the activity site. Enforcing this while the
    // scene is authored keeps the saved receipt valid under strict replay.
    if (
      !tile ||
      tile.blocksMovement ||
      occupied.has(tileKey(tile)) ||
      traceTiles.has(tileKey(tile))
    )
      return;
    traceTiles.add(tileKey(tile));
    const world = patchTileToWorldMeters(
      mapData,
      patchAnchor,
      tile.coordinates.x,
      tile.coordinates.y,
    );
    ecologicalTraces.push({
      id: `${sceneReceiptId}:trace:${ecologicalTraces.length + 1}`,
      kind,
      ageBand,
      label,
      position: { ...tile.coordinates },
      worldGroundMeters: { x: world.xM, z: world.zM },
      sourceEntityIds,
    });
  };
  // Each trace needs its own readable cell. Skip both occupied combat cells and
  // evidence already placed by an earlier trace instead of silently dropping a
  // later clue when two ideal points round onto the same referee tile.
  const nearestWalkableTrace = (target: {
    x: number;
    y: number;
  }): BattleMapTile | undefined =>
    [...mapData.tiles.values()]
      .filter(
        (tile) =>
          !tile.blocksMovement &&
          !occupied.has(tileKey(tile)) &&
          !traceTiles.has(tileKey(tile)),
      )
      .sort(
        (left, right) =>
          pointDistance(left.coordinates, target) -
            pointDistance(right.coordinates, target) ||
          left.coordinates.y - right.coordinates.y ||
          left.coordinates.x - right.coordinates.x,
      )[0];
  for (const distance of [2.5, 4.5]) {
    addTrace(
      "tracks",
      distance < 3 ? "fresh" : "weathered",
      distance < 3
        ? "Fresh tracks converge on the contact group"
        : "Older tracks continue beyond the visible threat",
      nearestWalkableTrace({
        x: centroid.x + awayFromParty.x * distance,
        y: centroid.y + awayFromParty.y * distance,
      }),
      allEntityIds,
    );
  }
  const beast = entities.find((entity) => isBeastLike(entity.monsterName));
  if (beast) {
    addTrace(
      "territorial-scrape",
      "fresh",
      `${beast.monsterName} scratched and scent-rubbed the approach`,
      nearestWalkableTrace({
        x: beast.position.x + approachDirection.x * 1.75,
        y: beast.position.y + approachDirection.y * 1.75,
      }),
      [beast.entityId],
    );
  }
  const vegetation = [...mapData.tiles.values()]
    .filter(
      (tile) =>
        tile.decoration === "tree" ||
        tile.decoration === "bush" ||
        tile.decoration === "mangrove" ||
        tile.decoration === "fallen_log",
    )
    .map((tile) => ({
      tile,
      distance: Math.min(
        ...entities.map((entity) =>
          pointDistance(tile.coordinates, entity.position),
        ),
      ),
    }))
    .filter((entry) => entry.distance <= 4)
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        left.tile.coordinates.y - right.tile.coordinates.y ||
        left.tile.coordinates.x - right.tile.coordinates.x,
    )[0]?.tile;
  addTrace(
    "disturbed-vegetation",
    "recent",
    "Branches and ground cover were disturbed by the threat group",
    // The vegetation asset itself can be blocking. Record the disturbance on
    // adjacent traversable ground so it remains a usable, replayable clue.
    vegetation ? nearestWalkableTrace(vegetation.coordinates) : undefined,
    allEntityIds,
  );

  const terrainImprints = authorTerrainImprints(
    mapData,
    patchAnchor,
    sceneReceiptId,
    entities,
    ecologicalTraces,
    activitySite,
    approachDirection,
  );
  if (terrainImprints.length !== 4) return null;

  const playerWorld = patchTileToWorldMeters(
    mapData,
    patchAnchor,
    playerAnchor.coordinates.x,
    playerAnchor.coordinates.y,
  );
  const receipt: OpeningThreatSceneReceiptV2 = {
    id: sceneReceiptId,
    kind: "opening-threat-scene",
    policyVersion: "opening-threat-scene-v2",
    sourceOpeningReceiptId: source.receiptId,
    worldSeed: source.worldSeed,
    sourceCellId: source.cellId,
    playerGroundMeters: { x: playerWorld.xM, z: playerWorld.zM },
    approachDirection: { x: approachDirection.x, z: approachDirection.y },
    entities: entities.map((entity) => ({
      kind: entity.kind,
      sceneReceiptId: entity.sceneReceiptId,
      sourceOpeningReceiptId: entity.sourceOpeningReceiptId,
      entityId: entity.entityId,
      monsterName: entity.monsterName,
      monsterOrdinal: entity.monsterOrdinal,
      socialRole: entity.socialRole,
      worldGroundMeters: { ...entity.worldGroundMeters },
      bodyState: entity.bodyState
        ? {
            ...entity.bodyState,
            facingDirection: { ...entity.bodyState.facingDirection },
          }
        : undefined,
      sourcePatchTile: { ...entity.position },
    })),
    ecologicalTraces,
    activitySite,
    terrainImprints,
  };
  return {
    playerAnchor,
    approachDirection,
    entities,
    ecologicalTraces,
    activitySite,
    terrainImprints,
    receipt,
    reusedSavedScene: false,
  };
}

// ============================================================================
// Saved Scene Replay
// ============================================================================
// A repeated transition for the same opening must reuse the frozen site and
// bodies. Re-authoring would duplicate world facts; accepting a shifted crop or
// roster would attach the receipt to the wrong place. Every mismatch fails shut.
// ============================================================================

type RestoredOpeningSceneResult =
  | { status: "ready"; scene: AuthoredOpeningScene }
  | { status: "source-gap"; detail: string };

/** Expose the persistent site to ordinary object targeting with source lineage. */
function activitySiteTarget(
  activitySite: BattleMapOpeningActivitySite,
): TargetableMapObject {
  return {
    id: activitySite.id,
    name: activitySite.label,
    position: { ...activitySite.position },
    size: "Medium",
    isWornOrCarried: false,
    isMagical: false,
    isFixedToSurface: false,
    source: {
      kind: "worldforge-monster-site",
      sourceId: activitySite.id,
      sourceKind: activitySite.kind,
      worldMeters: { ...activitySite.worldGroundMeters },
    },
  };
}

/** Rebuild tactical coordinates from saved world meters without inventing facts. */
function restoreOpeningScene(
  mapData: BattleMapData,
  source: OpeningBattlefieldSource,
  currentPlayerAnchor: BattleMapTile,
  roster: readonly OpeningThreatRosterEntry[],
  receipt: OpeningThreatSceneReceiptV2,
): RestoredOpeningSceneResult {
  if (
    receipt.sourceOpeningReceiptId !== source.receiptId ||
    receipt.worldSeed !== source.worldSeed ||
    receipt.sourceCellId !== source.cellId
  ) {
    return {
      status: "source-gap",
      detail: `Saved opening scene ${receipt.id} does not belong to opening receipt ${source.receiptId}.`,
    };
  }

  const drafts = createActorDrafts(roster);
  const rosterMatches =
    drafts.length === receipt.entities.length &&
    drafts.every((draft, index) => {
      const entity = receipt.entities[index];
      return (
        entity?.sceneReceiptId === receipt.id &&
        entity.sourceOpeningReceiptId === source.receiptId &&
        entity.monsterName === draft.monsterName &&
        entity.monsterOrdinal === draft.monsterOrdinal &&
        entity.socialRole === draft.socialRole
      );
    });
  if (!rosterMatches) {
    return {
      status: "source-gap",
      detail: `Saved opening scene ${receipt.id} does not match the current threat roster.`,
    };
  }

  const provenance = mapData.provenance;
  if (!provenance) {
    return {
      status: "source-gap",
      detail: `Saved opening scene ${receipt.id} cannot be placed without WorldForge tactical provenance.`,
    };
  }
  const patchAnchor = {
    playerXM: provenance.anchorWorldMeters.x,
    playerZM: provenance.anchorWorldMeters.z,
  };
  const tileForWorldFact = (
    world: { x: number; z: number },
    expected: { x: number; y: number },
  ): BattleMapTile | null => {
    const point = worldMetersToPatchTile(
      mapData,
      patchAnchor,
      world.x,
      world.z,
    );
    if (!point || point.x !== expected.x || point.y !== expected.y) return null;
    return mapData.tiles.get(`${point.x}-${point.y}`) ?? null;
  };

  const savedPlayerTile = tileForWorldFact(
    receipt.playerGroundMeters,
    currentPlayerAnchor.coordinates,
  );
  if (!savedPlayerTile || savedPlayerTile.blocksMovement) {
    return {
      status: "source-gap",
      detail: `Saved opening scene ${receipt.id} no longer shares the live player crop anchor.`,
    };
  }

  const occupied = new Set(
    (mapData.worldOccupants ?? []).map(
      (occupant) => `${occupant.position.x}-${occupant.position.y}`,
    ),
  );
  occupied.add(tileKey(savedPlayerTile));
  const entities: BattleMapOpeningThreatEntity[] = [];
  for (const sourceEntity of receipt.entities) {
    const tile = tileForWorldFact(
      sourceEntity.worldGroundMeters,
      sourceEntity.sourcePatchTile,
    );
    if (!tile || tile.blocksMovement || occupied.has(tileKey(tile))) {
      return {
        status: "source-gap",
        detail: `Saved opening scene ${receipt.id} contains a missing, blocked, or occupied threat position.`,
      };
    }
    occupied.add(tileKey(tile));
    const fallbackFacing = normalized({
      x: savedPlayerTile.coordinates.x - tile.coordinates.x,
      y: savedPlayerTile.coordinates.y - tile.coordinates.y,
    });
    entities.push({
      kind: sourceEntity.kind,
      sceneReceiptId: sourceEntity.sceneReceiptId,
      sourceOpeningReceiptId: sourceEntity.sourceOpeningReceiptId,
      entityId: sourceEntity.entityId,
      monsterName: sourceEntity.monsterName,
      monsterOrdinal: sourceEntity.monsterOrdinal,
      socialRole: sourceEntity.socialRole,
      worldGroundMeters: { ...sourceEntity.worldGroundMeters },
      // Legacy receipts predate body facts. They receive the deterministic
      // role profile for rendering, while current receipts preserve the exact
      // saved posture, load, and facing values.
      bodyState: sourceEntity.bodyState
        ? {
            ...sourceEntity.bodyState,
            facingDirection: { ...sourceEntity.bodyState.facingDirection },
          }
        : bodyStateForDraft(
            {
              monsterName: sourceEntity.monsterName,
              monsterOrdinal: sourceEntity.monsterOrdinal,
              socialRole: sourceEntity.socialRole,
            },
            fallbackFacing,
          ),
      position: { ...tile.coordinates },
    });
  }

  const siteTile = tileForWorldFact(
    receipt.activitySite.worldGroundMeters,
    receipt.activitySite.position,
  );
  if (!siteTile || siteTile.blocksMovement || occupied.has(tileKey(siteTile))) {
    return {
      status: "source-gap",
      detail: `Saved opening scene ${receipt.id} activity site no longer fits the live WorldForge crop.`,
    };
  }
  occupied.add(tileKey(siteTile));
  const activitySite: BattleMapOpeningActivitySite = {
    ...receipt.activitySite,
    position: { ...siteTile.coordinates },
    worldGroundMeters: { ...receipt.activitySite.worldGroundMeters },
    claimedByEntityIds: [...receipt.activitySite.claimedByEntityIds],
    contents: [...receipt.activitySite.contents],
  };

  const ecologicalTraces: BattleMapOpeningEcologicalTrace[] = [];
  for (const trace of receipt.ecologicalTraces) {
    const tile = tileForWorldFact(trace.worldGroundMeters, trace.position);
    if (!tile || tile.blocksMovement || occupied.has(tileKey(tile))) {
      // Name the failed fact and rejection class. Saved-scene failures must be
      // actionable because silently re-authoring the trace would corrupt world
      // continuity and a generic error gives the operator nothing to inspect.
      const rejection = !tile
        ? "world position no longer resolves to its saved tile"
        : tile.blocksMovement
          ? "saved tile is now blocked"
          : "saved tile is now occupied by another scene fact";
      return {
        status: "source-gap",
        detail: `Saved opening scene ${receipt.id} ecological evidence ${trace.id} no longer fits the live WorldForge crop: ${rejection}.`,
      };
    }
    occupied.add(tileKey(tile));
    ecologicalTraces.push({
      ...trace,
      position: { ...tile.coordinates },
      worldGroundMeters: { ...trace.worldGroundMeters },
      sourceEntityIds: [...trace.sourceEntityIds],
    });
  }

  // Current saves replay terrain memory exactly. Early v2 receipts do not have
  // this additive field, so derive it once from their already frozen bodies,
  // traces, and cache; the reducer then replaces that same-id receipt in place.
  const terrainImprints: BattleMapOpeningTerrainImprint[] = [];
  if (receipt.terrainImprints?.length) {
    const entityIds = new Set(entities.map((entity) => entity.entityId));
    const imprintKinds = new Set(
      receipt.terrainImprints.map((imprint) => imprint.kind),
    );
    if (
      receipt.terrainImprints.length !== 4 ||
      imprintKinds.size !== 4 ||
      !imprintKinds.has("flattened-ground") ||
      !imprintKinds.has("trampled-run") ||
      !imprintKinds.has("drag-furrow") ||
      !imprintKinds.has("refuse-scatter")
    ) {
      return {
        status: "source-gap",
        detail: `Saved opening scene ${receipt.id} has incomplete terrain memory and cannot be replayed authoritatively.`,
      };
    }
    for (const imprint of receipt.terrainImprints) {
      const startTile = tileForWorldFact(
        imprint.worldGroundMeters,
        imprint.position,
      );
      const endTile = tileForWorldFact(
        imprint.endWorldGroundMeters,
        imprint.endPosition,
      );
      const facingLength = Math.hypot(imprint.direction.x, imprint.direction.y);
      const sourceIdsMatch = imprint.sourceEntityIds.every((entityId) =>
        entityIds.has(entityId),
      );
      if (
        !startTile ||
        !endTile ||
        startTile.blocksMovement ||
        endTile.blocksMovement ||
        Math.abs(facingLength - 1) > 1e-6 ||
        imprint.extentCells.length <= 0 ||
        imprint.extentCells.width <= 0 ||
        imprint.activitySiteId !== activitySite.id ||
        imprint.sourceEntityIds.length !== entities.length ||
        !sourceIdsMatch
      ) {
        return {
          status: "source-gap",
          detail: `Saved opening scene ${receipt.id} terrain imprint ${imprint.id} no longer fits the live WorldForge crop or source group.`,
        };
      }
      terrainImprints.push({
        ...imprint,
        position: { ...startTile.coordinates },
        endPosition: { ...endTile.coordinates },
        worldGroundMeters: { ...imprint.worldGroundMeters },
        endWorldGroundMeters: { ...imprint.endWorldGroundMeters },
        direction: { ...imprint.direction },
        extentCells: { ...imprint.extentCells },
        sourceEntityIds: [...imprint.sourceEntityIds],
      });
    }
  } else {
    terrainImprints.push(
      ...authorTerrainImprints(
        mapData,
        patchAnchor,
        receipt.id,
        entities,
        ecologicalTraces,
        activitySite,
        { x: receipt.approachDirection.x, y: receipt.approachDirection.z },
      ),
    );
    if (terrainImprints.length !== 4) {
      return {
        status: "source-gap",
        detail: `Saved opening scene ${receipt.id} could not upgrade its occupation imprints on the live WorldForge crop.`,
      };
    }
  }
  const upgradedReceipt: OpeningThreatSceneReceiptV2 = receipt.terrainImprints
    ?.length
    ? receipt
    : { ...receipt, terrainImprints };

  return {
    status: "ready",
    scene: {
      playerAnchor: savedPlayerTile,
      approachDirection: {
        x: receipt.approachDirection.x,
        y: receipt.approachDirection.z,
      },
      entities,
      ecologicalTraces,
      activitySite,
      terrainImprints,
      receipt: upgradedReceipt,
      reusedSavedScene: Boolean(receipt.terrainImprints?.length),
    },
  };
}

// ============================================================================
// Resolved Return-Site Projection
// ============================================================================
// Production combat may not relaunch a resolved receipt. The World Battle Lab
// and future world renderers still need an honest way to inspect what remains,
// so this projector validates the same saved scene and then applies only the
// combat-authored body positions and site condition.
// ============================================================================

/** Rebuild a resolved opening site without treating its remaining bodies as a new fight. */
export function projectResolvedOpeningThreatReturnBattlefield(
  mapData: BattleMapData,
  source: OpeningBattlefieldSource,
  roster: readonly OpeningThreatRosterEntry[],
  receipt: OpeningThreatSceneReceiptV2,
): OpeningThreatBattlefieldResult {
  const resolution = receipt.resolution;
  if (!resolution) {
    return {
      status: "source-gap",
      detail: `Opening scene ${receipt.id} has no combat outcome to project as a return site.`,
    };
  }

  const provenance = mapData.provenance;
  if (
    !provenance ||
    provenance.worldSeed !== source.worldSeed ||
    provenance.anchorCellId !== source.cellId
  ) {
    return {
      status: "source-gap",
      detail: `Resolved opening scene ${receipt.id} does not match this WorldForge tactical crop.`,
    };
  }
  const anchor = nearestWalkableAnchor(mapData);
  if (!anchor) {
    return {
      status: "source-gap",
      detail: `Resolved opening scene ${receipt.id} has no legal return-site anchor.`,
    };
  }

  // Validate the original bodies, traces, site, and terrain memory before
  // applying aftermath. This prevents a plausible-looking return view from
  // hiding drift in the scene it claims to continue.
  const restored = restoreOpeningScene(
    mapData,
    source,
    anchor,
    roster,
    receipt,
  );
  if (restored.status !== "ready") return restored;
  const scene = restored.scene;
  const outcomeByEntityId = new Map(
    resolution.entityOutcomes.map(
      (outcome) => [outcome.sourceEntityId, outcome] as const,
    ),
  );
  const receiptEntityIds = new Set(
    receipt.entities.map((entity) => entity.entityId),
  );
  const resolutionEntityIds = new Set(outcomeByEntityId.keys());
  const disturbanceEntityIds = new Set(
    resolution.combatDisturbance.sourceEntityIds,
  );
  const resolutionShapeIsComplete =
    resolution.entityOutcomes.length === receipt.entities.length &&
    resolutionEntityIds.size === receipt.entities.length &&
    disturbanceEntityIds.size === receipt.entities.length &&
    [...receiptEntityIds].every(
      (entityId) =>
        resolutionEntityIds.has(entityId) && disturbanceEntityIds.has(entityId),
    ) &&
    Number.isFinite(resolution.resolvedAtGameTimeMs) &&
    Math.abs(
      Math.hypot(
        resolution.combatDisturbance.direction.x,
        resolution.combatDisturbance.direction.y,
      ) - 1,
    ) < 1e-6 &&
    resolution.combatDisturbance.extentCells.length > 0 &&
    resolution.combatDisturbance.extentCells.width > 0 &&
    (resolution.outcome === "party-victory"
      ? resolution.activitySiteCondition === "abandoned-disturbed" &&
        resolution.entityOutcomes.every(
          (outcome) => outcome.status !== "holding-ground",
        )
      : resolution.activitySiteCondition === "held-disturbed" &&
        resolution.entityOutcomes.every(
          (outcome) => outcome.status !== "withdrew",
        ));
  if (!resolutionShapeIsComplete) {
    return {
      status: "source-gap",
      detail: `Resolved opening scene ${receipt.id} has incomplete or contradictory outcome memory.`,
    };
  }

  const patchAnchor = {
    playerXM: provenance.anchorWorldMeters.x,
    playerZM: provenance.anchorWorldMeters.z,
  };
  const finalEntities: BattleMapOpeningThreatEntity[] = [];
  const occupiedFinalTiles = new Set<string>();
  for (const entity of scene.entities) {
    const outcome = outcomeByEntityId.get(entity.entityId);
    if (!outcome) {
      return {
        status: "source-gap",
        detail: `Resolved opening scene ${receipt.id} lost outcome ${entity.entityId}.`,
      };
    }
    const finalTilePoint = worldMetersToPatchTile(
      mapData,
      patchAnchor,
      outcome.lastSeenWorldGroundMeters.x,
      outcome.lastSeenWorldGroundMeters.z,
    );
    const finalTile = finalTilePoint
      ? mapData.tiles.get(`${finalTilePoint.x}-${finalTilePoint.y}`)
      : undefined;
    const hitPointStateMatches =
      outcome.status === "downed"
        ? outcome.finalHitPoints <= 0
        : outcome.finalHitPoints > 0;
    if (
      !finalTilePoint ||
      !finalTile ||
      finalTile.blocksMovement ||
      finalTilePoint.x !== outcome.finalTacticalPosition.x ||
      finalTilePoint.y !== outcome.finalTacticalPosition.y ||
      !hitPointStateMatches
    ) {
      return {
        status: "source-gap",
        detail: `Resolved opening scene ${receipt.id} outcome ${entity.entityId} no longer maps to its final referee cell.`,
      };
    }

    // Withdrawals are historical last-seen facts, not invisible tokens. Downed
    // bodies and defenders still holding the site remain physical entities.
    if (outcome.status === "withdrew") continue;
    const finalTileKey = `${finalTilePoint.x}-${finalTilePoint.y}`;
    if (occupiedFinalTiles.has(finalTileKey)) {
      return {
        status: "source-gap",
        detail: `Resolved opening scene ${receipt.id} places multiple bodies on ${finalTileKey}.`,
      };
    }
    occupiedFinalTiles.add(finalTileKey);
    finalEntities.push({
      ...entity,
      position: { ...outcome.finalTacticalPosition },
      worldGroundMeters: { ...outcome.lastSeenWorldGroundMeters },
      bodyState: entity.bodyState
        ? {
            ...entity.bodyState,
            facingDirection: { ...entity.bodyState.facingDirection },
          }
        : undefined,
    });
  }

  const disturbancePoint = worldMetersToPatchTile(
    mapData,
    patchAnchor,
    resolution.combatDisturbance.worldGroundMeters.x,
    resolution.combatDisturbance.worldGroundMeters.z,
  );
  if (
    !disturbancePoint ||
    disturbancePoint.x !== resolution.combatDisturbance.position.x ||
    disturbancePoint.y !== resolution.combatDisturbance.position.y
  ) {
    return {
      status: "source-gap",
      detail: `Resolved opening scene ${receipt.id} combat disturbance no longer maps to its saved referee cell.`,
    };
  }

  const holdingEntityIds = resolution.entityOutcomes
    .filter((outcome) => outcome.status === "holding-ground")
    .map((outcome) => outcome.sourceEntityId);
  const activitySite: BattleMapOpeningActivitySite = {
    ...scene.activitySite,
    label:
      resolution.activitySiteCondition === "abandoned-disturbed"
        ? `Abandoned ${scene.activitySite.label.toLowerCase()}`
        : `Contested ${scene.activitySite.label.toLowerCase()}`,
    claimedByEntityIds: holdingEntityIds,
    position: { ...scene.activitySite.position },
    worldGroundMeters: { ...scene.activitySite.worldGroundMeters },
    contents: [...scene.activitySite.contents],
  };
  const returnedResolution = {
    ...resolution,
    entityOutcomes: resolution.entityOutcomes.map((outcome) => ({
      ...outcome,
      finalTacticalPosition: { ...outcome.finalTacticalPosition },
      lastSeenWorldGroundMeters: {
        ...outcome.lastSeenWorldGroundMeters,
      },
    })),
    combatDisturbance: {
      ...resolution.combatDisturbance,
      position: { ...resolution.combatDisturbance.position },
      worldGroundMeters: {
        ...resolution.combatDisturbance.worldGroundMeters,
      },
      direction: { ...resolution.combatDisturbance.direction },
      extentCells: { ...resolution.combatDisturbance.extentCells },
      sourceEntityIds: [...resolution.combatDisturbance.sourceEntityIds],
    },
  };

  return {
    status: "ready",
    detail: `Resolved opening scene ${receipt.id} returned with ${finalEntities.length} physical bodies, ${resolution.entityOutcomes.length - finalEntities.length} withdrawals, and one ${resolution.activitySiteCondition} site.`,
    receipt,
    mapData: {
      ...mapData,
      targetableObjects: [
        ...(mapData.targetableObjects ?? []).filter(
          (object) => object.id !== activitySite.id,
        ),
        activitySiteTarget(activitySite),
      ],
      provenance: {
        ...provenance,
        locationLabel: provenance.locationLabel ?? source.locationLabel,
        generationPath: [
          ...provenance.generationPath,
          `Opening scene ${receipt.id}`,
          `Resolved return ${resolution.outcome}`,
        ],
      },
      encounterContext: {
        kind: "opening-standoff",
        source: "worldforge-opening",
        sourceReceiptId: source.receiptId,
        sourceSceneReceiptId: receipt.id,
        sceneContinuity: "resolved-return",
        sourceWorldCellId: source.cellId,
        anchorTile: { ...scene.playerAnchor.coordinates },
        approachDirection: { ...scene.approachDirection },
        sourceEntities: finalEntities,
        ecologicalTraces: scene.ecologicalTraces,
        terrainImprints: scene.terrainImprints,
        activitySite,
        sceneResolution: returnedResolution,
        deployment: {
          player: "current-position",
          enemy: "resolved-source-bodies",
        },
        omittedFacts: {
          preContactHistory: "not-authored",
        },
      },
    },
  };
}

// ============================================================================
// Source Validation And Tactical Framing
// ============================================================================

/**
 * Validate one opening receipt against the extracted map and add an honest
 * tactical frame. No terrain, props, structures, occupants, or roster facts are
 * generated here; all existing source layers pass through unchanged.
 */
export function projectOpeningThreatBattlefield(
  mapData: BattleMapData,
  source: OpeningBattlefieldSource,
  roster: readonly OpeningThreatRosterEntry[],
  existingReceipt?: OpeningThreatSceneReceipt,
): OpeningThreatBattlefieldResult {
  const provenance = mapData.provenance;
  if (!provenance) {
    return {
      status: "source-gap",
      detail: `Opening receipt ${source.receiptId} reached combat without WorldForge tactical provenance.`,
    };
  }

  // Both dimensions of source identity must agree. A matching cell in a
  // different seed is a different world; a matching seed in another cell is a
  // different place.
  if (
    provenance.worldSeed !== source.worldSeed ||
    provenance.anchorCellId !== source.cellId
  ) {
    return {
      status: "source-gap",
      detail: `Opening receipt ${source.receiptId} expected world ${source.worldSeed}, cell ${source.cellId}, but the live tactical crop identifies world ${provenance.worldSeed}, cell ${provenance.anchorCellId ?? "unknown"}.`,
    };
  }

  const anchor = nearestWalkableAnchor(mapData);
  if (!anchor) {
    return {
      status: "source-gap",
      detail: `Opening receipt ${source.receiptId} has no legal player anchor in its WorldForge crop.`,
    };
  }

  if (
    existingReceipt &&
    (existingReceipt.sourceOpeningReceiptId !== source.receiptId ||
      existingReceipt.worldSeed !== source.worldSeed ||
      existingReceipt.sourceCellId !== source.cellId)
  ) {
    return {
      status: "source-gap",
      detail: `Saved opening scene ${existingReceipt.id} does not belong to opening receipt ${source.receiptId}.`,
    };
  }

  // A completed scene is historical evidence, not a valid encounter launcher.
  // Return-site inspection uses the explicit projector above; production combat
  // must fail closed rather than resurrecting downed or withdrawn creatures.
  if (
    existingReceipt?.policyVersion === "opening-threat-scene-v2" &&
    existingReceipt.resolution
  ) {
    return {
      status: "source-gap",
      detail: `Saved opening scene ${existingReceipt.id} already resolved as ${existingReceipt.resolution.outcome} and cannot start combat again.`,
    };
  }

  // V2 receipts replay exact world positions. Early v2 saves gain terrain
  // imprints around their frozen bodies/site, while matching v1 receipts still
  // use the deterministic author to establish the complete current contract.
  let scene: AuthoredOpeningScene | null;
  if (existingReceipt?.policyVersion === "opening-threat-scene-v2") {
    const restored = restoreOpeningScene(
      mapData,
      source,
      anchor,
      roster,
      existingReceipt,
    );
    if (restored.status !== "ready") return restored;
    scene = restored.scene;
  } else {
    scene = authorOpeningScene(mapData, source, anchor, roster);
  }
  if (!scene) {
    return {
      status: "source-gap",
      detail: `Opening receipt ${source.receiptId} could not author every threat entity on legal WorldForge cells.`,
    };
  }

  // Preserve the complete source map. Only provenance lineage and encounter
  // framing are extended; the model is not allowed to repaint the location.
  return {
    status: "ready",
    detail: `Opening receipt ${source.receiptId} ${scene.reusedSavedScene ? "reused" : existingReceipt ? "upgraded" : "authored"} saved scene ${scene.receipt.id} with ${scene.entities.length} source entities, ${scene.ecologicalTraces.length} ecological traces, ${scene.terrainImprints.length} terrain imprints, and one persistent ${scene.activitySite.kind}.`,
    receipt: scene.receipt,
    mapData: {
      ...mapData,
      targetableObjects: [
        ...(mapData.targetableObjects ?? []).filter(
          (object) => object.id !== scene.activitySite.id,
        ),
        activitySiteTarget(scene.activitySite),
      ],
      provenance: {
        ...provenance,
        locationLabel: provenance.locationLabel ?? source.locationLabel,
        generationPath: [
          ...provenance.generationPath,
          `Opening threat ${source.receiptId}`,
          `Opening scene ${scene.receipt.id}`,
        ],
      },
      encounterContext: {
        kind: "opening-standoff",
        source: "worldforge-opening",
        sourceReceiptId: source.receiptId,
        sourceSceneReceiptId: scene.receipt.id,
        sceneContinuity: scene.reusedSavedScene ? "saved-replay" : "authored",
        sourceWorldCellId: source.cellId,
        anchorTile: { ...scene.playerAnchor.coordinates },
        approachDirection: scene.approachDirection,
        sourceEntities: scene.entities,
        ecologicalTraces: scene.ecologicalTraces,
        terrainImprints: scene.terrainImprints,
        activitySite: scene.activitySite,
        deployment: {
          player: "current-position",
          enemy: "source-world-entities",
        },
        omittedFacts: {
          preContactHistory: "not-authored",
        },
      },
    },
  };
}
