/** Owned torches become light only after ignition; the existing world clock burns their fuel. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 28/10/2026, 19:15:01
 * Dependents: components/CharacterSheet/Overview/InventoryList.tsx, components/World3D/DungeonExpeditionOverlay.tsx, hooks/actions/handleItemInteraction.ts, state/reducers/characterReducer.ts, systems/worldforge/dungeon/world/dungeonObjectResolution.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {GamePhase} from '../../types/core';
import type {GameState, Item} from '../../types';
import type {LightSource} from '../../types/underdark';
import {createLightSource, STANDARD_TORCH_LIGHT} from '../../services/underdarkService';

export interface CarriedTorchRequest {
  itemId: string;
  characterId: string;
  inventoryIndex?: number;
  light?: {action: 'extinguish'; sourceId: string};
}

/** Absolute game time prevents a reload or a missed tick from granting fresh fuel.
 * Game dates may precede 1970; a valid negative epoch is not an invalid clock. */
export function remainingLightMinutes(source: LightSource, gameTime: Date): number {
  if (!source.isActive || !Number.isFinite(source.durationRemaining)) return 0;
  let remaining = Math.max(0, source.durationRemaining);
  if (source.expiresAtGameTime !== undefined) {
    const now = gameTime.getTime();
    if (!Number.isFinite(now) || !Number.isFinite(source.expiresAtGameTime)) return 0;
    remaining = Math.min(remaining, Math.max(0, (source.expiresAtGameTime - now) / 60000));
  }
  return remaining;
}

/** Explicit records only: a fresh torch in a pack is not a burning torch. */
export function activeCarriedTorches(state: Pick<GameState, 'party'|'underdark'|'gameTime'>): LightSource[] {
  return (state.underdark?.activeLightSources ?? []).flatMap(source => {
    const durationRemaining = remainingLightMinutes(source, state.gameTime);
    if (source.type !== 'torch' || !source.bearerId || source.sourceItem?.id !== 'torch' || durationRemaining <= 0 ||
      !state.party.some(member => member.id === source.bearerId)) return [];
    return [{...source, durationRemaining, brightRadius: STANDARD_TORCH_LIGHT.brightRadius,
      dimRadius: STANDARD_TORCH_LIGHT.dimRadius}];
  });
}

function torchIndex(state: GameState, request: CarriedTorchRequest): number {
  return request.inventoryIndex ?? state.inventory.findIndex(item => item.id === request.itemId);
}

export function torchUseError(state: GameState, request: CarriedTorchRequest, sourceFlameId?: string): string|null {
  if (state.phase !== GamePhase.PLAYING) return 'Use your combat action before handling a torch in battle.';
  const bearer = state.party.find(member => member.id === request.characterId);
  if (!bearer || bearer.hp <= 0) return 'That character cannot handle a torch now.';
  const unable = new Set(['incapacitated', 'unconscious', 'paralyzed', 'stunned']);
  if (bearer.conditions?.some(condition => unable.has(condition.toLowerCase())) ||
    bearer.statusEffects?.some(effect => unable.has(effect.name.toLowerCase()))) return 'That character cannot handle a torch now.';
  if (request.itemId !== 'torch') return 'That item is not a torch.';
  if (request.light) {
    return state.underdark.activeLightSources.some(source => source.id === request.light!.sourceId &&
      source.type === 'torch' && source.bearerId === bearer.id && source.sourceItem?.id === 'torch')
      ? null : 'That carried torch is no longer available.';
  }
  if (activeCarriedTorches(state).some(source => source.bearerId === bearer.id)) return 'That character already carries a burning torch.';
  const index = torchIndex(state, request), item = state.inventory[index];
  if (!Number.isSafeInteger(index) || index < 0 || !item || item.id !== request.itemId || item.id !== 'torch' ||
    !Number.isSafeInteger(item.quantity ?? 1) || (item.quantity ?? 1) <= 0) return 'That torch is no longer carried.';
  const fuel = item.lightFuelMinutes ?? STANDARD_TORCH_LIGHT.durationMinutes;
  if (!Number.isFinite(fuel) || fuel <= 0 || fuel > STANDARD_TORCH_LIGHT.durationMinutes) return 'That torch has no usable fuel.';
  const hasTinderbox = state.inventory.some(held => held.id === 'tinderbox' && (held.quantity ?? 1) > 0);
  // Only the canonical object resolver may supply a fixed-flame proof. No player action carries one.
  const sourceFlame = sourceFlameId?.startsWith('object.v1:') === true;
  if (!hasTinderbox && !sourceFlame && activeCarriedTorches(state).length === 0) {
    return 'Use a tinderbox, or select Light a carried torch beside a fixed dungeon flame.';
  }
  return Number.isFinite(state.gameTime.getTime()) ? null : 'The world clock is unavailable; no torch was used.';
}

/** One transaction owns the inventory and light record. Replays cannot refund or consume twice. */
export function prepareCarriedTorch(state: GameState, request: CarriedTorchRequest, sourceFlameId?: string):
  {patch: Partial<GameState>} | {error: string} {
  const error = torchUseError(state, request, sourceFlameId);
  if (error) return {error};
  if (request.light) {
    const source = state.underdark.activeLightSources.find(light => light.id === request.light!.sourceId)!;
    const fuel = remainingLightMinutes(source, state.gameTime);
    // Return the same source item with its remaining fuel, never another fresh torch.
    const returned: Item[] = fuel > 0 ? [{...source.sourceItem!, quantity: 1, lightFuelMinutes: fuel}] : [];
    return {patch: {inventory: [...state.inventory, ...returned], underdark: {...state.underdark,
      activeLightSources: state.underdark.activeLightSources.filter(light => light.id !== source.id)}}};
  }
  const index = torchIndex(state, request), item = state.inventory[index];
  const duration = item.lightFuelMinutes ?? STANDARD_TORCH_LIGHT.durationMinutes;
  const inventory = [...state.inventory];
  if ((item.quantity ?? 1) > 1) inventory[index] = {...item, quantity: item.quantity! - 1};
  else inventory.splice(index, 1);
  const source: LightSource = {...createLightSource('Torch', 'torch',
    STANDARD_TORCH_LIGHT.brightRadius + STANDARD_TORCH_LIGHT.dimRadius, duration),
    bearerId: request.characterId, sourceItem: {...item, quantity: 1},
    brightRadius: STANDARD_TORCH_LIGHT.brightRadius, dimRadius: STANDARD_TORCH_LIGHT.dimRadius,
    expiresAtGameTime: state.gameTime.getTime() + duration * 60000};
  return {patch: {inventory, underdark: {...state.underdark,
    activeLightSources: [...state.underdark.activeLightSources, source]}}};
}
