/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 14/07/2026, 17:48:55
 * Dependents: components/Town/Broadsheet.tsx, components/Town/NoticeBoard.tsx, components/debug/TownHistoryDevOverlay.tsx, hooks/actions/actionHandlers.ts, hooks/useChronicleRumorsSync.ts, hooks/useOverheardGossip.ts, hooks/useTownCrierAnnouncements.ts, utils/world/chronicleNewsToRumors.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { LifeEventKind, TownSimState } from './types';
export type NewsProminence = 'headline' | 'notice' | 'gossip';
export interface TownNewsItem {
    /** The source chronicle event id. */
    id: number;
    day: number;
    kind: LifeEventKind;
    prominence: NewsProminence;
    /** Plain-English line (the event's own summary). */
    text: string;
}
export interface SelectNewsOptions {
    /** How many years back to consider (default 2). */
    years?: number;
    /** Lowest prominence to include (default 'gossip' = everything). */
    minProminence?: NewsProminence;
    /** Cap the number of items returned (most recent first). */
    max?: number;
}
/**
 * Recent town news, most-recent first, filtered by prominence.
 */
/** Default recency window (years) for "recent news" across every surface. */
export declare const NEWS_RECENCY_YEARS = 2;
export declare function selectTownNews(town: TownSimState, currentDay: number, opts?: SelectNewsOptions): TownNewsItem[];
/**
 * Pick a single headline for a town crier to proclaim.
 *
 * Returns the most recent headline-tier news item, skipping the one that was
 * just announced (so the crier doesn't repeat itself back-to-back). If only one
 * headline exists it may be returned again; null when the town has no headlines.
 *
 * Pure and deterministic — rotation comes from recency + lastAnnouncedId, never
 * from Math.random.
 */
export declare function pickCrierHeadline(town: TownSimState, currentDay: number, lastAnnouncedId?: number): TownNewsItem | null;
/** Frame a gossip news item as an overheard line, varied deterministically by id. */
export declare function frameOverheardGossip(item: TownNewsItem): string;
/**
 * Pick a single light, everyday item that townsfolk would gossip about in public.
 *
 * Source is the gossip tier ONLY (births, festivals, coming-of-age, courtships,
 * deaths, inheritances) — the headline-tier news belongs to the town crier and
 * the notice-tier to the boards, so this channel never overlaps with them.
 *
 * Returns the most recent gossip-tier item NOT in `recentlyHeardIds` — the ids
 * the player has already overheard within the caller's cooldown window. When
 * every gossip-tier item was recently heard, returns null: silence beats
 * repetition (previously only the immediately-previous id was skipped, so a
 * two-item pool alternated the same two lines forever).
 *
 * Pure and deterministic — rotation comes from recency + the caller's heard
 * set, never from Math.random.
 */
export declare function pickOverheardGossip(town: TownSimState, currentDay: number, recentlyHeardIds?: ReadonlySet<number>): TownNewsItem | null;
