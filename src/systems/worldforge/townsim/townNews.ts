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

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 29/10/2026, 00:41:47
 * Dependents: components/Town/Broadsheet.tsx, components/Town/NoticeBoard.tsx, components/debug/TownHistoryDevOverlay.tsx, hooks/actions/actionHandlers.ts, hooks/useChronicleRumorsSync.ts, hooks/useOverheardGossip.ts, hooks/useTownCrierAnnouncements.ts, systems/worldforge/townsim/townSituation.ts, utils/world/chronicleNewsToRumors.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
  // Property changes matter to neighbors, tradespeople, and notice boards, but
  // ordinary repairs or household moves do not displace disaster headlines.
  building: 'notice',
  // A player-authored outcome is substantial local news. It reaches boards and
  // rumors without displacing disasters or succession from crier headlines.
  player_intervention: 'notice',
  death: 'gossip',
  birth: 'gossip',
  courtship: 'gossip',
  came_of_age: 'gossip',
  inheritance: 'gossip',
  festival: 'gossip',
  // Raid-worry (Task 8) travels as everyday overheard talk — a notice, not a
  // crier's headline. Loud enough to reach the quest/notice board.
  raid_worry: 'notice',
  // NPC lives: a shop that changes hands, closes or reopens matters to every
  // customer, so it reaches the notice board. A personal change of fortune is
  // everyday talk.
  shop_succession: 'notice',
  shop_closed: 'notice',
  shop_opened: 'notice',
  fortune_rose: 'gossip',
  fortune_fell: 'gossip',
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
const GOSSIP_FRAMINGS: ReadonlyArray<(t: string, when: string) => string> = [
  (t, when) => `You overhear townsfolk gossiping${when}: "${t}"`,
  (t, when) => `A passerby mutters${when}: "${t}"`,
  (t, when) => `Two locals are chattering${when}: "${t}"`,
  (t, when) => `Someone nearby is saying${when}: "${t}"`,
  (t, when) => `Word on the street${when}: "${t}"`,
];

/** Preserve each voice and old callers; live hearing can add the source age. */
export function frameOverheardGossip(item: TownNewsItem, ageLabel?: string): string {
  const frame = GOSSIP_FRAMINGS[Math.abs(item.id) % GOSSIP_FRAMINGS.length];
  return frame(item.text, ageLabel ? ' ('+ageLabel+')' : '');
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


/** Show when news happened and who its original record involves. This is history,
 * not a claim that those people are alive, nearby, or asking the player for help.
 * Missing/ambiguous records stay anonymous; prose and today's household cannot
 * establish who participated in an older event. */
export function townNewsContext(town: TownSimState, item: TownNewsItem, currentDay: number): {
  ageLabel: string;
  people: {id: number; name: string}[];
} {
  const age = currentDay - item.day;
  const ageLabel = !Number.isInteger(age) || age < 0 ? 'Date unavailable'
    : age === 0 ? 'Today' : age === 1 ? 'Yesterday' : `${age} days ago`;
  const matches = town.chronicle.events.filter(event => event.id === item.id);
  const source = matches.length === 1 ? matches[0] : undefined;
  if (!source || source.day !== item.day || source.kind !== item.kind || source.summary !== item.text) {
    return {ageLabel, people: []};
  }
  const people = [...new Set([source.subjectId,...source.relatedIds])].flatMap(id => {
    const person = town.villagers[id];
    if (!Number.isInteger(id) || id <= 0 || !person || person.occupantId !== id
      || !person.name?.trim() || !Number.isFinite(person.bornDay) || person.bornDay > source.day
      || person.diedDay !== undefined && person.diedDay < source.day) return [];
    return [{id,name:person.name.trim()}];
  });
  return {ageLabel,people};
}
