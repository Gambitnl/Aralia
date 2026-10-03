/**
 * @file useBattleMapDerivedState.ts
 * Every render-ready value BattleMap derives from its props, in one hook.
 *
 * WHAT MOVED HERE (MOD-3.7): the contiguous run of memo/derivation blocks that
 * used to sit between the pointer hook and the JSX in BattleMap.tsx — viewport
 * culling, the tile index, world-occupant grouping, encounter marker/direction,
 * the opening-standoff track trail and its paw marks, elevation baseline and
 * reference, the synthetic CombatState fed to useVisibility, teleport
 * assignment labels, and the tactical target/path/threat/move coordinate sets.
 *
 * WHY: BattleMap.tsx was 831 lines and read as one wall of derivation followed
 * by one wall of JSX. Splitting on that seam leaves the component as a render
 * tree and gives the derived state a testable, independently readable home.
 *
 * WHAT WAS PRESERVED: the extracted run is byte-identical to the code it came
 * from, in the same order, so every hook call happens in the same sequence with
 * the same dependency arrays. `useVisibility` and `useTargetSelection` moved
 * with the run for that reason — they sit inside it, not around it. The three
 * hooks that must stay in the component (the two overlay `useState`s, the
 * `useEffect` syncing the line-of-sight toggle, the `openingSceneCameraFocus`
 * memo that feeds `useBattleMapPointer`, and the `gridRef`) stayed behind
 * because they are ordered before the pointer hook or are consumed by JSX refs.
 *
 * DEFERRED: a further split of the JSX into tile/marker layer subcomponents
 * (tracked in Agora task agora-9950), noted as a follow-up in the modularization packet.
 *
 * Called by: BattleMap.tsx
 * Depends on: useVisibleTileWindow for culling, useVisibility for the fog and
 * light model, useTargetSelection for ability target sets, and
 * elevationPresentation/visibilityObserverPolicy for the readout helpers.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 14:48:40
 * Dependents: components/BattleMap/BattleMap.tsx
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useMemo } from "react";
import type {
  BattleMapData,
  BattleMapTile as BattleMapTileData,
  CombatCharacter,
  CombatState,
  LightSource,
  Position,
} from "../../../types/combat";
import { useTargetSelection } from "../../../hooks/combat/useTargetSelection";
import { useVisibility } from "../../../hooks/combat/useVisibility";
import type { useTurnManager } from "../../../hooks/combat/useTurnManager";
import type { useAbilitySystem } from "../../../hooks/useAbilitySystem";
import { TILE_SIZE_PX } from "../../../config/mapConfig";
import { selectVisibilityObserver } from "../visibilityObserverPolicy";
import {
  describeBattleMapElevation,
  findBattleMapElevationBaseline,
} from "../elevationPresentation";
import { useVisibleTileWindow } from "./useVisibleTileWindow";
import type useBattleMapPointer from "./useBattleMapPointer";

/**
 * The slice of `useBattleMapPointer`'s result this hook consumes. Reading the
 * types off the pointer hook keeps the two in step: a change to the pointer
 * state's shape surfaces here as a type error instead of a silent mismatch.
 */
type BattleMapPointerState = ReturnType<typeof useBattleMapPointer>;

export interface UseBattleMapDerivedStateParams {
  mapData: BattleMapData | null;
  characters: CombatCharacter[];
  turnManager: ReturnType<typeof useTurnManager>;
  turnState: ReturnType<typeof useTurnManager>["turnState"];
  abilitySystem: ReturnType<typeof useAbilitySystem>;
  /** Scroll container that clips the board, owned by the pointer hook. */
  fitWrapRef: React.RefObject<HTMLElement | null>;
  /** The `.battle-map-grid` element, owned by BattleMap for its JSX ref. */
  gridRef: React.RefObject<HTMLElement | null>;
  boardScale: number;
  selectedCharacterId: BattleMapPointerState["selectedCharacterId"];
  actionMode: BattleMapPointerState["actionMode"];
  validMoves: BattleMapPointerState["validMoves"];
  activePath: BattleMapPointerState["activePath"];
  hoveredTile: BattleMapPointerState["hoveredTile"];
}

