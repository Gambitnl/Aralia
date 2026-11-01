import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleMerchantAction, handleOpenDynamicMerchant } from '../handleMerchantInteraction';
import type { Action, GameState } from '../../../types';
import { businessAttendance } from '../../../systems/economy/businessAttendance';

vi.mock('../../../systems/economy/businessAttendance', () => ({ businessAttendance: vi.fn() }));

describe('off-duty merchant execution', () => {
  beforeEach(() => vi.mocked(businessAttendance).mockResolvedValue({open:false,hours:'08:00–18:00',reason:'The keeper is off duty. Trading hours: 08:00–18:00.'}));
  const state = { worldBusinesses:{shop:{id:'shop',ownerId:'keeper'}},generatedNpcs:{},gold:14.12,inventory:[],
    gameTime:new Date('0351-01-02T05:13:00Z') } as unknown as GameState;
  it('refuses browse before registration or stock backfill', async () => {
    const dispatch=vi.fn(),addMessage=vi.fn();
    await handleOpenDynamicMerchant({gameState:state,dispatch,addMessage,addGeminiLog:vi.fn(),generalActionContext:'',
      action:{type:'OPEN_DYNAMIC_MERCHANT',label:'Browse',payload:{merchantType:'shop_tavern',buildingId:'keeper'}}} as never);
    expect(addMessage).toHaveBeenCalledWith(expect.stringContaining('off duty'),'system');
    expect(dispatch.mock.calls.map(([action])=>action.type)).toEqual(['SET_LOADING','SET_LOADING']);
  });
  it.each(['BUY_ITEM','SELL_ITEM','HAGGLE_ITEM'])('refuses %s from a window opened during the previous shift', async type => {
    const dispatch=vi.fn(),addMessage=vi.fn();
    await handleMerchantAction({gameState:state,dispatch,addMessage,
      action:{type,label:type,payload:{merchantId:'keeper'}} as Action} as never);
    expect(addMessage).toHaveBeenCalledWith(expect.stringContaining('08:00–18:00'),'system');
    expect(dispatch).not.toHaveBeenCalled();
    expect(state.gold).toBe(14.12);
  });
});
