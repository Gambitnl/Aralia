// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/07/2026, 01:49:02
 * Dependents: components/World3D/World3DWrapper.tsx
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file presents the generated dungeon reached from the live 3D world.
 *
 * It reuses the existing Dungeon3DPreview rather than creating a second interior renderer. The
 * surrounding expedition chrome identifies the canonical receipt and the exact world return
 * point, then gives the player one explicit route back. The shared preview now owns real floor-grid
 * movement, can secure deterministically identified authored treasure rooms, and can traverse a
 * three-page deterministic level stack generated from stable child seed paths. Each descent keeps
 * a parent return coordinate and writes compact visit evidence beside that page's isolated map ink.
 * The final page exposes the generated boss room as an objective. Inventory rewards, combat,
 * falling, pit rules, door actions, and automatic completion remain unsupported.
 *
 * Called by: World3DWrapper.tsx while a temporary dungeon entry is active.
 * Depends on: Dungeon3DPreview and the active entry receipt from dungeonEntryRuntime.ts.
 */
import React from 'react';
import {
  Dungeon3DPreview,
  type Dungeon3DOverlays,
} from '../BattleMap/dungeon/Dungeon3DPreview';
import { Button } from '../ui/Button';
import { useGameState } from '../../state/GameContext';
import type { ActiveDungeonEntry } from './dungeonEntryRuntime';
import DungeonParchmentMap from './DungeonParchmentMap';
import {
  buildDungeonLevelStack,
  dungeonLevelVisitReceipt,
  type DungeonLevelDescriptor,
} from '../../systems/worldforge/dungeon/world/dungeonLevels';
import type { Cell } from '../../systems/worldforge/dungeon/types';

// ============================================================================
// Production Expedition View
// ============================================================================
// The production entry shows the authored dungeon evidence and encounters, while design-only
// graph, heatmap, secret, and critical-path diagnostics remain off.
// ============================================================================

const EXPEDITION_OVERLAYS: Dungeon3DOverlays = {
  graph: false,
  loops: false,
  critical: false,
  heatmap: false,
  rooms: false,
  props: true,
  spawns: true,
  secrets: false,
};

interface DungeonExpeditionOverlayProps {
  entry: ActiveDungeonEntry;
  onReturn: () => void;
}

