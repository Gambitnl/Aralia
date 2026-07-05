/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/systems/adventureLog/oraclePrompt.ts
 *
 * Pure builder for the Oracle-as-Dungeon-Master prompt. Given the current
 * GameState, it assembles a grounded briefing — who the player is, the story so
 * far (from the runtime adventure log), active quests, the current town and its
 * known people, and nearby places the party has actually discovered — and wraps
 * it in a DM system instruction.
 *
 * CONTRACT: state → prompt string. No LLM, no async, no mutation. Every fact
 * comes from real game state, and the system instruction forbids the model from
 * inventing place or person names, so the Oracle only points at things that
 * exist in the player's world.
 */

import type { GameState } from '../../types/state';
import { QuestStatus } from '../../types/quests';
import { NPCS } from '../../data/world/npcs';
import { recentAdventureLog } from './adventureLog';

/** Resolve a display name for an NPC id from any registry available in state. */
function npcName(state: GameState, npcId: string): string | null {
  return (
    NPCS[npcId]?.name ||
    state.generatedNpcs?.[npcId]?.name ||
    state.dynamicNPCs?.[npcId]?.name ||
    null
  );
}

/** One-line character identity line, tolerant of missing race/class. */
export function describePlayer(state: GameState): string {
  const pc = state.party?.[0];
  if (!pc) return 'The seeker is an unknown traveler.';
  const race = pc.race?.name ?? 'traveler';
  const klass = pc.class?.name ?? 'adventurer';
  const level = pc.level ? ` (level ${pc.level})` : '';
  const bg = pc.background ? `, background: ${pc.background}` : '';
  return `${pc.name} — a ${race} ${klass}${level}${bg}.`;
}

/** The current town/settlement name from state, or null if unknown. */
export function currentTownName(state: GameState): string | null {
  return state.startTownName ?? null;
}

/** Names of NPCs the party has actually met (deduped, capped). */
export function knownPeople(state: GameState, cap = 8): string[] {
  const ids = state.metNpcIds ?? [];
  const names: string[] = [];
  for (const id of ids) {
    const n = npcName(state, id);
    if (n && !names.includes(n)) names.push(n);
    if (names.length >= cap) break;
  }
  return names;
}

/**
 * A few known establishments the Oracle can point at. Best-effort and sync:
 * lists business names from the world-business registry. Kept name-only so we
 * never surface fictitious detail — the model is told to use these verbatim.
 */
export function knownBusinesses(state: GameState, cap = 6): string[] {
  const out: string[] = [];
  const wb = state.worldBusinesses ?? {};
  for (const key of Object.keys(wb)) {
    const b = wb[key] as { name?: string } | undefined;
    if (!b?.name) continue;
    if (!out.includes(b.name)) out.push(b.name);
    if (out.length >= cap) break;
  }
  return out;
}

/** Places the party has discovered, from the discovery log (deduped, capped). */
export function discoveredPlaces(state: GameState, cap = 6): string[] {
  const out: string[] = [];
  for (const d of state.discoveryLog ?? []) {
    if (d.title && !out.includes(d.title)) out.push(d.title);
    if (out.length >= cap) break;
  }
  return out;
}

/** Active (non-completed, non-failed) quest titles. */
export function activeQuests(state: GameState, cap = 6): string[] {
  return (state.questLog ?? [])
    .filter(q => q.status === QuestStatus.Active || q.status === QuestStatus.Available)
    .map(q => q.title)
    .slice(0, cap);
}

const ORACLE_SYSTEM_INSTRUCTION = [
  'You are the Oracle: the Dungeon Master voice of this fantasy RPG.',
  'The player, lost in an open world, has asked you for guidance.',
  'Speak warmly and briefly, in-character, as a wise guide ("The Oracle\'s voice...").',
  'FIRST and foremost: directly answer THE PLAYER\'S QUESTION given below. Different questions require different answers — do not give a generic recap.',
  'Then, only if it helps answer the question, weave in a one-sentence recap using ONLY the recorded events below.',
  'Then offer 2-3 concrete suggestions relevant to the question — people to talk to or places to visit.',
  'Ground EVERY suggestion in the people, places, quests, and events listed below.',
  'Do NOT invent place names, person names, quests, or events that are not listed.',
  'If there is little to go on, gently suggest exploring the current town or speaking with the people already met.',
  'Keep the whole reply under about 120 words.',
].join(' ');

/**
 * Build the full Oracle DM prompt (system instruction + grounded briefing +
 * the player's question). Pure: state + question → string.
 */
export function buildOraclePrompt(state: GameState, playerQuery: string): string {
  const lines: string[] = [];

  lines.push("=== THE PLAYER'S QUESTION (answer THIS first) ===");
  lines.push(`"${playerQuery}"`);

  lines.push('');
  lines.push('=== WHO IS ASKING ===');
  lines.push(describePlayer(state));

  const town = currentTownName(state);
  lines.push('');
  lines.push('=== WHERE THEY ARE ===');
  lines.push(town ? `Currently in ${town}.` : 'Currently somewhere in the wilds (town unknown).');

  const recap = recentAdventureLog(state, 20);
  lines.push('');
  lines.push('=== THE STORY SO FAR (recorded events, oldest first) ===');
  if (recap.length === 0) {
    lines.push('(No notable events recorded yet — the adventure is just beginning.)');
  } else {
    for (const e of recap) {
      lines.push(`- [Day ${e.day} ${e.time}] ${e.summary}`);
    }
  }

  const quests = activeQuests(state);
  lines.push('');
  lines.push('=== ACTIVE QUESTS ===');
  lines.push(quests.length ? quests.map(q => `- ${q}`).join('\n') : '(None active.)');

  const people = knownPeople(state);
  lines.push('');
  lines.push('=== PEOPLE THE PARTY HAS MET ===');
  lines.push(people.length ? people.map(p => `- ${p}`).join('\n') : '(No one memorable yet.)');

  const businesses = knownBusinesses(state);
  if (businesses.length) {
    lines.push('');
    lines.push('=== KNOWN ESTABLISHMENTS ===');
    lines.push(businesses.map(b => `- ${b}`).join('\n'));
  }

  const places = discoveredPlaces(state);
  if (places.length) {
    lines.push('');
    lines.push('=== PLACES DISCOVERED ===');
    lines.push(places.map(p => `- ${p}`).join('\n'));
  }

  lines.push('');
  lines.push('=== REMINDER: THE PLAYER ASKS ===');
  lines.push(`"${playerQuery}"`);
  lines.push('Answer this specific question first.');

  return `${ORACLE_SYSTEM_INSTRUCTION}\n\n${lines.join('\n')}`;
}
