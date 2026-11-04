/**
 * @file villagerMood.ts — A villager's mood and recent life, DERIVED from the
 * town chronicle on request. Nothing here is stored: the diary is the source
 * of truth (SPEC D7), so a mood can never drift from the events behind it.
 *
 * NPC lives (2026-11-02). Dialogue and inspection can read these later; this
 * slice adds no UI.
 *
 * Windows (days before `day`, inclusive):
 *  - GRIEF_DAYS (60): death of a spouse, child or parent -> 'grieving'.
 *  - LOSS_DAYS (365): two or more losses (kin death, own fortune_fell, a
 *    family shop closed) -> 'bitter', when grief is no longer fresh.
 *  - JOY_DAYS (45): own marriage, a new child, reopening a shop, or a
 *    fortune_rose -> 'joyful'.
 *  - WORRY_DAYS (90): own fortune_fell, a family shop closed, or any town
 *    disaster (fire, plague, crime wave) -> 'worried'.
 * Order when several apply: grieving > bitter > joyful > worried > content.
 * `reasons` lists every reason that applies, most recent first, so dialogue
 * can show mixed feelings.
 *
 * Pure: reads state, mutates nothing.
 */

import type { LifeEvent, TownSimState } from './types';

export const GRIEF_DAYS = 60;
export const LOSS_DAYS = 365;
export const JOY_DAYS = 45;
export const WORRY_DAYS = 90;
/** Default look-back for villagerRecentLife. */
export const RECENT_LIFE_DAYS = 365;

export type Mood = 'joyful' | 'content' | 'grieving' | 'worried' | 'bitter';

export interface VillagerMood {
  mood: Mood;
  reasons: string[];
}

type MoodTown = Pick<TownSimState, 'villagers' | 'chronicle'>;

/** "today", "yesterday", or "N days ago". */
function agoLabel(eventDay: number, day: number): string {
  const n = day - eventDay;
  return n === 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
}

const within = (e: LifeEvent, day: number, span: number): boolean => e.day <= day && day - e.day <= span;

const touches = (e: LifeEvent, id: number): boolean => e.subjectId === id || e.relatedIds.includes(id);

/** Drop the final period so a time label can follow the sentence. */
const clause = (summary: string): string => summary.replace(/[.!]\s*$/, '');

/** Living villager present on `day`, or undefined. */
function presentVillager(town: MoodTown, occupantId: number, day: number) {
  const v = town.villagers[occupantId];
  if (!v || v.bornDay > day || (v.diedDay !== undefined && v.diedDay <= day)) return undefined;
  return v;
}

/** Close kin ids with their relation word. A dead spouse keeps spouseId. */
function kinOf(town: MoodTown, occupantId: number): Map<number, 'spouse' | 'parent' | 'child'> {
  const v = town.villagers[occupantId];
  const kin = new Map<number, 'spouse' | 'parent' | 'child'>();
  if (!v) return kin;
  if (v.spouseId !== undefined) kin.set(v.spouseId, 'spouse');
  // A partial or hand-built record can omit the kin arrays (2026-11-04: the
  // npcInstitutionStatements fixture). No listed kin means no kin to read.
  for (const id of v.parentIds ?? []) kin.set(id, 'parent');
  for (const id of v.childIds ?? []) kin.set(id, 'child');
  return kin;
}

/**
 * The mood of a living villager on `day`, with plain reasons. Returns
 * undefined for an unknown, unborn or dead villager: a mood is a present fact.
 */
export function villagerMood(town: MoodTown, occupantId: number, day: number): VillagerMood | undefined {
  const self = presentVillager(town, occupantId, day);
  if (!self) return undefined;
  const kin = kinOf(town, occupantId);
  const nameOf = (id: number): string => town.villagers[id]?.name ?? 'a relative';

  const grief: string[] = [];
  const joy: string[] = [];
  const worry: string[] = [];
  const losses: string[] = [];

  // Most recent first, so each list reads newest to oldest.
  const events = town.chronicle.events
    .filter((e) => within(e, day, LOSS_DAYS))
    .sort((a, b) => b.day - a.day || b.id - a.id);

  for (const e of events) {
    const ago = agoLabel(e.day, day);
    if (e.kind === 'death' && kin.has(e.subjectId)) {
      const line = `Their ${kin.get(e.subjectId)} ${nameOf(e.subjectId)} died ${ago}.`;
      losses.push(line);
      if (within(e, day, GRIEF_DAYS)) grief.push(line);
      continue;
    }
    if (e.kind === 'fortune_fell' && e.subjectId === occupantId) {
      const line = `They fell on hard times ${ago}.`;
      losses.push(line);
      if (within(e, day, WORRY_DAYS)) worry.push(line);
      continue;
    }
    if (e.kind === 'shop_closed' && touches(e, occupantId)) {
      const line = `${clause(e.summary)} ${ago}.`;
      losses.push(line);
      if (within(e, day, WORRY_DAYS)) worry.push(line);
      continue;
    }
    if (e.kind === 'disaster' && within(e, day, WORRY_DAYS)) {
      worry.push(`${clause(e.summary)} ${ago}.`);
      continue;
    }
    if (!within(e, day, JOY_DAYS)) continue;
    if (e.kind === 'marriage' && touches(e, occupantId)) {
      const partner = e.subjectId === occupantId ? e.relatedIds[0] : e.subjectId;
      joy.push(`They married ${nameOf(partner)} ${ago}.`);
    } else if (e.kind === 'birth' && e.relatedIds.includes(occupantId)) {
      joy.push(`Their child ${nameOf(e.subjectId)} was born ${ago}.`);
    } else if ((e.kind === 'shop_opened' || e.kind === 'fortune_rose') && e.subjectId === occupantId) {
      joy.push(`${clause(e.summary)} ${ago}.`);
    }
  }

  const reasons = (first: string[]): string[] => [...new Set([...first, ...grief, ...losses, ...joy, ...worry])];
  if (grief.length) return { mood: 'grieving', reasons: reasons(grief) };
  if (losses.length >= 2) return { mood: 'bitter', reasons: reasons(losses) };
  if (joy.length) return { mood: 'joyful', reasons: reasons(joy) };
  if (worry.length) return { mood: 'worried', reasons: reasons(worry) };
  return { mood: 'content', reasons: [] };
}

/**
 * Short plain lines about a villager's own recent life, newest first: events
 * where they are the subject or a related person, plus deaths of close kin.
 * Town-wide lines (subject 0) are left out; they are not personal news.
 * Returns [] for an unknown, unborn or dead villager.
 */
export function villagerRecentLife(
  town: MoodTown,
  occupantId: number,
  day: number,
  max = 5,
  spanDays = RECENT_LIFE_DAYS,
): string[] {
  if (!presentVillager(town, occupantId, day) || max <= 0) return [];
  const kin = kinOf(town, occupantId);
  return town.chronicle.events
    .filter((e) => within(e, day, spanDays) && e.summary.length > 0)
    .filter((e) => touches(e, occupantId) || (e.kind === 'death' && kin.has(e.subjectId)))
    .sort((a, b) => b.day - a.day || b.id - a.id)
    .slice(0, max)
    .map((e) => {
      const ago = agoLabel(e.day, day);
      return `${ago.charAt(0).toUpperCase()}${ago.slice(1)}: ${e.summary}`;
    });
}