/** Render one canonical dungeon and keep the originating world context visible in the chrome. */
const DungeonExpeditionOverlay: React.FC<DungeonExpeditionOverlayProps> = ({
  entry,
  onReturn,
}) => {
  const origin = entry.returnContext;
  const { state, dispatch } = useGameState();
  const [isMapOpen, setIsMapOpen] = React.useState(false);
  const levels = React.useMemo(
    () => buildDungeonLevelStack(entry.identity, entry.plan, entry.returnContext.worldSeed),
    [entry],
  );
  const [currentDepth, setCurrentDepth] = React.useState(0);
  const [arrivalCell, setArrivalCell] = React.useState<Cell>(levels[0].entryCell);
  const expedition = state.dungeonExpeditions?.[entry.identity.dungeonId];
  const [reachedLevelIds, setReachedLevelIds] = React.useState<Set<string>>(() => new Set([
    levels[0].identity.levelId,
    ...Object.keys(expedition?.progress.levelVisits ?? {}),
  ]));
  const currentLevel = levels[currentDepth];
  const claimedTreasureIds = expedition?.progress.claimedTreasureIds ?? [];
  const clearedEncounterIds = expedition?.progress.clearedEncounterIds ?? [];
  const discoveredCellKeys = expedition?.progress.exploredCellKeysByLevel?.[
    currentLevel.identity.levelId
  ] ?? [];

  React.useEffect(() => {
    if (expedition?.progress.levelVisits?.[levels[0].identity.levelId]) return;
    dispatch({
      type: 'DUNGEON_PROGRESS_RECORDED',
      payload: {
        dungeonId: entry.identity.dungeonId,
        progress: {
          levelVisits: {
            [levels[0].identity.levelId]: dungeonLevelVisitReceipt(levels[0]),
          },
        },
      },
    });
  }, [dispatch, entry.identity.dungeonId, expedition?.progress.levelVisits, levels]);

  const handleClaimTreasure = React.useCallback((eventId: string) => {
    // The preview emits one stable generated treasure-room id. The world reducer remains the writer
    // of durable expedition progress, preserving save/load and revisit behavior from the lifecycle
    // foundation rather than maintaining a component-owned list.
    dispatch({
      type: 'DUNGEON_PROGRESS_RECORDED',
      payload: {
        dungeonId: entry.identity.dungeonId,
        progress: { claimedTreasureIds: [eventId] },
      },
    });
  }, [dispatch, entry.identity.dungeonId]);

  const handleClearEncounter = React.useCallback((eventId: string) => {
    // Defeating a generated encounter follows the same additive progress path as treasure. The stable
    // encounter id recurs from the seeded plan, so a cleared monster stays cleared across save/load
    // and revisit without a component-owned combat list.
    dispatch({
      type: 'DUNGEON_PROGRESS_RECORDED',
      payload: {
        dungeonId: entry.identity.dungeonId,
        progress: { clearedEncounterIds: [eventId] },
      },
    });
  }, [dispatch, entry.identity.dungeonId]);

  const handleCompleteObjective = React.useCallback((objectiveId: string) => {
    // Reaching and defeating the deepest boss is the dungeon's completion condition. The objective
    // outcome is recorded first, then the authoritative completion event flips the ledger and the
    // shared cleared-dungeon ecology list. Both survive save/load and are preserved on revisit.
    dispatch({
      type: 'DUNGEON_PROGRESS_RECORDED',
      payload: {
        dungeonId: entry.identity.dungeonId,
        progress: { objectives: { [objectiveId]: 'completed' } },
      },
    });
    dispatch({
      type: 'DUNGEON_COMPLETED',
      payload: { dungeonId: entry.identity.dungeonId },
    });
  }, [dispatch, entry.identity.dungeonId]);

  const handleDiscoverCells = React.useCallback((cellKeys: readonly string[]) => {
    // Exploration joins the same additive progress action as treasure. The level key keeps one
    // dungeon's sheet separate from later descendants without implementing those descendants now.
    dispatch({
      type: 'DUNGEON_PROGRESS_RECORDED',
      payload: {
        dungeonId: entry.identity.dungeonId,
        progress: {
          exploredCellKeysByLevel: {
            [currentLevel.identity.levelId]: cellKeys,
          },
        },
      },
    });
  }, [currentLevel.identity.levelId, dispatch, entry.identity.dungeonId]);

  const handleDescend = React.useCallback(() => {
    const nextLevel = levels[currentDepth + 1];
    if (!currentLevel.downTransition || !nextLevel) return;

    // Reaching the child records both ends of the route under the root expedition. The next plan
    // starts at its authored entrance, while later ascent restores the parent's exact stair cell.
    dispatch({
      type: 'DUNGEON_PROGRESS_RECORDED',
      payload: {
        dungeonId: entry.identity.dungeonId,
        progress: {
          openedRouteIds: [currentLevel.downTransition.id],
          levelVisits: {
            [currentLevel.identity.levelId]: dungeonLevelVisitReceipt(currentLevel),
            [nextLevel.identity.levelId]: dungeonLevelVisitReceipt(nextLevel),
          },
        },
      },
    });
    setReachedLevelIds((current) => new Set([...current, nextLevel.identity.levelId]));
    setArrivalCell(nextLevel.entryCell);
    setCurrentDepth(nextLevel.identity.depth);
  }, [currentDepth, currentLevel, dispatch, entry.identity.dungeonId, levels]);

  const handleAscend = React.useCallback(() => {
    const parentLevel = levels[currentDepth - 1];
    if (!currentLevel.upTransition || !parentLevel || !currentLevel.parentReturnCell) return;

    // Parent return coordinates are generated with the parent page and persisted in the child
    // receipt. Ascending therefore lands at the same stair, not at an invented surface teleport.
    setArrivalCell(currentLevel.parentReturnCell);
    setCurrentDepth(parentLevel.identity.depth);
  }, [currentDepth, currentLevel, levels]);

  const parchmentPages = React.useMemo(() => levels
    .filter((level) => reachedLevelIds.has(level.identity.levelId))
    .map((level) => ({
      levelId: level.identity.levelId,
      plan: level.plan,
      discoveredCellKeys: expedition?.progress.exploredCellKeysByLevel?.[
        level.identity.levelId
      ] ?? [],
      annotations: [
        level.upTransition,
        level.downTransition,
        level.bossObjective,
        level.verticalSight,
      ].filter((feature): feature is NonNullable<DungeonLevelDescriptor['upTransition']> => feature !== null),
    })), [expedition?.progress, levels, reachedLevelIds]);

  return (
    <section
      aria-label={`Dungeon expedition: ${currentLevel.plan.name}`}
      data-testid="dungeon-expedition-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 80,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overflow: 'auto',
        padding: '16px',
        boxSizing: 'border-box',
        background: 'radial-gradient(circle at 50% 20%, #302719 0%, #0c0b0a 62%, #050505 100%)',
        color: '#f7ecd1',
      }}
    >
      {/* The header makes provenance reviewable without exposing raw generator controls. */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '12px 16px',
          border: '1px solid rgba(251, 191, 36, 0.35)',
          borderRadius: '12px',
          background: 'rgba(12, 10, 8, 0.88)',
        }}
      >
        <div>
          <div style={{ color: '#fbbf24', fontSize: '11px', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Playable Dungeon Entry
          </div>
          <h2 style={{ margin: '4px 0 2px', fontFamily: 'Georgia, serif', fontSize: '24px' }}>
            {currentLevel.plan.name}
          </h2>
          <div data-testid="dungeon-entry-receipt" style={{ color: '#d6c7aa', fontSize: '12px' }}>
            Canonical dungeon: {entry.identity.dungeonId}
          </div>
          <div data-testid="dungeon-level-receipt" style={{ color: '#c4b5fd', fontSize: '12px' }}>
            {currentLevel.identity.levelId} · {currentLevel.identity.dungeonId} · seed {currentLevel.identity.seedPath}
          </div>
          <div data-testid="dungeon-parent-link" style={{ color: '#a5b4fc', fontSize: '12px' }}>
            Parent: {currentLevel.identity.parentLevelId ?? 'world entrance'}
          </div>
          <div data-testid="dungeon-return-context" style={{ color: '#b8aa8f', fontSize: '12px' }}>
            Return route: world {origin.worldSeed} · cell {origin.cellId} · position {origin.xM.toFixed(1)}m, {origin.zM.toFixed(1)}m
          </div>
          <div data-testid="dungeon-treasure-progress" style={{ color: '#86efac', fontSize: '12px' }}>
            Treasure caches saved: {claimedTreasureIds.length}
          </div>
          <div data-testid="dungeon-exploration-progress" style={{ color: '#fde68a', fontSize: '12px' }}>
            Parchment cells inked on this page: {discoveredCellKeys.length} · pages reached {reachedLevelIds.size}/{levels.length}
          </div>
          <div data-testid="dungeon-vertical-landmarks" style={{ color: '#fdba74', fontSize: '12px' }}>
            {currentLevel.downTransition ? `Descent at ${currentLevel.downTransition.cell.x},${currentLevel.downTransition.cell.y}` : `Boss objective at ${currentLevel.bossObjective?.cell.x},${currentLevel.bossObjective?.cell.y}`}
            {currentLevel.verticalSight ? ` · ${currentLevel.verticalSight.label} at ${currentLevel.verticalSight.cell.x},${currentLevel.verticalSight.cell.y}` : ' · no authored vertical sightline on this plan'}
          </div>
        </div>

        <div style={{ display: 'flex', flex: '0 0 auto', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '8px' }}>
          {currentLevel.upTransition ? (
            <Button
              type="button"
              onClick={handleAscend}
              data-testid="dungeon-ascend"
              variant="ghost"
              size="md"
              style={{ border: '1px solid #a5b4fc', color: '#e0e7ff', fontWeight: 800 }}
            >
              Ascend to {currentLevel.identity.parentLevelId}
            </Button>
          ) : null}
          {currentLevel.downTransition ? (
            <Button
              type="button"
              onClick={handleDescend}
              data-testid="dungeon-descend"
              variant="action"
              size="md"
              style={{ border: '1px solid #fb923c', background: '#9a3412', color: '#fff7ed', fontWeight: 800 }}
            >
              Descend to level {currentDepth + 1}
            </Button>
          ) : null}
          {/* Unrolling is an explicit diegetic action. It changes presentation only; movement and
              persistence continue through the already-mounted canonical expedition. */}
          <Button
            type="button"
            onClick={() => setIsMapOpen(true)}
            data-testid="open-dungeon-map"
            variant="ghost"
            size="md"
            style={{ border: '1px solid #d6a756', color: '#fff1c2', fontWeight: 800 }}
          >
            Unroll Parchment Map
          </Button>

          {/* Returning restores the saved GroundWorld position and records an honest retreat. No
              completion is inferred because the current preview has no authoritative objective. */}
          <Button
            type="button"
            onClick={onReturn}
            data-testid="return-to-world-entrance"
            variant="action"
            size="md"
            style={{
              border: '1px solid #fbbf24',
              background: '#92400e',
              color: '#fff7db',
              fontWeight: 800,
            }}
          >
            Return to World Entrance
          </Button>
        </div>
      </header>

      {/* The shared renderer consumes the exact plan recovered from the level receipt. Its identity
          key remounts movement at a vertical boundary, preventing the departing page from briefly
          receiving the arrival page's discovery cells. Geometry remains generator-owned and every
          claimed cache still returns through the root expedition reducer callback. */}
      <div style={{ display: 'flex', flex: 1, justifyContent: 'center', minHeight: '500px' }}>
        <Dungeon3DPreview
          key={currentLevel.identity.dungeonId}
          plan={currentLevel.plan}
          overlays={EXPEDITION_OVERLAYS}
          gameplay={{
            identity: currentLevel.identity,
            claimedTreasureIds,
            onClaimTreasure: handleClaimTreasure,
            clearedEncounterIds,
            onClearEncounter: handleClearEncounter,
            discoveredCellKeys,
            onDiscoverCells: handleDiscoverCells,
            objective: currentLevel.bossObjective
              ? { id: currentLevel.bossObjective.id, cell: currentLevel.bossObjective.cell }
              : null,
            onCompleteObjective: handleCompleteObjective,
            initialPlayerCell: arrivalCell,
          }}
        />
      </div>

      {/* The parchment is layered over the expedition so closing it returns to the same 3D plan
          and movement position. Only explored keys from this canonical dungeon and level are read. */}
      {isMapOpen ? (
        <DungeonParchmentMap
          pages={parchmentPages}
          initialLevelId={currentLevel.identity.levelId}
          onClose={() => setIsMapOpen(false)}
        />
      ) : null}
    </section>
  );
};

export default DungeonExpeditionOverlay;
