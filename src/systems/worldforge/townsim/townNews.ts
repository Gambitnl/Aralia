/**
 * @file townNews.ts — the shared "news" layer that every diegetic surface reads.
 *
 * Turns a town's raw chronicle events into ranked, player-facing news items at
 * three prominence tiers, so each surface can pick its slice:
 *   - town crier / broadsheet headline  → 'headline'
 *   - notice / quest board              → 'notice' and up
 *   - overheard public gossip           → 'gossip' and up
 *
 * Pure. The event summaries are already plain-English (written by the sim), so
 * this layer only classifies, filters by recency, and orders them.
 */
import { DAYS_PER_YEAR } from './constants';
import type { LifeEvent, LifeEventKind, TownSimState } from './types';

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

/** How loudly each kind of event travels as news. */
const PROMINENCE: Record<LifeEventKind, NewsProminence> = {
  disaster: 'headline',
  role_succession: 'headline',
  marriage: 'notice',
  economy: 'notice',
  death: 'gossip',
  birth: 'gossip',
  courtship: 'gossip',
  came_of_age: 'gossip',
  inheritance: 'gossip',
  festival: 'gossip',
  // Raid-worry (Task 8) travels as everyday overheard talk — a notice, not a
  // crier's headline. Loud enough to reach the quest/notice board.
  raid_worry: 'notice',
};

const RANK: Record<NewsProminence, number> = { headline: 3, notice: 2, gossip: 1 };

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
export const NEWS_RECENCY_YEARS = 2;

export function selectTownNews(
  town: TownSimState,
  currentDay: number,
  opts: SelectNewsOptions = {},
): TownNewsItem[] {
  const years = opts.years ?? NEWS_RECENCY_YEARS;
  const from = currentDay - years * DAYS_PER_YEAR;
  const minRank = RANK[opts.minProminence ?? 'gossip'];

  const items = town.chronicle.events
    .filter((e: LifeEvent) => e.day >= from && e.day <= currentDay && e.summary.length > 0)
    .map((e: LifeEvent): TownNewsItem => ({
      id: e.id,
      day: e.day,
      kind: e.kind,
      prominence: PROMINENCE[e.kind],
      text: e.summary,
    }))
    .filter((i) => RANK[i.prominence] >= minRank)
    .sort((a, b) => b.day - a.day || b.id - a.id);

  return opts.max !== undefined ? items.slice(0, opts.max) : items;
}

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
export function pickCrierHeadline(
  town: TownSimState,
  currentDay: number,
  lastAnnouncedId?: number,
): TownNewsItem | null {
  const headlines = selectTownNews(town, currentDay, { minProminence: 'headline', max: 8 });
  if (headlines.length === 0) return null;
  // Most recent that isn't the immediately-previous proclamation.
  const fresh = headlines.find((h) => h.id !== lastAnnouncedId);
  // If the only headline equals lastAnnouncedId, repeat it rather than stay silent.
  return fresh ?? headlines[0];
}

/** Framings for overheard chatter; chosen deterministically by event id so the
 * same item always reads the same way but successive gossip varies its voice. */
const GOSSIP_FRAMINGS: ReadonlyArray<(t: string) => string> = [
  (t) => `You overhear townsfolk gossiping: "${t}"`,
  (t) => `A passerby mutters: "${t}"`,
  (t) => `Two locals are chattering: "${t}"`,
  (t) => `Someone nearby is saying: "${t}"`,
  (t) => `Word on the street: "${t}"`,
];

/** Frame a gossip news item as an overheard line, varied deterministically by id. */
export function frameOverheardGossip(item: TownNewsItem): string {
  const frame = GOSSIP_FRAMINGS[Math.abs(item.id) % GOSSIP_FRAMINGS.length];
  return frame(item.text);
}

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
export function pickOverheardGossip(
  town: TownSimState,
  currentDay: number,
  recentlyHeardIds?: ReadonlySet<number>,
): TownNewsItem | null {
  const gossip = selectTownNews(town, currentDay, { max: 24 }).filter(
    (i) => i.prominence === 'gossip',
  );
  const fresh = gossip.find((g) => !recentlyHeardIds?.has(g.id));
  return fresh ?? null;
}
