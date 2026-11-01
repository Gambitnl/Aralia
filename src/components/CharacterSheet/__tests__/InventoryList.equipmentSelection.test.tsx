/** The displayed weapon row must preserve its original inventory source through
 * filtering and display clones, so the reducer can reject stale clicks. */
import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import InventoryList from '../Overview/InventoryList';
import {createMockPlayerCharacter} from '../../../utils/core';
import {ItemType,type Item} from '../../../types';

const dagger=(over:Partial<Item>={}):Item=>({id:'dagger',name:'Dagger',description:'An owned dagger.',type:ItemType.Weapon,
  category:'Simple Melee',slot:'MainHand',damageDice:'1d4',properties:['Finesse','Light'],quantity:2,...over});

describe('equipment row selection',()=>{
  it('sends the original stacked source rather than its display clone',()=>{
    const item=dagger(),onAction=vi.fn();
    render(<InventoryList inventory={[item]} gold={0} character={createMockPlayerCharacter({id:'sana'})} onAction={onAction}/>);
    fireEvent.click(screen.getByRole('button',{name:'Equip Dagger'}));
    const action=onAction.mock.calls[0][0];
    expect(action.payload.inventoryIndex).toBe(0);
    expect(action.payload.inventoryItem).toBe(item);
  });
  it('keeps the purchased duplicate source index after filtering out other goods',()=>{
    const first=dagger(),bought=dagger({quantity:1,acquiredAt:1234,costInGp:2.22}),onAction=vi.fn();
    const inventory=[{id:'note',name:'Note',type:ItemType.Note} as Item,first,bought];
    render(<InventoryList inventory={inventory} gold={0} character={createMockPlayerCharacter({id:'sana'})} onAction={onAction}/>);
    fireEvent.click(screen.getByRole('button',{name:'Filter by Weapons'}));
    fireEvent.click(screen.getAllByRole('button',{name:'Equip Dagger'})[1]);
    const action=onAction.mock.calls[0][0];
    expect(action.payload.inventoryIndex).toBe(2);
    expect(action.payload.inventoryItem).toBe(bought);
  });
});
