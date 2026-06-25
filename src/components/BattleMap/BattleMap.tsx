// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 24/06/2026, 22:09:43
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/BattleMap/index.ts, components/Combat/CombatView.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx
 * Imports: 12 files
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
import React, { useMemo, useCallback } from 'react';
import { BattleMapData, CombatCharacter, BattleMapTile as BattleMapTileData, CombatState, LightSource, Position } from '../../types/combat';
import { useBattleMap } from '../../hooks/useBattleMap';
import { useTargetSelection } from '../../hooks/combat/useTargetSelection';
import { useVisibility } from '../../hooks/combat/useVisibility';
import type { useTurnManager } from '../../hooks/combat/useTurnManager';
import type { useAbilitySystem } from '../../hooks/useAbilitySystem';
import BattleMapTile from './BattleMapTile';
import CharacterToken from './CharacterToken';
import BattleMapOverlay from './BattleMapOverlay';
import { TILE_SIZE_PX } from '../../config/mapConfig';
import { UI_ID } from '../../styles/uiIds';
import { selectVisibilityObserver } from './visibilityObserverPolicy';

interface BattleMapProps {
  mapData: BattleMapData | null;
  characters: CombatCharacter[];
  showCoverLabels?: boolean;
  showLightSourceMarkers?: boolean;
  showLineOfSightCone?: boolean;
  objectInteraction?: {
    activeObjectId: string | null;
    movableObjectIds: string[];
    onObjectSelect: (objectId: string) => void;
    onObjectMove: (objectId: string, destination: Position) => void;
  };
  combatState: {
    turnManager: ReturnType<typeof useTurnManager>;
    turnState: ReturnType<typeof useTurnManager>['turnState'];
    abilitySystem: ReturnType<typeof useAbilitySystem>;
    isCharacterTurn: (id: string) => boolean;
    onCharacterUpdate: (character: CombatCharacter) => void;
  };
}

const BattleMap: React.FC<BattleMapProps> = ({ mapData, characters, showCoverLabels = false, showLightSourceMarkers = true, showLineOfSightCone = false, objectInteraction, combatState }) => {
  const { turnManager, turnState, abilitySystem, isCharacterTurn } = combatState;

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
  const primaryAttack = currentCharacter?.abilities[0];
  const canUsePrimaryAttack = currentCharacter && primaryAttack
    ? turnManager.canAffordAction(currentCharacter, primaryAttack.cost)
    : false;

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

  // --- OPTIMIZATION END ---

  if (!mapData) {
    return <div>Generating map...</div>;
  }

  // TODO(Ritualist): Implement ritual progress visualization in the map overlay or UI panel.
  // The 'activeRitual' state is now available in GameState. Render a progress bar if activeRitual is present and !isComplete.
  // Ensure the progress bar clearly shows interruption conditions (e.g., "Damage breaks concentration").

  return (
    <div id={UI_ID.BATTLE_MAP} data-testid={UI_ID.BATTLE_MAP} className="relative">
      {visibilityObserverSelection.sharedSenses && (
        <div className="absolute left-3 top-3 z-[var(--z-index-submap-overlay)] rounded-full border border-cyan-300/80 bg-slate-950/88 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.38)]">
          {/* This label makes the 2D map's observer switch legible. Without it,
              shared senses would silently change fog-of-war math while leaving
              the player unsure whether they are seeing from the caster or the familiar. */}
          Viewing through {visibilityObserverSelection.sharedSenses.observerName}
        </div>
      )}
       {/* UI for current turn actions */}
       {currentCharacter && isCharacterTurn(currentCharacter.id) && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-700 p-2 rounded-md shadow-lg flex gap-2 z-[var(--z-index-submap-overlay)]">
          <button 
            onClick={() => {
              // Switching back to movement should leave any half-started attack
              // targeting state behind; otherwise a later enemy click can still
              // behave like an ability target instead of a selection/move click.
              abilitySystem.cancelTargeting();
              setActionMode('move');
            }}
            className={`px-3 py-1 text-sm rounded transition-colors ${actionMode === 'move' ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-gray-600 hover:bg-gray-500'}`}
          >Move</button>
          <button
            onClick={() => {
              // The quick Attack button mirrors the ability palette. If the
              // action has already been spent, the player should see the button
              // disabled instead of entering a targeting mode that will fail.
              if (!currentCharacter || !primaryAttack || !canUsePrimaryAttack) return;
              setActionMode('ability');
              abilitySystem.startTargeting(primaryAttack, currentCharacter);
            }}
            disabled={!canUsePrimaryAttack}
            className={`px-3 py-1 text-sm rounded transition-colors ${!canUsePrimaryAttack ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : actionMode === 'ability' ? 'bg-red-600 text-white ring-2 ring-red-300' : 'bg-gray-600 hover:bg-gray-500'}`}
          >Attack</button>
        </div>
      )}

      {/*
        TODO(lint-intent): This element is being used as an interactive control, but its semantics are incomplete.
        TODO(lint-intent): Prefer a semantic element (button/label) or add role, tabIndex, and keyboard handlers.
        TODO(lint-intent): If the element is purely decorative, remove the handlers to keep intent clear.
      */}
      <div className={`battle-map-container bg-gray-800 p-2 rounded-lg shadow-lg ${abilitySystem.targetingMode ? 'cursor-crosshair' : ''}`}
          style={{
              width: `${mapData.dimensions.width * TILE_SIZE_PX + 2}px`,
              height: `${mapData.dimensions.height * TILE_SIZE_PX + 2}px`,
          }}>
        
        
        <div
          className="battle-map-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${mapData.dimensions.width}, ${TILE_SIZE_PX}px)`,
            gridTemplateRows: `repeat(${mapData.dimensions.height}, ${TILE_SIZE_PX}px)`,
            position: 'relative',
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
          
            return (
              <BattleMapTile
                key={tile.id}
                tile={tile}
                isValidMove={isValidMove}
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

          {objectInteraction && (mapData.targetableObjects ?? [])
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
            showLineOfSightCone={showLineOfSightCone}
            lineOfSightOriginCharacterId={currentCharacter?.id ?? null}
            spellMovementVisuals={turnManager.spellMovementVisuals || []}
            spellDeliveryVisuals={turnManager.spellDeliveryVisuals || []}
            aoePreview={abilitySystem.aoePreview}
            teleportDestinationPreview={abilitySystem.teleportDestinationPreview}
            assignedTeleportDestinations={assignedTeleportDestinations}
          />
        </div>
      </div>
    </div>
  );
};

export default BattleMap;
