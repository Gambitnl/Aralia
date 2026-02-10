/**
 * @file Minimap.tsx
 * A miniature "looking glass" view into the current submap showing the player's position
 * and the actual terrain/features around them. The minimap shows 8 tiles in each direction
 * from the player, and when the player approaches the edge, the player marker shifts toward
 * that edge instead of remaining centered.
 *
 * This component uses the same procedural data generation (useSubmapProceduralData) and
 * visual functions (submapVisuals) as SubmapPane to ensure visual consistency.
 */

import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { MapData, BiomeVisuals } from '../types';
import { BIOMES } from '../constants';
import { SUBMAP_DIMENSIONS } from '../config/mapConfig';
import { biomeVisualsConfig, defaultBiomeVisuals } from '../config/submapVisualsConfig';
import { useSubmapProceduralData } from '../hooks/useSubmapProceduralData';
import {
  VisualLayerOutput,
  getBaseVisuals,
  applyPathVisuals,
  applyWfcVisuals,
  applySeededFeatureVisuals,
  applyScatterVisuals
} from './Submap/submapVisuals';
import { Z_INDEX } from '../styles/zIndex';
import { UI_ID } from '../styles/uiIds';

// ============================================================================
// PROPS INTERFACE
// ============================================================================

interface MinimapProps {
  /** The world map data (used to get biome info) */
  mapData: MapData | null;
  /** Player's current world map tile coordinates */
  currentLocationCoords: { x: number; y: number };
  /** Player's position within the submap (0-indexed x,y) */
  submapCoords: { x: number; y: number } | null;
  /** Whether the minimap is visible */
  visible: boolean;
  /** Callback to toggle the submap (tactical view) */
  toggleSubmap: () => void;
  /** World seed for procedural generation consistency */
  worldSeed: number;
}

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

// Size of the minimap canvas in pixels
const MINIMAP_SIZE = 150;

// Number of tiles to show in each direction from the player (total viewport = TILE_RADIUS * 2 + 1)
const TILE_RADIUS = 8;

// Total tiles shown in each dimension (17 x 17 grid)
const VIEWPORT_TILES = TILE_RADIUS * 2 + 1;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extracts RGB values from a CSS color string (rgba, rgb, or hex).
 * Returns [r, g, b] or null if parsing fails.
 */
function parseColor(color: string | undefined): [number, number, number] | null {
  if (!color) return null;

  // Handle rgba(r, g, b, a) or rgb(r, g, b)
  const rgbaMatch = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbaMatch) {
    return [
      parseInt(rgbaMatch[1], 10),
      parseInt(rgbaMatch[2], 10),
      parseInt(rgbaMatch[3], 10)
    ];
  }

  // Handle #RRGGBB or #RGB
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16)
      ];
    }
    if (hex.length >= 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16)
      ];
    }
  }

  return null;
}

/**
 * Extracts the emoji character from a React content node.
 * Used to identify which icon is being rendered on a tile.
 */
function extractIcon(content: React.ReactNode): string | null {
  if (!content) return null;
  if (typeof content === 'string') return content;

  // If content is a React element (like <span>emoji</span>), try to get children
  if (React.isValidElement(content)) {
    const children = (content.props as { children?: React.ReactNode }).children;
    if (typeof children === 'string') return children;
  }

  return null;
}

// ============================================================================
// MINIMAP COMPONENT
// ============================================================================

/**
 * Minimap Component
 *
 * Displays a small overhead "looking glass" view of the current submap with the player's position.
 * Features:
 * - Shows 8 tiles in each direction from the player (17x17 viewport)
 * - Uses the SAME procedural data as SubmapPane for visual consistency
 * - Renders actual terrain features: paths, villages, ponds, trees, etc.
 * - Player marker stays centered unless near an edge
 * - When near an edge (<8 tiles), player marker shifts toward that edge
 */
