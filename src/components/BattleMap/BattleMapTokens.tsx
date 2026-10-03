// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/08/2026, 13:55:32
 * Dependents: components/BattleMap/BattleMap.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from "react";
import type { BattleMapData, CombatCharacter } from "../../types/combat";
import { TILE_SIZE_PX } from "../../config/mapConfig";
import CharacterToken, { OpeningThreatWorldBody } from "./CharacterToken";
import type { ObjectInteractionProps } from "./hooks/useBattleMapPointer";

/**
 * This component renders the token and physical entity layer of the battle map.
 *
 * It manages the visual display and click interactions for combatant tokens (player characters,
 * companions, summoned creatures, enemy monsters), resolved scenario aftermath bodies,
 * and movable scenario objects (e.g. carryable torches and cover props).
 *
 * Called by: BattleMap.tsx
 * Depends on: CharacterToken.tsx for individual token badges, health bars, and condition icons.
 */

export interface BattleMapTokensProps {
  mapData: BattleMapData;
  characters: CombatCharacter[];
  selectedCharacterId: string | null;
  validTargetSet: Set<string>;
  targetingMode?: boolean;
  turnCharacterId?: string | null;
  onCharacterClick: (character: CombatCharacter) => void;
  assetOverlayVisible?: boolean;
  objectInteraction?: ObjectInteractionProps;
  /**
   * VIZ-3 (agora-75ed.3): the board's live CSS scale, forwarded to each token
   * so it can drop badge detail and thicken its keyline when the board is
   * shrunk. Optional; an omitted scale keeps the full-detail token.
   */
  boardScale?: number;
}

export const BattleMapTokens: React.FC<BattleMapTokensProps> = ({
  mapData,
  characters,
  selectedCharacterId,
  validTargetSet,
  targetingMode = false,
  turnCharacterId = null,
  onCharacterClick,
  assetOverlayVisible = true,
  objectInteraction,
  boardScale,
}) => {
  return (
    <>
      {/* ==================================================================== */}
      {/* Targetable Map Assets & Movable Objects Buttons                      */}
      {/* ==================================================================== */}
      {assetOverlayVisible &&
        objectInteraction &&
        (mapData.targetableObjects ?? [])
          .filter((targetObject) =>
            objectInteraction.movableObjectIds.includes(targetObject.id),
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
                  // Stop propagation so selecting an object does not immediately
                  // command a move to its current tile.
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

      {/* ==================================================================== */}
      {/* Opening Standoff Aftermath Bodies                                    */}
      {/* ==================================================================== */}
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

      {/* ==================================================================== */}
      {/* Combatant Character Tokens                                           */}
      {/* ==================================================================== */}
      {characters.map((character) => {
        const charTileId = `${character.position.x}-${character.position.y}`;
        const isTargetable = validTargetSet.has(charTileId);

        return (
          <CharacterToken
            key={character.id}
            character={character}
            position={character.position}
            isSelected={selectedCharacterId === character.id}
            isTargetable={isTargetable}
            targetingMode={targetingMode}
            isTurn={turnCharacterId === character.id}
            onCharacterClick={onCharacterClick}
            boardScale={boardScale}
          />
        );
      })}
    </>
  );
};

export default BattleMapTokens;
