/**
 * @file itemQuestHooks.test.ts
 * Proof for agora-6820.3: item quest triggers come from item data, not from a
 * hardcoded item-id branch in the handler.
 *
 * Covers both halves the acceptance asks for: an item whose metadata hooks a
 * quest starts that quest, and an item with no hook dispatches nothing.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Dispatch } from 'react';
import { fireItemQuestHook, handleUseItem } from '../handleItemInteraction';
import { ITEMS } from '../../../constants';
import { INITIAL_QUESTS } from '../../../data/quests';
import { ItemType } from '../../../types';
import type { Item } from '../../../types';
import type { AppAction } from '../../../state/actionTypes';

const asDispatch = (fn: ReturnType<typeof vi.fn>) => fn as unknown as Dispatch<AppAction>;
const typesOf = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.map(([action]) => action.type);

describe('item quest hooks (agora-6820.3)', () => {
  it('starts the hooked quest and completes the named objective on pickup', () => {
    const dispatch = vi.fn();
    fireItemQuestHook(asDispatch(dispatch), ITEMS['old_map_fragment'], 'onPickup');

    expect(typesOf(dispatch)).toEqual(['ACCEPT_QUEST', 'UPDATE_QUEST_OBJECTIVE']);
    expect(dispatch.mock.calls[0][0].payload).toBe(INITIAL_QUESTS['lost_map']);
    expect(dispatch.mock.calls[1][0].payload).toEqual({
      questId: 'lost_map',
      objectiveId: 'find_map',
      isCompleted: true,
    });
  });

  it('reads the hook from item data, so a new item needs no handler change', () => {
    const dispatch = vi.fn();
    const hookedItem: Item = {
      id: 'ruin_rubbing',
      name: 'Ruin Rubbing',
      description: 'A charcoal rubbing taken from a ruin wall.',
      type: ItemType.Note,
      questHooks: { onUse: 'explore_ruins' },
    };

    fireItemQuestHook(asDispatch(dispatch), hookedItem, 'onUse');

    expect(typesOf(dispatch)).toEqual(['ACCEPT_QUEST']);
    expect(dispatch.mock.calls[0][0].payload).toBe(INITIAL_QUESTS['explore_ruins']);
  });

  it('does nothing for the wrong interaction or an item with no hook', () => {
    const dispatch = vi.fn();
    fireItemQuestHook(asDispatch(dispatch), ITEMS['old_map_fragment'], 'onUse');
    fireItemQuestHook(asDispatch(dispatch), ITEMS['shiny_coin'], 'onPickup');
    fireItemQuestHook(asDispatch(dispatch), undefined, 'onUse');

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('fires the onUse hook through handleUseItem, after the USE_ITEM dispatch', () => {
    const dispatch = vi.fn();
    handleUseItem(asDispatch(dispatch), { itemId: 'old_map_fragment', characterId: 'char-1' });
    expect(typesOf(dispatch)).toEqual(['USE_ITEM']);

    const withHook = vi.fn();
    handleUseItem(asDispatch(withHook), { itemId: 'healing_potion', characterId: 'char-1' });
    expect(typesOf(withHook)).toEqual(['USE_ITEM']);
  });
});