const Minimap: React.FC<MinimapProps> = ({
  mapData,
  currentLocationCoords,
  submapCoords,
  visible,
  toggleSubmap,
  worldSeed
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ========================================================================
  // GET CURRENT BIOME CONFIGURATION
  // ========================================================================

  // Determine the biome ID from the world map tile
  const currentBiomeId = useMemo(() => {
    if (!mapData) return 'plains';
    const { x, y } = currentLocationCoords;
    // Bounds check for the world map
    if (y >= 0 && y < mapData.tiles.length && x >= 0 && x < mapData.tiles[y].length) {
      return mapData.tiles[y][x].biomeId;
    }
    return 'plains';
  }, [mapData, currentLocationCoords]);

  // Get the biome's visual configuration (colors, icons, features)
  const visualsConfig: BiomeVisuals = useMemo(() => {
    const biome = BIOMES[currentBiomeId];
    if (biome && biomeVisualsConfig[biome.id]) {
      return biomeVisualsConfig[biome.id];
    }
    return defaultBiomeVisuals;
  }, [currentBiomeId]);

  // ========================================================================
  // PROCEDURAL DATA GENERATION
  // ========================================================================

  // Use the SAME procedural data hook as SubmapPane to ensure visual consistency
  // This generates paths, seeded features (ponds, villages), scatter (trees, flowers), etc.
  const { simpleHash, activeSeededFeatures, pathDetails, caGrid, wfcGrid } = useSubmapProceduralData({
    submapDimensions: SUBMAP_DIMENSIONS,
    currentWorldBiomeId: currentBiomeId,
    parentWorldMapCoords: currentLocationCoords,
    worldSeed,
  });

  // ========================================================================
  // TILE VISUAL CALCULATION (same logic as SubmapPane)
  // ========================================================================

  /**
   * Calculates the visual properties for a single tile.
   * This mirrors the getTileVisuals function in SubmapPane exactly
   * to ensure the minimap shows the same content as the full submap.
   */
  const getTileVisuals = useCallback((rowIndex: number, colIndex: number): VisualLayerOutput => {
    // Generate a deterministic hash for this tile position
    const tileHash = simpleHash(colIndex, rowIndex, 'tile_visual_seed_v4');

    // --- CA Grid Logic (caves/dungeons) ---
    // If a cellular automata grid exists, use it for wall/floor rendering
    if (caGrid && visualsConfig.caTileVisuals) {
      const tileType = caGrid[rowIndex]?.[colIndex] || 'wall';
      const tileVisual = visualsConfig.caTileVisuals[tileType];

      let visuals: VisualLayerOutput = {
        style: { backgroundColor: tileVisual.color },
        content: tileVisual.icon ? <span role="img" aria-label={tileType}>{tileVisual.icon}</span> : null,
        animationClass: '',
        isResource: false,
        effectiveTerrainType: tileType,
        zIndex: 0,
        activeSeededFeatureConfigForTile: null,
        isSeedTile: false,
      };

      // Apply scatter features on top of 'floor' tiles
      if (tileType === 'floor') {
        visuals = applyScatterVisuals(visuals, tileHash, visualsConfig);
      }

      return visuals;
    }

    // --- Standard Above-Ground Logic ---
    // Build up visuals in layers: base → WFC → path → features → scatter
    let visuals = getBaseVisuals(rowIndex, colIndex, tileHash, visualsConfig);

    // Apply WFC (Wave Function Collapse) visuals if present
    if (wfcGrid) {
      const wfcTileType = wfcGrid[rowIndex]?.[colIndex];
      if (wfcTileType) {
        visuals = applyWfcVisuals(visuals, wfcTileType, visualsConfig, tileHash);
      }
    }

    // Apply path visuals (main paths and adjacent "worn" tiles)
    visuals = applyPathVisuals(visuals, rowIndex, colIndex, pathDetails, visualsConfig, tileHash);

    // Apply seeded feature visuals (ponds, villages, forests, etc.)
    visuals = applySeededFeatureVisuals(visuals, rowIndex, colIndex, activeSeededFeatures);

    // Apply scatter visuals (random trees, flowers, mushrooms, etc.)
    visuals = applyScatterVisuals(visuals, tileHash, visualsConfig);

    return visuals;
  }, [simpleHash, visualsConfig, pathDetails, activeSeededFeatures, caGrid, wfcGrid]);

  // ========================================================================
  // CANVAS RENDERING
  // ========================================================================

  useEffect(() => {
    // Only render if visible and we have valid submap coordinates
    if (!visible || !submapCoords || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Size of each tile in pixels on the minimap canvas
    const tileSize = MINIMAP_SIZE / VIEWPORT_TILES;

    // Submap dimensions (typically 30 cols x 20 rows from config)
    const submapCols = SUBMAP_DIMENSIONS.cols;
    const submapRows = SUBMAP_DIMENSIONS.rows;

    // Player's current position on the submap
    const playerX = submapCoords.x;
    const playerY = submapCoords.y;

    // ======================================================================
    // CALCULATE VIEWPORT BOUNDS WITH EDGE CLAMPING
    // ======================================================================
    //
    // The viewport is normally centered on the player, but when the player
    // is within TILE_RADIUS tiles of an edge, we clamp the viewport to show
    // the edge and the player marker moves off-center.

    // Calculate the ideal viewport start (centered on player)
    let viewStartX = playerX - TILE_RADIUS;
    let viewStartY = playerY - TILE_RADIUS;

    // Clamp viewport to submap bounds
    // If player is near left/top edge, start at 0
    if (viewStartX < 0) viewStartX = 0;
    if (viewStartY < 0) viewStartY = 0;

    // If player is near right/bottom edge, clamp so viewport doesn't exceed bounds
    if (viewStartX + VIEWPORT_TILES > submapCols) {
      viewStartX = Math.max(0, submapCols - VIEWPORT_TILES);
    }
    if (viewStartY + VIEWPORT_TILES > submapRows) {
      viewStartY = Math.max(0, submapRows - VIEWPORT_TILES);
    }

    // Calculate where the player marker should be drawn relative to viewport
    // (This will be offset from center when near edges)
    const playerViewX = playerX - viewStartX;
    const playerViewY = playerY - viewStartY;

    // ======================================================================
    // CLEAR AND DRAW BACKGROUND
    // ======================================================================

    ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    // ======================================================================
    // DRAW SUBMAP TILES
    // ======================================================================
    //
    // We iterate over each visible tile in the viewport and draw it using
    // the same visual data that SubmapPane uses. This ensures the minimap
    // is a true "looking glass" into the actual submap content.

    for (let vy = 0; vy < VIEWPORT_TILES; vy++) {
      for (let vx = 0; vx < VIEWPORT_TILES; vx++) {
        const submapX = viewStartX + vx;
        const submapY = viewStartY + vy;

        // Check if this tile is within submap bounds
        if (submapX >= 0 && submapX < submapCols && submapY >= 0 && submapY < submapRows) {
          // Get the full visual data for this tile (same as SubmapPane)
          const visuals = getTileVisuals(submapY, submapX);

          // Extract the background color from the visuals
          const bgColor = visuals.style.backgroundColor as string;
          const parsed = parseColor(bgColor);

          if (parsed) {
            ctx.fillStyle = `rgb(${parsed[0]}, ${parsed[1]}, ${parsed[2]})`;
          } else {
            // Fallback to the raw color string
            ctx.fillStyle = bgColor || '#555555';
          }
        } else {
          // Out of bounds - draw as dark/unexplored
          ctx.fillStyle = '#222';
        }

        // Draw the tile background
        ctx.fillRect(vx * tileSize, vy * tileSize, tileSize, tileSize);

        // ================================================================
        // DRAW ICONS FOR FEATURES (paths, villages, ponds, etc.)
        // ================================================================
        //
        // For tiles that have content (emoji icons), we draw a small
        // representation on the minimap to show the feature.

        if (submapX >= 0 && submapX < submapCols && submapY >= 0 && submapY < submapRows) {
          const visuals = getTileVisuals(submapY, submapX);
          const icon = extractIcon(visuals.content);

          if (icon) {
            // Draw a small colored dot or mini-icon to represent the feature
            // We use a simplified representation since emojis don't scale well
            ctx.save();
            ctx.font = `${Math.max(6, tileSize * 0.7)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(icon, vx * tileSize + tileSize / 2, vy * tileSize + tileSize / 2);
            ctx.restore();
          }
        }
      }
    }

    // ======================================================================
    // DRAW SUBTLE GRID LINES
    // ======================================================================
    //
    // Light grid lines help show tile boundaries without being distracting

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 0.5;

    // Vertical lines
    for (let vx = 1; vx < VIEWPORT_TILES; vx++) {
      ctx.beginPath();
      ctx.moveTo(vx * tileSize, 0);
      ctx.lineTo(vx * tileSize, MINIMAP_SIZE);
      ctx.stroke();
    }

    // Horizontal lines
    for (let vy = 1; vy < VIEWPORT_TILES; vy++) {
      ctx.beginPath();
      ctx.moveTo(0, vy * tileSize);
      ctx.lineTo(MINIMAP_SIZE, vy * tileSize);
      ctx.stroke();
    }

    // ======================================================================
    // DRAW PLAYER MARKER
    // ======================================================================
    //
    // The player marker shows the current position within the submap.
    // It's centered when possible, but shifts toward edges when near them.

    const playerCenterX = playerViewX * tileSize + tileSize / 2;
    const playerCenterY = playerViewY * tileSize + tileSize / 2;

    // Draw player marker (amber circle with white border)
    ctx.beginPath();
    ctx.arc(playerCenterX, playerCenterY, tileSize / 1.5, 0, 2 * Math.PI);
    ctx.fillStyle = '#FBBF24'; // Amber-400
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw a small directional indicator pointing north
    ctx.beginPath();
    ctx.moveTo(playerCenterX, playerCenterY - tileSize / 1.2);
    ctx.lineTo(playerCenterX - 3, playerCenterY - tileSize / 2.5);
    ctx.lineTo(playerCenterX + 3, playerCenterY - tileSize / 2.5);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // ======================================================================
    // DRAW BORDER
    // ======================================================================
    //
    // A decorative border around the minimap for visual polish

    ctx.strokeStyle = '#A16207'; // Amber-800
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

  }, [visible, submapCoords, getTileVisuals]);

  // Don't render if not visible or no submap position
  if (!visible || !submapCoords) return null;

  return (
    <div
      id={UI_ID.MINIMAP}
      data-testid={UI_ID.MINIMAP}
      className={`absolute top-4 right-4 z-[${Z_INDEX.MINIMAP}] shadow-lg rounded-lg overflow-hidden border-2 border-amber-700 bg-black cursor-pointer hover:opacity-90 transition-opacity`}
      onClick={toggleSubmap}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleSubmap();
        }
      }}
      role="button"
      tabIndex={0}
      title="Click to open Submap"
    >
      <canvas
        ref={canvasRef}
        width={MINIMAP_SIZE}
        height={MINIMAP_SIZE}
        className="block"
      />
      {/* Coordinates display showing submap position */}
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-center text-[10px] text-amber-200 font-cinzel py-0.5 pointer-events-none">
        {submapCoords.x}, {submapCoords.y}
      </div>
    </div>
  );
};

export default Minimap;
