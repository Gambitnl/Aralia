// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 16/07/2026, 14:52:19
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/BattleMap/index.ts, components/Combat/CombatView.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx
 * Imports: 18 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file BattleMap.tsx
 * The primary component for rendering a source-backed tactical battlefield.
 *
 * CURRENT FUNCTIONALITY:
 * - Renders WorldForge terrain, tactical cells, character bodies, and saved scene evidence
 * - Manages turn-based interaction states (move/attack modes)
 * - Handles tile and character click interactions
 * - Displays damage numbers and spell effects through overlay
 * - Implements basic optimization with memoized sets for target selection
 *
 * PERFORMANCE OPPORTUNITIES:
 * - Missing viewport culling for off-screen entities (renders all characters/tiles)
 * - No level-of-detail scaling for distant combatants
 * - Individual DOM elements for each damage number (could use canvas)
 * - Grid rendering recalculates all tiles even when only positions change
 * - No texture atlas consolidation for sprite batching
 */
import React, {
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import {
  ArrowRight,
  Bone,
  Footprints,
  Leaf,
  MapPinned,
  Mountain,
  Swords,
  UsersRound,
} from "lucide-react";
import {
  BattleMapData,
  CombatCharacter,
  BattleMapTile as BattleMapTileData,
  CombatState,
  LightSource,
  Position,
} from "../../types/combat";
import { useBattleMap } from "../../hooks/useBattleMap";
import { useTargetSelection } from "../../hooks/combat/useTargetSelection";
import { useVisibility } from "../../hooks/combat/useVisibility";
import type { useTurnManager } from "../../hooks/combat/useTurnManager";
import type { useAbilitySystem } from "../../hooks/useAbilitySystem";
import BattleMapTile from "./BattleMapTile";
import CharacterToken, { OpeningThreatWorldBody } from "./CharacterToken";
import BattleMapOverlay from "./BattleMapOverlay";
import BattleMapGroundCanvas from "./BattleMapGroundCanvas";
import BattleMapFogCanvas from "./BattleMapFogCanvas";
import { TILE_SIZE_PX } from "../../config/mapConfig";
import { UI_ID } from "../../styles/uiIds";
import { Z_INDEX } from "../../styles/zIndex";
import { selectVisibilityObserver } from "./visibilityObserverPolicy";
import type { SpellMapArtifacts } from "./spellMapArtifacts";
import { selectQuickAttack } from "./quickAttack";
import {
  describeBattleMapElevation,
  findBattleMapElevationBaseline,
} from "./elevationPresentation";

// Width of the row-letter gutter to the left of the grid; the column ruler uses
// the same value as a leading offset so numbers sit centered over their columns.
const RULER_GUTTER_PX = 20;
const COLUMN_RULER_HEIGHT_PX = 16;

// Spreadsheet-style row labels: A..Z, then AA, AB, … for taller maps.
const rowLabel = (index: number): string => {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
};

const LEGEND_ITEMS: Array<{
  swatch: string;
  label: string;
  testId?: string;
  title?: string;
  dashed?: boolean;
  toggle?: "lineOfSight";
}> = [
  {
    swatch: "border-2 border-emerald-400/90 bg-emerald-500/10",
    label: "Move Range",
  },
  { swatch: "bg-emerald-300/80", label: "Destination" },
  { swatch: "bg-rose-500/60", label: "Attack Range" },
  { swatch: "bg-orange-500/60", label: "Area Effect" },
  {
    swatch: "border-t-2 border-amber-200/70",
    label: "Elevation: floor 0 ft | contour step 5 ft",
    testId: "elevation-legend",
    title:
      "The lowest ground in this tactical map is 0 ft. Each contour marks another 5-foot height step; hover a tile to see whether it is uphill or downhill.",
  },
  {
    swatch: "border border-dashed border-slate-300",
    label: "Line of Sight",
    dashed: true,
    toggle: "lineOfSight",
  },
];

const MIN_USABLE_BOARD_SCALE = 0.7;

interface BattleMapProps {
  mapData: BattleMapData | null;
  characters: CombatCharacter[];
  showCoverLabels?: boolean;
  showLightSourceMarkers?: boolean;
  showLineOfSightCone?: boolean;
  assetOverlayVisible?: boolean;
  /** Visual harness layer that marks every explicit source-backed object fact. */
  showTargetableObjectFacts?: boolean;
  /** Source-backed noncombat residents, grouped by tactical cell for legibility. */
  showWorldOccupants?: boolean;
  /** Debug/review surfaces may prioritize whole-map context over token size. */
  preferFullMapFit?: boolean;
  cameraFocusRequest?: { characterId: string; requestId: number } | null;
  objectInteraction?: {
    activeObjectId: string | null;
    movableObjectIds: string[];
    onObjectSelect: (objectId: string) => void;
    onObjectMove: (objectId: string, destination: Position) => void;
  };
  /** Non-creature summon/control records rendered as explicit map artifacts. */
  spellMapArtifacts?: SpellMapArtifacts;
  combatState: {
    turnManager: ReturnType<typeof useTurnManager>;
    turnState: ReturnType<typeof useTurnManager>["turnState"];
    abilitySystem: ReturnType<typeof useAbilitySystem>;
    isCharacterTurn: (id: string) => boolean;
    onCharacterUpdate: (character: CombatCharacter) => void;
  };
}

const BattleMap: React.FC<BattleMapProps> = ({
  mapData,
  characters,
  showCoverLabels = false,
  showLightSourceMarkers = true,
  showLineOfSightCone = false,
  assetOverlayVisible = true,
  showTargetableObjectFacts = false,
  showWorldOccupants = true,
  preferFullMapFit = false,
  cameraFocusRequest = null,
  objectInteraction,
  spellMapArtifacts,
  combatState,
}) => {
  const { turnManager, turnState, abilitySystem, isCharacterTurn } =
    combatState;
  const [lineOfSightOverlayVisible, setLineOfSightOverlayVisible] =
    useState(showLineOfSightCone);
  const [pendingCameraCenterCharacterId, setPendingCameraCenterCharacterId] =
    useState<string | null>(null);
  const [hoveredTile, setHoveredTile] = useState<BattleMapTileData | null>(
    null,
  );

  // Keep the local overlay toggle aligned if a parent view changes the starting
  // line-of-sight teaching overlay, while still letting the player hide it in
  // the map itself when it gets in the way.
  useEffect(() => {
    setLineOfSightOverlayVisible(showLineOfSightCone);
  }, [showLineOfSightCone]);

  const battleMapState = useBattleMap(
    mapData,
    characters,
    turnManager,
    abilitySystem,
  );

  // Use damage numbers from turnManager state prop if available
  // Assuming turnManager.damageNumbers is exposed (which we added in useTurnManager)
  const damageNumbers = turnManager.damageNumbers || [];

  const {
    selectedCharacterId,
    validMoves,
    activePath,
    actionMode,
    setActionMode,
    handleTileClick,
    handleCharacterClick,
  } = battleMapState;

  const activeObjectId = objectInteraction?.activeObjectId ?? null;
  const activeObject = activeObjectId
    ? (mapData?.targetableObjects?.find(
        (targetObject) => targetObject.id === activeObjectId,
      ) ?? null)
    : null;

  const handleObjectAwareTileClick = useCallback(
    (tile: BattleMapTileData) => {
      // When a movable object is selected, a tile click becomes an object move
      // instead of a normal creature movement or attack click. This path is
      // opt-in so production combat maps keep their existing click behavior.
      if (activeObject && objectInteraction && !tile.blocksMovement) {
        objectInteraction.onObjectMove(activeObject.id, tile.coordinates);
        return;
      }

      handleTileClick(tile);
    },
    [activeObject, handleTileClick, objectInteraction],
  );

  // Live AoE preview when hovering tiles while targeting
  const handleTileHover = useCallback(
    (tile: BattleMapTileData) => {
      // Terrain inspection is useful in every action mode. AoE preview remains
      // conditional below, but relative height should not disappear simply
      // because the player is moving rather than targeting.
      setHoveredTile(tile);
      if (
        !abilitySystem?.previewAoE ||
        !abilitySystem.targetingMode ||
        !mapData
      )
        return;
      const caster = characters.find(
        (c) => c.id === turnState.currentCharacterId,
      );
      if (caster) {
        abilitySystem.previewAoE(tile.coordinates, caster);
      }
    },
    [abilitySystem, characters, mapData, turnState.currentCharacterId],
  );

  const tileArray = useMemo(() => {
    if (!mapData) return [];
    return Array.from(mapData.tiles.values());
  }, [mapData]);

  // Residents are identity-rich world facts, but several people can occupy one
  // five-foot tactical cell. Group only for rendering so the model retains all
  // identities while the board avoids stacks of indistinguishable markers.
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
      // A return visit has no live approach direction. Its saved churn, bodies,
      // and abandoned site carry the history without a tactical arrow implying
      // the withdrawn group is still advancing on the party.
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

    // The authoring policy stores fresh tracks before older ones. Reverse them
    // for visual reading. An active scene terminates at the current creature
    // group; a resolved return keeps the original contact endpoint from saved
    // traffic wear so withdrawn creatures do not bend old tracks toward bodies.
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
  const openingSceneCameraFocus = useMemo(() => {
    const context = mapData?.encounterContext;
    if (context?.kind !== "opening-standoff") return null;
    const points = [
      context.anchorTile,
      ...context.sourceEntities.map((entity) => entity.position),
      ...context.ecologicalTraces.map((trace) => trace.position),
      ...(context.terrainImprints ?? []).flatMap((imprint) => [
        imprint.position,
        imprint.endPosition,
      ]),
      ...(context.activitySite ? [context.activitySite.position] : []),
      ...(context.sceneResolution
        ? [context.sceneResolution.combatDisturbance.position]
        : []),
    ];
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return {
      receiptId: context.sourceSceneReceiptId,
      position: {
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (Math.min(...ys) + Math.max(...ys)) / 2,
      },
    };
  }, [mapData]);

  const currentCharacter = characters.find(
    (c) => c.id === turnState.currentCharacterId,
  );
  // WorldForge samples keep a wider-world height offset. Normalize only the
  // player-facing map readout to the lowest tile in this crop; terrain geometry
  // and combat continue consuming the untouched source elevations.
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
  // The viewer policy is shared with the 3D map so light, darkness, and fog of
  // war do not accidentally choose different creatures in different renderers.
  const visibilityObserverSelection = selectVisibilityObserver({
    selectedCharacterId,
    currentCharacterId: turnState.currentCharacterId,
    characters,
  });
  const visibilityObserverId = visibilityObserverSelection.observerId;
  // The visibility hook expects a CombatState object because it is also used by
  // non-map callers. The 2D renderer only needs map, characters, and live light
  // sources, so this local bridge supplies those fields while preserving the
  // existing turn-manager ownership of active lights.
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
  // The map shortcut must represent a real direct attack, not the first item in
  // an arbitrary ability array. Preserve loadout order while skipping spells,
  // movement, cooldowns, depleted uses, and unaffordable attacks.
  const quickAttack = currentCharacter
    ? selectQuickAttack(currentCharacter.abilities, (cost) =>
        turnManager.canAffordAction(currentCharacter, cost),
      )
    : null;
  const quickAttackIsArmed = Boolean(
    abilitySystem.targetingMode &&
    quickAttack &&
    abilitySystem.selectedAbility?.id === quickAttack.id,
  );

  // --- OPTIMIZATION START ---
  // Memoize sets to reduce O(N) lookups in render loop and prevent re-calcs on mouse move
  // IMPROVEMENT OPPORTUNITY: Could implement spatial indexing for faster tile lookups
  // instead of linear searches through character arrays

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

  // 2. Active Path Set: Validates if a tile is in the current movement path
  const activePathSet = useMemo(() => {
    const set = new Set<string>();
    activePath.forEach((p) => set.add(p.id));
    return set;
  }, [activePath]);

  // Tiles adjacent to a living enemy (melee reach): stepping through or into
  // these provokes — the other half of the movement decision, shown as a red
  // hatch inside the reachable region.
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

  // Coordinate set of the reachable-move region, for drawing a crisp perimeter
  // stroke around its outer boundary (instead of a shapeless per-tile wash).
  const validMoveCoordSet = useMemo(() => {
    const set = new Set<string>();
    if (!mapData) return set;
    mapData.tiles.forEach((tile) => {
      if (validMoves.has(tile.id))
        set.add(`${tile.coordinates.x},${tile.coordinates.y}`);
    });
    return set;
  }, [mapData, validMoves]);

  // --- OPTIMIZATION END ---

  // Fit-to-container scaling. Procedural battle maps are frequently larger than
  // the center pane, so normal layouts show the whole framed board. If fitting
  // would make combatants too tiny to select, keep a usable minimum scale and
  // let the board scroll instead of shrinking the tactical surface into pixels.
  const fitWrapRef = useRef<HTMLDivElement>(null);
  const fitFrameRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
  // User zoom sits on top of auto-fit: null means "auto" (fit the pane, but
  // never below the usable minimum), a number is an explicit zoom the player
  // chose via the controls or mouse wheel.
  const [userZoom, setUserZoom] = useState<number | null>(null);
  // Production combat protects token usability with the 70% floor. Scenario
  // review can opt into a true fit so road/river continuity is visible before
  // the reviewer zooms into mechanics.
  const autoScale =
    preferFullMapFit || fitScale >= MIN_USABLE_BOARD_SCALE ? fitScale : 1;
  const boardScale = userZoom ?? autoScale;
  // Slack on the comparison: scrollbar appearance/disappearance nudges the
  // measured fit scale, so demand a real overshoot before switching the pane
  // into scroll mode (otherwise "Fit" can land left-anchored instead of centered).
  const isBoardScrollable = boardScale > fitScale * 1.02;
  useLayoutEffect(() => {
    const recompute = () => {
      const wrap = fitWrapRef.current;
      const frame = fitFrameRef.current;
      if (!wrap || !frame) return;
      const fw = frame.offsetWidth;
      const fh = frame.offsetHeight;
      if (fw === 0 || fh === 0) return;
      setFrameSize((prev) =>
        prev.w === fw && prev.h === fh ? prev : { w: fw, h: fh },
      );
      const s = Math.min(wrap.clientWidth / fw, wrap.clientHeight / fh, 1);
      setFitScale(s > 0 && Number.isFinite(s) ? s : 1);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    if (fitWrapRef.current) ro.observe(fitWrapRef.current);
    return () => ro.disconnect();
  }, [mapData?.dimensions.width, mapData?.dimensions.height]);
  const clampZoom = (z: number) => Math.min(3, Math.max(0.15, z));
  // Focal-point zoom: remember which CONTENT point sat under the anchor
  // (cursor or viewport center) so the scroll position can be corrected after
  // the scale changes — otherwise zooming on a large map flings the view away
  // from what the player was looking at.
  const zoomAnchorRef = useRef<{
    boardX: number;
    boardY: number;
    frameOffsetX: number;
    frameOffsetY: number;
    vx: number;
    vy: number;
  } | null>(null);
  // User zoom should keep the cursor's map point stable; this flag prevents
  // the active-combatant auto-center effect below from stealing that gesture.
  const skipCombatantCenterAfterZoomRef = useRef(false);
  // Each saved opening scene receives one establishing shot. Later turns return
  // to the normal active-combatant camera behavior instead of repeatedly
  // dragging the player back to the group midpoint.
  const openingSceneCenteredReceiptRef = useRef<string | null>(null);
  const boardScaleRef = useRef(boardScale);
  useLayoutEffect(() => {
    // Wheel handlers run outside React's render cycle, so they read the latest
    // committed board scale from this ref instead of from a stale closure.
    boardScaleRef.current = boardScale;
  }, [boardScale]);
  const zoomBy = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      const wrap = fitWrapRef.current;
      const frame = fitFrameRef.current;
      if (wrap && frame) {
        const wrapRect = wrap.getBoundingClientRect();
        const frameRect = frame.getBoundingClientRect();
        const vx =
          clientX !== undefined
            ? clientX - wrapRect.left
            : wrap.clientWidth / 2;
        const vy =
          clientY !== undefined
            ? clientY - wrapRect.top
            : wrap.clientHeight / 2;
        const scale = boardScaleRef.current;
        const frameOffsetX = wrap.scrollLeft + frameRect.left - wrapRect.left;
        const frameOffsetY = wrap.scrollTop + frameRect.top - wrapRect.top;
        zoomAnchorRef.current = {
          boardX: (wrap.scrollLeft + vx - frameOffsetX) / scale,
          boardY: (wrap.scrollTop + vy - frameOffsetY) / scale,
          frameOffsetX,
          frameOffsetY,
          vx,
          vy,
        };
      }
      setUserZoom((prev) =>
        clampZoom((prev ?? boardScaleRef.current) * factor),
      );
    },
    [],
  );
  const requestCameraCenter = useCallback((characterId: string) => {
    // Both the explicit React prop and the roster's browser event land here.
    // Resetting user zoom first means every roster focus click returns the map
    // to its automatic viewer level before scrolling to the requested token.
    setUserZoom(null);
    setPendingCameraCenterCharacterId(characterId);
  }, []);
  const centerBoardOnPosition = useCallback(
    (position: Position, viewportOffsetY = 0) => {
      if (!mapData || !fitWrapRef.current) return;

      const wrap = fitWrapRef.current;
      const targetLeft =
        (RULER_GUTTER_PX + position.x * TILE_SIZE_PX + TILE_SIZE_PX / 2) *
          boardScale -
        wrap.clientWidth / 2;
      const targetTop =
        (COLUMN_RULER_HEIGHT_PX +
          position.y * TILE_SIZE_PX +
          TILE_SIZE_PX / 2) *
          boardScale -
        wrap.clientHeight / 2 -
        viewportOffsetY;

      // Camera centering is scroll-based in the 2D tactical board. Keeping the
      // math in one helper makes roster focus and turn-start focus land on the
      // same tile center instead of drifting by a gutter or ruler offset.
      window.requestAnimationFrame(() => {
        wrap.scrollTo({
          left: Math.max(0, targetLeft),
          top: Math.max(0, targetTop),
        });
      });
    },
    [boardScale, mapData],
  );
  const centerBoardOnCharacter = useCallback(
    (character: CombatCharacter) => {
      centerBoardOnPosition(character.position);
    },
    [centerBoardOnPosition],
  );
  useEffect(() => {
    if (!cameraFocusRequest) return;
    requestCameraCenter(cameraFocusRequest.characterId);
  }, [cameraFocusRequest, requestCameraCenter]);
  useEffect(() => {
    const handleRosterCameraRequest = (event: Event) => {
      const characterId = (event as CustomEvent<{ characterId?: string }>)
        .detail?.characterId;
      if (characterId) requestCameraCenter(characterId);
    };

    window.addEventListener(
      "aralia:battle-map-center-character",
      handleRosterCameraRequest,
    );
    return () =>
      window.removeEventListener(
        "aralia:battle-map-center-character",
        handleRosterCameraRequest,
      );
  }, [requestCameraCenter]);
  useLayoutEffect(() => {
    const wrap = fitWrapRef.current;
    const anchor = zoomAnchorRef.current;
    if (!wrap || !anchor) return;
    zoomAnchorRef.current = null;
    wrap.scrollLeft =
      anchor.frameOffsetX + anchor.boardX * boardScale - anchor.vx;
    wrap.scrollTop =
      anchor.frameOffsetY + anchor.boardY * boardScale - anchor.vy;
    skipCombatantCenterAfterZoomRef.current = true;
  }, [boardScale]);
  // Wheel zoom, anchored at the cursor. Attached natively because React's
  // onWheel is passive and cannot preventDefault the board or page scroll.
  useEffect(() => {
    const wrap = fitWrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY);
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, [zoomBy]);
  useLayoutEffect(() => {
    if (!pendingCameraCenterCharacterId) return;

    const requestedCharacter = characters.find(
      (character) => character.id === pendingCameraCenterCharacterId,
    );
    setPendingCameraCenterCharacterId(null);
    if (!requestedCharacter || !isBoardScrollable) return;

    // A roster focus click is an explicit camera command. Mark the next
    // active-combatant centering pass as handled so it does not immediately
    // pull the board back to whoever currently owns the turn.
    skipCombatantCenterAfterZoomRef.current = true;
    centerBoardOnCharacter(requestedCharacter);
  }, [
    centerBoardOnCharacter,
    characters,
    isBoardScrollable,
    pendingCameraCenterCharacterId,
  ]);
  useLayoutEffect(() => {
    // Leaving scroll mode (e.g. pressing Fit) must clear any leftover scroll
    // offset: overflow-hidden keeps the stale scroll position and would leave
    // the fitted board shifted out of view.
    if (
      !isBoardScrollable &&
      typeof fitWrapRef.current?.scrollTo === "function"
    ) {
      fitWrapRef.current.scrollTo(0, 0);
    }
    if (
      !mapData ||
      !isBoardScrollable ||
      !currentCharacter ||
      !fitWrapRef.current
    )
      return;

    // A wheel or zoom-button gesture has already corrected the scroll position
    // for the player's cursor/focal point, so do not recenter on the turn owner.
    if (skipCombatantCenterAfterZoomRef.current) {
      skipCombatantCenterAfterZoomRef.current = false;
      return;
    }

    // The first view of an opening encounter is an establishing shot. Center
    // the whole authored contact scene, including evidence, rather than making
    // the current hero look alone while monsters crowd a viewport edge.
    if (
      openingSceneCameraFocus &&
      openingSceneCenteredReceiptRef.current !==
        openingSceneCameraFocus.receiptId
    ) {
      openingSceneCenteredReceiptRef.current =
        openingSceneCameraFocus.receiptId;
      // Move the authored scene below the floating Move/Attack toolbar. The
      // board remains at the player's zoom level; only the scroll camera gains
      // a HUD-safe top inset so upper screens cannot be clipped on short maps.
      centerBoardOnPosition(openingSceneCameraFocus.position, 56);
      return;
    }

    // A scrollable tactical board should open on the active combatant, not the
    // empty top-left corner of a large generated map.
    centerBoardOnCharacter(currentCharacter);
  }, [
    centerBoardOnCharacter,
    centerBoardOnPosition,
    currentCharacter,
    isBoardScrollable,
    mapData,
    openingSceneCameraFocus,
  ]);

  if (!mapData) {
    return <div>Generating map...</div>;
  }

  // TODO #33(Ritualist): Implement ritual progress visualization in the map overlay or UI panel.
  // The 'activeRitual' state is now available in GameState. Render a progress bar if activeRitual is present and !isComplete.
  // Ensure the progress bar clearly shows interruption conditions (e.g., "Damage breaks concentration").
  return (
    <div
      id={UI_ID.BATTLE_MAP}
      data-testid={UI_ID.BATTLE_MAP}
      className="relative flex h-full w-full flex-col items-center justify-center"
    >
      {visibilityObserverSelection.sharedSenses && (
        <div
          className="absolute left-3 top-3 rounded-full border border-cyan-300/80 bg-slate-950/88 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.38)]"
          style={{ zIndex: Z_INDEX.COMBAT_OVERLAY }}
        >
          {/* This label makes the 2D map's observer switch legible. Without it,
              shared senses would silently change fog-of-war math while leaving
              the player unsure whether they are seeing from the caster or the familiar. */}
          Viewing through{" "}
          {visibilityObserverSelection.sharedSenses.observerName}
        </div>
      )}
      {abilitySystem.targetingMode && abilitySystem.targetValidationReason && (
        <div
          role="status"
          aria-live="polite"
          className="absolute left-3 top-16 max-w-[18rem] rounded border border-rose-300/70 bg-slate-950/90 px-3 py-2 text-xs font-semibold leading-snug text-rose-100 shadow-[0_0_16px_rgba(244,63,94,0.28)]"
          style={{ zIndex: Z_INDEX.COMBAT_OVERLAY }}
        >
          {abilitySystem.targetValidationReason}
        </div>
      )}
      {/* UI for current turn actions */}
      {currentCharacter && isCharacterTurn(currentCharacter.id) && (
        /* The painted ground and tile grid are rendered later in this file.
           Use the shared combat overlay layer explicitly so the toolbar stays
           visible and clickable instead of existing underneath those canvases. */
        <div
          data-testid="battle-map-command-toolbar"
          className="absolute left-3 top-3 flex gap-2 rounded-md border border-slate-600/70 bg-slate-950/80 p-1.5 shadow-lg backdrop-blur-sm"
          style={{ zIndex: Z_INDEX.COMBAT_OVERLAY }}
        >
          <button
            onClick={() => {
              // Switching back to movement should leave any half-started attack
              // targeting state behind; otherwise a later enemy click can still
              // behave like an ability target instead of a selection/move click.
              abilitySystem.cancelTargeting();
              setActionMode("move");
            }}
            type="button"
            aria-pressed={actionMode === "move"}
            aria-label="Move on the battle map"
            className={`inline-flex h-9 items-center gap-1.5 rounded px-3 text-xs font-semibold transition-colors ${actionMode === "move" ? "bg-blue-600 text-white ring-2 ring-blue-300" : "bg-gray-600 hover:bg-gray-500"}`}
          >
            <Footprints size={14} aria-hidden="true" />
            <span>Move</span>
          </button>
          <button
            onClick={() => {
              // Pressing the armed shortcut again mirrors the ability palette's
              // cancel behavior, keeping both command origins consistent.
              if (quickAttackIsArmed) {
                abilitySystem.cancelTargeting();
                setActionMode("move");
                return;
              }

              // The shortcut disables when no honest direct attack is ready,
              // instead of arming a movement, utility, or unavailable ability.
              if (!currentCharacter || !quickAttack) return;
              setActionMode("ability");
              abilitySystem.startTargeting(quickAttack, currentCharacter);
            }}
            type="button"
            disabled={!quickAttack}
            aria-pressed={quickAttackIsArmed}
            aria-label={
              quickAttack
                ? `Attack with ${quickAttack.name}`
                : "No direct attack available"
            }
            title={
              quickAttack
                ? `Attack with ${quickAttack.name}`
                : "No direct action attack is ready"
            }
            className={`inline-flex h-9 items-center gap-1.5 rounded px-3 text-xs font-semibold transition-colors ${!quickAttack ? "bg-gray-600 text-gray-400 cursor-not-allowed" : quickAttackIsArmed ? "bg-red-600 text-white ring-2 ring-red-300" : "bg-gray-600 hover:bg-gray-500"}`}
          >
            <Swords size={14} aria-hidden="true" />
            <span>Attack</span>
          </button>
        </div>
      )}

      {/* Gold-framed grid with spreadsheet rulers (A–P down, 1–20 across) and a
          legend, matching the tactical battle-map mockup. The frame is scaled to
          fit its pane so the whole board stays in view. */}
      <div
        ref={fitWrapRef}
        className={`relative flex min-h-0 w-full flex-1 ${
          isBoardScrollable
            ? "items-start justify-start overflow-auto"
            : "items-center justify-center overflow-hidden"
        }`}
      >
        {/* The spacer always takes the SCALED footprint: it gives the wrap real
          scrollbars when zoomed past the pane (a CSS transform alone does not
          affect scroll layout) and a correctly-sized box to flex-center when
          the board fits. */}
        <div
          style={
            frameSize.w > 0
              ? // overflow hidden: at scale<1 the frame's UNSCALED layout box would
                // otherwise leak past the spacer into the wrap's scroll extent,
                // letting the user scroll into empty space beyond the visual board.
                {
                  width: frameSize.w * boardScale,
                  height: frameSize.h * boardScale,
                  flexShrink: 0,
                  minWidth: 0,
                  minHeight: 0,
                  overflow: "hidden",
                }
              : undefined
          }
        >
          <div
            ref={fitFrameRef}
            style={{
              transform: `scale(${boardScale})`,
              transformOrigin: "top left",
            }}
            className="inline-block rounded-xl border-2 border-amber-800/50 bg-slate-950/70 p-2 shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
          >
            {/* Column ruler */}
            <div className="flex" style={{ paddingLeft: RULER_GUTTER_PX }}>
              {Array.from({ length: mapData.dimensions.width }).map((_, i) => (
                <div
                  key={`col-${i}`}
                  style={{ width: TILE_SIZE_PX }}
                  className="text-center text-[10px] font-semibold leading-4 text-amber-200/50"
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <div className="flex">
              {/* Row ruler */}
              <div className="flex flex-col" style={{ width: RULER_GUTTER_PX }}>
                {Array.from({ length: mapData.dimensions.height }).map(
                  (_, i) => (
                    <div
                      key={`row-${i}`}
                      style={{ height: TILE_SIZE_PX }}
                      className="flex items-center justify-center text-[10px] font-semibold text-amber-200/50"
                    >
                      {rowLabel(i)}
                    </div>
                  ),
                )}
              </div>
              <div
                className={`battle-map-container relative ${abilitySystem.targetingMode ? "cursor-crosshair" : ""}`}
                style={{
                  width: `${mapData.dimensions.width * TILE_SIZE_PX + 2}px`,
                  height: `${mapData.dimensions.height * TILE_SIZE_PX + 2}px`,
                }}
              >
                {/* Painted forest ground beneath the interactive grid. */}
                <BattleMapGroundCanvas
                  mapData={mapData}
                  tileSize={TILE_SIZE_PX}
                  showDecorations={assetOverlayVisible}
                  className="pointer-events-none absolute inset-0 h-full w-full"
                />
                {/* Soft fog-of-war above the tiles, below the tokens: the same
            visibility data as before, feathered into light pools instead of
            per-tile black squares. */}
                <BattleMapFogCanvas
                  mapData={mapData}
                  tileSize={TILE_SIZE_PX}
                  visibleTiles={visibility.visibleTiles}
                  getLightLevel={visibility.getLightLevel}
                  className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
                />
                <div
                  className="battle-map-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${mapData.dimensions.width}, ${TILE_SIZE_PX}px)`,
                    gridTemplateRows: `repeat(${mapData.dimensions.height}, ${TILE_SIZE_PX}px)`,
                    position: "relative",
                    zIndex: 1,
                    border: "1px solid #4A5568",
                  }}
                >
                  {tileArray.map((tile) => {
                    // Optimised lookups using Sets (O(1)) instead of Array searches/Calculations (O(N))
                    // IMPROVEMENT OPPORTUNITY: Implement viewport culling to skip rendering
                    // off-screen tiles entirely - could reduce render load by 60-80% in large maps
                    const isTargetable = validTargetSet.has(tile.id);
                    const isAoePreview = aoeSet.has(tile.id);
                    const isTeleportDestinationPreview =
                      teleportDestinationSet.has(tile.id);
                    const isVisible = visibility.visibleTiles.has(tile.id);
                    const lightLevel = visibility.getLightLevel(tile.id);
                    const isValidMove =
                      actionMode === "move" && validMoves.has(tile.id);
                    const isInPath = activePathSet.has(tile.id);
                    const isObjectMoveDestination = Boolean(
                      activeObject && !tile.blocksMovement,
                    );
                    const { x: tx, y: ty } = tile.coordinates;
                    const moveEdges = isValidMove
                      ? {
                          top: !validMoveCoordSet.has(`${tx},${ty - 1}`),
                          right: !validMoveCoordSet.has(`${tx + 1},${ty}`),
                          bottom: !validMoveCoordSet.has(`${tx},${ty + 1}`),
                          left: !validMoveCoordSet.has(`${tx - 1},${ty}`),
                        }
                      : undefined;

                    return (
                      <BattleMapTile
                        key={tile.id}
                        tile={tile}
                        isValidMove={isValidMove}
                        moveEdges={moveEdges}
                        isThreatened={
                          isValidMove && threatCoordSet.has(`${tx},${ty}`)
                        }
                        isInPath={isInPath}
                        isTargetable={isTargetable}
                        isAoePreview={isAoePreview}
                        isTeleportDestinationPreview={
                          isTeleportDestinationPreview
                        }
                        isObjectMoveDestination={isObjectMoveDestination}
                        isVisible={isVisible}
                        lightLevel={lightLevel}
                        showCoverLabel={showCoverLabels}
                        elevationReference={elevationReference}
                        mapBaselineElevation={elevationBaseline}
                        targetingMode={abilitySystem.targetingMode}
                        onTileClick={handleObjectAwareTileClick}
                        onTileHover={handleTileHover}
                      />
                    );
                  })}

                  {/* The scenario lab can reveal the object registry as a dedicated
              review layer. Transparent rings preserve the underlying art while
              cyan circles identify natural features and amber diamonds identify
              catalog props; normal combat leaves this layer disabled. */}
                  {showTargetableObjectFacts &&
                    (mapData.targetableObjects ?? []).map((targetObject) => {
                      const sourceKind = targetObject.source?.kind;
                      const isProp = sourceKind === "worldforge-prop";
                      return (
                        <div
                          key={`targetable-object-fact-${targetObject.id}`}
                          data-testid="targetable-object-fact-marker"
                          data-source-kind={sourceKind ?? "unclassified"}
                          title={`Target fact: ${targetObject.name}`}
                          className={`pointer-events-none absolute z-[8] h-5 w-5 -translate-x-1/2 -translate-y-1/2 border-2 shadow-[0_0_7px_rgba(0,0,0,0.85)] ${
                            isProp
                              ? "rotate-45 rounded-sm border-amber-300 bg-amber-500/10"
                              : "rounded-full border-cyan-300 bg-cyan-500/10"
                          }`}
                          style={{
                            left:
                              targetObject.position.x * TILE_SIZE_PX +
                              TILE_SIZE_PX / 2,
                            top:
                              targetObject.position.y * TILE_SIZE_PX +
                              TILE_SIZE_PX / 2,
                          }}
                        >
                          <span
                            className={`absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                              isProp ? "bg-amber-100" : "bg-cyan-100"
                            }`}
                          />
                        </div>
                      );
                    })}

                  {/* Occupants are ambient source facts rather than combat tokens. The
              violet grouped marker distinguishes them from blue/red combatants
              and keeps dense households readable without discarding identity. */}
                  {showWorldOccupants &&
                    worldOccupantGroups.map((group) => {
                      const movingCount = group.occupants.filter(
                        (occupant) => occupant.moving,
                      ).length;
                      const names = group.occupants.map(
                        (occupant) => occupant.name,
                      );
                      const summary =
                        names.length > 3
                          ? `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`
                          : names.join(", ");
                      return (
                        <div
                          key={`world-occupants-${group.position.x}-${group.position.y}`}
                          data-testid="world-occupant-marker"
                          data-occupant-count={group.occupants.length}
                          data-moving-count={movingCount}
                          aria-label={`${group.occupants.length} source resident${group.occupants.length === 1 ? "" : "s"}: ${summary}`}
                          title={summary}
                          className={`pointer-events-none absolute z-[12] flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-violet-950/90 text-violet-100 shadow-[0_0_8px_rgba(0,0,0,0.95)] ${
                            movingCount > 0
                              ? "border-fuchsia-300 ring-1 ring-fuchsia-300/60"
                              : "border-violet-300"
                          }`}
                          style={{
                            left:
                              group.position.x * TILE_SIZE_PX +
                              TILE_SIZE_PX / 2,
                            top:
                              group.position.y * TILE_SIZE_PX +
                              TILE_SIZE_PX / 2,
                          }}
                        >
                          <UsersRound
                            size={11}
                            strokeWidth={2.5}
                            aria-hidden="true"
                          />
                          {group.occupants.length > 1 && (
                            <span className="absolute -right-1.5 -top-1.5 flex min-h-3 min-w-3 items-center justify-center rounded-full border border-violet-100 bg-violet-500 px-0.5 text-[7px] font-black leading-none text-white">
                              {group.occupants.length}
                            </span>
                          )}
                        </div>
                      );
                    })}

                  {/* Occupation imprints sit below actors and loose objects because
              they are deformation of the source ground itself. Their anchors,
              directions, and extents come from the saved scene receipt; this
              renderer only turns those facts into soil, furrows, and refuse. */}
                  {mapData.encounterContext?.kind === "opening-standoff" &&
                    mapData.encounterContext.terrainImprints?.length && (
                      <svg
                        data-testid="opening-terrain-imprints"
                        className="pointer-events-none absolute left-0 top-0 z-[9] overflow-visible"
                        width={mapData.dimensions.width * TILE_SIZE_PX}
                        height={mapData.dimensions.height * TILE_SIZE_PX}
                        aria-label="Source-authored monster occupation imprints"
                      >
                        {mapData.encounterContext.terrainImprints.map(
                          (imprint) => {
                            const start = {
                              x:
                                imprint.position.x * TILE_SIZE_PX +
                                TILE_SIZE_PX / 2,
                              y:
                                imprint.position.y * TILE_SIZE_PX +
                                TILE_SIZE_PX / 2,
                            };
                            const end = {
                              x:
                                imprint.endPosition.x * TILE_SIZE_PX +
                                TILE_SIZE_PX / 2,
                              y:
                                imprint.endPosition.y * TILE_SIZE_PX +
                                TILE_SIZE_PX / 2,
                            };
                            const rotation =
                              Math.atan2(
                                imprint.direction.y,
                                imprint.direction.x,
                              ) *
                              (180 / Math.PI);
                            const halfLength =
                              (imprint.extentCells.length * TILE_SIZE_PX) / 2;
                            const halfWidth =
                              (imprint.extentCells.width * TILE_SIZE_PX) / 2;
                            const tangent = {
                              x: -imprint.direction.y,
                              y: imprint.direction.x,
                            };
                            const furrowOffset =
                              imprint.extentCells.width * TILE_SIZE_PX * 0.22;
                            const routeMidpoint = {
                              x:
                                (start.x + end.x) / 2 +
                                tangent.x * TILE_SIZE_PX * 0.4,
                              y:
                                (start.y + end.y) / 2 +
                                tangent.y * TILE_SIZE_PX * 0.4,
                            };
                            return (
                              <g
                                key={imprint.id}
                                data-testid="opening-terrain-imprint"
                                data-imprint-kind={imprint.kind}
                                data-imprint-age={imprint.ageBand}
                                aria-label={imprint.label}
                              >
                                <title>{imprint.label}</title>
                                {imprint.kind === "flattened-ground" && (
                                  <g
                                    transform={`translate(${start.x} ${start.y}) rotate(${rotation})`}
                                  >
                                    <path
                                      d={`M ${-halfLength * 0.94} ${-halfWidth * 0.18} Q ${-halfLength * 0.62} ${-halfWidth * 0.92} 0 ${-halfWidth * 0.78} Q ${halfLength * 0.82} ${-halfWidth * 0.7} ${halfLength * 0.96} ${halfWidth * 0.08} Q ${halfLength * 0.68} ${halfWidth * 0.88} ${-halfLength * 0.08} ${halfWidth * 0.74} Q ${-halfLength * 0.82} ${halfWidth * 0.66} ${-halfLength * 0.94} ${-halfWidth * 0.18} Z`}
                                      fill="rgba(91, 70, 43, 0.38)"
                                      stroke="rgba(170, 132, 79, 0.28)"
                                      strokeWidth="1.2"
                                    />
                                    <path
                                      d={`M ${-halfLength * 0.7} ${-halfWidth * 0.26} Q 0 ${-halfWidth * 0.58} ${halfLength * 0.72} ${-halfWidth * 0.12} M ${-halfLength * 0.6} ${halfWidth * 0.28} Q 0 ${halfWidth * 0.52} ${halfLength * 0.65} ${halfWidth * 0.18}`}
                                      fill="none"
                                      stroke="rgba(190, 145, 83, 0.27)"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                    />
                                    {[
                                      [-0.7, -0.38, 5, 2, -18],
                                      [-0.42, 0.42, 4, 1.8, 22],
                                      [-0.08, -0.48, 5.5, 2.2, 8],
                                      [0.28, 0.38, 4.5, 1.8, -12],
                                      [0.62, -0.3, 5, 2, 28],
                                      [0.75, 0.25, 3.8, 1.6, -30],
                                    ].map(
                                      (
                                        [
                                          xFactor,
                                          yFactor,
                                          radiusX,
                                          radiusY,
                                          leafRotation,
                                        ],
                                        index,
                                      ) => (
                                        <ellipse
                                          key={`${imprint.id}:leaf-litter:${index}`}
                                          cx={halfLength * xFactor}
                                          cy={halfWidth * yFactor}
                                          rx={radiusX}
                                          ry={radiusY}
                                          transform={`rotate(${leafRotation} ${halfLength * xFactor} ${halfWidth * yFactor})`}
                                          fill={
                                            index % 2 === 0
                                              ? "rgba(150, 111, 61, 0.55)"
                                              : "rgba(104, 82, 47, 0.62)"
                                          }
                                        />
                                      ),
                                    )}
                                  </g>
                                )}
                                {imprint.kind === "trampled-run" && (
                                  <>
                                    <path
                                      d={`M ${start.x} ${start.y} Q ${routeMidpoint.x} ${routeMidpoint.y} ${end.x} ${end.y}`}
                                      fill="none"
                                      stroke="rgba(91, 66, 38, 0.38)"
                                      strokeWidth={Math.max(
                                        8,
                                        imprint.extentCells.width *
                                          TILE_SIZE_PX *
                                          0.66,
                                      )}
                                      strokeLinecap="round"
                                    />
                                    <path
                                      d={`M ${start.x} ${start.y} Q ${routeMidpoint.x} ${routeMidpoint.y} ${end.x} ${end.y}`}
                                      fill="none"
                                      stroke="rgba(170, 126, 70, 0.24)"
                                      strokeWidth={2.2}
                                      strokeLinecap="round"
                                    />
                                  </>
                                )}
                                {imprint.kind === "drag-furrow" && (
                                  <>
                                    {[-1, 1].map((side) => (
                                      <path
                                        key={`${imprint.id}:furrow:${side}`}
                                        d={`M ${start.x + tangent.x * furrowOffset * side} ${start.y + tangent.y * furrowOffset * side} Q ${routeMidpoint.x + tangent.x * furrowOffset * side * 0.7} ${routeMidpoint.y + tangent.y * furrowOffset * side * 0.7} ${end.x + tangent.x * furrowOffset * side} ${end.y + tangent.y * furrowOffset * side}`}
                                        fill="none"
                                        stroke="rgba(89, 59, 31, 0.68)"
                                        strokeWidth={2.2}
                                        strokeLinecap="round"
                                      />
                                    ))}
                                    <path
                                      d={`M ${start.x} ${start.y} Q ${routeMidpoint.x} ${routeMidpoint.y} ${end.x} ${end.y}`}
                                      fill="none"
                                      stroke="rgba(171, 128, 75, 0.24)"
                                      strokeWidth={1.2}
                                      strokeLinecap="round"
                                    />
                                  </>
                                )}
                                {imprint.kind === "refuse-scatter" && (
                                  <g
                                    transform={`translate(${start.x} ${start.y}) rotate(${rotation})`}
                                  >
                                    <path
                                      d="M -13 -5 l 7 -3 l 2 5 l -7 3 Z"
                                      fill="#80603b"
                                      stroke="#2a1d13"
                                      strokeWidth="1"
                                    />
                                    <path
                                      d="M 4 -9 l 9 3 l -2 4 l -8 -2 Z"
                                      fill="#5f472f"
                                      stroke="#241911"
                                      strokeWidth="1"
                                    />
                                    <path
                                      d="M -4 5 l 10 -1 l 1 3 l -9 2 Z"
                                      fill="#a17a48"
                                      stroke="#2c1e13"
                                      strokeWidth="1"
                                    />
                                    <circle
                                      cx="13"
                                      cy="7"
                                      r="2.7"
                                      fill="#d0b27d"
                                      stroke="#35271b"
                                      strokeWidth="1"
                                    />
                                    <circle
                                      cx="-15"
                                      cy="8"
                                      r="2"
                                      fill="#b99865"
                                      stroke="#35271b"
                                      strokeWidth="1"
                                    />
                                  </g>
                                )}
                              </g>
                            );
                          },
                        )}
                      </svg>
                    )}

                  {/* Combat churn is outcome memory, not a generic blood decal.
              Its center, direction, size, severity, and creature identities all
              come from the resolved receipt. Irregular soil and dragged leaf
              litter make the result physical without claiming confirmed deaths. */}
                  {mapData.encounterContext?.kind === "opening-standoff" &&
                    mapData.encounterContext.sceneResolution &&
                    (() => {
                      const disturbance =
                        mapData.encounterContext.sceneResolution
                          .combatDisturbance;
                      const center = {
                        x:
                          disturbance.position.x * TILE_SIZE_PX +
                          TILE_SIZE_PX / 2,
                        y:
                          disturbance.position.y * TILE_SIZE_PX +
                          TILE_SIZE_PX / 2,
                      };
                      const halfLength =
                        (disturbance.extentCells.length * TILE_SIZE_PX) / 2;
                      const halfWidth =
                        (disturbance.extentCells.width * TILE_SIZE_PX) / 2;
                      const rotation =
                        Math.atan2(
                          disturbance.direction.y,
                          disturbance.direction.x,
                        ) *
                        (180 / Math.PI);
                      return (
                        <svg
                          data-testid="opening-combat-disturbance"
                          data-disturbance-severity={disturbance.severity}
                          className="pointer-events-none absolute left-0 top-0 z-[10] overflow-visible"
                          width={mapData.dimensions.width * TILE_SIZE_PX}
                          height={mapData.dimensions.height * TILE_SIZE_PX}
                          aria-label="Source-authored combat disturbance"
                        >
                          <g
                            transform={`translate(${center.x} ${center.y}) rotate(${rotation})`}
                          >
                            <path
                              d={`M ${-halfLength} ${-halfWidth * 0.12} Q ${-halfLength * 0.66} ${-halfWidth * 0.9} ${-halfLength * 0.12} ${-halfWidth * 0.7} Q ${halfLength * 0.5} ${-halfWidth} ${halfLength} ${-halfWidth * 0.16} Q ${halfLength * 0.72} ${halfWidth * 0.78} ${halfLength * 0.08} ${halfWidth * 0.66} Q ${-halfLength * 0.58} ${halfWidth} ${-halfLength} ${-halfWidth * 0.12} Z`}
                              fill="rgba(65, 43, 30, 0.1)"
                              stroke="rgba(185, 132, 79, 0.2)"
                              strokeWidth="0.8"
                            />
                            {[
                              { along: -0.58, across: -0.18, scale: 0.32 },
                              { along: -0.08, across: 0.22, scale: 0.38 },
                              { along: 0.52, across: -0.12, scale: 0.3 },
                            ].map((patch, index) => {
                              const patchLength = halfLength * patch.scale;
                              const patchWidth =
                                halfWidth * (0.52 + (index % 2) * 0.16);
                              return (
                                <g
                                  key={`combat-churn-patch-${index}`}
                                  transform={`translate(${halfLength * patch.along} ${halfWidth * patch.across}) rotate(${index === 1 ? 12 : index === 2 ? -9 : -18})`}
                                >
                                  <path
                                    d={`M ${-patchLength} ${-patchWidth * 0.1} Q ${-patchLength * 0.48} ${-patchWidth} ${patchLength * 0.12} ${-patchWidth * 0.68} Q ${patchLength} ${-patchWidth * 0.42} ${patchLength * 0.82} ${patchWidth * 0.42} Q ${patchLength * 0.18} ${patchWidth} ${-patchLength * 0.72} ${patchWidth * 0.62} Z`}
                                    fill={
                                      disturbance.severity === "heavy"
                                        ? "rgba(66, 40, 28, 0.55)"
                                        : "rgba(76, 53, 35, 0.42)"
                                    }
                                    stroke="rgba(176, 126, 75, 0.28)"
                                    strokeWidth="0.8"
                                  />
                                  <path
                                    d={`M ${-patchLength * 0.7} ${patchWidth * 0.18} Q 0 ${-patchWidth * 0.46} ${patchLength * 0.68} ${patchWidth * 0.08}`}
                                    fill="none"
                                    stroke="rgba(207, 160, 101, 0.32)"
                                    strokeLinecap="round"
                                    strokeWidth="1"
                                  />
                                </g>
                              );
                            })}
                            <path
                              d={`M ${-halfLength * 0.82} ${-halfWidth * 0.24} Q ${-halfLength * 0.22} ${halfWidth * 0.42} ${halfLength * 0.72} ${-halfWidth * 0.3} M ${-halfLength * 0.58} ${halfWidth * 0.44} Q 0 ${-halfWidth * 0.42} ${halfLength * 0.84} ${halfWidth * 0.22}`}
                              fill="none"
                              stroke="rgba(211, 169, 111, 0.28)"
                              strokeLinecap="round"
                              strokeWidth="1.4"
                            />
                            {[-0.72, -0.28, 0.18, 0.62].map((offset, index) => (
                              <ellipse
                                key={`combat-churn-scuff-${index}`}
                                cx={halfLength * offset}
                                cy={
                                  (index % 2 === 0 ? -1 : 1) * halfWidth * 0.38
                                }
                                rx={4.5 + (index % 2) * 1.5}
                                ry={2.2}
                                fill="rgba(42, 28, 20, 0.72)"
                                transform={`rotate(${index % 2 === 0 ? -18 : 24} ${halfLength * offset} ${(index % 2 === 0 ? -1 : 1) * halfWidth * 0.38})`}
                              />
                            ))}
                          </g>
                        </svg>
                      );
                    })()}

                  {/* The opening activity site is physical source evidence, not another
              status badge. Muted bedding, a container, and remains form one
              ground-level silhouette behind the contact line; the receipt owns
              its contents and exact world position across repeated visits. */}
                  {mapData.encounterContext?.kind === "opening-standoff" &&
                    mapData.encounterContext.activitySite &&
                    (() => {
                      const site = mapData.encounterContext.activitySite;
                      const siteCondition =
                        mapData.encounterContext.sceneResolution
                          ?.activitySiteCondition;
                      const abandoned = siteCondition === "abandoned-disturbed";
                      const hasRemains =
                        site.contents.includes("gnawed-remains");
                      return (
                        <div
                          key={site.id}
                          data-testid="opening-monster-site"
                          data-site-kind={site.kind}
                          data-site-age={site.ageBand}
                          data-site-condition={siteCondition ?? "occupied"}
                          aria-label={`${site.label}; ${siteCondition ?? "occupied"} WorldForge activity site`}
                          title={site.label}
                          className="pointer-events-none absolute z-[11] h-10 w-11"
                          style={{
                            left:
                              site.position.x * TILE_SIZE_PX + TILE_SIZE_PX / 2,
                            top:
                              site.position.y * TILE_SIZE_PX + TILE_SIZE_PX / 2,
                            transform: `translate(-50%, -50%) scale(${1 / Math.max(boardScale, 0.65)})`,
                            transformOrigin: "center",
                          }}
                        >
                          {site.kind === "claimed-cache" ? (
                            <>
                              <span
                                className={`absolute bottom-0 left-0.5 h-6 w-10 bg-[#777b68]/90 shadow-[0_3px_5px_rgba(0,0,0,0.9)] ${abandoned ? "rotate-[14deg] -translate-x-1" : "-rotate-6"}`}
                                style={{
                                  clipPath:
                                    "polygon(5% 22%, 73% 5%, 100% 31%, 88% 90%, 27% 100%, 0 70%)",
                                }}
                              />
                              <span
                                className={`absolute bottom-2 left-1 h-2.5 w-4 rounded-full border border-stone-900 bg-emerald-950 shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${abandoned ? "-translate-x-2 rotate-[26deg]" : "-rotate-12"}`}
                              >
                                <span className="absolute right-0 top-0 h-full w-1 rounded-full bg-stone-500/80" />
                              </span>
                              <span
                                className={`absolute bottom-2 left-4 h-4 w-6 border border-stone-950 bg-[#875835] shadow-[0_2px_3px_rgba(0,0,0,0.9)] ${abandoned ? "translate-x-1 rotate-[24deg]" : "rotate-3"}`}
                              >
                                <span className="absolute left-1/3 top-0 h-full w-px bg-amber-200/35" />
                                <span className="absolute right-1/3 top-0 h-full w-px bg-amber-200/35" />
                                <span className="absolute left-0 top-1/2 h-px w-full bg-stone-950/70" />
                              </span>
                              <span
                                className={`absolute bottom-[1.35rem] left-[0.95rem] h-1.5 w-6 border border-stone-950 bg-[#8a5b35] shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${abandoned ? "-translate-y-2 translate-x-2 rotate-[38deg]" : "-rotate-6"}`}
                              />
                            </>
                          ) : site.kind === "feeding-site" ? (
                            <>
                              <span className="absolute bottom-1 left-1 h-7 w-9 -rotate-6 rounded-[45%] bg-red-950/45 shadow-[inset_0_0_8px_rgba(0,0,0,0.85)]" />
                              <Bone
                                className="absolute bottom-2 left-2 -rotate-[28deg] text-stone-200 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]"
                                size={20}
                                strokeWidth={2.25}
                                aria-hidden="true"
                              />
                              <Bone
                                className="absolute bottom-1 right-1 rotate-[32deg] text-stone-300 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]"
                                size={17}
                                strokeWidth={2.25}
                                aria-hidden="true"
                              />
                            </>
                          ) : (
                            <>
                              <span className="absolute bottom-1 left-1 h-8 w-9 -rotate-6 rounded-[48%] border border-emerald-950/80 bg-emerald-950/45 shadow-[inset_0_0_8px_rgba(0,0,0,0.9)]" />
                              <Leaf
                                className="absolute bottom-2 left-2 -rotate-[28deg] text-emerald-200/85 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]"
                                size={20}
                                strokeWidth={1.8}
                                aria-hidden="true"
                              />
                              <Leaf
                                className="absolute bottom-1 right-1 rotate-[35deg] text-lime-200/70 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]"
                                size={15}
                                strokeWidth={1.8}
                                aria-hidden="true"
                              />
                            </>
                          )}
                          {hasRemains && site.kind !== "feeding-site" && (
                            <Bone
                              className="absolute -right-0.5 bottom-0.5 rotate-[24deg] text-stone-200 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]"
                              size={16}
                              strokeWidth={2.25}
                              aria-hidden="true"
                            />
                          )}
                          {abandoned && (
                            <>
                              <span className="absolute -bottom-0.5 -left-1 h-px w-5 rotate-[28deg] bg-amber-200/65 shadow-[0_1px_1px_rgba(0,0,0,0.9)]" />
                              <span className="absolute -right-1 bottom-1 h-1.5 w-2.5 -rotate-[18deg] bg-[#6e4b2d] shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
                              <span className="absolute right-1 top-0 h-1 w-2 rotate-[34deg] bg-stone-400/80 shadow-[0_1px_1px_rgba(0,0,0,0.9)]" />
                            </>
                          )}
                        </div>
                      );
                    })()}

                  {/* The source trail is rendered as small alternating impressions in
              churned soil, not a dashed UI connector. Interpolation only fills
              the line between saved trace anchors; it does not author new
              evidence or extend beyond the exact contact-scene facts. */}
                  {openingTrackMarks.length > 0 && mapData && (
                    <svg
                      data-testid="opening-track-trail"
                      className="pointer-events-none absolute left-0 top-0 z-[12] overflow-visible"
                      width={mapData.dimensions.width * TILE_SIZE_PX}
                      height={mapData.dimensions.height * TILE_SIZE_PX}
                      aria-hidden="true"
                    >
                      {openingTrackMarks.map((mark, index) => (
                        <g
                          key={`opening-track-mark-${index}`}
                          transform={`translate(${mark.x * TILE_SIZE_PX + TILE_SIZE_PX / 2} ${mark.y * TILE_SIZE_PX + TILE_SIZE_PX / 2}) rotate(${mark.rotation})`}
                        >
                          <ellipse
                            cx={mark.side * 2.4}
                            cy="-2.5"
                            rx="2.1"
                            ry="3.9"
                            fill="rgba(148, 107, 59, 0.88)"
                            stroke="rgba(38,25,15,0.72)"
                            strokeWidth="0.7"
                          />
                          <ellipse
                            cx={mark.side * -2}
                            cy="4"
                            rx="1.9"
                            ry="3.5"
                            fill="rgba(126, 87, 46, 0.88)"
                            stroke="rgba(38,25,15,0.72)"
                            strokeWidth="0.7"
                          />
                        </g>
                      ))}
                    </svg>
                  )}

                  {/* Trace anchors use physical marks instead of abstract field-sign
              icons: paired impressions, scratched soil, and broken stems. */}
                  {mapData.encounterContext?.kind === "opening-standoff" &&
                    mapData.encounterContext.ecologicalTraces.map((trace) => {
                      const isTrack = trace.kind === "tracks";
                      const isScrape =
                        trace.kind === "scent-mark" ||
                        trace.kind === "territorial-scrape";
                      return (
                        <div
                          key={trace.id}
                          data-testid="opening-ecological-trace"
                          data-trace-kind={trace.kind}
                          data-trace-age={trace.ageBand ?? "unknown"}
                          aria-label={trace.label}
                          title={trace.label}
                          className={`pointer-events-none absolute z-[13] h-6 w-6 ${trace.ageBand === "weathered" ? "opacity-55" : trace.ageBand === "recent" ? "opacity-80" : "opacity-100"}`}
                          style={{
                            left:
                              trace.position.x * TILE_SIZE_PX +
                              TILE_SIZE_PX / 2,
                            top:
                              trace.position.y * TILE_SIZE_PX +
                              TILE_SIZE_PX / 2,
                            transform: `translate(-50%, -50%) scale(${1 / Math.max(boardScale, 0.65)})`,
                          }}
                        >
                          {isTrack ? (
                            <>
                              <span className="absolute left-[6px] top-[3px] h-2.5 w-1.5 -rotate-12 rounded-[55%] bg-[#2c1c11] shadow-[0_1px_1px_rgba(205,160,93,0.25)]" />
                              <span className="absolute bottom-[3px] right-[6px] h-2.5 w-1.5 rotate-12 rounded-[55%] bg-[#3c2818] shadow-[0_1px_1px_rgba(205,160,93,0.22)]" />
                            </>
                          ) : isScrape ? (
                            <>
                              <span className="absolute left-1 top-1 h-px w-4 rotate-[18deg] bg-[#c09254]/70 shadow-[0_1px_1px_rgba(0,0,0,0.9)]" />
                              <span className="absolute left-1 top-2.5 h-px w-4 rotate-[12deg] bg-[#9e7040]/75 shadow-[0_1px_1px_rgba(0,0,0,0.9)]" />
                              <span className="absolute left-1 top-4 h-px w-3.5 rotate-[7deg] bg-[#79502c]/80 shadow-[0_1px_1px_rgba(0,0,0,0.9)]" />
                              <span className="absolute bottom-0.5 right-1 h-1.5 w-3 rounded-[50%] bg-[#402818]/75" />
                            </>
                          ) : (
                            <>
                              <span className="absolute left-2 top-0 h-5 w-0.5 rotate-[38deg] bg-[#4f3822] shadow-[0_1px_1px_rgba(0,0,0,0.9)]" />
                              <span className="absolute right-2 top-1 h-5 w-0.5 -rotate-[32deg] bg-[#72502d] shadow-[0_1px_1px_rgba(0,0,0,0.9)]" />
                              <span className="absolute bottom-1 left-0.5 h-1.5 w-2.5 -rotate-12 rounded-[60%] bg-[#5d713b]/80" />
                              <span className="absolute right-0.5 top-1 h-1.5 w-2 rotate-12 rounded-[60%] bg-[#7d8b49]/70" />
                            </>
                          )}
                        </div>
                      );
                    })}

                  {/* A source-framed encounter needs one explicit visual receipt. The
              inverse scale keeps this marker readable at whole-map review zoom,
              while its tile anchor still follows the transformed board. */}
                  {encounterMarker && mapData.encounterContext && (
                    <div
                      data-testid="encounter-source-anchor"
                      aria-label={
                        mapData.encounterContext.kind === "opening-standoff"
                          ? `${encounterMarker.label}; marks the party's exact source-world position; arrow points toward the source-authored threat approach`
                          : `${encounterMarker.label}; arrow points from the exterior or near side toward the interior or far side`
                      }
                      className="pointer-events-none absolute z-[16]"
                      style={{
                        left:
                          mapData.encounterContext.anchorTile.x * TILE_SIZE_PX +
                          TILE_SIZE_PX / 2,
                        top:
                          mapData.encounterContext.anchorTile.y * TILE_SIZE_PX +
                          TILE_SIZE_PX / 2,
                        // Lift the fixed-size receipt above its exact tile so whole-map
                        // fit never hides the combat tokens deployed around the anchor.
                        // Live settlement interceptions start on the player's tile, so
                        // their receipt needs more clearance than a gate/crossing marker.
                        // Keep the anchor exact while moving only the label treatment.
                        transform: `translate(-50%, ${mapData.encounterContext.kind === "opening-standoff" || mapData.encounterContext.kind === "settlement-watch" || mapData.encounterContext.kind === "settlement-state-patrol" ? "-220%" : "-120%"}) scale(${1 / Math.max(boardScale, 0.01)})`,
                        transformOrigin: "center",
                      }}
                    >
                      <div
                        className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-[0_0_12px_rgba(0,0,0,0.9)] ${encounterMarker.className}`}
                      >
                        <MapPinned
                          size={15}
                          strokeWidth={2.5}
                          aria-hidden="true"
                        />
                        {encounterDirection && (
                          <ArrowRight
                            size={13}
                            strokeWidth={3}
                            aria-hidden="true"
                            className="absolute -right-4 top-1.5"
                            style={{
                              transform: `rotate(${Math.atan2(encounterDirection.y, encounterDirection.x)}rad)`,
                              transformOrigin: "center",
                            }}
                          />
                        )}
                        <span
                          className={`absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${encounterMarker.className}`}
                        >
                          {encounterMarker.label}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Targetable map assets are a teaching/editing overlay, not the
              ground art itself. The surrounding combat screen owns the header
              toggle so these pins can be hidden without crowding the legend. */}
                  {assetOverlayVisible &&
                    objectInteraction &&
                    (mapData.targetableObjects ?? [])
                      .filter((targetObject) =>
                        objectInteraction.movableObjectIds.includes(
                          targetObject.id,
                        ),
                      )
                      .map((targetObject) => {
                        const isSelectedObject =
                          targetObject.id === objectInteraction.activeObjectId;
                        return (
                          <button
                            key={`targetable-object-${targetObject.id}`}
                            type="button"
                            aria-label={`Select ${targetObject.name ?? targetObject.id} object`}
                            title={`${targetObject.name ?? targetObject.id} object`}
                            onClick={(event) => {
                              // Object markers sit on top of tiles. Stop the click here
                              // so selecting the object does not immediately also move it
                              // to its current tile.
                              event.stopPropagation();
                              objectInteraction.onObjectSelect(targetObject.id);
                            }}
                            className={`absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-xs font-black leading-none shadow-[0_0_14px_rgba(251,191,36,0.5)] transition-transform ${
                              isSelectedObject
                                ? "z-30 scale-110 border-yellow-50 bg-amber-300 text-amber-950 ring-2 ring-yellow-100"
                                : "z-20 border-amber-100/80 bg-amber-500/90 text-amber-950 hover:scale-105"
                            }`}
                            style={{
                              left:
                                targetObject.position.x * TILE_SIZE_PX +
                                TILE_SIZE_PX / 2,
                              top:
                                targetObject.position.y * TILE_SIZE_PX +
                                TILE_SIZE_PX / 2,
                            }}
                          >
                            ✦
                          </button>
                        );
                      })}

                  {/* Resolved bodies belong to source history, not initiative.
              Render only outcomes explicitly saved as downed; withdrawals are
              last-seen records and therefore produce no invisible or selectable
              token on the return map. */}
                  {mapData.encounterContext?.kind === "opening-standoff" &&
                    mapData.encounterContext.sceneResolution &&
                    mapData.encounterContext.sourceEntities.map((entity) => {
                      const outcome =
                        mapData.encounterContext?.kind === "opening-standoff"
                          ? mapData.encounterContext.sceneResolution?.entityOutcomes.find(
                              (candidate) =>
                                candidate.sourceEntityId === entity.entityId,
                            )
                          : undefined;
                      return outcome?.status === "downed" ? (
                        <OpeningThreatWorldBody
                          key={`opening-aftermath-body-${entity.entityId}`}
                          source={entity}
                          position={entity.position}
                        />
                      ) : null;
                    })}

                  {characters.map((character) => {
                    // Optimized: Iterate characters directly instead of looking them up via characterPositions map
                    // This removes an O(N) search inside the loop, making this rendering phase O(N) instead of O(N^2)
                    // IMPROVEMENT OPPORTUNITY: Add viewport culling here - only render characters within camera bounds
                    // Could use a quadtree or simple bounds checking to filter visible entities
                    const charTileId = `${character.position.x}-${character.position.y}`;
                    const isTargetable = validTargetSet.has(charTileId);

                    return (
                      <CharacterToken
                        key={character.id}
                        character={character}
                        position={character.position}
                        isSelected={selectedCharacterId === character.id}
                        isTargetable={isTargetable}
                        targetingMode={abilitySystem.targetingMode}
                        isTurn={turnState.currentCharacterId === character.id}
                        onCharacterClick={handleCharacterClick}
                      />
                    );
                  })}
                  <BattleMapOverlay
                    mapData={mapData}
                    characters={characters}
                    damageNumbers={damageNumbers}
                    animations={turnManager.animations || []}
                    spellZones={turnManager.spellZones || []}
                    scheduledSpellEffects={
                      turnManager.scheduledSpellEffects || []
                    }
                    movementDebuffs={turnManager.movementDebuffs || []}
                    activeLightSources={
                      (turnManager.activeLightSources || []) as LightSource[]
                    }
                    showLightSourceMarkers={showLightSourceMarkers}
                    showLineOfSightCone={lineOfSightOverlayVisible}
                    lineOfSightOriginCharacterId={currentCharacter?.id ?? null}
                    spellMovementVisuals={
                      turnManager.spellMovementVisuals || []
                    }
                    spellDeliveryVisuals={
                      turnManager.spellDeliveryVisuals || []
                    }
                    spellMapArtifacts={spellMapArtifacts}
                    aoePreview={abilitySystem.aoePreview}
                    teleportDestinationPreview={
                      abilitySystem.teleportDestinationPreview
                    }
                    assignedTeleportDestinations={assignedTeleportDestinations}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Keep the last inspected tile visible so the player can move toward
          controls without losing the comparison. All three landmarks share
          one map-floor ruler: the tile, the selected creature, and zero. This
          avoids asking the player to reconcile two unexplained baselines. */}
      {hoveredTile && hoveredElevation && (
        <div
          data-testid="battle-map-elevation-readout"
          data-elevation-relation={hoveredElevation.relation}
          data-tile-height-feet={hoveredElevation.localReliefFeet}
          data-reference-height-feet={
            hoveredElevation.referenceLocalReliefFeet ?? undefined
          }
          data-relative-height-feet={hoveredElevation.relativeFeet ?? undefined}
          data-map-floor-feet="0"
          className="pointer-events-none absolute bottom-24 left-3 flex w-[20rem] max-w-[calc(100%_-_1.5rem)] items-start gap-2 rounded-md border border-amber-300/55 bg-slate-950 px-2.5 py-2 text-slate-100 shadow-lg sm:bottom-12"
          style={{ zIndex: Z_INDEX.COMBAT_OVERLAY }}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-amber-300/35 bg-amber-950/55 text-amber-200">
            <Mountain size={17} strokeWidth={2} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="flex items-baseline justify-between gap-3 border-b border-slate-700/80 pb-1 text-[9px] font-black uppercase text-amber-300">
              <span>Elevation</span>
              <span className="text-slate-400">
                Tile {rowLabel(hoveredTile.coordinates.y)}
                {hoveredTile.coordinates.x + 1}
              </span>
            </span>
            <span className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b border-slate-800 pb-0.5">
              <span className="text-[11px] font-bold text-amber-200">
                This tile
              </span>
              <span className="text-sm font-black tabular-nums text-amber-100">
                {hoveredElevation.localReliefFeet} ft
              </span>
            </span>
            {elevationReference &&
              hoveredElevation.referenceLocalReliefFeet != null && (
                <span className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b border-slate-800 pb-0.5">
                  <span className="truncate text-[11px] font-bold text-cyan-300">
                    {elevationReference.label}
                  </span>
                  <span className="text-xs font-black tabular-nums text-cyan-100">
                    {hoveredElevation.referenceLocalReliefFeet} ft
                  </span>
                </span>
              )}
            <span className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
              <span className="text-[11px] text-slate-300">Map floor</span>
              <span className="text-xs font-black tabular-nums text-slate-300">
                0 ft
              </span>
            </span>
            {elevationReference && hoveredElevation.relativeText && (
              <span className="mt-1 block rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[11px] text-slate-100">
                {hoveredElevation.relation === "level"
                  ? `This tile is level with ${elevationReference.label}.`
                  : `This tile is ${hoveredElevation.relativeText} than ${elevationReference.label}.`}
              </span>
            )}
            <span className="mt-1 block text-[10px] text-slate-300">
              0 ft is the lowest visible ground. Each contour is a 5 ft step.
            </span>
          </span>
        </div>
      )}
      {/* Zoom controls — user zoom over the auto-fit. "Fit" returns to auto. */}
      <div
        className="absolute bottom-10 right-3 flex items-center gap-1 rounded-md border border-amber-800/50 bg-slate-950/85 p-1 shadow-lg"
        style={{ zIndex: Z_INDEX.COMBAT_OVERLAY }}
      >
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => zoomBy(1 / 1.25)}
          className="h-7 w-7 rounded bg-slate-800 text-sm font-bold text-slate-200 hover:bg-slate-700"
        >
          −
        </button>
        <span className="min-w-[3rem] text-center text-xs font-semibold tabular-nums text-slate-300">
          {Math.round(boardScale * 100)}%
        </span>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => zoomBy(1.25)}
          className="h-7 w-7 rounded bg-slate-800 text-sm font-bold text-slate-200 hover:bg-slate-700"
        >
          +
        </button>
        <button
          type="button"
          aria-label="Fit map to view"
          onClick={() => setUserZoom(fitScale)}
          className={`h-7 rounded px-2 text-xs font-semibold ${userZoom !== null && Math.abs(boardScale - fitScale) < 0.001 ? "bg-amber-700 text-amber-50" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`}
        >
          Fit
        </button>
        <button
          type="button"
          aria-label="Reset zoom to automatic"
          onClick={() => setUserZoom(null)}
          className={`h-7 rounded px-2 text-xs font-semibold ${userZoom === null ? "bg-amber-700 text-amber-50" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`}
        >
          Auto
        </button>
      </div>
      {/* Legend — rendered outside the scaled frame so it stays readable
          regardless of how far the board is scaled to fit. */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-1 text-xs text-slate-300">
        {LEGEND_ITEMS.map((item) => {
          if (item.toggle) {
            return (
              /* eslint-disable-next-line no-restricted-syntax -- This is a tiny legend swatch toggle; the shared Button component is too large for the map footer. */
              <button
                key={item.label}
                type="button"
                aria-label={`${lineOfSightOverlayVisible ? "Hide" : "Show"} line of sight overlay`}
                aria-pressed={lineOfSightOverlayVisible}
                onClick={() =>
                  setLineOfSightOverlayVisible((visible) => !visible)
                }
                className={`flex items-center gap-1.5 rounded px-1.5 py-1 transition-colors ${lineOfSightOverlayVisible ? "text-slate-100 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-800/70 hover:text-slate-300"}`}
                title={`${lineOfSightOverlayVisible ? "Hide" : "Show"} line-of-sight overlay`}
              >
                <span
                  className={`inline-block h-3 w-3 rounded-sm ${item.swatch} ${lineOfSightOverlayVisible ? "" : "opacity-40"}`}
                />
                <span>{item.label}</span>
              </button>
            );
          }

          return (
            <div
              key={item.label}
              data-testid={item.testId}
              className="flex items-center gap-1.5"
              title={item.title}
            >
              <span
                className={`inline-block h-3 w-3 rounded-sm ${item.swatch}`}
              />
              <span>{item.label}</span>
            </div>
          );
        })}
        {showWorldOccupants && worldOccupantGroups.length > 0 && (
          <div
            className="flex items-center gap-1.5"
            data-testid="world-occupant-legend"
          >
            <span className="inline-flex h-3 w-3 items-center justify-center rounded-full border border-violet-300 bg-violet-950 text-violet-100">
              <UsersRound size={8} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <span>Residents</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default BattleMap;
