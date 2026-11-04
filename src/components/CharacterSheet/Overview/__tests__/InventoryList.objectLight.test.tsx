/** Real stowing produced two Shield rows. The player must be able to select the
 * enchanted instance without borrowing its plain neighbor or changing expiry. */
import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {GameProvider} from '../../../../state/GameContext';
import {createMockGameState,createMockPlayerCharacter} from '../../../../utils/core/factories';
import {ALL_ITEMS} from '../../../../data/items';
import InventoryList from '../InventoryList';
import type {GameState} from '../../../../types';

function fixture(){
  const plain={...ALL_ITEMS.shield},lit={...ALL_ITEMS.shield,lightSpellId:'actual-shield-cast'};
  const character=createMockPlayerCharacter({id:'elara',name:'Elara Vance',equippedItems:{}});
  character.class={...character.class,armorProficiencies:['Light Armor','Medium Armor','Shields']};
  const state=createMockGameState({party:[character],inventory:[plain,lit],gold:16,
    gameTime:new Date('0351-01-05T13:24:24Z')});
  state.underdark={...state.underdark,activeLightSources:[{id:'actual-shield-cast',type:'spell',name:'Light on Shield',radius:40,
    durationRemaining:53,isActive:false,expiresAtGameTime:state.gameTime.getTime()+53*60000,
    objectLight:{spellId:'light',casterId:'elara',slot:'OffHand',color:'#fff1ca'}}]};
  return {state,plain,lit};
}
describe('a stowed object with Light',()=>{
  it('distinguishes the two shields and equips the exact enchanted source instance',()=>{
    const {state,lit}=fixture(),onAction=vi.fn();
    render(<GameProvider state={state} dispatch={vi.fn()}><InventoryList inventory={state.inventory}
      gold={state.gold} character={state.party[0]} onAction={onAction}/></GameProvider>);
    expect(screen.getByTestId('inventory-object-light')).toHaveTextContent('Light by Elara Vance · 53 min left · concealed in pack');
    expect(screen.getByRole('heading',{name:'Shared party supplies'})).toBeVisible();
    expect(screen.getByRole('heading',{name:'Party funds'})).toBeVisible();
    expect(screen.getByRole('button',{name:'Equip Shield'})).toBeEnabled();
    fireEvent.click(screen.getByRole('button',{name:'Equip Shield — Light by Elara Vance'}));
    expect(onAction.mock.calls[0][0].payload).toMatchObject({characterId:'elara',inventoryIndex:1});
    expect(onAction.mock.calls[0][0].payload.inventoryItem).toBe(lit);
    expect(state.party[0].equippedItems.OffHand).toBeUndefined();
  });
  it('shows remaining packed duration from absolute time and no benefit after expiry or recast',()=>{
    const {state}=fixture();
    const ui=(s:GameState)=><GameProvider state={s} dispatch={vi.fn()}><InventoryList inventory={s.inventory}
      gold={s.gold} character={s.party[0]} onAction={vi.fn()}/></GameProvider>;
    const view=render(ui(state));
    view.rerender(ui({...state,gameTime:new Date(state.gameTime.getTime()+5*60000)}));
    expect(screen.getByTestId('inventory-object-light')).toHaveTextContent('48 min left');
    view.rerender(ui({...state,gameTime:new Date(state.gameTime.getTime()+53*60000)}));
    expect(screen.queryByTestId('inventory-object-light')).toBeNull();
    view.rerender(ui({...state,underdark:{...state.underdark,activeLightSources:[]}}));
    expect(screen.queryByTestId('inventory-object-light')).toBeNull();
  });
  it('does not label a separate supplied inventory as the shared party supply store',()=>{
    const {state,plain}=fixture();
    render(<GameProvider state={state} dispatch={vi.fn()}><InventoryList inventory={[plain]} gold={0}
      character={state.party[0]} onAction={vi.fn()}/></GameProvider>);
    expect(screen.queryByRole('heading',{name:'Shared party supplies'})).toBeNull();
    expect(screen.getByRole('heading',{name:'Backpack'})).toBeVisible();
  });
});
