
import { validateMerchantTransaction } from '../handleMerchantInteraction';
import { GameState } from '../../../types';

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
