/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 12:43:06
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file BattleMapTile.tsx
 * A memoized component for rendering a single tile on the battle map.
 *
 * Each tile is the smallest visible unit of the 2D combat map. It shows the
 * base ground, movement/targeting overlays, light visibility masks, and now
 * tile-level environmental spell effects such as fire, web, fog, and difficult
 * terrain. BattleMap.tsx feeds this component live tile data after commands
 * mutate the map.
 */
import React from "react";
import { BattleMapTile as BattleMapTileData, LightLevel } from "../../types/combat";
interface BattleMapTileProps {
    tile: BattleMapTileData;
    isValidMove: boolean;
    isInPath: boolean;
    isTargetable: boolean;
    isAoePreview: boolean;
    isTeleportDestinationPreview: boolean;
    isObjectMoveDestination?: boolean;
    /** Which edges of this tile form the outer boundary of the reachable-move
     *  region. The perimeter gets a crisp stroke so "how far can I go" is a
     *  single readable outline instead of a shapeless wash. */
    moveEdges?: {
        top: boolean;
        right: boolean;
        bottom: boolean;
        left: boolean;
    };
    /** Reachable tile that sits in a living enemy's melee reach — moving here
     *  provokes, so it gets a red hatch inside the move region. */
    isThreatened?: boolean;
    isVisible?: boolean;
    lightLevel?: LightLevel;
    showCoverLabel?: boolean;
    /** Creature whose ground height gives the player-facing relative baseline. */
    elevationReference?: {
        elevation: number;
        label: string;
    } | null;
    /** Lowest sampled tile in this crop; the player sees it as map height 0 ft. */
    mapBaselineElevation?: number;
    targetingMode: boolean;
    onTileClick: (tile: BattleMapTileData) => void;
    onTileHover?: (tile: BattleMapTileData) => void;
}
declare const BattleMapTile: React.FC<BattleMapTileProps>;
export default BattleMapTile;
