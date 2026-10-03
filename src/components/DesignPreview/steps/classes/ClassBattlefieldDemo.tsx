// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 23:51:10
 * Dependents: components/DesignPreview/steps/classes/subclasses/barbarian/WildHeartDemo.tsx
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useCallback, useEffect, useState } from 'react';
import BattleMap from '../../../BattleMap/BattleMap';
import BattleMap3D from '../../../BattleMap/BattleMap3D';
import { useAbilitySystem } from '../../../../hooks/useAbilitySystem';
import { useTurnManager } from '../../../../hooks/combat/useTurnManager';
import { generateProceduralSandboxBattleSetup } from '../../../../hooks/useBattleMapGeneration';
import { createQuickCombatCharacter } from '../../../../utils/sandbox/quickCharacterGenerator';
import type { BattleMapData, CombatCharacter, CombatLogEntry } from '../../../../types/combat';
import { Button } from '../../../ui/Button';

/**
 * This component places the selected Wild Heart combat character on the same
 * production 2D and 3D battle-map renderers used by tactical combat.
 *
 * The Classes leaf owns the deterministic review board, while BattleMap and
 * BattleMap3D remain the only authorities for drawing tokens, terrain, status
 * badges, and camera state. The parent supplies the native Rage result; this
 * component only mirrors that result into the shared renderer roster.
 *
 * Called by: WildHeartDemo.tsx inside the Classes domain.
 * Depends on: the production map generator, turn manager, ability system, and
 * the canonical BattleMap/BattleMap3D presentation components.
 */

// ============================================================================
// Deterministic review board
// ============================================================================
// A fixed seed keeps screenshots and repeated browser checks on the same board.
// The board is a review fixture only; movement, targeting, and status rendering
// still flow through the production combat hooks and renderer components.
const WILD_HEART_BOARD_SEED = 31873;

/** Build the one player and one enemy token needed to make the class state legible. */
function createTrainingTarget(): CombatCharacter {
  const target = createQuickCombatCharacter({
    classId: 'fighter',
    raceId: 'human',
    level: 1,
    name: 'Wild Heart Training Target',
    useRecommendedStats: true,
  });

  // A missing production fixture is a hard boundary. It must not be replaced by
  // a hand-built token because the map renderer expects a complete combat record.
  if (!target) {
    throw new Error('Production training-target assembly failed for the Wild Heart board.');
  }

  // The quick combat factory creates a player-shaped record. Changing only team
  // and identity makes it a visible opposing actor without inventing its stats.
  return {
    ...target,
    id: 'wild-heart-training-target',
    name: 'Wild Heart Training Target',
    team: 'enemy',
  };
}

/** Generate the same board and preserve the supplied native Wild Heart state. */
function createWildHeartBoardSetup(character: CombatCharacter): {
  mapData: BattleMapData;
  positionedCharacters: CombatCharacter[];
} {
  // The class character comes from the parent's native Rage transaction. The
  // generator supplies deterministic positions and ordinary tactical terrain.
  return generateProceduralSandboxBattleSetup('forest', WILD_HEART_BOARD_SEED, [
    character,
    createTrainingTarget(),
  ]);
}

// ============================================================================
// Classes-owned renderer bridge
// ============================================================================
export interface ClassBattlefieldDemoProps {
  /** The production character whose statusEffects are consumed by both renderers. */
  character: CombatCharacter;
  /** Reset returns the parent Wild Heart transaction to its native baseline. */
  onReset: () => void;
}

