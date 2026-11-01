/**
 * Elara's first authored preparations chapter, grounded in the actual person
 * and the game's existing ration/water items. This is preparation for her public
 * ambition, not a claim that an unrelated temple is the Temple of the Morning.
 * Conversation choices and the companion reducer share these eligibility rules.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 12:51:04
 * Dependents: components/ConversationPanel/CompanionPreparationChoices.tsx, hooks/actions/handleNpcInteraction.ts, state/reducers/companionPreparationReducer.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState } from '@/types/state';
import type { Item } from '@/types/items';
import type { Companion, CompanionQuestline, CompanionPreparationChoice } from '@/types/companions';
import { RATIONS_ITEM_ID, WATER_ITEM_ID, resourceDays } from '@/systems/travel/provisioning';
import { ELARA_PREPARATIONS_QUEST_ID } from '@/data/quests';

export const PREPARATION_COMPANION_ID = 'elara_vance';
export const PREPARATION_DAYS = 2;
export const PREPARATION_OBJECTIVE_ID = 'handover_supplies';
export { ELARA_PREPARATIONS_QUEST_ID };

/** Recall only the authored events this person actually retained. The chapter
 * remains distinct from private ambitions and from the decision to travel. */
export function preparationMeetingRecall(companion: Companion): string {
  if (companion.questline?.id !== ELARA_PREPARATIONS_QUEST_ID) return '';
  const remembers = (event: string) => companion.memories.some(memory => memory.tags.includes(ELARA_PREPARATIONS_QUEST_ID) && memory.tags.includes(event));
  if (companion.questline.currentStageId === 'collecting' && remembers('promise-open')) return 'I am still counting on the road supplies you promised.';
  if (companion.questline.currentStageId === 'supplied' && remembers('promise-fulfilled')) return 'I remember the provisions you brought and the promise you kept.';
  if (companion.questline.currentStageId === 'withdrawn' && remembers('promise-withdrawn')) return 'You told me you could not keep your promise about the supplies. I remember.';
  if (companion.questline.currentStageId === 'declined' && remembers('declined')) return 'You said you could not commit to bringing supplies. I have not counted on them.';
  return '';
}

export function preparationCompanion(state: GameState) {
  const companion = state.companions?.[PREPARATION_COMPANION_ID];
  const conversation = state.activeConversation;
  if (!companion || !conversation?.participants.includes(companion.id)) return undefined;
  if (!companion.goals?.some(goal => goal.id === 'restore_temple' && !goal.isSecret && goal.status === 'active')) return undefined;
  if (!state.metNpcIds?.includes(companion.id)) return undefined;
  const present = state.party?.some(member => member.id === companion.id)
    || state.currentLocationActiveDynamicNpcIds?.includes(companion.id);
  if (!present) return undefined;
  if (companion.questline && companion.questline.id !== ELARA_PREPARATIONS_QUEST_ID) return undefined;
  if (companion.questline?.origin && companion.questline.origin.worldSeed !== state.worldSeed) return undefined;
  return companion;
}

export function preparationQuestline(state: GameState): CompanionQuestline {
  return {
    id: ELARA_PREPARATIONS_QUEST_ID,
    title: 'Road Preparations',
    currentStageId: 'offered',
    origin: { worldSeed: state.worldSeed, locationId: state.currentLocationId },
    stages: {
      offered: { description: 'Elara needs two days of food and water for her journey.', objectives: ['Decide whether to help.'], isCompleted: false },
      collecting: { description: 'You promised to bring Elara two days of food and water.', objectives: ['Hand over 2 rations and 2 water-days to Elara.'], isCompleted: false },
      supplied: { description: 'Elara carries the provisions you gave her. Her restoration work remains ahead.', objectives: [], isCompleted: false },
      declined: { description: 'You declined to promise supplies. Elara still has her own preparations to make.', objectives: [], isCompleted: false },
      withdrawn: { description: 'You told Elara you could not keep the promise. She remembers the conversation.', objectives: [], isCompleted: false },
    },
  };
}

export function hasPreparationSupplies(inventory: readonly Item[]): boolean {
  // Malformed stacks cannot be used as an inexhaustible supply or a negative gift.
  const valid = inventory.filter(item => Number.isFinite(item.quantity ?? 1) && (item.quantity ?? 1) > 0);
  return resourceDays(valid, RATIONS_ITEM_ID) >= PREPARATION_DAYS
    && resourceDays(valid, WATER_ITEM_ID) >= PREPARATION_DAYS;
}

/** Split the real carried stacks, retaining their descriptions and provenance.
 * No side takes goods unless both resources are available together. */
export function transferPreparationSupplies(inventory: readonly Item[]): { remaining: Item[]; given: Item[] } | null {
  if (!hasPreparationSupplies(inventory)) return null;
  const need = new Map([[RATIONS_ITEM_ID, PREPARATION_DAYS], [WATER_ITEM_ID, PREPARATION_DAYS]]);
  const remaining: Item[] = [];
  const given: Item[] = [];
  for (const item of inventory) {
    const quantity = item.quantity ?? 1;
    const wanted = need.get(item.id) ?? 0;
    if (!wanted || !Number.isFinite(quantity) || quantity <= 0) { remaining.push(item); continue; }
    const taken = Math.min(wanted, quantity);
    given.push({ ...item, quantity: taken });
    need.set(item.id, wanted - taken);
    if (quantity > taken) remaining.push({ ...item, quantity: quantity - taken });
  }
  return { remaining, given };
}

export function preparationChoices(state: GameState): Array<{ choice: CompanionPreparationChoice; label: string; disabled?: boolean }> {
  const companion = preparationCompanion(state);
  if (!companion) return [];
  switch (companion.questline?.currentStageId) {
    case 'offered':
    case 'declined':
    case 'withdrawn': return [
      { choice: 'promise', label: 'Promise to bring 2 rations and 2 water-days' },
      { choice: 'decline', label: 'I cannot commit to that' },
    ];
    case 'collecting': return [
      { choice: 'deliver', label: 'Give Elara 2 rations and 2 water-days', disabled: !hasPreparationSupplies(state.inventory) },
      { choice: 'withdraw', label: 'Tell Elara I cannot keep my promise' },
    ];
    case 'supplied': return [{ choice: 'recall', label: 'Ask about her preparations' }];
    default: return [{ choice: 'ask', label: 'Ask how her preparations are going' }];
  }
}
