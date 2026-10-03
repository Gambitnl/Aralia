/**
 * @file BattleMap.tsx
 * The primary component for rendering a source-backed tactical battlefield.
 *
 * This component orchestrates the 2D grid display, linking terrain canvases,
 * character tokens, spell overlays, and tactical HUD controls together. It
 * calculates movement perimeters, handles dynamic elevation readouts, and
 * scales the battlefield smoothly to fit the player's viewport.
 *
 * SPLIT (agora-9950): the JSX is now five named layers instead of one wall.
 * `layers/BattleMapRulers` draws the coordinate gutters, `layers/BattleMapTileLayer`
 * owns the per-tile flag derivations, and `layers/BattleMapMarkerLayer` owns the
 * overlay/token mounts and the turn-manager channel normalization they need.
 * Each renders a fragment, so the element tree, stacking, and pointer targets
 * are unchanged; this component is now the board frame plus its canvases.
 *
 * Called by: CombatView.tsx, BattleMapDemo.tsx, PreviewCombatScenarios.tsx
 * Depends on: useBattleMapPointer for interaction/camera handling,
 * useBattleMapDerivedState for every memoized value the render tree reads,
 * BattleMapHUD for controls/overlays, the three layers/ subcomponents for the
 * board contents, and BattleMapGroundCanvas/FogCanvas for rendering.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/09/2026, 14:48:40
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/BattleMap/index.ts, components/Combat/CombatView.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/classes/ClassBattlefieldDemo.tsx, components/DesignPreview/steps/classes/classesScenarioAdapter.tsx, components/DesignPreview/steps/raceDomain/raceFrameworkAdapter.tsx, components/DesignPreview/steps/spells/spellsFrameworkAdapter.tsx
 * Imports: 15 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { RitualState } from '../../types/rituals';
import React, {
  useMemo,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  BattleMapData,
  CombatCharacter,
  Position,
} from "../../types/combat";
import type { ControlledActionMode } from "../../hooks/useBattleMap";
import type { useTurnManager } from "../../hooks/combat/useTurnManager";
import type { useAbilitySystem } from "../../hooks/useAbilitySystem";
import BattleMapGroundCanvas from "./BattleMapGroundCanvas";
import BattleMapFogCanvas from "./BattleMapFogCanvas";
import { TILE_SIZE_PX } from "../../config/mapConfig";
import { UI_ID } from "../../styles/uiIds";
import type { SpellMapArtifacts } from "./spellMapArtifacts";
import { useBattleMapPointer } from "./hooks/useBattleMapPointer";
import { useBattleMapDerivedState } from "./hooks/useBattleMapDerivedState";
import { BattleMapHUD } from "./BattleMapHUD";
import {
  BattleMapColumnRuler,
  BattleMapRowRuler,
} from "./layers/BattleMapRulers";
import { BattleMapTileLayer } from "./layers/BattleMapTileLayer";
import { BattleMapMarkerLayer } from "./layers/BattleMapMarkerLayer";

export interface BattleMapProps {
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
  /** Ritual in progress from game state; shown by the HUD (agora-f4ab.4). */
  activeRitual?: RitualState | null;
  /** Debug/review surfaces may prioritize whole-map context over token size. */
  preferFullMapFit?: boolean;
  /**
   * Dev/review affordance: shows the render-only fog-of-war veil toggle chip in
   * the command toolbar. Off by default so it never ships in real-game combat;
   * only the design-lab demo path opts in.
   */
  showFogToggle?: boolean;
  /**
   * Hands ownership of the action mode to the parent.
   *
   * The Move / Attack commands now live in the ACTIONS panel, a SIBLING of this
   * map. Both surfaces must read and write ONE mode, so CombatView owns it and
   * passes it in. Omit it and the map keeps its own mode, which is what the
   * design lab and preview scenarios still do.
   */
  controlledActionMode?: ControlledActionMode;
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
  activeRitual = null,
  preferFullMapFit = false,
  showFogToggle = false,
  controlledActionMode,
  cameraFocusRequest = null,
  objectInteraction,
  spellMapArtifacts,
  combatState,
}) => {
  const { turnManager, turnState, abilitySystem, isCharacterTurn } =
    combatState;

  // ============================================================================
  // Local Visibility and Render-Only Overlay Toggles
  // ============================================================================
  const [lineOfSightOverlayVisible, setLineOfSightOverlayVisible] =
    useState(showLineOfSightCone);
  // Render-only switch for the fog-of-war veil. Visual review needs to judge
  // the painted ground on dense-forest maps where most tiles sit outside line
  // of sight; referee visibility data is untouched when the veil is hidden.
  const [fogOfWarVisible, setFogOfWarVisible] = useState(true);

  // Keep the local overlay toggle aligned if a parent view changes the starting
  // line-of-sight teaching overlay.
  useEffect(() => {
    setLineOfSightOverlayVisible(showLineOfSightCone);
  }, [showLineOfSightCone]);

  // ============================================================================
  // Opening Standoff Scene Camera & Trace Calculations
  // ============================================================================
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

  // ============================================================================
  // Pointer Gestures, Tile Clicks, Zooming & Camera Centering Hook
  // ============================================================================
  const {
    selectedCharacterId,
    validMoves,
    activePath,
    actionMode,
    fitWrapRef,
    fitFrameRef,
    fitScale,
    frameSize,
    userZoom,
    setUserZoom,
    boardScale,
    isBoardScrollable,
    zoomBy,
    hoveredTile,
    handleObjectAwareTileClick,
    handleTileHover,
    handleCharacterClick,
  } = useBattleMapPointer({
    mapData,
    characters,
    turnManager,
    turnState,
    abilitySystem,
    controlledActionMode,
    objectInteraction,
    cameraFocusRequest,
    preferFullMapFit,
    openingSceneCameraFocus,
  });

  const activeObjectId = objectInteraction?.activeObjectId ?? null;
  const activeObject = activeObjectId
    ? (mapData?.targetableObjects?.find(
        (targetObject) => targetObject.id === activeObjectId,
      ) ?? null)
    : null;

  // ============================================================================
  // Viewport Culling & Derived Render State
  // ============================================================================
  // The grid element the culling hook measures. It is also the JSX ref for the
  // tactical grid layer, so it stays in the component; everything derived from
  // it moved to hooks/useBattleMapDerivedState.ts (MOD-3.7), in the same order
  // and with the same dependency arrays it had here.
  const gridRef = useRef<HTMLDivElement>(null);

  const {
    visibleTiles,
    worldOccupantGroups,
    encounterMarker,
    encounterDirection,
    openingTrackMarks,
    assignedTeleportDestinations,
    elevationBaseline,
    elevationReference,
    hoveredElevation,
    currentCharacter,
    visibilityObserverSelection,
    visibility,
    aoeSet,
    validTargetSet,
    teleportDestinationSet,
    activePathSet,
    threatCoordSet,
    validMoveCoordSet,
  } = useBattleMapDerivedState({
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
  });

  if (!mapData) {
    return <div>Generating map...</div>;
  }

  // Ritual progress (agora-f4ab.4, 2026-09-13): CombatView passes state.activeRitual
  // in as the `activeRitual` prop (BattleMap stays props-driven for the design-preview
  // harnesses), and BattleMapHUD renders RitualProgressPanel from it: progress bar,
  // elapsed/total, and the interruption conditions.

  return (
    <div
      id={UI_ID.BATTLE_MAP}
      data-testid={UI_ID.BATTLE_MAP}
      className="relative flex h-full w-full flex-col items-center justify-center"
    >
      {/* ==================================================================== */}
      {/* Heads-Up Display: Shared Senses, Validation, Fog, Elevation, Zoom   */}
      {/* ==================================================================== */}
      <BattleMapHUD
        sharedSenses={visibilityObserverSelection.sharedSenses}
        targetingMode={abilitySystem.targetingMode}
        targetValidationReason={abilitySystem.targetValidationReason}
        currentCharacter={currentCharacter}
        isCurrentCharacterTurn={
          currentCharacter ? isCharacterTurn(currentCharacter.id) : false
        }
        showFogToggle={showFogToggle}
        fogOfWarVisible={fogOfWarVisible}
        onToggleFogOfWar={() => setFogOfWarVisible((visible) => !visible)}
        hoveredTile={hoveredTile}
        hoveredElevation={hoveredElevation}
        elevationReference={elevationReference}
        boardScale={boardScale}
        fitScale={fitScale}
        userZoom={userZoom}
        onZoomBy={(factor) => zoomBy(factor)}
        onSetUserZoom={setUserZoom}
        lineOfSightOverlayVisible={lineOfSightOverlayVisible}
        onToggleLineOfSight={() =>
          setLineOfSightOverlayVisible((visible) => !visible)
        }
        showWorldOccupants={showWorldOccupants}
        hasWorldOccupants={worldOccupantGroups.length > 0}
        activeRitual={activeRitual}
        characters={characters}
      />

      {/* ==================================================================== */}
      {/* Gold-Framed Grid Container with Rulers (A-P down, 1-20 across)       */}
      {/* ==================================================================== */}
      <div
        ref={fitWrapRef}
        className={`relative flex min-h-0 w-full flex-1 ${
          isBoardScrollable
            ? "items-start justify-start overflow-auto"
            : "items-center justify-center overflow-hidden"
        }`}
      >
        <div
          style={
            frameSize.w > 0
              ? {
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
            {/* Coordinate rulers (A-P down, 1-20 across) */}
            <BattleMapColumnRuler width={mapData.dimensions.width} />

            <div className="flex">
              <BattleMapRowRuler height={mapData.dimensions.height} />

              {/* Main tactical board container */}
              <div
                className={`battle-map-container relative ${
                  abilitySystem.targetingMode ? "cursor-crosshair" : ""
                }`}
                style={{
                  width: `${mapData.dimensions.width * TILE_SIZE_PX + 2}px`,
                  height: `${mapData.dimensions.height * TILE_SIZE_PX + 2}px`,
                }}
              >
                {/* Painted terrain canvas underneath the tile grid */}
                <BattleMapGroundCanvas
                  mapData={mapData}
                  tileSize={TILE_SIZE_PX}
                  showDecorations={assetOverlayVisible}
                  className="pointer-events-none absolute inset-0 h-full w-full"
                />

                {/* Soft fog-of-war canvas above terrain, below tokens */}
                {fogOfWarVisible && (
                  <BattleMapFogCanvas
                    mapData={mapData}
                    tileSize={TILE_SIZE_PX}
                    visibleTiles={visibility.visibleTiles}
                    getLightLevel={visibility.getLightLevel}
                    className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
                  />
                )}

                {/* Tactical grid layer rendering each individual tile */}
                <div
                  ref={gridRef}
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
                  {/* Tactical tiles for the culled viewport window */}
                  <BattleMapTileLayer
                    visibleTiles={visibleTiles}
                    validTargetSet={validTargetSet}
                    aoeSet={aoeSet}
                    teleportDestinationSet={teleportDestinationSet}
                    activePathSet={activePathSet}
                    visibility={visibility}
                    actionMode={actionMode}
                    validMoves={validMoves}
                    validMoveCoordSet={validMoveCoordSet}
                    threatCoordSet={threatCoordSet}
                    activeObject={activeObject}
                    showCoverLabels={showCoverLabels}
                    elevationReference={elevationReference}
                    elevationBaseline={elevationBaseline}
                    targetingMode={abilitySystem.targetingMode}
                    onTileClick={handleObjectAwareTileClick}
                    onTileHover={handleTileHover}
                  />

                  {/* Overlays and tokens drawn above the tile layer */}
                  <BattleMapMarkerLayer
                    mapData={mapData}
                    characters={characters}
                    boardScale={boardScale}
                    turnManager={turnManager}
                    abilitySystem={abilitySystem}
                    showTargetableObjectFacts={showTargetableObjectFacts}
                    showWorldOccupants={showWorldOccupants}
                    worldOccupantGroups={worldOccupantGroups}
                    openingTrackMarks={openingTrackMarks}
                    encounterMarker={encounterMarker}
                    encounterDirection={encounterDirection}
                    showLightSourceMarkers={showLightSourceMarkers}
                    lineOfSightOverlayVisible={lineOfSightOverlayVisible}
                    currentCharacterId={currentCharacter?.id ?? null}
                    spellMapArtifacts={spellMapArtifacts}
                    assignedTeleportDestinations={assignedTeleportDestinations}
                    selectedCharacterId={selectedCharacterId}
                    validTargetSet={validTargetSet}
                    turnCharacterId={turnState.currentCharacterId}
                    onCharacterClick={handleCharacterClick}
                    assetOverlayVisible={assetOverlayVisible}
                    objectInteraction={objectInteraction}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BattleMap;
