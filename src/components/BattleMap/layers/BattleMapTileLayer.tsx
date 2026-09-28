/**
 * @file layers/BattleMapTileLayer.tsx
 * The tactical tile layer of the 2D battle map: one <BattleMapTile> per
 * culled-in tile, with every per-tile flag the tile renderer needs.
 *
 * WHAT MOVED HERE (agora-9950): the `visibleTiles.map(...)` block that used to
 * sit inside the `.battle-map-grid` div in BattleMap.tsx. That block was the
 * only remaining place in the component where real per-element decisions
 * (targetable / AoE preview / teleport pad / reachable move / path / threat /
 * object-drop destination / move-region perimeter edges) were computed, and it
 * was buried fifteen levels deep in the render tree.
 *
 * WHAT WAS PRESERVED: the flag derivations are byte-identical to the inline
 * versions, in the same order, and every prop reaches BattleMapTile exactly as
 * before. The component renders a FRAGMENT, not a wrapper element: a fragment
 * emits no DOM node, so the tiles stay direct children of the CSS grid and the
 * board's geometry, stacking, and pointer targets are unchanged.
 *
 * Called by: BattleMap.tsx
 * Depends on: BattleMapTile for the per-tile render.
 */

import React from "react";
import type {
  BattleMapTile as BattleMapTileData,
  LightLevel,
  TargetableMapObject,
} from "../../../types/combat";
import BattleMapTile from "../BattleMapTile";
import type useBattleMapPointer from "../hooks/useBattleMapPointer";

type BattleMapPointerState = ReturnType<typeof useBattleMapPointer>;

export interface BattleMapTileLayerProps {
  /** Tiles inside the scroll viewport this frame, from the culling hook. */
  visibleTiles: BattleMapTileData[];
  /** Tile ids the selected ability can legally target right now. */
  validTargetSet: Set<string>;
  /** Tile ids inside the hovered ability's area of effect. */
  aoeSet: Set<string>;
  /** Tile ids offered as teleport destinations during assignment. */
  teleportDestinationSet: Set<string>;
  /** Tile ids on the previewed movement path. */
  activePathSet: Set<string>;
  /** Tactical visibility: which tiles are seen, and how brightly. */
  visibility: {
    visibleTiles: Set<string>;
    getLightLevel: (tileId: string) => LightLevel;
  };
  /** Current pointer action mode; only "move" paints reachable tiles. */
  actionMode: BattleMapPointerState["actionMode"];
  /** Tile ids reachable by the selected creature's remaining movement. */
  validMoves: BattleMapPointerState["validMoves"];
  /** "x,y" keys of reachable tiles, for the outer perimeter stroke. */
  validMoveCoordSet: Set<string>;
  /** "x,y" keys of reachable tiles that sit in a living enemy's melee reach. */
  threatCoordSet: Set<string>;
  /** Selected movable map object; every open tile becomes a drop destination. */
  activeObject: TargetableMapObject | null;
  showCoverLabels: boolean;
  elevationReference: { elevation: number; label: string } | null;
  elevationBaseline: number;
  targetingMode: boolean;
  onTileClick: (tile: BattleMapTileData) => void;
  onTileHover: (tile: BattleMapTileData) => void;
}

export const BattleMapTileLayer: React.FC<BattleMapTileLayerProps> = ({
  visibleTiles,
  validTargetSet,
  aoeSet,
  teleportDestinationSet,
  activePathSet,
  visibility,
  actionMode,
  validMoves,
  validMoveCoordSet,
  threatCoordSet,
  activeObject,
  showCoverLabels,
  elevationReference,
  elevationBaseline,
  targetingMode,
  onTileClick,
  onTileHover,
}) => (
  <>
    {visibleTiles.map((tile) => {
      const isTargetable = validTargetSet.has(tile.id);
      const isAoePreview = aoeSet.has(tile.id);
      const isTeleportDestinationPreview = teleportDestinationSet.has(tile.id);
      const isVisible = visibility.visibleTiles.has(tile.id);
      const lightLevel = visibility.getLightLevel(tile.id);
      const isValidMove = actionMode === "move" && validMoves.has(tile.id);
      const isInPath = activePathSet.has(tile.id);
      const isObjectMoveDestination = Boolean(
        activeObject && !tile.blocksMovement,
      );
      const { x: tx, y: ty } = tile.coordinates;
      // Only the OUTER boundary of the reachable region gets a stroke: an edge
      // is drawn when the neighbor across it is not itself reachable.
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
          elevationReference={elevationReference}
          mapBaselineElevation={elevationBaseline}
          targetingMode={targetingMode}
          onTileClick={onTileClick}
          onTileHover={onTileHover}
        />
      );
    })}
  </>
);

export default BattleMapTileLayer;
