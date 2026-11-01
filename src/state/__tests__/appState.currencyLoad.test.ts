/** An earned catalog coin stays an object until an actual payment spends it.
 * Loading must preserve quantities and provenance, including named lookalikes. */
import {describe, expect, it} from 'vitest';
import {appReducer} from '../appState';
import {ALL_ITEMS} from '../../data/items';
import {createMockGameState, createMockPlayerCharacter} from '../../utils/core/factories';
import {getPartyFundsGp} from '../../systems/economy/partyFunds';

const inventory=[
  {...ALL_ITEMS.shiny_coin, quantity: 6, acquiredAt: 42, sourceId: 'earned-cache', containerId: 'pouch'},
  {...ALL_ITEMS.shiny_coin, id: 'shiny_coin_relic', name: 'Remembered coin', quantity: 3},
];

describe('earned coin identity through start and repeated native load',()=>{
  it('keeps source records, quantities and liquid funds through repeated loads',()=>{
    const saved=createMockGameState({gold: 16, inventory});
    const first=appReducer(createMockGameState(),{type:'LOAD_GAME_SUCCESS',payload:saved});
    const next=appReducer(createMockGameState(),{type:'LOAD_GAME_SUCCESS',payload:first});
    for(const s of [first,next]){
      expect(s.gold).toBe(16);
      expect(s.inventory).toEqual(inventory);
      expect(getPartyFundsGp(s)).toBe(22);
    }
    expect(saved.inventory).toEqual(inventory);
  });

  it('retains carried starting coins separately from the creation purse',()=>{
    const result=appReducer(createMockGameState(),{type:'START_GAME_SUCCESS',payload:{
      character:createMockPlayerCharacter({startingGold:7}),startingInventory:inventory,
      dynamicLocationItemIds:{},initialLocationDescription:'A quiet beginning.',initialActiveDynamicNpcIds:null,
    }});
    expect(result.gold).toBe(7);
    expect(result.inventory).toEqual(inventory);
    expect(getPartyFundsGp(result)).toBe(13);
  });
});
