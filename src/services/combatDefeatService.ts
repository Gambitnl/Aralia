/** Defeat Chronicles use the normal codec while earlier recovery slots stay intact. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 18:54:15
 * Dependents: components/screens/GameOverScreen.tsx, hooks/useGameInitialization.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { GamePhase } from '../types/core';
import type { GameState } from '../types/state';
import type { PersistedCombatOutcome } from '../types/combatOutcome';
import * as SaveLoadService from './saveLoadService';
import { writeEmergencySnapshot } from './saveLoad/emergencySnapshot';

export const DEFEAT_SLOT_PREFIX = 'aralia_rpg_slot_defeat_';
let fallbackSerial = 0;
const validSlot = (slot: string | null | undefined): slot is string =>
  typeof slot === 'string' && slot.startsWith(DEFEAT_SLOT_PREFIX)
  && /^[a-zA-Z0-9_-]+$/.test(slot) && slot.length < 180;

export function createDefeatSlotId(): string {
  // Archive IDs are separate from the campaign's dice stream.
  const suffix = globalThis.crypto?.randomUUID?.() ?? `local_${++fallbackSerial}`;
  return `${DEFEAT_SLOT_PREFIX}${Date.now()}_${suffix}`;
}

function hasConsistentDefeat(state: GameState): state is GameState & { lastCombatOutcome: PersistedCombatOutcome } {
  const outcome = state.lastCombatOutcome;
  return outcome?.result === 'defeat'
    && outcome.worldSeed === (state.worldSeed ?? 0)
    && outcome.currentLocationId === state.currentLocationId
    && Array.isArray(outcome.party) && Array.isArray(outcome.enemies) && Array.isArray(outcome.events)
    && outcome.party.every(member => typeof member.id === 'string' && typeof member.name === 'string'
      && Number.isFinite(member.currentHP) && Number.isFinite(member.maxHP))
    && outcome.enemies.every(enemy => typeof enemy.id === 'string' && typeof enemy.name === 'string'
      && Number.isFinite(enemy.currentHP) && Number.isFinite(enemy.maxHP))
    && outcome.events.every(event => typeof event.id === 'string' && typeof event.message === 'string'
      && typeof event.type === 'string' && Number.isFinite(event.timestamp))
    && state.party.every(member => outcome.party.some(result => result.id === member.id && result.currentHP === member.hp));
}

export function defeatSlotFromSearch(search: string): string | null {
  const slot = new URLSearchParams(search).get('defeat');
  return validSlot(slot) ? slot : null;
}

export function setDefeatSlotInUrl(slot: string): void {
  if (!validSlot(slot) || typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('defeat', slot);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

export async function saveDefeatChronicle(state: GameState, slotId: string): Promise<SaveLoadService.SaveLoadResult> {
  if (!validSlot(slotId) || state.phase !== GamePhase.GAME_OVER
    || !state.party.length || !hasConsistentDefeat(state)) {
    return { success: false, message: 'This page has no completed defeat to record.' };
  }
  const snapshot: GameState = { ...state,
    lastCombatOutcome: { ...state.lastCombatOutcome, chronicleSlotId: slotId } };
  const label = `Defeat — ${state.party.map(member => member.name).join(', ')}`;
  // Reuse the emergency envelope, but write only this new Chronicle's key.
  // A reload while IndexedDB is pending can load the exact fallback through
  // the ordinary codec; the rolling autosave and checkpoints are untouched.
  const backup = writeEmergencySnapshot(snapshot, {
    slotId, slotName: label, isAutoSave: false, backupKey: slotId,
  });
  if (backup.succeeded) setDefeatSlotInUrl(slotId);
  const result = await SaveLoadService.saveGame(snapshot, slotId, undefined,
    { displayName: label, isAutoSave: false });
  if (result.success) {
    setDefeatSlotInUrl(slotId);
    // In fallback mode the slot itself is the permanent save, so keep it.
    if (SaveLoadService.isUsingIndexedDB()) backup.clearIfCurrent();
  }
  return result;
}

export async function loadDefeatChronicle(slotId: string): Promise<SaveLoadService.SaveLoadResult> {
  if (!validSlot(slotId)) return { success: false, message: 'The defeat record is unavailable.' };
  const result = await SaveLoadService.loadGame(slotId);
  if (!result.success || !result.data) return result;
  if (result.data.phase !== GamePhase.GAME_OVER || !result.data.party.length
    || !hasConsistentDefeat(result.data)
    || result.data.lastCombatOutcome.chronicleSlotId !== slotId) {
    return { success: false, message: 'This save is not the defeat attached to this page.' };
  }
  return result;
}
