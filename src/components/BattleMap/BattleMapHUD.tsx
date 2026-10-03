// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/10/2026, 00:42:28
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/layers/BattleMapRulers.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from "react";
import { RitualProgressPanel } from './RitualProgressPanel';
import type { RitualState } from '../../types/rituals';
import { CloudFog, Mountain, UsersRound } from "lucide-react";
import type { BattleMapTile as BattleMapTileData, CombatCharacter } from "../../types/combat";
import { Z_INDEX } from "../../styles/zIndex";
import {
  describeBattleMapTerrain,
  type BattleMapElevationPresentation as ElevationDescription,
} from "./elevationPresentation";

/**
 * This component renders the tactical heads-up display (HUD) and informational
 * overlays on top of the battle map.
 *
 * It provides the player with critical combat context: shared observer senses,
 * live target validation feedback, fog-of-war veil toggles, dynamic tile elevation
 * and terrain readouts, board zoom controls, and the map color legend.
 *
 * Called by: BattleMap.tsx
 * Depends on: elevationPresentation for height math and text descriptions.
 */

// ============================================================================
// Spreadsheet-Style Coordinate Helper
// ============================================================================
// Converts a 0-indexed row number into spreadsheet column lettering:
// 0 -> 'A', 25 -> 'Z', 26 -> 'AA', 27 -> 'AB', etc.
export const rowLabel = (index: number): string => {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
};

