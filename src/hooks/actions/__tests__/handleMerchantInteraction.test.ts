
import { describe, it, expect, vi } from 'vitest';
import {
  validateMerchantTransaction,
  isTavernOrInnMerchant,
  offerTavernHire,
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

/** Minimal read-only GameState for the consent gate (companions + npcMemory). */
function makeStateWithDisposition(npcId: string, disposition: number): GameState {
  return {
    companions: {},
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

    expect(dispatch).toHaveBeenCalledTimes(1);
    const recruit = dispatch.mock.calls[0][0];
    expect(recruit.type).toBe('RECRUIT_COMPANION');
    // Pipeline wiring: source is the tavern surface and the paired halves share id.
    expect(recruit.payload.source).toBe('tavern');
    expect(recruit.payload.character.id).toBe(keeper.id);
    expect(recruit.payload.companion.id).toBe(keeper.id);
    expect(recruit.payload.character.id).toBe(recruit.payload.companion.id);
  });

  it('announces the join in-fiction on a successful hire', () => {
    const keeper = makeKeeper(80);
    const state = makeStateWithDisposition(keeper.id, 80);
    const captured: string[] = [];

    offerTavernHire(keeper, state, vi.fn(), (m: string) => captured.push(m));

    expect(captured.some(m => m.includes(keeper.name) && m.includes('joins your party'))).toBe(true);
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
