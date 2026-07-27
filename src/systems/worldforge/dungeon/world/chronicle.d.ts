import type { ChronicleRef } from '../types';
import type { DungeonSite } from './dungeonSites';
export type { ChronicleKind, ChronicleRef, ChronicleShape } from '../types';
/**
 * Build the chronicle for a site: the real world events near it, each with a
 * world-consistent derived age. Provenance zone first (always, when present),
 * then any other event zone whose cells reach within `NEAR_GRAPH_HOPS` of the
 * site cell. Deduped by zoneId, sorted provenance-first then by zoneId.
 *
 * Cross-site consistency: the same zone yields the same `{kind, name, zoneId,
 * yearsAgo}` for EVERY site that references it (ages stream off the world root).
 */
export declare function chronicleForSite(worldSeed: number, site: DungeonSite): ChronicleRef[];
