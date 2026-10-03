// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/07/2026, 01:48:10
 * Dependents: components/World3D/DungeonExpeditionOverlay.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file renders the player's remembered dungeon as a parchment sheet.
 *
 * It receives the exact DungeonPlan already mounted by the 3D expedition and asks the shared map
 * model for explored cells, known doors, and discovered authored landmarks. Reached dungeon levels
 * become separate selectable pages, each backed by its own persisted exploration key. Stairs,
 * truthful height sightlines, and the deepest boss objective remain hidden until their real floor
 * cell is discovered. Search, pit traversal, combat, and completion rules remain separate lanes.
 *
 * Called by: DungeonExpeditionOverlay when the player chooses to unroll the map.
 * Depends on: the shared DungeonPlan map model and the normal Aralia Button primitive.
 */

import React, { useMemo, useState } from 'react';
import type { DungeonPlan } from '../../systems/worldforge/dungeon/types';
import {
  buildDungeonParchmentSheet,
  type DungeonMapAnnotation,
  type DungeonMapLandmarkKind,
} from '../../systems/worldforge/dungeon/world/dungeonMap';
import { Button } from '../ui/Button';

// ============================================================================
// Player-Facing Map Contract
// ============================================================================
// Discovery is supplied by the canonical expedition ledger. Closing changes presentation only;
// explored ink stays in GameState and therefore survives later map openings and revisits.
// ============================================================================

export interface DungeonParchmentPage {
  levelId: string;
  plan: DungeonPlan;
  discoveredCellKeys: readonly string[];
  annotations: readonly DungeonMapAnnotation[];
}

interface DungeonParchmentMapProps {
  pages: readonly DungeonParchmentPage[];
  initialLevelId: string;
  onClose: () => void;
}

function landmarkGlyph(kind: DungeonMapLandmarkKind): string {
  if (kind === 'entrance') return '↟';
  if (kind === 'treasure') return '◆';
  if (kind === 'shrine') return '✦';
  if (kind === 'stairs-up') return '↑';
  if (kind === 'stairs-down') return '↓';
  if (kind === 'boss') return '♛';
  return '◉';
}

function readablePurpose(purpose: string): string {
  return purpose.replaceAll('-', ' ');
}

// ============================================================================
// Parchment Rendering
// ============================================================================
// The ink geometry uses one SVG unit per canonical floor cell. This is a view of DungeonPlan, not
// a second cartographic generator, and its blank areas contain no hidden cell or landmark markup.
// ============================================================================

