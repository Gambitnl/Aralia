/**
 * Let a person read an account the player actually carries and form an opinion.
 * A shared note is hearsay, never a witnessed event or a confirmed route. The
 * conversation reducer stores that distinction in the companion's memory;
 * greeting and UI code use the same source to recall it after a saved reunion.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 15:47:05
 * Dependents: components/ConversationPanel/CompanionRumorChoices.tsx, hooks/actions/handleNpcInteraction.ts, state/reducers/companionRumorReducer.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { Companion } from '@/types/companions';
import type { GameState } from '@/types/state';
import type { Item } from '@/types/items';

export function rumorConversationCompanion(state: GameState, id: string): Companion | undefined {
  const companion = state.companions?.[id];
  if (!companion || !state.activeConversation?.participants.includes(id) || !state.metNpcIds?.includes(id)) return undefined;
  const inParty = state.party?.some(member => member.id === id);
  const present = inParty || (state.currentLocationActiveDynamicNpcIds?.includes(id)
    && (!companion.whereabouts || companion.whereabouts.locationId === state.currentLocationId));
  if (!present || (companion.whereabouts && companion.whereabouts.worldSeed !== state.worldSeed)) return undefined;
  return companion;
}

/** Only retained ordinary rumor/lead receipts are offered here. Secrets keep
 * their separate disclosure surface; unbought offers are never conversation data. */
export function shareableRumorNotes(state: GameState): Array<{ item: Item; inventoryIndex: number; subject: string }> {
  return (state.inventory ?? []).flatMap((item, inventoryIndex) =>
    item.type === 'service' && item.id.startsWith('rumor_') && item.sourceId
      && ['Rumor', 'Lead'].includes(item.name) && item.description?.trim()
      ? [{ item, inventoryIndex, subject: rumorSubject(item) }] : []);
}

export function rumorSubject(item: Item): string {
  // The normal receipt already prints the named source inside its quotation.
  // Extract a display label only; this does not resolve geography or a route.
  return item.description.match(/"([^":\r\n]{1,120}):/)?.[1] ?? item.name;
}

export function rumorOpinion(companion: Companion, account: string): { reply: string; preference: string } {
  const cautious = (companion.personality?.conscientiousness ?? 50) >= 70;
  const practical = companion.personality?.values?.some(value => /profit|wealth|survival/i.test(value));
  const publicAim = companion.goals?.find(goal => !goal.isSecret && goal.status === 'active');
  const aim = publicAim?.description;
  const ownPlans = aim ? ` I still intend to ${aim.charAt(0).toLowerCase() + aim.slice(1)}.` : ' I have my own plans to weigh as well.';
  if (cautious) {
    const risk = /underwater|flood(?:ed|ing)?|drown/i.test(account)
      ? 'This account describes flooding. I need a safe way in and a way back before I could agree to investigate.'
      : 'I need a confirmed approach and a way back before I could agree to investigate this account.';
    return { reply: risk + ownPlans, preference: 'Wants a confirmed approach and a return plan before agreeing to investigate an unfamiliar site.' };
  }
  if (practical) return {
    reply: 'I would want clear terms, a reason to take the risk, and a way back before agreeing to follow this up.' + ownPlans,
    preference: 'Wants clear terms and an exit plan before agreeing to follow an uncertain lead.',
  };
  return {
    reply: 'I will consider the account you showed me. I would need to understand the journey before agreeing to go.' + ownPlans,
    preference: 'Wants to understand a proposed journey before deciding whether to take part.',
  };
}

export function companionRumorRecall(companion: Companion, worldSeed: number | null): string {
  const memory = [...(companion.memories ?? [])].reverse().find(memory => memory.hearsay?.sharedInWorldSeed === worldSeed);
  return memory?.hearsay ? `I remember the account you showed me about ${memory.hearsay.subject}.` : '';
}
