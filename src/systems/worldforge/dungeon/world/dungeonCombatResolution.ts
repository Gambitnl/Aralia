/** Validate the source battle once before the existing END_BATTLE owner awards loot and attrition. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 09:01:34
 * Dependents: state/appState.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {GameState} from '../../../../types/state';
import type {AppAction} from '../../../../state/actionTypes';
import {GamePhase} from '../../../../types/core';
import {recordDungeonProgress} from './dungeonLifecycle';

export function resolveDungeonBattle(state: GameState, action: Extract<AppAction, {type: 'END_BATTLE'}>): Partial<GameState> | null {
  const source = state.extractedBattleMap?.dungeonEncounter;
  const requested = action.payload?.dungeonEncounterId;
  if (!source && !requested) return {};
  // Replayed, detached, or mismatched outcomes cannot award a second copy of loot.
  if (!source || requested !== source.encounterId || state.phase !== GamePhase.COMBAT) return null;
  if (source.returnContext.worldSeed !== state.worldSeed || source.returnContext.cellId !== state.playerCell?.cellId) return null;
  const record = state.dungeonExpeditions?.[source.rootIdentity.dungeonId];
  const enemy = state.currentEnemies?.find(e => e.id === source.combatantId);
  if (!record || !enemy || record.progress.clearedEncounterIds.includes(source.encounterId)) return null;
  const finalEnemy = action.payload?.finalEnemyState?.find(e => e.id === source.combatantId);
  const victory = Boolean(action.payload?.rewards);
  if (victory && (!finalEnemy || finalEnemy.currentHP > 0 || action.payload?.finalEnemyState?.some(e => e.currentHP > 0))) return null;
  const leader = action.payload?.finalPartyState?.find(p => p.id === state.party[0]?.id);
  const position = leader?.position;
  const tile = position && state.extractedBattleMap?.tiles.get(`${position.x}-${position.y}`);
  if (position && (!tile || tile.blocksMovement)) return null;
  const resume = {...source, enemyHP: finalEnemy?.currentHP ?? enemy.currentHP,
    playerCell: position ? {x: position.x + source.cropOrigin.x, y: position.y + source.cropOrigin.y} : source.playerCell};
  return {
    dungeonCombatReturn: resume,
    // The return receipt is visit-local. Keep the accepted health outcome in the
    // existing saved ledger too, so an overworld retreat cannot heal this enemy.
    // Only an earned victory grants clear credit; loot/party attrition stay with END_BATTLE.
    dungeonExpeditions: {...state.dungeonExpeditions,
      [source.rootIdentity.dungeonId]: recordDungeonProgress(record, {
        encounterHitPoints: {[source.encounterId]: resume.enemyHP},
        ...(victory ? {clearedEncounterIds: [source.encounterId]} : {}),
      })},
  };
}
