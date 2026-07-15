// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 11/07/2026, 23:51:15
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/BattleMap/index.ts, components/Combat/CombatView.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx
 * Imports: 17 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file BattleMap.tsx
 * The primary component for rendering the procedural battle map grid, tiles, and character tokens.
 * 
 * CURRENT FUNCTIONALITY:
 * - Renders grid-based battle map with tiles and character tokens
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
import React, { useMemo, useCallback, useEffect, useRef, useState, useLayoutEffect } from 'react';
import { Footprints, Swords } from 'lucide-react';
import { BattleMapData, CombatCharacter, BattleMapTile as BattleMapTileData, CombatState, LightSource, Position } from '../../types/combat';
import { useBattleMap } from '../../hooks/useBattleMap';
import { useTargetSelection } from '../../hooks/combat/useTargetSelection';
import { useVisibility } from '../../hooks/combat/useVisibility';
import type { useTurnManager } from '../../hooks/combat/useTurnManager';
import type { useAbilitySystem } from '../../hooks/useAbilitySystem';
import BattleMapTile from './BattleMapTile';
import CharacterToken from './CharacterToken';
import BattleMapOverlay from './BattleMapOverlay';
import BattleMapGroundCanvas from './BattleMapGroundCanvas';
import BattleMapFogCanvas from './BattleMapFogCanvas';
import { TILE_SIZE_PX } from '../../config/mapConfig';
import { UI_ID } from '../../styles/uiIds';
import { Z_INDEX } from '../../styles/zIndex';
import { selectVisibilityObserver } from './visibilityObserverPolicy';
import type { SpellMapArtifacts } from './spellMapArtifacts';
import { selectQuickAttack } from './quickAttack';

// Width of the row-letter gutter to the left of the grid; the column ruler uses
// the same value as a leading offset so numbers sit centered over their columns.
const RULER_GUTTER_PX = 20;
const COLUMN_RULER_HEIGHT_PX = 16;

// Spreadsheet-style row labels: A..Z, then AA, AB, … for taller maps.
const rowLabel = (index: number): string => {
  let n = index;
  let label = '';
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
};

const LEGEND_ITEMS: Array<{ swatch: string; label: string; dashed?: boolean; toggle?: 'lineOfSight' }> = [
  { swatch: 'bg-emerald-500/60', label: 'Move Range' },
  { swatch: 'bg-emerald-300/80', label: 'Destination' },
  { swatch: 'bg-rose-500/60', label: 'Attack Range' },
  { swatch: 'bg-orange-500/60', label: 'Area Effect' },
  { swatch: 'border border-dashed border-slate-300', label: 'Line of Sight', dashed: true, toggle: 'lineOfSight' },
];

const MIN_USABLE_BOARD_SCALE = 0.7;

interface BattleMapProps {
  mapData: BattleMapData | null;
  characters: CombatCharacter[];
  showCoverLabels?: boolean;
  showLightSourceMarkers?: boolean;
  showLineOfSightCone?: boolean;
  assetOverlayVisible?: boolean;
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
    turnState: ReturnType<typeof useTurnManager>['turnState'];
    abilitySystem: ReturnType<typeof useAbilitySystem>;
    isCharacterTurn: (id: string) => boolean;
    onCharacterUpdate: (character: CombatCharacter) => void;
  };
}

