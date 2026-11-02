/**
 * @file npcsForCell.ts — resolve the interactable townsfolk for the player's
 * current Worldforge town cell.
 *
 * Grid retirement deleted the old 2D-village triggers that surfaced a town's
 * shopkeepers; World3DWrapper still REGISTERS them (`npc_burg_<burg>_plot_*`
 * merchants + `biz_burg_<burg>_plot_*` businesses) but nothing re-adds them to
 * the action pane's talk-target list. This selector is the cell-native successor:
 * given the player's atlas cell, it returns the registered merchant NPCs whose
 * linked business sits in the same burg, so "Talk to <keeper>" / "Browse Goods"
 * actions can appear again.
 *
 * Pure and bounded. Returns [] when the player isn't standing in a burg (a
 * legitimate "no town here" case, not a swallowed error) — no try/catch fallback.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 19:47:46
 * Dependents: hooks/app/useAppLocationView.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { NPC } from '../../../types';
import type { RichNPC } from '../../../types/world';
import type { WorldBusiness } from '../../../types/business';
import { burgIdForLocation, type TownGroundContext } from './chronicleForLocation';
import { householdNpcAliveAt } from './householdNpc';
import type { TownLifeRegistry } from '../roster/agentLife';
import { shopKeeperAt, type ShopLifeView } from './shopLife';

export interface TownNpcsInput {
  worldSeed: number;
  cellId?: number | null;
  ground?: TownGroundContext;
  generatedNpcs: Record<string, RichNPC> | undefined;
  worldBusinesses: Record<string, WorldBusiness> | undefined;
  /** Cap on how many keepers to surface (keeps the talk list bounded). */
  max?: number;
  /** Life registry; entries may carry the sim's `shops` records (ShopLifeView). */
  townLife?: Record<number, TownLifeRegistry[number] & Pick<ShopLifeView, 'shops'>>;
  day?: number;
}

/**
 * Registered merchant NPCs (shop/tavern keepers) for the town at the player's
 * current cell. Each returned NPC owns a `worldBusinesses` entry whose `burgId`
 * matches the burg seated at `cellId`. Bounded by `max` (default 6) so a large
 * town never floods the action pane.
 */
export function townMerchantNpcsForCell(input: TownNpcsInput): NPC[] {
  const burgId = burgIdForLocation({ worldSeed: input.worldSeed, cellId: input.cellId, ground: input.ground });
  if (burgId === undefined) return []; // not standing in a burg

  const businesses = input.worldBusinesses ?? {};
  const npcs = input.generatedNpcs ?? {};
  const max = input.max ?? 6;

  const result: NPC[] = [];
  for (const biz of Object.values(businesses)) {
    if (result.length >= max) break;
    if (biz.burgId !== burgId) continue;
    const owner = npcs[biz.ownerId];
    // The owner must be a registered generated NPC; a business with no resolvable
    // keeper is skipped rather than surfaced as an un-talkable ghost.
    if (!owner) continue;
    // NPC lives (2026-11-02): the town sim's shop record wins when it exists.
    // A closed shop shows no keeper. An open shop shows its owner only when the
    // registered identity already names the sim keeper; a stale identity waits
    // for merchant registration on the next town entry instead of showing a
    // dead keeper. Saves without shop records keep the household check.
    const shop = shopKeeperAt(input.townLife?.[burgId], biz.plotId ?? undefined, input.day ?? 0);
    if (shop.status === 'closed') continue;
    if (shop.status === 'open') {
      if (owner.name === shop.keeper.name) result.push(owner as unknown as NPC);
      continue;
    }
    if (householdNpcAliveAt(owner, input.townLife, input.day ?? 0)) result.push(owner as unknown as NPC);
  }
  return result;
}
