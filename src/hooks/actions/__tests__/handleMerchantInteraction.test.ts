
import { describe, it, expect, vi } from 'vitest';
import {
  validateMerchantTransaction,
  isTavernOrInnMerchant,
  offerTavernHire,
  handleMerchantAction,
} from '../handleMerchantInteraction';
import { GameState } from '../../../types';
import type { RichNPC } from '../../../types/world';
import { generateNPC } from '../../../services/npcGenerator';

describe('validateMerchantTransaction', () => {
  const mockGameState = {
    gold: 100,
    inventory: [
      { id: 'item_1', name: 'Sword' },
      { id: 'item_2', name: 'Shield' }
    ]
  } as unknown as GameState;

  describe('buy', () => {
    it('should return valid for sufficient gold', () => {
      const payload = { item: { id: 'new_item' }, cost: 50 };
      const result = validateMerchantTransaction('buy', payload, mockGameState);
      expect(result.valid).toBe(true);
    });

    it('should return invalid for insufficient gold', () => {
      const payload = { item: { id: 'expensive_item' }, cost: 150 };
      const result = validateMerchantTransaction('buy', payload, mockGameState);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Insufficient gold');
    });

    it('should return invalid for missing item', () => {
      const payload = { cost: 50 };
      const result = validateMerchantTransaction('buy', payload, mockGameState);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No item specified for purchase.');
    });

    it('should return invalid for invalid cost', () => {
      const payload = { item: { id: 'item' }, cost: -10 };
      const result = validateMerchantTransaction('buy', payload, mockGameState);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid purchase cost.');
    });
  });

  describe('sell', () => {
    it('should return valid if item exists in inventory', () => {
      const payload = { itemId: 'item_1', value: 25 };
      const result = validateMerchantTransaction('sell', payload, mockGameState);
      expect(result.valid).toBe(true);
    });

    it('should return invalid if item does not exist in inventory', () => {
      const payload = { itemId: 'non_existent', value: 25 };
      const result = validateMerchantTransaction('sell', payload, mockGameState);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Item not found in inventory.');
    });

    it('should return invalid for missing itemId', () => {
      const payload = { value: 25 };
      const result = validateMerchantTransaction('sell', payload, mockGameState);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No item specified for sale.');
    });

    it('should return invalid for invalid value', () => {
      const payload = { itemId: 'item_1', value: -5 };
      const result = validateMerchantTransaction('sell', payload, mockGameState);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid sale value.');
    });
  });
});

describe('handleMerchantAction buy', () => {
  const baseState = () => ({
    gold: 100,
    inventory: [] as unknown[],
    gameTime: new Date('2026-07-04T09:00:00Z'),
    npcMemory: {},
    party: [],
    currentLocationId: 'loc-1',
  }) as unknown as GameState;

  it('dispatches BUY_ITEM for a SINGLE unit even when the shelf item is a stack', async () => {
    const dispatch = vi.fn();
    const addMessage = vi.fn();
    const action = {
      type: 'BUY_ITEM',
      payload: { transaction: { buy: { item: { id: 'rations', name: 'Rations', quantity: 30 }, cost: 1 } } },
    } as never;

    await handleMerchantAction({ action, gameState: baseState(), dispatch, addMessage } as never);

    const buyCall = dispatch.mock.calls.find(c => c[0].type === 'BUY_ITEM');
    expect(buyCall, 'BUY_ITEM should be dispatched (the no-op bug is fixed)').toBeTruthy();
    expect(buyCall![0].payload.item.quantity).toBe(1); // not the whole stack of 30
    expect(buyCall![0].payload.cost).toBe(1);
  });

  it('does not dispatch BUY_ITEM when the player cannot afford it', async () => {
    const dispatch = vi.fn();
    const addMessage = vi.fn();
    const action = {
      type: 'BUY_ITEM',
      payload: { transaction: { buy: { item: { id: 'plate', name: 'Plate' }, cost: 5000 } } },
    } as never;

    await handleMerchantAction({ action, gameState: baseState(), dispatch, addMessage } as never);

    expect(dispatch.mock.calls.some(c => c[0].type === 'BUY_ITEM')).toBe(false);
    expect(addMessage).toHaveBeenCalled();
  });
});

// ============================================================================
// Tavern / inn "Hire <name>" affordance (P9-trigger-tavern)
// ============================================================================
// The innkeeper-type merchant exposes a hire path: take the generated building
// NPC, run the disposition-gated consent gate, and on a yes convert + dispatch
// RECRUIT_COMPANION with source:'tavern'; on a no decline in the merchant voice.
// ============================================================================

