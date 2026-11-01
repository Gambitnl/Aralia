// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 14:00:47
 * Dependents: components/World3D/World3DWrapper.tsx
 * Imports: 17 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {companionDungeonRiskError} from '../../systems/companions/companionSiteRisk';
/**
 * This file presents the generated dungeon reached from the live 3D world.
 *
 * It reuses the existing Dungeon3DPreview rather than creating a second interior renderer. The
 * surrounding expedition chrome identifies the canonical receipt and the exact world return
 * point, then gives the player one explicit route back. The shared preview now owns real floor-grid
 * movement, can secure deterministically identified authored treasure rooms, and can traverse a
 * three-page deterministic level stack generated from stable child seed paths. Each descent keeps
 * a parent return coordinate and writes compact visit evidence beside that page's isolated map ink.
 * Source encounters use the existing combat owner. The final page exposes the generated boss room
 * as an objective. Inventory cache rewards, falling, pit rules, secret/bricked-door actions and
 * automatic objective completion remain unsupported.
 * Ordinary closed doors can be opened from adjacent footing and persist in the route ledger.
 *
 * Called by: World3DWrapper.tsx while a temporary dungeon entry is active.
 * Depends on: Dungeon3DPreview and the active entry receipt from dungeonEntryRuntime.ts.
 */

import React from 'react';
import {activeCarriedTorches,torchUseError} from '../../systems/underdark/carriedItemLight';
import {STANDARD_TORCH_LIGHT} from '../../services/underdarkService';
import { createPortal } from 'react-dom';
import { validateDungeonExplorationPosition } from '../../systems/worldforge/dungeon/world/dungeonExplorationResume';
import { SystemMenu } from '../ActionPane/SystemMenu';
import type { Action } from '../../types';
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
import { dungeonKnowledge } from './dungeonKnowledge';
import {projectDungeonEncounter, prepareDungeonCombat} from '../../systems/worldforge/dungeon/world/dungeonCombat';
import {openDungeonDoorProgress, withOpenedDungeonDoors} from '../../systems/worldforge/dungeon/world/dungeonDoorActions';
import {handleStartBattleMapEncounter} from '../../systems/combat/startBattleMapEncounter';

// ============================================================================
// Production Expedition View
// ============================================================================
// The production entry shows the authored dungeon evidence and encounters, while design-only
// graph, heatmap, secret, and critical-path diagnostics remain off.
// ============================================================================

const NO_OPENED_ROUTES: readonly string[] = [];

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
  /** The same player-action authority used by the surrounding game menu. */
  onAction?: (action: Action) => void;
}

