/**
 * @file src/hooks/useTownMerchantRegistration.ts
 * Populates the town the player is standing in with interactable merchants —
 * shop/tavern keepers and their businesses — so a town reached by 2D map travel
 * is a LIVING place ("Talk to <keeper>" / "Browse Goods"), not an empty shell.
 *
 * Before this, merchants were only registered by World3DWrapper's 3D ground
 * entry, so a 2D-only arrival saw nobody. This registers on ANY arrival by
 * watching the canonical player cell — using computeBurgMerchants, which derives
 * the SAME plot-keyed ids the 3D bake uses, so a keeper registered here IS the
 * one the 3D town renders (identical-towns invariant). Registration is
 * idempotent: both views use the same canonical household resolver. It retains
 * saved businesses and memory while repairing outdated independent keeper names
 * and family facts. Existing IDs are updated rather than duplicated.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 19:47:46
 * Dependents: components/layout/GameModals.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useEffect, useMemo } from 'react';
import type { Dispatch } from 'react';
import { GameState } from '../types';
import { AppAction } from '../state/actionTypes';
import { burgIdForLocation } from '../systems/worldforge/townsim/chronicleForLocation';
import { computeBurgMerchants } from '../systems/worldforge/townsim/registerBurgMerchants';
import { getGameDay } from '../utils/core';

export function useTownMerchantRegistration(
  gameState: GameState,
  dispatch: Dispatch<AppAction>,
): void {
  const { worldSeed } = gameState;
  const cellId = gameState.playerCell?.cellId ?? null;
  const burgId = useMemo(() => {
    if (cellId == null) return undefined;
    return burgIdForLocation({ worldSeed, cellId });
  }, [worldSeed, cellId]);

  useEffect(() => {
    if (burgId === undefined) return;
    const gameDay = getGameDay(gameState.gameTime);
    const { npcs, businesses } = computeBurgMerchants(
      worldSeed,
      burgId,
      gameDay,
      gameState.generatedNpcs,
      gameState.worldBusinesses,
      gameState.townSim?.[burgId],
    );
    for (const npc of npcs) dispatch({ type: 'REGISTER_GENERATED_NPC', payload: { npc } });
    for (const business of businesses) dispatch({ type: 'REGISTER_WORLD_BUSINESS', payload: { business } });
    // Intentionally keyed on the burg (not every state change): computeBurgMerchants
    // is idempotent, and re-running on each generatedNpcs change would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burgId, worldSeed, dispatch]);
}
