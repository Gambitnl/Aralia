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
import type { NPC } from '../../../types';
import type { RichNPC } from '../../../types/world';
import type { WorldBusiness } from '../../../types/business';
export interface TownNpcsInput {
    worldSeed: number;
    cellId?: number | null;
    generatedNpcs: Record<string, RichNPC> | undefined;
    worldBusinesses: Record<string, WorldBusiness> | undefined;
    /** Cap on how many keepers to surface (keeps the talk list bounded). */
    max?: number;
}
/**
 * Registered merchant NPCs (shop/tavern keepers) for the town at the player's
 * current cell. Each returned NPC owns a `worldBusinesses` entry whose `burgId`
 * matches the burg seated at `cellId`. Bounded by `max` (default 6) so a large
 * town never floods the action pane.
 */
export declare function townMerchantNpcsForCell(input: TownNpcsInput): NPC[];
