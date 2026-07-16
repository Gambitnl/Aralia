// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 01:42:46
 * Dependents: components/World3D/World3DWrapper.tsx, hooks/actions/handleNpcInteraction.ts, hooks/useDeEscalation.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file lets gameplay actions ask the currently mounted GroundWorld to
 * prepare a real fight-in-place encounter.
 *
 * GroundWorld lives inside World3DWrapper, while wanted-watch decisions happen
 * in the action layer. A tiny runtime provider bridges that ownership boundary
 * without serializing the generated world into GameState. The provider exists
 * only while a live ground session is mounted; static towns and placeless
 * encounters therefore keep their existing fallback behavior.
 *
 * Registered by: World3DWrapper
 * Called by: handleNpcInteraction and future world-event confrontation routes
 */
import type { StartBattleMapEncounterPayload } from '@/types/actions';
import type { Crime } from '@/types/crime';
import type { PlayerFactionStanding } from '@/types/factions';
import type { BattleMapData } from '@/types/combat';
import type { OpeningBattlefieldSource } from '@/systems/gameEntry/types';
import type { SettlementEncounterTrigger } from '@/systems/combat/worldScenario/settlementEncounterHostility';

// ============================================================================
// Runtime Request And Result
// ============================================================================

export interface ActiveGroundSettlementEncounterRequest {
  trigger: SettlementEncounterTrigger;
  knownCrimes: readonly Crime[];
  playerFactionStandings: Readonly<Record<string, PlayerFactionStanding>>;
}

export type ActiveGroundSettlementEncounterResult =
  | {
      status: 'ready';
      detail: string;
      payload: StartBattleMapEncounterPayload;
    }
  | {
      status: 'unavailable' | 'withheld' | 'source-gap' | 'not-applicable';
      detail: string;
    };

export type ActiveGroundCombatProvider = (
  request: ActiveGroundSettlementEncounterRequest,
) => Promise<ActiveGroundSettlementEncounterResult>;

/** Hostile openings carry only a game-authored location receipt and roster. */
export interface ActiveGroundOpeningEncounterRequest {
  source: OpeningBattlefieldSource;
}

export type ActiveGroundOpeningEncounterResult =
  | {
      status: 'ready';
      detail: string;
      mapData: BattleMapData;
    }
  | {
      status: 'unavailable' | 'source-gap';
      detail: string;
    };

export type ActiveGroundOpeningCombatProvider = (
  request: ActiveGroundOpeningEncounterRequest,
) => Promise<ActiveGroundOpeningEncounterResult>;

// ============================================================================
// Mounted Ground Session
// ============================================================================

let activeProvider: ActiveGroundCombatProvider | null = null;
let activeOpeningProvider: ActiveGroundOpeningCombatProvider | null = null;

/**
 * Publish one mounted GroundWorld provider and return an ownership-safe cleanup.
 * A stale React effect cannot clear a newer provider installed by the next
 * render because cleanup only removes the exact function it registered.
 */
export function registerActiveGroundCombatProvider(
  provider: ActiveGroundCombatProvider,
): () => void {
  activeProvider = provider;
  return () => {
    if (activeProvider === provider) activeProvider = null;
  };
}

/** Ask the live GroundWorld for a source encounter, if one is mounted. */
export async function prepareActiveGroundSettlementEncounter(
  request: ActiveGroundSettlementEncounterRequest,
): Promise<ActiveGroundSettlementEncounterResult> {
  if (!activeProvider) {
    return {
      status: 'unavailable',
      detail: 'No live WorldForge GroundWorld is mounted for this interaction.',
    };
  }
  return activeProvider(request);
}

// ============================================================================
// Mounted Opening Encounter Projection
// ============================================================================
// Opening conversations run above the live GroundWorld. Their action layer can
// ask for that exact crop through this separate provider without coupling the
// social threat model to settlement-crime evidence or combatant projection.
// ============================================================================

/** Publish the opening projector owned by the currently mounted GroundWorld. */
export function registerActiveGroundOpeningCombatProvider(
  provider: ActiveGroundOpeningCombatProvider,
): () => void {
  activeOpeningProvider = provider;
  return () => {
    if (activeOpeningProvider === provider) activeOpeningProvider = null;
  };
}

/** Ask the live GroundWorld to validate and project one hostile opening. */
export async function prepareActiveGroundOpeningEncounter(
  request: ActiveGroundOpeningEncounterRequest,
): Promise<ActiveGroundOpeningEncounterResult> {
  if (!activeOpeningProvider) {
    return {
      status: 'unavailable',
      detail: 'No live WorldForge GroundWorld is mounted for this opening threat.',
    };
  }
  return activeOpeningProvider(request);
}