/** Render one canonical dungeon and keep the originating world context visible in the chrome. */
const DungeonExpeditionOverlay: React.FC<DungeonExpeditionOverlayProps> = ({
  entry,
  onReturn,
  onAction,
}) => {
  const origin = entry.returnContext;
  const { state, dispatch } = useGameState();
  const [isMapOpen, setIsMapOpen] = React.useState(false);
  const levels = React.useMemo(
    () => buildDungeonLevelStack(entry.identity, entry.plan, entry.returnContext.worldSeed),
    [entry],
  );
  const resume = state.dungeonCombatReturn?.rootIdentity.dungeonId === entry.identity.dungeonId ? state.dungeonCombatReturn : null;
  const expedition = state.dungeonExpeditions?.[entry.identity.dungeonId];
  const savedPosition = React.useMemo(() => validateDungeonExplorationPosition(expedition, entry), [entry]);
  const initialDepth = resume?.depth ?? savedPosition?.depth ?? 0;
  const [currentDepth, setCurrentDepth] = React.useState(initialDepth);
  const [arrivalCell, setArrivalCell] = React.useState<Cell>(resume?.playerCell ?? savedPosition?.playerCell ?? levels[initialDepth].entryCell);
  const [reachedLevelIds, setReachedLevelIds] = React.useState<Set<string>>(() => new Set([
    levels[0].identity.levelId,
    ...Object.keys(expedition?.progress.levelVisits ?? {}),
  ]));
  const currentLevel = levels[currentDepth];
  const openedRouteIds = expedition?.progress.openedRouteIds ?? NO_OPENED_ROUTES;
  // A saved opened leaf changes passage, never the source walls, history or inhabitants.
  const currentPlan = React.useMemo(() => withOpenedDungeonDoors(currentLevel.plan, currentLevel.identity, openedRouteIds), [currentLevel, openedRouteIds]);
  const [currentPlayerCell, setCurrentPlayerCell] = React.useState<Cell>(arrivalCell);
  // Only accepted preview movement and actual stair transitions change this compact save receipt.
  React.useEffect(() => {
    const next = {depth: currentDepth, playerCell: currentPlayerCell,
      entranceKind: entry.entranceKind, returnContext: entry.returnContext};
    if (JSON.stringify(expedition?.progress.activeVisit) === JSON.stringify(next)) return;
    dispatch({type:'DUNGEON_PROGRESS_RECORDED', payload:{dungeonId:entry.identity.dungeonId, progress:{activeVisit:next}}});
  }, [currentDepth, currentPlayerCell, entry, dispatch, expedition?.progress.activeVisit]);
  const atStair = (cell: Cell | undefined) => Boolean(cell && cell.x === currentPlayerCell.x && cell.y === currentPlayerCell.y);
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

  const knowledge = dungeonKnowledge(currentPlan, entry.identity.seedPath,
    state.inventory ?? [], discoveredCellKeys);

  // Loading the bestiary may outlive a return or floor change. A departed
  // expedition must never reopen combat over the player's new location.
  const encounterScope = React.useRef<object | null>(null);
  React.useEffect(() => {
    encounterScope.current = {};
    return () => { encounterScope.current = null; };
  }, [entry, currentDepth]);

  const handleStartEncounter = React.useCallback(async (encounterId: string, playerCell: Cell) => {
    // Revalidate accepted footing before projecting any tactical placement.
    // A stale preview request cannot choose another square for the party.
    if (playerCell.x !== currentPlayerCell.x || playerCell.y !== currentPlayerCell.y) {
      throw new Error('Your position changed. Check the creature from your current square.');
    }
    const scope = encounterScope.current;
    const map = projectDungeonEncounter(currentPlan, {
      rootIdentity: entry.identity, levelIdentity: currentLevel.identity, depth: currentDepth,
      entranceKind: entry.entranceKind, returnContext: entry.returnContext,
      playerCell, encounterId, partyCount: state.party?.length ?? 0, clearedEncounterIds,
      carriedBrightRadiusFt: activeCarriedTorches(state)[0]?.brightRadius ?? 0,
    });
    // Leaving the dungeon clears its visit-local return receipt. The saved
    // source encounter keeps its accepted injuries through retreat and revisit.
    const legacyHP = state.dungeonCombatReturn?.encounterId === encounterId ? state.dungeonCombatReturn.enemyHP : undefined;
    const previousHP = expedition?.progress.encounterHitPoints?.[encounterId] ?? legacyHP;
    const payload = await prepareDungeonCombat(map, previousHP);
    if (!scope || scope !== encounterScope.current) return;
    await handleStartBattleMapEncounter(dispatch, payload);
  }, [clearedEncounterIds, currentDepth, currentLevel, currentPlan, dispatch, entry, expedition?.progress.encounterHitPoints, state.party, state.dungeonCombatReturn, state.underdark, state.gameTime, currentPlayerCell]);

  const handleOpenDoor = React.useCallback((target: Cell, player: Cell) => {
    // Recheck the accepted square at the product boundary. A stale or distant UI
    // request cannot open another leaf or reveal a secret passage.
    if (player.x !== currentPlayerCell.x || player.y !== currentPlayerCell.y) return;
    const progress = openDungeonDoorProgress(currentPlan, currentLevel.identity, player, target);
    if (progress) dispatch({type: 'DUNGEON_PROGRESS_RECORDED', payload: {dungeonId: entry.identity.dungeonId, progress}});
  }, [currentLevel.identity, currentPlan, currentPlayerCell, dispatch, entry.identity.dungeonId]);

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

  const handleObjectInteraction = React.useCallback((objectId:string,intent:'examine'|'collect'|'light_torch',inventoryIndex?:number) => {
    // The world owner rechecks saved footing and the canonical prop, then records
    // collection and inventory together. The view supplies no item or quantity.
    dispatch({type:'DUNGEON_OBJECT_INTERACTED',payload:{dungeonId:entry.identity.dungeonId,objectId,intent,inventoryIndex}});
  }, [dispatch,entry.identity.dungeonId]);

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

  const descentConcern = companionDungeonRiskError(state, entry.identity, currentDepth + 1);
  const handleDescend = React.useCallback(() => {
    if (companionDungeonRiskError(state, entry.identity, currentDepth + 1)) return;
    const nextLevel = levels[currentDepth + 1];
    if (!currentLevel.downTransition || !nextLevel || !atStair(currentLevel.downTransition.cell)) return;

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
    setCurrentPlayerCell(nextLevel.entryCell);
    setCurrentDepth(nextLevel.identity.depth);
  }, [currentDepth, currentLevel, currentPlayerCell, dispatch, entry.identity.dungeonId, levels, state]);

  const handleAscend = React.useCallback(() => {
    const parentLevel = levels[currentDepth - 1];
    if (!currentLevel.upTransition || !parentLevel || !currentLevel.parentReturnCell || !atStair(currentLevel.upTransition.cell)) return;

    // Parent return coordinates are generated with the parent page and persisted in the child
    // receipt. Ascending therefore lands at the same stair, not at an invented surface teleport.
    setArrivalCell(currentLevel.parentReturnCell);
    setCurrentPlayerCell(currentLevel.parentReturnCell);
    setCurrentDepth(parentLevel.identity.depth);
  }, [currentDepth, currentLevel, currentPlayerCell, levels]);

  const parchmentPages = React.useMemo(() => levels
    .filter((level) => reachedLevelIds.has(level.identity.levelId))
    .map((level) => ({
      levelId: level.identity.levelId,
      plan: withOpenedDungeonDoors(level.plan, level.identity, openedRouteIds),
      discoveredCellKeys: expedition?.progress.exploredCellKeysByLevel?.[
        level.identity.levelId
      ] ?? [],
      playerCell: level.identity.levelId === currentLevel.identity.levelId ? currentPlayerCell : undefined,
      annotations: [
        level.upTransition,
        level.downTransition,
        level.bossObjective,
        level.verticalSight,
      ].filter((feature): feature is NonNullable<DungeonLevelDescriptor['upTransition']> => feature !== null),
    })), [expedition?.progress, levels, reachedLevelIds, openedRouteIds, currentLevel.identity.levelId, currentPlayerCell]);

  // The expedition is the active gameplay surface. A body portal keeps town
  // HUD/chat stacking contexts from covering its controls without changing the
  // retained world, return pose, dungeon plan or progress.
  return createPortal(
    <section
      aria-label={`Dungeon expedition: ${currentLevel.plan.name}`}
      data-testid="dungeon-expedition-overlay"
      className="p-2 sm:p-4"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'calc(var(--z-index-content-overlay-top, 70) - 1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overflow: 'auto',
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
          flexWrap: 'wrap',
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
            Exploring · Floor {currentDepth + 1}
          </div>
          <h2 style={{ margin: '4px 0 2px', fontFamily: 'Georgia, serif', fontSize: '24px' }}>
            {currentLevel.plan.name}
          </h2>
          <p className="hidden sm:block" style={{margin: '4px 0', color: '#d6c7aa', fontSize: '13px'}}>Explore with the arrow keys or WASD. Your parchment remembers where you have been.</p>
          {/* Attrition stays visible while the world HUD is suspended; these are real party values. */}
          <div aria-label="Expedition party health" className="flex flex-wrap gap-x-3 text-xs text-stone-200">
            {(state.party ?? []).map(member => <span key={member.id}>{member.name} · {member.hp}/{member.maxHp} HP</span>)}
          </div>
          {state.isDevModeEnabled && <details style={{fontSize: '12px', overflowWrap: 'anywhere'}}>
          <summary style={{cursor: 'pointer', color: '#a8a29e'}}>Developer details</summary>
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
          </details>}
        </div>

        <div style={{ display: 'flex', flex: '0 1 auto', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '8px' }}>
          {onAction && <SystemMenu compact onAction={onAction} disabled={Boolean(state.isLoading)}
            unreadDiscoveryCount={state.unreadDiscoveryCount ?? 0}
            hasNewRateLimitError={Boolean(state.hasNewRateLimitError)}
            isDevModeEnabled={Boolean(state.isDevModeEnabled)} autoSaveEnabled={Boolean(state.autoSaveEnabled)}
            combatDifficulty={state.combatDifficulty} rulesEdition={state.rulesEdition} allowSaveScum={state.allowSaveScum} />}
          {currentLevel.upTransition ? (
            <Button
              type="button"
              onClick={handleAscend}
              data-testid="dungeon-ascend"
              hidden={!atStair(currentLevel.upTransition.cell)}
              disabled={!atStair(currentLevel.upTransition.cell)}
              variant="ghost"
              size="md"
              style={{ border: '1px solid #a5b4fc', color: '#e0e7ff', fontWeight: 800 }}
            >
              {atStair(currentLevel.upTransition.cell) ? 'Go up one floor' : 'Return to the stairs to go up'}
            </Button>
          ) : null}
          {currentLevel.downTransition ? (
            <Button
              type="button"
              onClick={handleDescend}
              data-testid="dungeon-descend"
              hidden={!atStair(currentLevel.downTransition.cell)}
              disabled={!atStair(currentLevel.downTransition.cell) || Boolean(descentConcern)}
              title={descentConcern ?? undefined}
              variant="action"
              size="md"
              style={{ border: '1px solid #fb923c', background: '#9a3412', color: '#fff7ed', fontWeight: 800 }}
            >
              {descentConcern ?? (atStair(currentLevel.downTransition.cell) ? 'Go down one floor' : 'Reach the stairs to go deeper')}
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

          {/* Walking back to the root entrance permits retreat to the frozen GroundWorld position. No
              completion is inferred because the current preview has no authoritative objective. */}
          <Button
            type="button"
            onClick={() => { if (currentDepth === 0 && atStair(levels[0].entryCell)) onReturn(); }}
            data-testid="return-to-world-entrance"
            hidden={currentDepth !== 0 || !atStair(levels[0].entryCell)}
            disabled={currentDepth !== 0 || !atStair(levels[0].entryCell)}
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

      <details className="rounded-xl border border-amber-400/20 bg-stone-950/80 p-3">
        <summary className="cursor-pointer text-sm text-amber-100">Field notes · {knowledge.heard.length} recorded account{knowledge.heard.length === 1 ? '' : 's'}{knowledge.traces.length ? ` · ${knowledge.traces.map(trace => trace.label).join(', ')}` : ''}</summary>
      <section aria-label="Expedition journal" className="grid gap-3 rounded-xl border border-amber-400/20 bg-stone-950/80 p-4 md:grid-cols-2">
        <div>
          <h3 className="font-serif text-lg text-amber-200">What you have heard</h3>
          {knowledge.heard.length ? knowledge.heard.map(item => <p key={item.id} className="mt-2 text-sm leading-relaxed text-stone-200">{item.description}</p>)
            : <p className="mt-2 text-sm text-stone-400">You have no recorded accounts of this place.</p>}
        </div>
        <div>
          <h3 className="font-serif text-lg text-amber-200">Traces found</h3>
          {knowledge.traces.length ? <ul className="mt-2 flex flex-wrap gap-2">{knowledge.traces.map(trace => <li key={trace.label} className="rounded border border-amber-200/20 px-2 py-1 text-sm capitalize">{trace.label}{trace.count > 1 ? ' × ' + trace.count : ''}</li>)}</ul>
            : <p className="mt-2 text-sm text-stone-400">Explore the rooms to find signs of their past.</p>}
        </div>
      </section>

      </details>

      {/* The shared renderer consumes the exact plan recovered from the level receipt. Its identity
          key remounts movement at a vertical boundary, preventing the departing page from briefly
          receiving the arrival page's discovery cells. Geometry remains generator-owned and every
          claimed cache still returns through the root expedition reducer callback. */}
      <div style={{ display: 'flex', flex: 1, justifyContent: 'center', minHeight: '320px' }}>
        <Dungeon3DPreview
          key={currentLevel.identity.dungeonId}
          plan={currentPlan}
          overlays={EXPEDITION_OVERLAYS}
          gameplay={{
            identity: currentLevel.identity,
            playerCharacter: state.party[0],
            paused: isMapOpen,
            // Standalone preview keeps its simulators; production outcomes use live source owners.
            developerTools: false,
            objectFindings: expedition?.progress.objectFindings,
            carriedTorch: activeCarriedTorches(state)[0],
            carriedTorchIndex: state.inventory.findIndex(item=>item.id==='torch'&&(item.quantity??1)>0),
            // Show actual pack sources; the same action already accepts their exact indices.
            carriedTorchChoices: state.inventory.flatMap((item,inventoryIndex)=>item.id==='torch'&&(item.quantity??1)>0
              ? [{inventoryIndex,fuelMinutes:item.lightFuelMinutes??STANDARD_TORCH_LIGHT.durationMinutes,quantity:item.quantity??1}] : []),
            // This previews the displayed flame. The reducer still proves its canonical reach.
            getTorchUseError: (inventoryIndex,sourceObjectId)=>torchUseError(state,{
              itemId:'torch',characterId:state.party.find(member=>member.hp>0)?.id??'',inventoryIndex,
            },sourceObjectId),
            onExtinguishTorch: () => {
              const source=activeCarriedTorches(state)[0];
              if(source?.bearerId)dispatch({type:'USE_ITEM',payload:{itemId:'torch',characterId:source.bearerId,light:{action:'extinguish',sourceId:source.id}}});
            },
            onObjectInteraction: handleObjectInteraction,
            claimedTreasureIds,
            onClaimTreasure: handleClaimTreasure,
            clearedEncounterIds,
            onClearEncounter: handleClearEncounter,
            onStartEncounter: handleStartEncounter,
            partyLevels: state.party?.map(member => member.level ?? 1),
            discoveredCellKeys,
            onDiscoverCells: handleDiscoverCells,
            objective: currentLevel.bossObjective
              ? { id: currentLevel.bossObjective.id, cell: currentLevel.bossObjective.cell }
              : null,
            onCompleteObjective: handleCompleteObjective,
            initialPlayerCell: arrivalCell,
            onPlayerCellChange: setCurrentPlayerCell,
            onOpenDoor: handleOpenDoor,
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
    </section>,
    document.body,
  );
};

export default DungeonExpeditionOverlay;