/** Render one native combat roster through the selectable 2D or 3D renderer. */
export const ClassBattlefieldDemo: React.FC<ClassBattlefieldDemoProps> = ({
  character,
  onReset,
}) => {
  // Build the deterministic board exactly once. The parent may replace the
  // character object when Rage changes, but that feature update must not rebuild
  // terrain or move the token to a new spawn square.
  const [initialSetup] = useState(() => createWildHeartBoardSetup(character));
  const [renderMode, setRenderMode] = useState<'2d' | '3d'>('2d');
  const [mapData, setMapData] = useState<BattleMapData | null>(() => initialSetup.mapData);
  const [boardCharacters, setBoardCharacters] = useState<CombatCharacter[]>(() => initialSetup.positionedCharacters);
  const [combatLog, setCombatLog] = useState<CombatLogEntry[]>([]);

  // Present the parent-owned mechanic state over the board roster without writing
  // state during an effect. The board copy contributes the latest token position,
  // so a Rage transition changes status facts without resetting map placement.
  const presentedCharacters = boardCharacters.map(candidate => (
    candidate.id === character.id
      ? { ...candidate, ...character, position: candidate.position }
      : candidate
  ));

  // Production map actions publish their updated character through this boundary.
  // No visual component is allowed to mutate the class feature independently.
  const handleCharacterUpdate = useCallback((updatedCharacter: CombatCharacter): void => {
    setBoardCharacters(previous => previous.map(candidate => (
      candidate.id === updatedCharacter.id ? updatedCharacter : candidate
    )));
  }, []);

  // Combat logs are useful proof context, but they remain a presentation receipt;
  // the live character and its statusEffects stay authoritative for the rule.
  const handleLogEntry = useCallback((entry: CombatLogEntry): void => {
    setCombatLog(previous => [...previous, entry]);
  }, []);

  // The fixed initiative totals keep the mounted board stable across captures.
  const initiativeRoller = useCallback((candidate: CombatCharacter): number => (
    candidate.team === 'player' ? 20 : 10
  ), []);

  // The turn manager is the production clock and action boundary consumed by both
  // renderers, even though this narrow class proof does not add a new action.
  const turnManager = useTurnManager({
    characters: presentedCharacters,
    mapData,
    onCharacterUpdate: handleCharacterUpdate,
    onLogEntry: handleLogEntry,
    onMapUpdate: setMapData,
    initiativeRoller,
    difficulty: 'normal',
  });

  // Start the ordinary turn state once the deterministic board has mounted. The
  // renderer receives this same state in both modes, so changing cameras cannot
  // create a second class mechanic or a browser-only status path.
  useEffect(() => {
    if (mapData && presentedCharacters.length > 0 && turnManager.turnState.turnOrder.length === 0) {
      turnManager.initializeCombat(presentedCharacters);
    }
  }, [mapData, presentedCharacters, turnManager]);

  // The ability system owns targeting and command execution for the map. It is
  // intentionally wired even though this representative leaf exposes no new
  // ability button, keeping the map's existing interaction contract intact.
  const abilitySystem = useAbilitySystem({
    characters: presentedCharacters,
    mapData,
    onExecuteAction: turnManager.executeAction,
    onCharacterUpdate: handleCharacterUpdate,
    onLogEntry: handleLogEntry,
    onAbilityEffect: turnManager.addDamageNumber,
    onMapUpdate: setMapData,
  });

  // Reset the parent transaction and return to the reviewer's readable 2D start.
  // The effect above then replaces only the Wild Heart token's native status state.
  const resetBoard = (): void => {
    onReset();
    setRenderMode('2d');
    setCombatLog([]);
  };

  const wildHeartStatus = character.statusEffects.find(status => status.id === 'raging');
  const mapCombatState = {
    turnManager,
    turnState: turnManager.turnState,
    abilitySystem,
    isCharacterTurn: turnManager.isCharacterTurn,
    onCharacterUpdate: handleCharacterUpdate,
  };

  return (
    <section
      aria-label="Wild Heart 2D and 3D battlefield demonstration"
      data-testid="wild-heart-battlefield-demo"
      className="mt-4 rounded border border-cyan-400/40 bg-slate-950/60 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">
            Canonical map presentation
          </p>
          <h3 className="mt-1 text-base font-semibold">Wild Heart tactical proof</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            The native Bear Spirit status is shown by the shared combat roster in 2D and 3D.
          </p>
        </div>
        <span
          data-testid="wild-heart-battlefield-state"
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300"
        >
          Map status: {wildHeartStatus?.name ?? 'Not raging'}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Wild Heart battlefield controls">
        <Button
          type="button"
          variant={renderMode === '2d' ? 'action' : 'ghost'}
          size="sm"
          aria-pressed={renderMode === '2d'}
          onClick={() => setRenderMode('2d')}
          className="min-h-11 rounded border border-cyan-300/60 px-3 py-2 text-xs font-semibold text-cyan-100"
        >
          2D View
        </Button>
        <Button
          type="button"
          variant={renderMode === '3d' ? 'action' : 'ghost'}
          size="sm"
          aria-pressed={renderMode === '3d'}
          onClick={() => setRenderMode('3d')}
          className="min-h-11 rounded border border-cyan-300/60 px-3 py-2 text-xs font-semibold text-cyan-100"
        >
          3D View
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={resetBoard}
          className="min-h-11 rounded border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300"
        >
          Reset map state
        </Button>
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <div className="rounded border border-slate-800 bg-slate-950/80 p-2">
          <dt className="text-slate-500">Renderer</dt>
          <dd data-testid="wild-heart-battlefield-renderer" className="mt-1 font-mono font-bold text-cyan-200">
            {renderMode.toUpperCase()}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/80 p-2">
          <dt className="text-slate-500">Shared status input</dt>
          <dd data-testid="wild-heart-battlefield-status" className="mt-1 font-semibold text-emerald-200">
            {wildHeartStatus?.name ?? 'Not raging'}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/80 p-2">
          <dt className="text-slate-500">Map events</dt>
          <dd data-testid="wild-heart-battlefield-log-count" className="mt-1 font-mono font-bold text-slate-200">
            {combatLog.length}
          </dd>
        </div>
      </div>

      <p className="mt-3 border-l-2 border-cyan-400 pl-2 text-xs leading-relaxed text-cyan-100">
        The map consumes the same CombatCharacter statusEffects that drive the class facts above;
        it does not calculate Rage or resistance.
      </p>

      <div
        data-testid={`wild-heart-${renderMode}-map`}
        className="mt-3 min-h-[360px] overflow-hidden rounded border border-slate-800 bg-slate-950"
      >
        {renderMode === '3d' ? (
          <BattleMap3D
            mapData={mapData}
            characters={presentedCharacters}
            combatState={mapCombatState}
          />
        ) : (
          <BattleMap
            mapData={mapData}
            characters={presentedCharacters}
            preferFullMapFit
            combatState={mapCombatState}
          />
        )}
      </div>
    </section>
  );
};

export default ClassBattlefieldDemo;
