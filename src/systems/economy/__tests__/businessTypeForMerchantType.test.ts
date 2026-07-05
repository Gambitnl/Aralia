import { describe, it, expect } from 'vitest';
import { businessTypeForMerchantType } from '../NpcBusinessManager';

describe('businessTypeForMerchantType', () => {
  it('maps a blacksmith building to a smithy (weapons & armor), not a random shop', () => {
    expect(businessTypeForMerchantType('shop_blacksmith')).toBe('smithy');
    expect(businessTypeForMerchantType('weaponsmith')).toBe('smithy');
  });

  it('maps alchemist/apothecary buildings to an apothecary', () => {
    expect(businessTypeForMerchantType('shop_alchemist')).toBe('apothecary');
    expect(businessTypeForMerchantType('apothecary')).toBe('apothecary');
  });

  it('maps taverns and inns to a tavern', () => {
    expect(businessTypeForMerchantType('tavern')).toBe('tavern');
    expect(businessTypeForMerchantType('the_prancing_inn')).toBe('tavern');
  });

  it('maps enchanter/magic shops to an enchanter shop', () => {
    expect(businessTypeForMerchantType('shop_enchanter')).toBe('enchanter_shop');
  });

  it('routes general goods and unrecognized types to a general store (deterministic, not random)', () => {
    expect(businessTypeForMerchantType('shop_general')).toBe('general_store');
    expect(businessTypeForMerchantType('some_unknown_building')).toBe('general_store');
    expect(businessTypeForMerchantType('')).toBe('general_store');
  });

  it('is deterministic (same input → same type)', () => {
    expect(businessTypeForMerchantType('shop_blacksmith')).toBe(businessTypeForMerchantType('shop_blacksmith'));
  });
});