const BattleMap: React.FC<BattleMapProps> = ({ mapData, characters, showCoverLabels = false, showLightSourceMarkers = true, showLineOfSightCone = false, assetOverlayVisible = true, preferFullMapFit = false, cameraFocusRequest = null, objectInteraction, spellMapArtifacts, combatState }) => {
  const { turnManager, turnState, abilitySystem, isCharacterTurn } = combatState;
  const [lineOfSightOverlayVisible, setLineOfSightOverlayVisible] = useState(showLineOfSightCone);
  const [pendingCameraCenterCharacterId, setPendingCameraCenterCharacterId] = useState<string | null>(null);

  // Keep the local overlay toggle aligned if a parent view changes the starting
  // line-of-sight teaching overlay, while still letting the player hide it in
  // the map itself when it gets in the way.
  useEffect(() => {
    setLineOfSightOverlayVisible(showLineOfSightCone);
  }, [showLineOfSightCone]);

  const battleMapState = useBattleMap(mapData, characters, turnManager, abilitySystem);

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
    ? mapData?.targetableObjects?.find(targetObject => targetObject.id === activeObjectId) ?? null
    : null;

  const handleObjectAwareTileClick = useCallback((tile: BattleMapTileData) => {
    // When a movable object is selected, a tile click becomes an object move
    // instead of a normal creature movement or attack click. This path is
    // opt-in so production combat maps keep their existing click behavior.
    if (activeObject && objectInteraction && !tile.blocksMovement) {
      objectInteraction.onObjectMove(activeObject.id, tile.coordinates);
      return;
    }

    handleTileClick(tile);
  }, [activeObject, handleTileClick, objectInteraction]);

  // Live AoE preview when hovering tiles while targeting
  const handleTileHover = useCallback((tile: BattleMapTileData) => {
    if (!abilitySystem?.previewAoE || !abilitySystem.targetingMode || !mapData) return;
    const caster = characters.find(c => c.id === turnState.currentCharacterId);
    if (caster) {
      abilitySystem.previewAoE(tile.coordinates, caster);
    }
  }, [abilitySystem, characters, mapData, turnState.currentCharacterId]);

  const tileArray = useMemo(() => {
    if (!mapData) return [];
    return Array.from(mapData.tiles.values());
  }, [mapData]);

  const currentCharacter = characters.find(c => c.id === turnState.currentCharacterId);
  // The viewer policy is shared with the 3D map so light, darkness, and fog of
  // war do not accidentally choose different creatures in different renderers.
  const visibilityObserverSelection = selectVisibilityObserver({
    selectedCharacterId,
    currentCharacterId: turnState.currentCharacterId,
    characters
  });
  const visibilityObserverId = visibilityObserverSelection.observerId;
  // The visibility hook expects a CombatState object because it is also used by
  // non-map callers. The 2D renderer only needs map, characters, and live light
  // sources, so this local bridge supplies those fields while preserving the
  // existing turn-manager ownership of active lights.
  const visibilityState = useMemo(() => ({
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
    activeLightSources: (turnManager.activeLightSources || []) as LightSource[],
    mapData: mapData ?? undefined
  } as unknown as CombatState), [actionMode, characters, mapData, selectedCharacterId, turnManager.activeLightSources, turnManager.reactiveTriggers, turnState]);
  const visibility = useVisibility({
    combatState: visibilityState,
    activeCharacterId: visibilityObserverId
  });
  const assignedTeleportDestinations = useMemo(() => {
    const assignment = abilitySystem.pendingTeleportAssignment;
    if (!assignment) return [];

    return Object.entries(assignment.destinationsByTargetId).map(([targetId, destination]) => {
      const target = characters.find(character => character.id === targetId);
      return {
        targetId,
        targetName: target?.name ?? targetId,
        destination,
        abilityName: assignment.ability.name
      };
    });
  }, [abilitySystem.pendingTeleportAssignment, characters]);
  // The map shortcut must represent a real direct attack, not the first item in
  // an arbitrary ability array. Preserve loadout order while skipping spells,
  // movement, cooldowns, depleted uses, and unaffordable attacks.
  const quickAttack = currentCharacter
    ? selectQuickAttack(
        currentCharacter.abilities,
        (cost) => turnManager.canAffordAction(currentCharacter, cost),
      )
    : null;
  const quickAttackIsArmed = Boolean(
    abilitySystem.targetingMode
    && quickAttack
    && abilitySystem.selectedAbility?.id === quickAttack.id,
  );

  // --- OPTIMIZATION START ---
  // Memoize sets to reduce O(N) lookups in render loop and prevent re-calcs on mouse move
  // IMPROVEMENT OPPORTUNITY: Could implement spatial indexing for faster tile lookups
  // instead of linear searches through character arrays

  const { aoeSet, validTargetSet, teleportDestinationSet } = useTargetSelection({
    selectedAbility: abilitySystem.selectedAbility,
    targetingMode: abilitySystem.targetingMode,
    isValidTarget: abilitySystem.isValidTarget,
    aoePreview: abilitySystem.aoePreview,
    teleportDestinationPreview: abilitySystem.teleportDestinationPreview,
    currentCharacter,
    mapData,
    characters
  });

  // 2. Active Path Set: Validates if a tile is in the current movement path
  const activePathSet = useMemo(() => {
    const set = new Set<string>();
    activePath.forEach(p => set.add(p.id));
    return set;
  }, [activePath]);

  // Tiles adjacent to a living enemy (melee reach): stepping through or into
  // these provokes — the other half of the movement decision, shown as a red
  // hatch inside the reachable region.
  const threatCoordSet = useMemo(() => {
    const set = new Set<string>();
    characters.forEach(ch => {
      if (ch.team !== 'enemy' || ch.currentHP <= 0) return;
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
    mapData.tiles.forEach(tile => {
      if (validMoves.has(tile.id)) set.add(`${tile.coordinates.x},${tile.coordinates.y}`);
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
  const autoScale = preferFullMapFit || fitScale >= MIN_USABLE_BOARD_SCALE ? fitScale : 1;
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
      setFrameSize(prev => (prev.w === fw && prev.h === fh ? prev : { w: fw, h: fh }));
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
  const boardScaleRef = useRef(boardScale);
  useLayoutEffect(() => {
    // Wheel handlers run outside React's render cycle, so they read the latest
    // committed board scale from this ref instead of from a stale closure.
    boardScaleRef.current = boardScale;
  }, [boardScale]);
  const zoomBy = useCallback((factor: number, clientX?: number, clientY?: number) => {
    const wrap = fitWrapRef.current;
    const frame = fitFrameRef.current;
    if (wrap && frame) {
      const wrapRect = wrap.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      const vx = clientX !== undefined ? clientX - wrapRect.left : wrap.clientWidth / 2;
      const vy = clientY !== undefined ? clientY - wrapRect.top : wrap.clientHeight / 2;
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
    setUserZoom(prev => clampZoom((prev ?? boardScaleRef.current) * factor));
  }, []);
  const requestCameraCenter = useCallback((characterId: string) => {
    // Both the explicit React prop and the roster's browser event land here.
    // Resetting user zoom first means every roster focus click returns the map
    // to its automatic viewer level before scrolling to the requested token.
    setUserZoom(null);
    setPendingCameraCenterCharacterId(characterId);
  }, []);
  const centerBoardOnCharacter = useCallback((character: CombatCharacter) => {
    if (!mapData || !fitWrapRef.current) return;

    const wrap = fitWrapRef.current;
    const targetLeft =
      (RULER_GUTTER_PX +
        character.position.x * TILE_SIZE_PX +
        TILE_SIZE_PX / 2) * boardScale -
      wrap.clientWidth / 2;
    const targetTop =
      (COLUMN_RULER_HEIGHT_PX +
        character.position.y * TILE_SIZE_PX +
        TILE_SIZE_PX / 2) * boardScale -
      wrap.clientHeight / 2;

    // Camera centering is scroll-based in the 2D tactical board. Keeping the
    // math in one helper makes roster focus and turn-start focus land on the
    // same tile center instead of drifting by a gutter or ruler offset.
    window.requestAnimationFrame(() => {
      wrap.scrollTo({
        left: Math.max(0, targetLeft),
        top: Math.max(0, targetTop),
      });
    });
  }, [boardScale, mapData]);
  useEffect(() => {
    if (!cameraFocusRequest) return;
    requestCameraCenter(cameraFocusRequest.characterId);
  }, [cameraFocusRequest, requestCameraCenter]);
  useEffect(() => {
    const handleRosterCameraRequest = (event: Event) => {
      const characterId = (event as CustomEvent<{ characterId?: string }>).detail?.characterId;
      if (characterId) requestCameraCenter(characterId);
    };

    window.addEventListener('aralia:battle-map-center-character', handleRosterCameraRequest);
    return () => window.removeEventListener('aralia:battle-map-center-character', handleRosterCameraRequest);
  }, [requestCameraCenter]);
  useLayoutEffect(() => {
    const wrap = fitWrapRef.current;
    const anchor = zoomAnchorRef.current;
    if (!wrap || !anchor) return;
    zoomAnchorRef.current = null;
    wrap.scrollLeft = anchor.frameOffsetX + anchor.boardX * boardScale - anchor.vx;
    wrap.scrollTop = anchor.frameOffsetY + anchor.boardY * boardScale - anchor.vy;
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
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => wrap.removeEventListener('wheel', onWheel);
  }, [zoomBy]);
  useLayoutEffect(() => {
    if (!pendingCameraCenterCharacterId) return;

    const requestedCharacter = characters.find(character => character.id === pendingCameraCenterCharacterId);
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
    if (!isBoardScrollable && typeof fitWrapRef.current?.scrollTo === 'function') {
      fitWrapRef.current.scrollTo(0, 0);
    }
    if (!mapData || !isBoardScrollable || !currentCharacter || !fitWrapRef.current) return;

    // A wheel or zoom-button gesture has already corrected the scroll position
    // for the player's cursor/focal point, so do not recenter on the turn owner.
    if (skipCombatantCenterAfterZoomRef.current) {
      skipCombatantCenterAfterZoomRef.current = false;
      return;
    }

    // A scrollable tactical board should open on the active combatant, not the
    // empty top-left corner of a large generated map.
    centerBoardOnCharacter(currentCharacter);
  }, [
    centerBoardOnCharacter,
    currentCharacter,
    isBoardScrollable,
    mapData,
  ]);

  if (!mapData) {
    return <div>Generating map...</div>;
  }

  // TODO #33(Ritualist): Implement ritual progress visualization in the map overlay or UI panel.
  // The 'activeRitual' state is now available in GameState. Render a progress bar if activeRitual is present and !isComplete.
  // Ensure the progress bar clearly shows interruption conditions (e.g., "Damage breaks concentration").
  return (
    <div id={UI_ID.BATTLE_MAP} data-testid={UI_ID.BATTLE_MAP} className="relative flex h-full w-full flex-col items-center justify-center">
      {visibilityObserverSelection.sharedSenses && (
        <div
          className="absolute left-3 top-3 rounded-full border border-cyan-300/80 bg-slate-950/88 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.38)]"
          style={{ zIndex: Z_INDEX.COMBAT_OVERLAY }}
        >
          {/* This label makes the 2D map's observer switch legible. Without it,
              shared senses would silently change fog-of-war math while leaving
              the player unsure whether they are seeing from the caster or the familiar. */}
          Viewing through {visibilityObserverSelection.sharedSenses.observerName}
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
              setActionMode('move');
            }}
            type="button"
            aria-pressed={actionMode === 'move'}
            aria-label="Move on the battle map"
            className={`inline-flex h-9 items-center gap-1.5 rounded px-3 text-xs font-semibold transition-colors ${actionMode === 'move' ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-gray-600 hover:bg-gray-500'}`}
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
                setActionMode('move');
                return;
              }

              // The shortcut disables when no honest direct attack is ready,
              // instead of arming a movement, utility, or unavailable ability.
              if (!currentCharacter || !quickAttack) return;
              setActionMode('ability');
              abilitySystem.startTargeting(quickAttack, currentCharacter);
            }}
            type="button"
            disabled={!quickAttack}
            aria-pressed={quickAttackIsArmed}
            aria-label={quickAttack ? `Attack with ${quickAttack.name}` : 'No direct attack available'}
            title={quickAttack ? `Attack with ${quickAttack.name}` : 'No direct action attack is ready'}
            className={`inline-flex h-9 items-center gap-1.5 rounded px-3 text-xs font-semibold transition-colors ${!quickAttack ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : quickAttackIsArmed ? 'bg-red-600 text-white ring-2 ring-red-300' : 'bg-gray-600 hover:bg-gray-500'}`}
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
          isBoardScrollable ? 'items-start justify-start overflow-auto' : 'items-center justify-center overflow-hidden'
        }`}
      >
      {/* The spacer always takes the SCALED footprint: it gives the wrap real
          scrollbars when zoomed past the pane (a CSS transform alone does not
          affect scroll layout) and a correctly-sized box to flex-center when
          the board fits. */}
      <div
        style={
          frameSize.w > 0
            // overflow hidden: at scale<1 the frame's UNSCALED layout box would
            // otherwise leak past the spacer into the wrap's scroll extent,
            // letting the user scroll into empty space beyond the visual board.
            ? { width: frameSize.w * boardScale, height: frameSize.h * boardScale, flexShrink: 0, minWidth: 0, minHeight: 0, overflow: 'hidden' }
            : undefined
        }
      >
      <div
        ref={fitFrameRef}
        style={{
          transform: `scale(${boardScale})`,
          transformOrigin: 'top left',
        }}
        className="inline-block rounded-xl border-2 border-amber-800/50 bg-slate-950/70 p-2 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
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
            {Array.from({ length: mapData.dimensions.height }).map((_, i) => (
              <div
                key={`row-${i}`}
                style={{ height: TILE_SIZE_PX }}
                className="flex items-center justify-center text-[10px] font-semibold text-amber-200/50"
              >
                {rowLabel(i)}
              </div>
            ))}
          </div>
          <div className={`battle-map-container relative ${abilitySystem.targetingMode ? 'cursor-crosshair' : ''}`}
              style={{
                  width: `${mapData.dimensions.width * TILE_SIZE_PX + 2}px`,
                  height: `${mapData.dimensions.height * TILE_SIZE_PX + 2}px`,
              }}>
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
            display: 'grid',
            gridTemplateColumns: `repeat(${mapData.dimensions.width}, ${TILE_SIZE_PX}px)`,
            gridTemplateRows: `repeat(${mapData.dimensions.height}, ${TILE_SIZE_PX}px)`,
            position: 'relative',
            zIndex: 1,
            border: '1px solid #4A5568',
          }}
        >
          {tileArray.map(tile => {
            // Optimised lookups using Sets (O(1)) instead of Array searches/Calculations (O(N))
            // IMPROVEMENT OPPORTUNITY: Implement viewport culling to skip rendering
            // off-screen tiles entirely - could reduce render load by 60-80% in large maps
            const isTargetable = validTargetSet.has(tile.id);
            const isAoePreview = aoeSet.has(tile.id);
            const isTeleportDestinationPreview = teleportDestinationSet.has(tile.id);
            const isVisible = visibility.visibleTiles.has(tile.id);
            const lightLevel = visibility.getLightLevel(tile.id);
            const isValidMove = actionMode === 'move' && validMoves.has(tile.id);
            const isInPath = activePathSet.has(tile.id);
            const isObjectMoveDestination = Boolean(activeObject && !tile.blocksMovement);
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
                isThreatened={isValidMove && threatCoordSet.has(`${tx},${ty}`)}
                isInPath={isInPath}
                isTargetable={isTargetable}
                isAoePreview={isAoePreview}
                isTeleportDestinationPreview={isTeleportDestinationPreview}
                isObjectMoveDestination={isObjectMoveDestination}
                isVisible={isVisible}
                lightLevel={lightLevel}
                showCoverLabel={showCoverLabels}
                targetingMode={abilitySystem.targetingMode}
                onTileClick={handleObjectAwareTileClick}
                onTileHover={handleTileHover}
              />
            )
          })}

          {/* Targetable map assets are a teaching/editing overlay, not the
              ground art itself. The surrounding combat screen owns the header
              toggle so these pins can be hidden without crowding the legend. */}
          {assetOverlayVisible && objectInteraction && (mapData.targetableObjects ?? [])
            .filter(targetObject => objectInteraction.movableObjectIds.includes(targetObject.id))
            .map(targetObject => {
              const isSelectedObject = targetObject.id === objectInteraction.activeObjectId;
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
                      ? 'z-30 scale-110 border-yellow-50 bg-amber-300 text-amber-950 ring-2 ring-yellow-100'
                      : 'z-20 border-amber-100/80 bg-amber-500/90 text-amber-950 hover:scale-105'
                  }`}
                  style={{
                    left: targetObject.position.x * TILE_SIZE_PX + TILE_SIZE_PX / 2,
                    top: targetObject.position.y * TILE_SIZE_PX + TILE_SIZE_PX / 2
                  }}
                >
                  ✦
                </button>
              );
            })}
                
          {characters.map(character => {
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
            scheduledSpellEffects={turnManager.scheduledSpellEffects || []}
            movementDebuffs={turnManager.movementDebuffs || []}
            activeLightSources={(turnManager.activeLightSources || []) as LightSource[]}
            showLightSourceMarkers={showLightSourceMarkers}
            showLineOfSightCone={lineOfSightOverlayVisible}
            lineOfSightOriginCharacterId={currentCharacter?.id ?? null}
            spellMovementVisuals={turnManager.spellMovementVisuals || []}
            spellDeliveryVisuals={turnManager.spellDeliveryVisuals || []}
            spellMapArtifacts={spellMapArtifacts}
            aoePreview={abilitySystem.aoePreview}
            teleportDestinationPreview={abilitySystem.teleportDestinationPreview}
            assignedTeleportDestinations={assignedTeleportDestinations}
          />
        </div>
          </div>
        </div>
      </div>
      </div>
      </div>
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
        >−</button>
        <span className="min-w-[3rem] text-center text-xs font-semibold tabular-nums text-slate-300">
          {Math.round(boardScale * 100)}%
        </span>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => zoomBy(1.25)}
          className="h-7 w-7 rounded bg-slate-800 text-sm font-bold text-slate-200 hover:bg-slate-700"
        >+</button>
        <button
          type="button"
          aria-label="Fit map to view"
          onClick={() => setUserZoom(fitScale)}
          className={`h-7 rounded px-2 text-xs font-semibold ${userZoom !== null && Math.abs(boardScale - fitScale) < 0.001 ? 'bg-amber-700 text-amber-50' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
        >Fit</button>
        <button
          type="button"
          aria-label="Reset zoom to automatic"
          onClick={() => setUserZoom(null)}
          className={`h-7 rounded px-2 text-xs font-semibold ${userZoom === null ? 'bg-amber-700 text-amber-50' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
        >Auto</button>
      </div>
      {/* Legend — rendered outside the scaled frame so it stays readable
          regardless of how far the board is scaled to fit. */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-1 text-xs text-slate-300">
        {LEGEND_ITEMS.map(item => {
          if (item.toggle) {
            return (
              /* eslint-disable-next-line no-restricted-syntax -- This is a tiny legend swatch toggle; the shared Button component is too large for the map footer. */
              <button
                key={item.label}
                type="button"
                aria-label={`${lineOfSightOverlayVisible ? 'Hide' : 'Show'} line of sight overlay`}
                aria-pressed={lineOfSightOverlayVisible}
                onClick={() => setLineOfSightOverlayVisible(visible => !visible)}
                className={`flex items-center gap-1.5 rounded px-1.5 py-1 transition-colors ${lineOfSightOverlayVisible ? 'text-slate-100 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-800/70 hover:text-slate-300'}`}
                title={`${lineOfSightOverlayVisible ? 'Hide' : 'Show'} line-of-sight overlay`}
              >
                <span className={`inline-block h-3 w-3 rounded-sm ${item.swatch} ${lineOfSightOverlayVisible ? '' : 'opacity-40'}`} />
                <span>{item.label}</span>
              </button>
            );
          }

          return (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 rounded-sm ${item.swatch}`} />
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BattleMap;
