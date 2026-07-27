/**
 * @file manifests.ts — the living overlay's owned-contents layer.
 *
 * For every container furnishing in a {@link BlueprintPlan} (chest, shelf,
 * barrel, crate, strongbox), roll a small manifest of real registry items from
 * a pool chosen by (room purpose, container kind, the household's trade, its
 * wealth). Every container is OWNED by the household (`ownerHomeId = brief.homeId`)
 * so taking an item can later be flagged stolen (see Item.stolenFrom).
 *
 * Determinism: each container rolls from its OWN seed stream
 * `manifest:<level>:<furnishingIndex>` off the building's seed path, so adding
 * or removing one container never re-rolls its neighbors.
 *
 * Pure data — no three.js. Every itemId a manifest emits resolves in ALL_ITEMS
 * (test-enforced across 25 seeds).
 */
import type { BlueprintPlan, HouseholdBrief } from './blueprintTypes';
import { type SeedPath } from '../seedPath';
export interface ManifestEntry {
    itemId: string;
    qty: number;
}
export interface ContainerManifest {
    level: number;
    furnishingIndex: number;
    kind: string;
    ownerHomeId: string;
    entries: ManifestEntry[];
}
/** Furnishing kinds that hold owned goods. */
export declare const CONTAINER_KINDS: ReadonlySet<string>;
/**
 * Build an owned manifest for every container furnishing in the plan. Order is
 * floor order, then furnishing order within each floor.
 */
export declare function containerManifests(plan: BlueprintPlan, brief: HouseholdBrief, path: SeedPath): ContainerManifest[];