export function useBattleMapDerivedState({
  mapData,
  characters,
  turnManager,
  turnState,
  abilitySystem,
  fitWrapRef,
  gridRef,
  boardScale,
  selectedCharacterId,
  actionMode,
  validMoves,
  activePath,
  hoveredTile,
}: UseBattleMapDerivedStateParams) {
  // ============================================================================
  // Viewport Culling of the Tile Grid
  // ============================================================================
  // The grid renders one DOM element per tile. A 120x90 board is 10,800 tiles,
  // which costs seconds of main-thread time and about 33,000 DOM nodes. Only
  // the tiles inside the scroll viewport are rendered; the CSS grid keeps its
  // explicit row and column tracks, and each tile places itself from its own
  // coordinates, so the board keeps the exact same geometry.
  const tileWindowState = useVisibleTileWindow({
    wrapRef: fitWrapRef,
    gridRef,
    width: mapData?.dimensions.width ?? 0,
    height: mapData?.dimensions.height ?? 0,
    tileSize: TILE_SIZE_PX,
    boardScale,
  });

  // Index the tiles by coordinate so the render loop costs the size of the
  // window, not the size of the board.
  const tileLookup = useMemo(() => {
    if (!mapData) return null;
    const { width, height } = mapData.dimensions;
    const cells = new Array<BattleMapTileData | undefined>(width * height);
    for (const tile of mapData.tiles.values()) {
      const { x, y } = tile.coordinates;
      if (x >= 0 && x < width && y >= 0 && y < height) {
        cells[y * width + x] = tile;
      }
    }
    return cells;
  }, [mapData]);

  // The tiles the grid actually renders this frame.
  //  - pending: the very first render, before the grid has any layout. No tiles
  //    yet; the layout effect measures and re-renders before the browser
  //    paints, so the cheap first commit is the one that costs nothing.
  //  - unmeasurable: no viewport to cull against (jsdom, display:none ancestor),
  //    so the whole board renders.
  //  - measured: render the measured window.
  const visibleTiles = useMemo(() => {
    if (!mapData || !tileLookup) return [];
    if (tileWindowState.status === "pending") return [];
    const { width, height } = mapData.dimensions;
    const bounds =
      tileWindowState.status === "measured"
        ? tileWindowState.window
        : { minX: 0, maxX: width - 1, minY: 0, maxY: height - 1 };
    const { minX, maxX, minY, maxY } = bounds;
    const tiles: BattleMapTileData[] = [];
    for (let y = minY; y <= maxY; y++) {
      const rowStart = y * width;
      for (let x = minX; x <= maxX; x++) {
        const tile = tileLookup[rowStart + x];
        if (tile) tiles.push(tile);
      }
    }
    return tiles;
  }, [mapData, tileLookup, tileWindowState]);

  // Group residents by 5ft tactical cell for clear rendering without dropping identity
  const worldOccupantGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        position: Position;
        occupants: NonNullable<BattleMapData["worldOccupants"]>;
      }
    >();
    for (const occupant of mapData?.worldOccupants ?? []) {
      const key = `${occupant.position.x}-${occupant.position.y}`;
      const group = groups.get(key);
      if (group) {
        group.occupants.push(occupant);
      } else {
        groups.set(key, { position: occupant.position, occupants: [occupant] });
      }
    }
    return Array.from(groups.values());
  }, [mapData]);

  const encounterMarker = useMemo(() => {
    const context = mapData?.encounterContext;
    if (!context) return null;
    if (context.kind === "opening-standoff") {
      if (context.sceneResolution) return null;
      return {
        label: "Opening standoff",
        className: "border-cyan-300 bg-cyan-950/95 text-cyan-100",
      };
    }
    if (context.kind === "settlement-edge") {
      return {
        label: "Settlement gate",
        className: "border-amber-300 bg-amber-950/95 text-amber-100",
      };
    }
    if (context.kind === "settlement-watch") {
      return {
        label: "Watch interception",
        className: "border-red-300 bg-red-950/95 text-red-100",
      };
    }
    if (context.kind === "settlement-state-patrol") {
      return {
        label: "State patrol",
        className: "border-rose-300 bg-rose-950/95 text-rose-100",
      };
    }
    if (context.kind === "river-crossing") {
      return {
        label:
          context.crossingKind === "bridge"
            ? "Bridge crossing"
            : "Ford crossing",
        className: "border-sky-300 bg-sky-950/95 text-sky-100",
      };
    }
    return {
      label: "Route heading",
      className: "border-orange-300 bg-orange-950/95 text-orange-100",
    };
  }, [mapData]);

  const encounterDirection = useMemo(() => {
    const context = mapData?.encounterContext;
    if (!context) return null;
    if ("routeDirection" in context) return context.routeDirection;
    return context.kind === "opening-standoff"
      ? context.approachDirection
      : null;
  }, [mapData]);

  const openingTrackTrail = useMemo(() => {
    const context = mapData?.encounterContext;
    if (context?.kind !== "opening-standoff") return [];
    const tracks = context.ecologicalTraces.filter(
      (trace) => trace.kind === "tracks",
    );
    if (tracks.length === 0) return [];

    const trailEnd = context.sceneResolution
      ? context.terrainImprints?.find(
          (imprint) => imprint.kind === "trampled-run",
        )?.endPosition
      : context.sourceEntities.length > 0
        ? context.sourceEntities.reduce(
            (sum, entity) => ({
              x: sum.x + entity.position.x / context.sourceEntities.length,
              y: sum.y + entity.position.y / context.sourceEntities.length,
            }),
            { x: 0, y: 0 },
          )
        : undefined;
    if (!trailEnd) return [];
    return [
      ...tracks
        .slice()
        .reverse()
        .map((trace) => trace.position),
      trailEnd,
    ];
  }, [mapData]);

  const openingTrackMarks = useMemo(() => {
    const marks: Array<{
      x: number;
      y: number;
      rotation: number;
      side: number;
    }> = [];
    for (
      let segmentIndex = 0;
      segmentIndex < openingTrackTrail.length - 1;
      segmentIndex += 1
    ) {
      const start = openingTrackTrail[segmentIndex]!;
      const end = openingTrackTrail[segmentIndex + 1]!;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const distance = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.floor(distance / 0.72));
      const rotation = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      for (let step = segmentIndex === 0 ? 0 : 1; step <= steps; step += 1) {
        const progress = step / steps;
        marks.push({
          x: start.x + dx * progress,
          y: start.y + dy * progress,
          rotation,
          side: marks.length % 2 === 0 ? -1 : 1,
        });
      }
    }
    return marks;
  }, [openingTrackTrail]);

  const currentCharacter = characters.find(
    (c) => c.id === turnState.currentCharacterId,
  );

  // Elevation baseline and relative height reference
  const elevationBaseline = useMemo(
    () => findBattleMapElevationBaseline(mapData?.tiles.values() ?? []),
    [mapData],
  );

  const elevationReference = useMemo(() => {
    const referenceCharacter =
      characters.find((character) => character.id === selectedCharacterId) ??
      characters.find(
        (character) => character.id === turnState.currentCharacterId,
      ) ??
      null;
    const referenceTile = referenceCharacter
      ? mapData?.tiles.get(
          `${referenceCharacter.position.x}-${referenceCharacter.position.y}`,
        )
      : null;
    if (!referenceCharacter || !referenceTile) return null;
    return {
      elevation: referenceTile.elevation,
      label: referenceCharacter.name,
    };
  }, [characters, mapData, selectedCharacterId, turnState.currentCharacterId]);

  const hoveredElevation = hoveredTile
    ? describeBattleMapElevation(
        hoveredTile.elevation,
        elevationReference?.elevation,
        elevationReference?.label,
        elevationBaseline,
      )
    : null;

  // Visibility and observer shared senses
  const visibilityObserverSelection = selectVisibilityObserver({
    selectedCharacterId,
    currentCharacterId: turnState.currentCharacterId,
    characters,
  });
  const visibilityObserverId = visibilityObserverSelection.observerId;

  const visibilityState = useMemo(
    () =>
      ({
        isActive: true,
        characters,
        turnState,
        selectedCharacterId,
        selectedAbilityId: null,
        actionMode,
        validTargets: [],
        validMoves: [],
        combatLog: [],
        reactiveTriggers: turnManager.reactiveTriggers || [],
        activeLightSources: (turnManager.activeLightSources ||
          []) as LightSource[],
        mapData: mapData ?? undefined,
      }) as unknown as CombatState,
    [
      actionMode,
      characters,
      mapData,
      selectedCharacterId,
      turnManager.activeLightSources,
      turnManager.reactiveTriggers,
      turnState,
    ],
  );

  const visibility = useVisibility({
    combatState: visibilityState,
    activeCharacterId: visibilityObserverId,
  });

  const assignedTeleportDestinations = useMemo(() => {
    const assignment = abilitySystem.pendingTeleportAssignment;
    if (!assignment) return [];

    return Object.entries(assignment.destinationsByTargetId).map(
      ([targetId, destination]) => {
        const target = characters.find(
          (character) => character.id === targetId,
        );
        return {
          targetId,
          targetName: target?.name ?? targetId,
          destination,
          abilityName: assignment.ability.name,
        };
      },
    );
  }, [abilitySystem.pendingTeleportAssignment, characters]);

  // ============================================================================
  // Tactical Target, Movement, and Threat Sets
  // ============================================================================
  const { aoeSet, validTargetSet, teleportDestinationSet } = useTargetSelection(
    {
      selectedAbility: abilitySystem.selectedAbility,
      targetingMode: abilitySystem.targetingMode,
      isValidTarget: abilitySystem.isValidTarget,
      aoePreview: abilitySystem.aoePreview,
      teleportDestinationPreview: abilitySystem.teleportDestinationPreview,
      currentCharacter,
      mapData,
      characters,
    },
  );

  const activePathSet = useMemo(() => {
    const set = new Set<string>();
    activePath.forEach((p) => set.add(p.id));
    return set;
  }, [activePath]);

  // Threat range coordinates surrounding active hostile enemies
  const threatCoordSet = useMemo(() => {
    const set = new Set<string>();
    characters.forEach((ch) => {
      if (ch.team !== "enemy" || ch.currentHP <= 0) return;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          set.add(`${ch.position.x + dx},${ch.position.y + dy}`);
        }
      }
    });
    return set;
  }, [characters]);

  // Coordinate set of reachable moves for boundary perimeter strokes
  const validMoveCoordSet = useMemo(() => {
    const set = new Set<string>();
    if (!mapData) return set;
    mapData.tiles.forEach((tile) => {
      if (validMoves.has(tile.id))
        set.add(`${tile.coordinates.x},${tile.coordinates.y}`);
    });
    return set;
  }, [mapData, validMoves]);

  return {
    // Culling and the tiles the grid renders this frame.
    tileWindowState,
    tileLookup,
    visibleTiles,
    // Overlay inputs.
    worldOccupantGroups,
    encounterMarker,
    encounterDirection,
    openingTrackTrail,
    openingTrackMarks,
    assignedTeleportDestinations,
    // Elevation readouts.
    elevationBaseline,
    elevationReference,
    hoveredElevation,
    // Turn and visibility model.
    currentCharacter,
    visibilityObserverSelection,
    visibilityObserverId,
    visibilityState,
    visibility,
    // Tactical coordinate sets.
    aoeSet,
    validTargetSet,
    teleportDestinationSet,
    activePathSet,
    threatCoordSet,
    validMoveCoordSet,
  };
}

export default useBattleMapDerivedState;
