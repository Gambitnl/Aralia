// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/07/2026, 05:50:27
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
import React from 'react';
import { BattleMapTile as BattleMapTileData, EnvironmentalEffect, LightLevel } from '../../types/combat';

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
  moveEdges?: { top: boolean; right: boolean; bottom: boolean; left: boolean };
  isVisible?: boolean;
  lightLevel?: LightLevel;
  showCoverLabel?: boolean;
  targetingMode: boolean;
  onTileClick: (tile: BattleMapTileData) => void;
  onTileHover?: (tile: BattleMapTileData) => void;
}

// ============================================================================
// Tile Environmental Effect Visuals
// ============================================================================
// This section turns map-mutated environmental effects into compact 2D markers.
// The 3D map already reads the same tile data in VFXSystem; keeping the mapping
// here lets the 2D grid show hazards even when no active spell-zone overlay is
// present.
// ============================================================================

type EnvironmentalEffectVisual = {
  label: string;
  overlayClass: string;
  textClass: string;
};

type CoverTileVisual = {
  label: string;
  description: string;
  textClass: string;
};

const ENVIRONMENTAL_EFFECT_VISUALS: Record<EnvironmentalEffect['type'], EnvironmentalEffectVisual> = {
  fire: {
    label: 'FIRE',
    overlayClass: 'bg-orange-500/35',
    textClass: 'text-orange-100 bg-orange-900/80 border-orange-300/60'
  },
  ice: {
    label: 'ICE',
    overlayClass: 'bg-cyan-300/30',
    textClass: 'text-cyan-50 bg-cyan-900/80 border-cyan-200/60'
  },
  poison: {
    label: 'POIS',
    overlayClass: 'bg-lime-500/30',
    textClass: 'text-lime-50 bg-lime-900/80 border-lime-200/60'
  },
  difficult_terrain: {
    label: 'DIFF',
    overlayClass: 'bg-amber-500/25',
    textClass: 'text-amber-50 bg-amber-900/80 border-amber-200/60'
  },
  web: {
    label: 'WEB',
    overlayClass: 'bg-slate-200/30',
    textClass: 'text-slate-50 bg-slate-800/85 border-slate-100/70'
  },
  fog: {
    label: 'FOG',
    overlayClass: 'bg-slate-300/25',
    textClass: 'text-slate-50 bg-slate-700/85 border-slate-100/60'
  },
  hazard: {
    label: 'HAZ',
    overlayClass: 'bg-rose-500/30',
    textClass: 'text-rose-50 bg-rose-950/85 border-rose-200/70'
  }
};

function getEnvironmentalEffectVisual(tile: BattleMapTileData): EnvironmentalEffectVisual | null {
  // Empty environmental-effect lists mean the tile has no spell-mutated hazard
  // beyond its normal terrain texture.
  if (!tile.environmentalEffects?.length) {
    return null;
  }

  // Use the first effect as the summary marker for now. This is intentionally
  // compact for the grid; if stacked effects become common, the next slice
  // should add a richer stack indicator or tooltip detail instead of crowding
  // the tile with multiple badges.
  return ENVIRONMENTAL_EFFECT_VISUALS[tile.environmentalEffects[0].type];
}

function getCoverTileVisual(tile: BattleMapTileData): CoverTileVisual | null {
  // Wall tiles are the sandbox's total-cover teaching pieces: they stop line of
  // sight entirely, so they need a different badge from AC-boosting cover.
  if (tile.blocksLoS && tile.blocksMovement && tile.terrain === 'wall') {
    return {
      label: 'TC',
      description: 'total cover',
      textClass: 'text-red-50 bg-red-950/90 border-red-300/80'
    };
  }

  // Pillars use the same special case as calculateCover: they are cover tiles,
  // but they protect more strongly than brush, logs, or similar low obstacles.
  if (tile.providesCover && tile.decoration === 'pillar') {
    return {
      label: '3/4',
      description: 'three-quarters cover',
      textClass: 'text-amber-50 bg-amber-950/90 border-amber-300/80'
    };
  }

  // Any other cover-providing tile follows the combat utility's default half
  // cover rule. The badge is deliberately short so it fits inside a 32px tile.
  if (tile.providesCover) {
    return {
      label: 'HC',
      description: 'half cover',
      textClass: 'text-yellow-950 bg-yellow-300/95 border-yellow-50/80'
    };
  }

  return null;
}

