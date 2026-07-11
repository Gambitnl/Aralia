/**
 * @file history/context.ts
 * @description The public `HistoryResult`, the theme actor vocabulary, and the
 * central working `SimCtx` — extracted VERBATIM from simulateHistory.ts (packet
 * W1-P6). Move-only: no behavior, just the shared shapes every history module
 * threads through. `HistoryResult` is re-exported by `../simulateHistory` so its
 * public surface is unchanged; `ACTORS`/`SimCtx` are exported for the recorder,
 * appliers, event-picker, and the main loop.
 */

import type { IntactState, Rng } from '../buildIntact';
import type {
  BuilderArchetype,
  DoorState,
  DungeonEdge,
  DungeonEvent,
  DungeonTheme,
} from '../types';

// ─── Public result ───────────────────────────────────────────────────────────

export interface HistoryResult {
  /** Full log, oldest first; `id` equals the array index. */
  events: DungeonEvent[];
  /** side*side working-grid overlay (OverlayKind per cell), cropped later. */
  overlay: Uint8Array;
  /** Working-grid door cell → state (bricked/secret) with its causing event. */
  doorStates: Map<number, { state: DoorState; eventRef: number }>;
  /** Debris/décor the events left behind, keyed to the event and its room. */
  evidenceProps: Array<{ kind: string; cell: number; eventRef: number; roomId: number }>;
  /** Who occupies which rooms; the last occupying event is the apex (boss). */
  occupations: Array<{ roomIds: number[]; actorKey: string; eventRef: number; isApex: boolean }>;
  /** Rooms whose vault an event cracked (loot systems read this later). */
  plunderedRoomIds: Set<number>;
}

// ─── Theme actor vocabulary ──────────────────────────────────────────────────
//
// Descriptive faction/monster-family strings (Task 6 maps them to CR tiers).
// Kept HERE rather than imported from generateDungeon.ts to avoid a later
// import cycle. Three registers per theme: a mid-tier denning family (`den`),
// an undead tier (`awaken`), and a squatting faction (`reoccupy`). `bloom`
// always dens `myconid_ring`.

export interface ActorVocab {
  den: string;
  undead: string;
  faction: string;
}

export const ACTORS: Record<DungeonTheme, ActorVocab> = {
  crypt: { den: 'ghoul_pack', undead: 'restless_dead', faction: 'grave_cult' },
  cavern: { den: 'giant_spider_brood', undead: 'crawling_dead', faction: 'goblin_smugglers' },
  frost: { den: 'winter_wolf_pack', undead: 'frozen_dead', faction: 'ice_reavers' },
  sewer: { den: 'carrion_crawler_nest', undead: 'drowned_dead', faction: 'thieves_guild' },
  fungal: { den: 'myconid_ring', undead: 'sporebound_dead', faction: 'spore_cult' },
};

// ─── Working simulation context ──────────────────────────────────────────────

export interface SimCtx {
  st: IntactState;
  rng: Rng;
  theme: DungeonTheme;
  archetype: BuilderArchetype;
  actors: ActorVocab;
  overlay: Uint8Array;
  doorStates: Map<number, { state: DoorState; eventRef: number }>;
  evidenceProps: Array<{ kind: string; cell: number; eventRef: number; roomId: number }>;
  occupations: Array<{ roomIds: number[]; actorKey: string; eventRef: number; isApex: boolean }>;
  plunderedRoomIds: Set<number>;
  /** Loop edges the tunnel applier dug, with the corridor cells it carved. */
  tunnels: Array<{ edge: DungeonEdge; cells: number[] }>;
  /** BUILT loop edges (from buildIntact) with their corridor cells, discovered
   * ONCE at sim start. collapse/brick-off may target these too — an intact one is
   * a connectivity-safe cycle edge to bring down / wall up. Lazily filled. */
  builtLoops: Array<{ edge: DungeonEdge; cells: number[] }> | null;
  builderName: string;
  structureNoun: string;
  /** Redo-thunks recorded for the event currently being applied (canonical pass).
   * Replaying an event = running these in order against a restored snapshot. */
  rec: Array<() => void>;
  /** Lazily-built roomId → its floor-cell indices, filled by ONE full grid scan.
   * A room's own floor cells never change owner during the sim (collapse/brick-off
   * only rewrite corridor cells), so this cache is safe to reuse across appliers
   * and replaces the per-call O(side²) `roomCells` scans that dominated the sim. */
  roomCellCache: Map<number, number[]> | null;
}
