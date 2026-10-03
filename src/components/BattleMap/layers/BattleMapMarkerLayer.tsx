/**
 * @file layers/BattleMapMarkerLayer.tsx
 * Everything the 2D battle map draws ON TOP of the tiles: spell/encounter/
 * evidentiary overlays and the character, object, and aftermath tokens.
 *
 * WHAT MOVED HERE (agora-9950): the `<BattleMapOverlays>` and
 * `<BattleMapTokens>` mounts from BattleMap.tsx, plus the run of
 * `turnManager.x || []` and `abilitySystem.x` reads that used to be written
 * inline as prop expressions there. Those reads are the real content of this
 * seam — twenty-odd live turn-manager channels normalized from
 * "possibly undefined" into the arrays the overlay renderer requires — and they
 * belong with the layer that consumes them, not in the middle of a JSX tree.
 *
 * WHY THIS IS A LAYER AND NOT A PASS-THROUGH: BattleMap.tsx now hands this
 * component the two live combat hooks and the derived overlay inputs. The
 * fan-out to individual overlay props happens once, here. BattleMap's render
 * tree reads as five layers instead of one seventy-line prop wall.
 *
 * WHAT WAS PRESERVED: every prop value is the same expression it was inline,
 * including the `LightSource[]` assertion on `activeLightSources` and the
 * `boardScale` note on the token layer. The component renders a FRAGMENT, so
 * both children stay direct children of the CSS grid exactly as before.
 *
 * Called by: BattleMap.tsx
 * Depends on: BattleMapOverlays, BattleMapTokens.
 */

import React from "react";
import type { LightSource } from "../../../types/combat";
import type { useTurnManager } from "../../../hooks/combat/useTurnManager";
import type { useAbilitySystem } from "../../../hooks/useAbilitySystem";
import {
  BattleMapOverlays,
  type BattleMapOverlaysProps,
} from "../BattleMapOverlays";
import {
  BattleMapTokens,
  type BattleMapTokensProps,
} from "../BattleMapTokens";

export interface BattleMapMarkerLayerProps
  extends Pick<
      BattleMapOverlaysProps,
      | "mapData"
      | "characters"
      | "boardScale"
      | "showTargetableObjectFacts"
      | "showWorldOccupants"
      | "worldOccupantGroups"
      | "openingTrackMarks"
      | "encounterMarker"
      | "encounterDirection"
      | "showLightSourceMarkers"
      | "lineOfSightOverlayVisible"
      | "currentCharacterId"
      | "spellMapArtifacts"
      | "assignedTeleportDestinations"
    >,
    Pick<
      BattleMapTokensProps,
      | "selectedCharacterId"
      | "validTargetSet"
      | "turnCharacterId"
      | "onCharacterClick"
      | "assetOverlayVisible"
      | "objectInteraction"
    > {
  /** Live turn manager; the source of every animated overlay channel below. */
  turnManager: ReturnType<typeof useTurnManager>;
  /** Live ability system; supplies targeting mode and the two previews. */
  abilitySystem: ReturnType<typeof useAbilitySystem>;
}

export const BattleMapMarkerLayer: React.FC<BattleMapMarkerLayerProps> = ({
  mapData,
  characters,
  boardScale,
  turnManager,
  abilitySystem,
  showTargetableObjectFacts,
  showWorldOccupants,
  worldOccupantGroups,
  openingTrackMarks,
  encounterMarker,
  encounterDirection,
  showLightSourceMarkers,
  lineOfSightOverlayVisible,
  currentCharacterId,
  spellMapArtifacts,
  assignedTeleportDestinations,
  selectedCharacterId,
  validTargetSet,
  turnCharacterId,
  onCharacterClick,
  assetOverlayVisible,
  objectInteraction,
}) => (
  <>
    {/* Environmental, tactical, and evidentiary overlays */}
    <BattleMapOverlays
      mapData={mapData}
      characters={characters}
      boardScale={boardScale}
      showTargetableObjectFacts={showTargetableObjectFacts}
      showWorldOccupants={showWorldOccupants}
      worldOccupantGroups={worldOccupantGroups}
      openingTrackMarks={openingTrackMarks}
      encounterMarker={encounterMarker}
      encounterDirection={encounterDirection}
      damageNumbers={turnManager.damageNumbers || []}
      animations={turnManager.animations || []}
      spellZones={turnManager.spellZones || []}
      scheduledSpellEffects={turnManager.scheduledSpellEffects || []}
      movementDebuffs={turnManager.movementDebuffs || []}
      activeLightSources={
        (turnManager.activeLightSources || []) as LightSource[]
      }
      showLightSourceMarkers={showLightSourceMarkers}
      lineOfSightOverlayVisible={lineOfSightOverlayVisible}
      currentCharacterId={currentCharacterId}
      spellMovementVisuals={turnManager.spellMovementVisuals || []}
      spellDeliveryVisuals={turnManager.spellDeliveryVisuals || []}
      spellMapArtifacts={spellMapArtifacts}
      aoePreview={abilitySystem.aoePreview}
      teleportDestinationPreview={abilitySystem.teleportDestinationPreview}
      assignedTeleportDestinations={assignedTeleportDestinations}
    />

    {/* Character tokens, movable objects, and aftermath bodies */}
    <BattleMapTokens
      mapData={mapData}
      characters={characters}
      selectedCharacterId={selectedCharacterId}
      validTargetSet={validTargetSet}
      targetingMode={abilitySystem.targetingMode}
      turnCharacterId={turnCharacterId}
      onCharacterClick={onCharacterClick}
      assetOverlayVisible={assetOverlayVisible}
      objectInteraction={objectInteraction}
      /* VIZ-3: the tokens live inside the CSS-scaled frame above, so this is
         the only place that knows how big a 32 px token actually is on
         screen. */
      boardScale={boardScale}
    />
  </>
);

export default BattleMapMarkerLayer;