const BattleMapTile: React.FC<BattleMapTileProps> = React.memo(({ tile, isValidMove, isInPath, isTargetable, isAoePreview, isTeleportDestinationPreview, isObjectMoveDestination = false, moveEdges, isVisible = true, lightLevel = 'bright', showCoverLabel = false, targetingMode, onTileClick, onTileHover }) => {
  // Terrain color is the underlying ground. Spell-mutated environmental effects
  // are layered later so they can appear on grass, stone, water, or any biome.
  // Muted, low-chroma terrain tones so the translucent move/attack/AoE overlays
  // read clearly on top (the ornate mockup relies on that contrast). Grass is a
  // deep forest green rather than a bright mid-green so the emerald move-range
  // highlight stands out against it.
  const getTerrainColor = (terrain: string) => {
    switch (terrain) {
      case 'grass': return 'bg-[#1c3524]';
      case 'rock':
      case 'floor':
      case 'stone': return 'bg-slate-600';
      case 'water': return 'bg-sky-900';
      case 'difficult': return 'bg-amber-900';
      case 'wall': return 'bg-slate-900';
      case 'sand': return 'bg-yellow-800';
      case 'mud': return 'bg-stone-800';
      default: return 'bg-[#0e1a13]';
    }
  };

  // Tiles are transparent so the painted ground canvas (BattleMapGroundCanvas)
  // shows through; a faint terrain tint keeps type legibility and gives the
  // move/attack overlays something to sit on. Trees/rocks are drawn on the
  // canvas now, so the tile no longer renders emoji decorations.
  // Warm low-alpha ink line instead of flat gray, so the grid sits IN the
  // painted illustration rather than on top of it like a spreadsheet.
  const tileBaseClasses = 'w-full h-full flex items-center justify-center border border-[#8a6b42]/10';
  const terrainColor = getTerrainColor(tile.terrain);
  const environmentalVisual = getEnvironmentalEffectVisual(tile);
  const coverVisual = showCoverLabel ? getCoverTileVisual(tile) : null;
  const environmentalSummary = tile.environmentalEffects?.map(effect => effect.type).join(', ') ?? 'none';

  // Overlay palette matches the map legend: green = reachable movement, a
  // brighter green = the chosen destination/path, red = attack/targetable,
  // orange = area effect. Keeping these in sync with the legend is what makes
  // the tactical read match the mockup.
  let overlayClass = '';
  if (isTeleportDestinationPreview) {
      overlayClass = 'bg-sky-400/55';
  } else if (isAoePreview) {
      overlayClass = 'bg-orange-500/55';
  } else if (isTargetable) {
      overlayClass = 'bg-rose-500/40';
  } else if (isInPath) {
    overlayClass = 'bg-emerald-300/60';
  } else if (isValidMove) {
    // Quiet interior — the perimeter stroke (moveEdges) carries the boundary,
    // so the fill can drop low enough to keep the terrain art readable.
    overlayClass = 'bg-emerald-400/20';
  } else if (isObjectMoveDestination) {
    overlayClass = 'bg-amber-400/20';
  }

  // Visibility is separate from targeting and movement overlays. The masks are
  // deliberately light now that a painted ground sits underneath: hidden and
  // dark tiles still read as "limited sight" but the battlefield art stays
  // visible instead of being crushed to solid black (which turned the whole map
  // into a dark checkerboard).
  const visibilityOverlayClass = !isVisible
    ? 'bg-black/55'
    : lightLevel === 'magical_darkness'
      ? 'bg-black/45'
      : lightLevel === 'darkness'
      ? 'bg-black/25'
        : lightLevel === 'dim'
          ? 'bg-slate-950/15'
          : '';
  
  // Targeting mode must send every tile click to the validation layer. Legal
  // tiles still get bright overlays, while illegal tiles can now produce the
  // existing "why this cannot be targeted" banner instead of doing nothing.
  const isInteractive = targetingMode || isValidMove || isTargetable || isTeleportDestinationPreview || isObjectMoveDestination;

  const handleActivate = () => {
    if (!isInteractive) return;
    onTileClick(tile);
  };

  return (
    <div
      className={`${tileBaseClasses} group relative transition-colors duration-150`}
      onClick={handleActivate}
      onMouseEnter={() => onTileHover?.(tile)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleActivate();
        }
      }}
      role="button"
      tabIndex={isInteractive ? 0 : -1}
      aria-disabled={!isInteractive}
      aria-label={`Tile ${tile.terrain} at ${tile.coordinates.x}, ${tile.coordinates.y}${coverVisual ? `, ${coverVisual.description}` : ''}`}
      style={{ cursor: targetingMode ? 'crosshair' : (isInteractive ? 'pointer' : 'default') }}
      title={`(${tile.coordinates.x}, ${tile.coordinates.y}) - ${tile.terrain}${coverVisual ? ` - ${coverVisual.description}` : ''} - Elev: ${tile.elevation} - ${isVisible ? lightLevel : 'hidden'} - Effects: ${environmentalSummary}`}
    >
      {/* Faint terrain tint over the painted ground, for type legibility and to
          give the move/attack overlays a base. */}
      <div className={`absolute inset-0 ${terrainColor} opacity-20 pointer-events-none`} />
      {/* Elevation is hover-only: always-on digits across the board read as a
          debug overlay, not a battle map. The number appears on the tile under
          the cursor (and stays in the title tooltip). */}
      {tile.elevation > 1 && (
        <div className="absolute top-0 right-0.5 text-[9px] font-bold text-slate-200/70 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
          {tile.elevation}
        </div>
      )}
      {/* Crisp perimeter stroke around the outer boundary of the reachable
          move region — the core "how far can I go" read. */}
      {moveEdges && (moveEdges.top || moveEdges.right || moveEdges.bottom || moveEdges.left) && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            borderTop: moveEdges.top ? '2px solid rgba(52,211,153,0.9)' : undefined,
            borderRight: moveEdges.right ? '2px solid rgba(52,211,153,0.9)' : undefined,
            borderBottom: moveEdges.bottom ? '2px solid rgba(52,211,153,0.9)' : undefined,
            borderLeft: moveEdges.left ? '2px solid rgba(52,211,153,0.9)' : undefined,
          }}
        />
      )}
      {environmentalVisual && (
        <>
          <div className={`absolute inset-0 ${environmentalVisual.overlayClass} pointer-events-none`}></div>
          <div className={`absolute bottom-0 left-0 rounded-tr border px-0.5 text-[8px] font-black leading-3 tracking-wide shadow-sm pointer-events-none ${environmentalVisual.textClass}`}>
            {environmentalVisual.label}
          </div>
        </>
      )}
      {coverVisual && (
        <div className={`absolute top-0 left-0 z-10 rounded-br border px-0.5 text-[8px] font-black leading-3 tracking-wide shadow-sm pointer-events-none ${coverVisual.textClass}`}>
          {coverVisual.label}
        </div>
      )}
      {visibilityOverlayClass && <div className={`absolute inset-0 ${visibilityOverlayClass} pointer-events-none`}></div>}
      {overlayClass && <div className={`absolute inset-0 ${overlayClass} pointer-events-none`}></div>}
    </div>
  );
});

BattleMapTile.displayName = 'BattleMapTile';

export default BattleMapTile;