const DungeonParchmentMap: React.FC<DungeonParchmentMapProps> = ({
  pages,
  initialLevelId,
  onClose,
}) => {
  const [levelId, setLevelId] = useState(initialLevelId);
  const page = pages.find((candidate) => candidate.levelId === levelId) ?? pages[0];
  if (!page) throw new Error('Dungeon parchment requires at least one reached level page.');

  const sheet = useMemo(
    () => buildDungeonParchmentSheet(page.plan, page.discoveredCellKeys, page.annotations),
    [page],
  );

  return (
    <article
      role="dialog"
      aria-modal="true"
      aria-label={`Parchment map of ${page.plan.name}`}
      data-testid="dungeon-parchment-map"
      data-level-id={levelId}
      data-page-count={pages.length}
      data-discovered-cell-count={sheet.discoveredCellCount}
      data-hidden-landmark-count={sheet.hiddenLandmarkCount}
      style={{
        position: 'absolute',
        inset: '12px',
        zIndex: 120,
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr) auto',
        gap: '12px',
        padding: '18px',
        overflow: 'hidden',
        border: '2px solid #6b3e16',
        borderRadius: '16px',
        boxShadow: '0 24px 70px rgba(0, 0, 0, 0.72), inset 0 0 70px rgba(91, 51, 20, 0.24)',
        color: '#3f2917',
        background:
          'radial-gradient(circle at 44% 34%, rgba(255,248,205,0.96), rgba(216,174,99,0.97) 65%, rgba(151,99,45,0.98)), repeating-linear-gradient(6deg, rgba(91,51,20,0.05) 0 1px, transparent 1px 5px)',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Party field notes · {levelId}
          </div>
          <h3 style={{ margin: '3px 0 0', fontFamily: 'Georgia, serif', fontSize: '28px' }}>
            {page.plan.name}
          </h3>
          <nav aria-label="Dungeon level pages" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
            {pages.map((candidate) => (
              <Button
                key={candidate.levelId}
                type="button"
                data-testid="dungeon-map-level-page"
                data-level-id={candidate.levelId}
                variant="ghost"
                size="sm"
                onClick={() => setLevelId(candidate.levelId)}
                style={{
                  border: '1px solid rgba(63,41,23,0.5)',
                  color: '#3f2917',
                  fontWeight: 900,
                  background: candidate.levelId === levelId ? 'rgba(107,62,22,0.18)' : 'transparent',
                }}
              >
                {candidate.levelId.replace(':', ' ')}
              </Button>
            ))}
          </nav>
        </div>
        <Button
          type="button"
          data-testid="close-dungeon-map"
          variant="ghost"
          size="md"
          onClick={onClose}
          style={{ border: '1px solid rgba(63,41,23,0.55)', color: '#3f2917', fontWeight: 900 }}
        >
          Roll up map
        </Button>
      </header>

      {/* The SVG frames only the current ink and emits only explored floor and known doors. Blank
          parchment therefore conveys fog without leaking silhouettes or the full level extent. */}
      <div
        data-testid="dungeon-parchment-sheet"
        style={{
          minHeight: 0,
          overflow: 'hidden',
          border: '1px solid rgba(63,41,23,0.35)',
          borderRadius: '12px',
          background: 'rgba(255, 244, 194, 0.26)',
        }}
      >
        <svg
          viewBox={`${sheet.exploredBounds.minX} ${sheet.exploredBounds.minY} ${sheet.exploredBounds.width} ${sheet.exploredBounds.height}`}
          preserveAspectRatio="xMidYMid meet"
          aria-label={`${sheet.discoveredCellCount} explored dungeon cells`}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <defs>
            <filter id="dungeon-map-wobble">
              <feTurbulence baseFrequency="0.025" numOctaves="2" seed="17" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.08" />
            </filter>
          </defs>
          <g filter="url(#dungeon-map-wobble)">
            {sheet.exploredCells.map((cell) => (
              <rect
                key={`${cell.x},${cell.y}`}
                data-testid="dungeon-map-explored-cell"
                data-cell-key={`${cell.x},${cell.y}`}
                x={cell.x + 0.04}
                y={cell.y + 0.04}
                width={0.92}
                height={0.92}
                rx={0.08}
                fill="rgba(91, 51, 20, 0.17)"
                stroke="#4b2c16"
                strokeWidth={0.12}
              />
            ))}
            {sheet.exploredDoors.map((door) => (
              <path
                key={`door:${door.cell.x},${door.cell.y}`}
                data-testid="dungeon-map-known-door"
                d={`M ${door.cell.x + 0.18} ${door.cell.y + 0.5} L ${door.cell.x + 0.82} ${door.cell.y + 0.5}`}
                stroke="#7c2d12"
                strokeWidth={0.18}
                strokeLinecap="round"
              />
            ))}
            {sheet.visibleLandmarks.map((landmark) => (
              <g
                key={landmark.id}
                data-testid="dungeon-map-landmark"
                data-landmark-kind={landmark.kind}
                data-room-id={landmark.roomId}
                transform={`translate(${landmark.cell.x + 0.5} ${landmark.cell.y + 0.5})`}
              >
                <circle r={0.38} fill="#f4d27c" stroke="#6b2f13" strokeWidth={0.11} />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={0.48}
                  fontWeight={900}
                  fill="#5b2110"
                >
                  {landmarkGlyph(landmark.kind)}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>

      <footer style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ fontSize: '12px', fontWeight: 800 }}>
          <span data-testid="dungeon-map-discovered-count">{sheet.discoveredCellCount} cells inked</span>
          {' · '}
          <span data-testid="dungeon-map-hidden-floor-count">{sheet.hiddenFloorCellCount} cells still concealed</span>
          {' · '}
          <span data-testid="dungeon-map-landmark-count">{sheet.visibleLandmarks.length} landmarks remembered</span>
        </div>
        <div aria-label="Remembered landmarks" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {sheet.visibleLandmarks.map((landmark) => (
            <span
              key={`legend:${landmark.id}`}
              style={{ padding: '4px 8px', border: '1px solid rgba(63,41,23,0.32)', borderRadius: '999px', fontSize: '11px', fontWeight: 800 }}
            >
              {landmarkGlyph(landmark.kind)} {landmark.label} · {readablePurpose(landmark.purpose)}
            </span>
          ))}
        </div>
      </footer>
    </article>
  );
};

export default DungeonParchmentMap;
