/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 17/07/2026, 22:34:53
 * Dependents: components/layout/GameModals.tsx
 * Imports: 51 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file MapPane.tsx
 * World map modal surface. Worldforge native renderers (SVG/canvas) are the sole
 * cartography system. The Azgaar iframe has been retired (2026-06-24).
 *
 * The pane receives legacy `MapData` for player position/discovery tracking.
 * These reads pass through the World geography adapter, preserving travel,
 * discovery, and 3D-entry contracts during the Submap → Worldforge transition.
 */
import React from 'react';
import { MapTile as MapTileType } from '../types';
import type { Item } from '@/types/items';
import type { TravelMeta } from '@/types/travelMeta';
import type { PlayerWorldPosition, DiscoveredHiddenSite } from '../types';
import type { Entry3DAnchor } from '@/types/state';
import { type TripEventPartyMember } from '@/systems/travel/tripEvents';
import type { Ship } from '@/types/naval';
interface MapPaneProps {
    worldSeed?: number;
    onTileClick: (x: number, y: number, tile: MapTileType, travelMeta?: TravelMeta) => void;
    /** When set, clicking a discovered cell in Enter 3D mode starts streamed world entry. */
    onEnter3DAtCell?: (x: number, y: number, tile: MapTileType, anchor?: Entry3DAnchor) => void;
    /** Last known 3D position — draws AtlasPlayerMarker on the Worldforge atlas. */
    playerWorldPos?: PlayerWorldPosition | null;
    /** SP4 discovered hidden places — pinned on the World Forge atlas. */
    discoveredHiddenSites?: DiscoveredHiddenSite[];
    /**
     * Pillar 2, Task 8 (living ecology): frozen site paths of cleared dungeons
     * (state.clearedDungeons). Drives the danger overlay's dungeon term — every
     * UNCLEARED site bumps the danger around its cell. Omit → all sites uncleared.
     */
    clearedDungeonPaths?: string[];
    onClose: () => void;
    allowTravel?: boolean;
    /** Show Enter 3D interaction mode (PLAYING phase atlas click-to-travel). */
    allow3DEntry?: boolean;
    showGenerationControls?: boolean;
    canRegenerateWorld?: boolean;
    generationLockedReason?: string | null;
    onRegenerateWorld?: (seed?: number) => void;
    /**
     * Optional maritime proof/generation flag. Default-off preserves the frozen
     * FMG world topology; proof harnesses can enable it to test generated island
     * harbor reachability without changing normal gameplay saves yet.
     */
    enableIslandHarbors?: boolean;
    /**
     * Shared party inventory — feeds the travel-mode provisioning rings + readout
     * (how far current rations/water reach). Omit to hide the provisioning UI.
     */
    provisionInventory?: Item[];
    /** Number of party members consuming rations/water (provisioning consumers). */
    partySize?: number;
    /**
     * The party's spendable gold (`gameState.gold`) — used to gate hired-ferry
     * travel (travel G15). When a sea crossing's fare exceeds this, the ferry pick
     * is rejected with an "insufficient gold" cue instead of a free trip. Omit → 0.
     */
    partyGold?: number;
    /** Best forager's Survival modifier (Wis mod + proficiency) — for the forage choice. */
    partySurvivalModifier?: number;
    /**
     * Real party travel modes; a horse is offered only when a member is mounted.
     * GameModals binds this to `gameState.party`, so the full member objects are
     * already here — trip-event skill checks read their optional check fields
     * (ability scores, skill proficiencies, proficiency bonus) off the SAME
     * array; transport-only callers stay valid because those fields are optional.
     */
    transportParty?: Array<{
        transportMode?: 'foot' | 'mounted';
    } & TripEventPartyMember>;
    /** Persisted atlas cells reached by this party, derived from discovery entries. */
    exploredCellIds?: number[];
    /**
     * The player's currently active owned ship. When provided and the ship is
     * docked at the player's current port, the 'Ship (owned)' sea-travel option
     * becomes selectable. Omit (or pass null) when no active ship is available.
     */
    activeShip?: Ship | null;
    /**
     * Called instead of onTileClick when the player commits a port→port voyage in
     * an owned ship. It notifies the caller that a voyage was committed (with the
     * destination port burg id and the sea-miles distance) so the caller can start
     * the voyage and open the voyage UI. No teleport happens for ship travel.
     */
    onSetSail?: (destinationBurgId: number, seaMiles: number, danger: number) => void;
    /**
     * The player's canonical atlas cell (`gameState.playerCell.cellId`) — the
     * source-of-truth Voronoi cell they occupy. When present it drives the
     * "you are here" pin EXACTLY, instead of reverse-deriving the cell from the
     * coarse 30×20 grid tile. This matters at spawn: a chosen start town's exact
     * cell is carried here, so the pin sits ON the town rather than drifting to a
     * neighbouring cell (the grid-center round-trip rounds ~16 fine cells per grid
     * square to whichever is nearest the square's centre). After grid movement the
     * id is re-derived from the tile via the same mapping the pin would have used,
     * so there is no post-spawn regression. Omit ⇒ fall back to the grid round-trip.
     */
    playerAtlasCellId?: number | null;
    /**
     * The in-world clock (`gameState.gameTime`). Season contract (G3): travel
     * route planning multiplies edge minutes by the current season's
     * travelCostMultiplier (winter routes take 1.5x as long). Omit ⇒ neutral 1x
     * (main-menu previews and tests plan season-free).
     */
    gameTime?: Date | null;
}
declare const MapPane: React.FC<MapPaneProps>;
export default MapPane;