/** Build a deterministic RichNPC at a chosen disposition via the real generator. */
function makeKeeper(disposition: number): RichNPC {
  return generateNPC({
    id: 'tavern-keeper-1',
    name: 'Brena Caskwright',
    role: 'merchant',
    classId: 'fighter',
    level: 2,
    backgroundId: 'guild artisan',
    initialDisposition: disposition,
  });
}

/** Minimal read-only GameState for the consent gate (companions + npcMemory + gold). */
function makeStateWithDisposition(npcId: string, disposition: number, gold = 1000): GameState {
  return {
    companions: {},
    gold,
    npcMemory: {
      [npcId]: { disposition },
    },
  } as unknown as GameState;
}

describe('isTavernOrInnMerchant', () => {
  it('matches tavern-flavoured merchant types case-insensitively', () => {
    expect(isTavernOrInnMerchant('shop_tavern')).toBe(true);
    expect(isTavernOrInnMerchant('Tavern')).toBe(true);
    expect(isTavernOrInnMerchant('tavern')).toBe(true);
  });

  it('matches inn-flavoured merchant types case-insensitively', () => {
    expect(isTavernOrInnMerchant('inn')).toBe(true);
    expect(isTavernOrInnMerchant('Inn')).toBe(true);
    expect(isTavernOrInnMerchant('The Prancing Inn')).toBe(true);
  });

  it('does not match unrelated merchant types', () => {
    expect(isTavernOrInnMerchant('shop_blacksmith')).toBe(false);
    expect(isTavernOrInnMerchant('General Store')).toBe(false);
    expect(isTavernOrInnMerchant('Temple')).toBe(false);
  });
});

describe('offerTavernHire', () => {
  it('recruits the keeper when consent passes (warm disposition)', () => {
    const keeper = makeKeeper(80);
    const state = makeStateWithDisposition(keeper.id, 80);
    const dispatch = vi.fn();
    const addMessage = vi.fn();

    offerTavernHire(keeper, state, dispatch, addMessage);

    const recruit = dispatch.mock.calls.find(c => c[0].type === 'RECRUIT_COMPANION')?.[0];
    expect(recruit).toBeTruthy();
    // Pipeline wiring: source is the tavern surface and the paired halves share id.
    expect(recruit.payload.source).toBe('tavern');
    expect(recruit.payload.character.id).toBe(keeper.id);
    expect(recruit.payload.companion.id).toBe(keeper.id);
    expect(recruit.payload.character.id).toBe(recruit.payload.companion.id);
    // Paid hire deducts gold (level-2 keeper → 30 gold).
    const gold = dispatch.mock.calls.find(c => c[0].type === 'MODIFY_GOLD')?.[0];
    expect(gold?.payload.amount).toBe(-30);
  });

  it('announces the join in-fiction on a successful hire', () => {
    const keeper = makeKeeper(80);
    const state = makeStateWithDisposition(keeper.id, 80);
    const captured: string[] = [];

    offerTavernHire(keeper, state, vi.fn(), (m: string) => captured.push(m));

    expect(captured.some(m => m.includes(keeper.name) && m.includes('join your party'))).toBe(true);
  });

  it('declines a willing hire the player cannot afford, without recruiting', () => {
    const keeper = makeKeeper(80); // consent passes...
    const state = makeStateWithDisposition(keeper.id, 80, 5); // ...but only 5 gold (cost is 30)
    const dispatch = vi.fn();
    const captured: string[] = [];

    offerTavernHire(keeper, state, dispatch, (m: string) => captured.push(m));

    expect(dispatch).not.toHaveBeenCalled(); // no recruit, no gold change
    expect(captured.some(m => /gold/i.test(m))).toBe(true);
  });

  it('declines without recruiting when consent fails (cold disposition)', () => {
    const keeper = makeKeeper(10);
    const state = makeStateWithDisposition(keeper.id, 10);
    const dispatch = vi.fn();
    const captured: string[] = [];

    offerTavernHire(keeper, state, dispatch, (m: string) => captured.push(m));

    // No RECRUIT_COMPANION on a decline.
    expect(dispatch).not.toHaveBeenCalled();
    // In-fiction merchant-voice refusal is surfaced.
    expect(captured.some(m => m.includes("not for hire"))).toBe(true);
  });
});
