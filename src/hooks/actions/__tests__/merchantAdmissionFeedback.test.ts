/** Played 3D refusal: the town plan closed but its correct deceased-keeper
 * explanation reached only the hidden system log. Both initial admission and
 * stale trade requests must retain that reason in the visible notification. */
import { describe, expect, it, vi } from 'vitest';
import type { GameState } from '../../../types';
import { handleOpenDynamicMerchant, handleMerchantAction } from '../handleMerchantInteraction';

const reason = 'The proprietor has died. No successor is recorded to serve here.';
vi.mock('../../../systems/economy/businessAttendance', () => ({
  businessAttendance: vi.fn(async () => ({ open: false, reason: 'The proprietor has died. No successor is recorded to serve here.' })),
}));

describe('visible merchant admission refusal', () => {
  it.each(['open', 'buy'] as const)('keeps %s refusal visible without serving or charging', async kind => {
    const gameState = {
      gold:20.76, inventory:[{id:'gold_piece',quantity:8,sourceId:'cache9'}],
      generatedNpcs:{keeper:{id:'keeper',businessId:'shop'}},
      worldBusinesses:{shop:{id:'shop',ownerId:'keeper'}},
    } as unknown as GameState;
    const before=structuredClone(gameState), dispatch=vi.fn(), addMessage=vi.fn();
    const action = kind==='open'
      ? {type:'OPEN_DYNAMIC_MERCHANT',payload:{merchantType:'shop_general',buildingId:'keeper'}}
      : {type:'BUY_ITEM',payload:{merchantId:'keeper',transaction:{buy:{item:{id:'torch'},cost:0.01}}}};
    await (kind==='open'?handleOpenDynamicMerchant:handleMerchantAction)({gameState,dispatch,addMessage,action} as never);
    expect(addMessage).toHaveBeenCalledWith(reason,'system');
    expect(dispatch).toHaveBeenCalledWith({type:'ADD_NOTIFICATION',payload:{type:'warning',message:reason}});
    expect(dispatch.mock.calls.some(([a])=>['OPEN_MERCHANT','BUY_ITEM','REGISTER_GENERATED_NPC','REGISTER_WORLD_BUSINESS'].includes(a.type))).toBe(false);
    expect(gameState).toEqual(before);
  });
});
