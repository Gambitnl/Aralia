/**
 * Proves the takeable-broadsheet keepsake reducer plumbing:
 *  - GIVE_ITEM appends a fully-formed bespoke item (carrying readableContent)
 *    to inventory — something the registry-keyed ADD_ITEM cannot do.
 *  - READ_ITEM on a readable Book item opens the broadsheet modal on that item's
 *    FROZEN snapshot, regardless of where the player currently is.
 *
 * These are the load-bearing guarantees behind reading a pocketed broadsheet
 * after leaving the town that printed it.
 */
import { characterReducer } from '../characterReducer';
import { uiReducer } from '../uiReducer';
import { createMockGameState } from '../../../utils/core/factories';
import { ItemType, type GameState, type Item } from '../../../types';
import type { AppAction } from '../../actionTypes';

const SNAPSHOT = JSON.stringify({
  townName: 'Testton',
  day: 100,
  news: [{ id: 1, day: 99, kind: 'disaster', prominence: 'headline', text: 'A fire on the docks.' }],
});

const makeBroadsheetItem = (): Item => ({
  id: 'broadsheet_100_abc',
  name: 'Broadsheet — Testton, Day 100',
  description: 'A frozen broadsheet keepsake.',
  type: ItemType.Book,
  readableContent: SNAPSHOT,
});

describe('broadsheet keepsake reducers', () => {
  it('GIVE_ITEM appends the full bespoke item (with readableContent) to inventory', () => {
    const state = createMockGameState();
    const item = makeBroadsheetItem();
    const action: AppAction = { type: 'GIVE_ITEM', payload: { item } };

    const next = characterReducer(state, action);

    expect(next.inventory).toBeDefined();
    expect(next.inventory!.length).toBe(state.inventory.length + 1);
    const added = next.inventory!.find((i) => i.id === 'broadsheet_100_abc');
    expect(added).toBeDefined();
    expect(added!.readableContent).toBe(SNAPSHOT);
    // Acquisition boundary stamps the entry timestamp.
    expect(typeof added!.acquiredAt).toBe('number');
  });

  it('READ_ITEM on a readable Book opens the broadsheet on its frozen snapshot', () => {
    const base = createMockGameState();
    const item = makeBroadsheetItem();
    const state: GameState = { ...base, inventory: [...base.inventory, item] };

    const next = uiReducer(state, { type: 'READ_ITEM', payload: { itemId: item.id } });

    expect(next.isBroadsheetVisible).toBe(true);
    expect(next.broadsheetSnapshot).toBe(SNAPSHOT);
  });

  it('READ_ITEM is a no-op for items without readableContent', () => {
    const base = createMockGameState();
    const plain: Item = { id: 'plain_rock', name: 'Rock', description: 'A rock.', type: ItemType.Treasure };
    const state: GameState = { ...base, inventory: [...base.inventory, plain] };

    const next = uiReducer(state, { type: 'READ_ITEM', payload: { itemId: 'plain_rock' } });

    expect(next).toEqual({});
  });

  it('opening the broadsheet live (SET_BROADSHEET_VISIBLE true) clears any frozen snapshot', () => {
    const state = createMockGameState();
    const next = uiReducer(state, { type: 'SET_BROADSHEET_VISIBLE', payload: true });
    expect(next.isBroadsheetVisible).toBe(true);
    expect(next.broadsheetSnapshot).toBeUndefined();
  });

  it('closing the broadsheet clears the frozen snapshot', () => {
    const state = createMockGameState();
    const next = uiReducer(state, { type: 'SET_BROADSHEET_VISIBLE', payload: false });
    expect(next.isBroadsheetVisible).toBe(false);
    expect(next.broadsheetSnapshot).toBeUndefined();
  });
});