// ============================================================================
// Map Legend Swatches
// ============================================================================
// Standardized visual indicators explaining tile borders, threat ranges,
// elevation contours, and toggleable line-of-sight cones.
export const LEGEND_ITEMS: Array<{
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

export interface BattleMapHUDProps {
  sharedSenses?: { observerName: string } | null;
  targetingMode?: boolean;
  targetValidationReason?: string | null;
  currentCharacter?: CombatCharacter | null;
  isCurrentCharacterTurn?: boolean;
  showFogToggle?: boolean;
  fogOfWarVisible: boolean;
  onToggleFogOfWar: () => void;
  hoveredTile: BattleMapTileData | null;
  hoveredElevation: ElevationDescription | null;
  elevationReference: { elevation: number; label: string } | null;
  boardScale: number;
  fitScale: number;
  userZoom: number | null;
  onZoomBy: (factor: number) => void;
  onSetUserZoom: (zoom: number | null) => void;
  lineOfSightOverlayVisible: boolean;
  onToggleLineOfSight: () => void;
  showWorldOccupants?: boolean;
  hasWorldOccupants?: boolean;
  /** Ritual in progress (game state activeRitual); renders the progress panel top-right. */
  activeRitual?: RitualState | null;
  characters?: CombatCharacter[];
}

export const BattleMapHUD: React.FC<BattleMapHUDProps> = ({
  sharedSenses,
  targetingMode,
  targetValidationReason,
  currentCharacter,
  isCurrentCharacterTurn,
  showFogToggle,
  fogOfWarVisible,
  onToggleFogOfWar,
  hoveredTile,
  hoveredElevation,
  elevationReference,
  boardScale,
  fitScale,
  userZoom,
  onZoomBy,
  onSetUserZoom,
  lineOfSightOverlayVisible,
  onToggleLineOfSight,
  showWorldOccupants = false,
  hasWorldOccupants = false,
  activeRitual = null,
  characters = [],
}) => {
  return (
    <>
      {/* ==================================================================== */}
      {/* Top Banners & Validation Notices                                     */}
      {/* ==================================================================== */}
      <RitualProgressPanel ritual={activeRitual} characters={characters} />

      {sharedSenses && (
        <div
          className="absolute left-3 top-3 rounded-full border border-cyan-300/80 bg-slate-950/88 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.38)]"
          style={{ zIndex: Z_INDEX.COMBAT_OVERLAY }}
        >
          {/* This label clarifies which observer's senses are currently active */}
          Viewing through {sharedSenses.observerName}
        </div>
      )}

      {targetingMode && targetValidationReason && (
        <div
          role="status"
          aria-live="polite"
          className="absolute left-3 top-16 max-w-[18rem] rounded border border-rose-300/70 bg-slate-950/90 px-3 py-2 text-xs font-semibold leading-snug text-rose-100 shadow-[0_0_16px_rgba(244,63,94,0.28)]"
          style={{ zIndex: Z_INDEX.COMBAT_OVERLAY }}
        >
          {targetValidationReason}
        </div>
      )}

      {/* Dev / Review affordance: fog-of-war veil toggle toolbar */}
      {currentCharacter && isCurrentCharacterTurn && showFogToggle && (
        <div
          data-testid="battle-map-fog-toolbar"
          className="absolute left-3 top-3 flex gap-2 rounded-md border border-slate-600/70 bg-slate-950/80 p-1.5 shadow-lg backdrop-blur-sm"
          style={{ zIndex: Z_INDEX.COMBAT_OVERLAY }}
        >
          <button
            onClick={onToggleFogOfWar}
            type="button"
            aria-pressed={fogOfWarVisible}
            aria-label="Toggle fog of war"
            title={
              fogOfWarVisible
                ? "Hide the fog-of-war veil (render only)"
                : "Show the fog-of-war veil"
            }
            className={`inline-flex h-9 items-center gap-1.5 rounded px-3 text-xs font-semibold transition-colors ${
              fogOfWarVisible
                ? "bg-sky-700 text-white ring-2 ring-sky-300"
                : "bg-gray-600 hover:bg-gray-500"
            }`}
          >
            <CloudFog size={14} aria-hidden="true" />
            <span>Fog</span>
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* Elevation & Terrain Readout                                          */}
      {/* ==================================================================== */}
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
          data-tile-terrain={hoveredTile.terrain}
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
            <span className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-3 border-b border-slate-800 pb-0.5">
              <span className="text-[11px] text-slate-300">Terrain</span>
              <span className="text-right text-xs font-black text-slate-100">
                {describeBattleMapTerrain(hoveredTile)}
              </span>
            </span>
            <span className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b border-slate-800 pb-0.5">
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

      {/* ==================================================================== */}
      {/* Zoom and Fit Controls                                                */}
      {/* ==================================================================== */}
      <div
        className="absolute bottom-10 right-3 flex items-center gap-1 rounded-md border border-amber-800/50 bg-slate-950/85 p-1 shadow-lg"
        style={{ zIndex: Z_INDEX.COMBAT_OVERLAY }}
      >
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => onZoomBy(1 / 1.25)}
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
          onClick={() => onZoomBy(1.25)}
          className="h-7 w-7 rounded bg-slate-800 text-sm font-bold text-slate-200 hover:bg-slate-700"
        >
          +
        </button>
        <button
          type="button"
          aria-label="Fit map to view"
          onClick={() => onSetUserZoom(fitScale)}
          className={`h-7 rounded px-2 text-xs font-semibold ${
            userZoom !== null && Math.abs(boardScale - fitScale) < 0.001
              ? "bg-amber-700 text-amber-50"
              : "bg-slate-800 text-slate-200 hover:bg-slate-700"
          }`}
        >
          Fit
        </button>
        <button
          type="button"
          aria-label="Reset zoom to automatic"
          onClick={() => onSetUserZoom(null)}
          className={`h-7 rounded px-2 text-xs font-semibold ${
            userZoom === null
              ? "bg-amber-700 text-amber-50"
              : "bg-slate-800 text-slate-200 hover:bg-slate-700"
          }`}
        >
          Auto
        </button>
      </div>

      {/* ==================================================================== */}
      {/* Legend & Toggles (Footer)                                            */}
      {/* ==================================================================== */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-1 text-xs text-slate-300">
        {LEGEND_ITEMS.map((item) => {
          if (item.toggle) {
            return (
              /* eslint-disable-next-line no-restricted-syntax -- Tiny legend swatch toggle */
              <button
                key={item.label}
                type="button"
                aria-label={`${lineOfSightOverlayVisible ? "Hide" : "Show"} line of sight overlay`}
                aria-pressed={lineOfSightOverlayVisible}
                onClick={onToggleLineOfSight}
                className={`flex items-center gap-1.5 rounded px-1.5 py-1 transition-colors ${
                  lineOfSightOverlayVisible
                    ? "text-slate-100 hover:bg-slate-800"
                    : "text-slate-500 hover:bg-slate-800/70 hover:text-slate-300"
                }`}
                title={`${lineOfSightOverlayVisible ? "Hide" : "Show"} line-of-sight overlay`}
              >
                <span
                  className={`inline-block h-3 w-3 rounded-sm ${item.swatch} ${
                    lineOfSightOverlayVisible ? "" : "opacity-40"
                  }`}
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
        {showWorldOccupants && hasWorldOccupants && (
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
    </>
  );
};

export default BattleMapHUD;
