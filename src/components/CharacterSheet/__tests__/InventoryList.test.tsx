import React from 'react';
import { ItemType, GamePhase, type GameState } from '../../../types';
import { GameProvider } from '../../../state/GameContext';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InventoryList from '../Overview/InventoryList';
import { Item } from '../../../types';
import { createMockPlayerCharacter } from '../../../utils/core';
import { ADVENTURING_GEAR } from '../../../data/items/adventuringGear';

describe('spendable sheet currency', () => {
  it('counts stacked gold and electrum at face value without listing them as goods', () => {
    const onAction=vi.fn();
    render(<InventoryList gold={20.77} character={createMockPlayerCharacter()} onAction={onAction} inventory={[
      {id:'gold_piece',name:'Gold Piece',type:ItemType.Treasure,quantity:8,weight:0.02} as Item,
      {id:'electrum_piece',name:'Electrum Piece',type:ItemType.Treasure,quantity:2,weight:0.02} as Item,
    ]}/>);
    expect(screen.getByRole('img',{name:'2 Platinum pieces'})).toBeInTheDocument();
    expect(screen.getByRole('img',{name:'9 Gold pieces'})).toBeInTheDocument();
    expect(screen.getByRole('img',{name:'7 Silver pieces'})).toBeInTheDocument();
    expect(screen.getByRole('img',{name:'7 Copper pieces'})).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:/Drop (Gold|Electrum) Piece/})).not.toBeInTheDocument();
    expect(onAction).not.toHaveBeenCalled();
  });
});

/**
 * This file proves the character sheet inventory shows perishable food correctly.
 *
 * The inventory UI is where players decide whether carried food can still be eaten.
 * These tests keep that visible behavior tied to durable item timestamps instead
 * of letting the screen fall back to a placeholder freshness flag.
 *
 * Called by: Vitest focused Character Sheet test runs.
 * Depends on: InventoryList.tsx and the shared mock character factory.
 */

// ============================================================================
// Time-Controlled Food Fixtures
// ============================================================================
// These helpers build fresh and spoiled food against a fixed clock so the test
// checks the gameplay rule instead of the machine's real current time.
// ============================================================================

const NOW = Date.UTC(2026, 0, 2, 12, 0, 0);
const ONE_HOUR_MS = 60 * 60 * 1000;
const TWO_DAYS_MS = 2 * 24 * ONE_HOUR_MS;

const buildFood = (id: string, name: string, acquiredAt: number): Item => ({
  id,
  name,
  description: 'A simple ration that spoils if carried too long.',
  type: ItemType.FoodDrink,
  perishable: true,
  shelfLife: '1 day',
  nutritionValue: 5,
  acquiredAt,
});

// ============================================================================
// Inventory Expiration Behavior
// ============================================================================
// The inventory list must distinguish edible food from food whose acquisition
// timestamp is older than its shelf life.
// ============================================================================

describe('InventoryList food expiration', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders fresh food as edible and expired food as visibly expired', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const character = createMockPlayerCharacter({ id: 'food-tester' });
    const freshFood = buildFood('fresh_apple', 'Fresh Apple', NOW - ONE_HOUR_MS);
    const expiredFood = buildFood('old_bread', 'Old Bread', NOW - TWO_DAYS_MS);
    const onAction = vi.fn();

    render(
      <InventoryList
        inventory={[freshFood, expiredFood]}
        gold={0}
        character={character}
        onAction={onAction}
      />
    );

    const freshRow = screen.getByText('Fresh Apple').closest('li');
    const expiredRow = screen.getByText('Old Bread').closest('li');

    expect(freshRow).not.toBeNull();
    expect(expiredRow).not.toBeNull();
    expect(within(freshRow!).getByText(/Expires:/)).toHaveTextContent('Expires: 1 day');
    expect(within(expiredRow!).getByText(/Expired/)).toHaveTextContent('Expired');
    expect(within(freshRow!).getByRole('button', { name: 'Eat Fresh Apple' })).toBeEnabled();
    expect(within(expiredRow!).getByRole('button', { name: 'Eat Old Bread' })).toBeDisabled();
  });

  it('keeps inventory filters and row actions large enough to tap', () => {
    const character = createMockPlayerCharacter({ id: 'inventory-tester' });
    const weapon: Item = {
      id: 'test_sword',
      name: 'Test Sword',
      description: 'A simple test weapon.',
      type: ItemType.Weapon,
      slot: 'MainHand',
      damageDice: '1d6',
    };
    const onAction = vi.fn();

    render(
      <InventoryList
        inventory={[weapon]}
        gold={0}
        character={character}
        onAction={onAction}
      />
    );

    expect(screen.getByRole('button', { name: 'Filter by All' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'Filter by Weapons' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'Equip Test Sword' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'Toggle junk status for Test Sword' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'Drop Test Sword' })).toHaveClass('min-h-11');
  });
});

describe('purchased provision meal confirmation',()=>{
 const supplies=()=>[
  {id:'rations',name:'Rations (1 day)',type:ItemType.FoodDrink,quantity:4,description:''},
  {id:'water-day',name:'Waterskin (1 day)',type:ItemType.FoodDrink,quantity:4,description:''},
  {id:'rations',name:'Rations (1 day)',type:ItemType.FoodDrink,quantity:1,description:'Bought ration'},
  {id:'water-day',name:'Waterskin (1 day)',type:ItemType.FoodDrink,quantity:1,description:'Bought water'},
 ] as Item[];
 it('quotes coupled costs and cancels without dispatching consumption',()=>{
  const onAction=vi.fn();render(<InventoryList inventory={supplies()} gold={8.06} character={createMockPlayerCharacter({id:'dara'})} onAction={onAction}/>);
  fireEvent.click(screen.getAllByRole('button',{name:'Eat Rations (1 day)'}).at(-1)!);
  expect(screen.getByRole('region',{name:'Party meal confirmation'})).toHaveTextContent('1 ration(s) and 1 water unit(s)');
  expect(onAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Cancel meal'}));
  expect(screen.queryByRole('region',{name:'Party meal confirmation'})).not.toBeInTheDocument();expect(onAction).not.toHaveBeenCalled();
 });
 it('retains exact bought sources through filtered and cloned display rows',()=>{
  const inventory=supplies(),onAction=vi.fn();render(<InventoryList inventory={inventory} gold={8.06} character={createMockPlayerCharacter({id:'dara'})} onAction={onAction}/>);
  fireEvent.click(screen.getAllByRole('button',{name:'Eat Rations (1 day)'}).at(-1)!);
  fireEvent.change(screen.getByRole('combobox',{name:'Water supply to use first'}),{target:{value:'3'}});
  fireEvent.click(screen.getByRole('button',{name:'Confirm party meal'}));
  expect(onAction).toHaveBeenCalledTimes(1);
  const meal=onAction.mock.calls[0][0].payload.meal;
  expect(meal.rationIndex).toBe(2);expect(meal.rationItem).toBe(inventory[2]);
  expect(meal.waterIndex).toBe(3);expect(meal.waterItem).toBe(inventory[3]);
 });
 it('refuses silently replaced same-ID supplies in an open quote',()=>{
  const inventory=supplies(),onAction=vi.fn(),character=createMockPlayerCharacter({id:'dara'});
  const view=render(<InventoryList inventory={inventory} gold={8.06} character={character} onAction={onAction}/>);
  fireEvent.click(screen.getAllByRole('button',{name:'Eat Rations (1 day)'}).at(-1)!);
  const changed=[...inventory];changed[2]={...inventory[2],acquiredAt:999};
  view.rerender(<InventoryList inventory={changed} gold={8.06} character={character} onAction={onAction}/>);
  expect(screen.getByRole('button',{name:'Confirm party meal'})).toBeDisabled();expect(onAction).not.toHaveBeenCalled();
 });
});

describe('paid information field reading', () => {
  it('reads the retained account outside a merchant without buying, consuming or changing its source', () => {
    const note={id:'rumor_paid',name:'Rumor',type:ItemType.Service,sourceId:'gossip_earned_source',
      description:'Purchased from The Silver Bear: "Half the undercity has been underwater for centuries."',cost:'0',weight:0} as Item;
    const original=structuredClone(note),onAction=vi.fn();
    render(<InventoryList inventory={[note]} gold={8.17} character={createMockPlayerCharacter()} onAction={onAction}/>);
    fireEvent.click(screen.getByText('Read Rumor',{exact:true}));
    expect(screen.getByText(note.description,{exact:true})).toBeVisible();
    expect(onAction).not.toHaveBeenCalled();
    expect(note).toEqual(original);
  });
});

describe('torch ignition preparation', () => {
  it('explains missing ignition before commitment and uses the exact selected partial torch', () => {
    const character=createMockPlayerCharacter({id:'torch-bearer'});
    const torch={id:'torch',name:'Torch',type:ItemType.Consumable,quantity:1,lightFuelMinutes:32.21666666666667} as Item;
    const inventory=[torch],onAction=vi.fn(),dispatch=vi.fn();
    const state={phase:GamePhase.PLAYING,party:[character],inventory,gameTime:new Date('0351-01-04T17:03:55Z'),underdark:{activeLightSources:[]}} as unknown as GameState;
    const view=render(<GameProvider state={state} dispatch={dispatch}><InventoryList inventory={inventory} gold={27.88} character={character} onAction={onAction}/></GameProvider>);
    const light=screen.getByRole('button',{name:'Light Torch'});
    expect(light).toBeDisabled();
    expect(light).toHaveAccessibleDescription('Use a tinderbox, or select Light a carried torch beside a fixed dungeon flame.');
    expect(screen.getByText('Use a tinderbox, or select Light a carried torch beside a fixed dungeon flame.')).toBeVisible();
    fireEvent.click(light);expect(onAction).not.toHaveBeenCalled();
    const stocked=[...inventory,{id:'tinderbox',name:'Tinderbox',type:ItemType.Tool,quantity:1} as Item];
    view.rerender(<GameProvider state={{...state,inventory:stocked}} dispatch={dispatch}><InventoryList inventory={stocked} gold={27.38} character={character} onAction={onAction}/></GameProvider>);
    expect(screen.getByRole('button',{name:'Light Torch'})).toBeEnabled();
    fireEvent.click(screen.getByRole('button',{name:'Light Torch'}));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({type:'USE_ITEM',payload:{itemId:'torch',characterId:character.id,inventoryIndex:0}}));
    expect(torch.lightFuelMinutes).toBe(32.21666666666667);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('opening a carried expedition pack', () => {
  it('shows retained ritual contents separately from additional loose items',()=>{
    const kit={id:'backpack:unpacked:priest',name:"Priest's Pack — retained kit",type:ItemType.Tool,
      isContainer:true,capacityWeight:20,weight:15,quantity:1,
      description:'The backpack retains the blanket, an alms box, 2 blocks of incense, a censer, and vestments.',
      unpackedFrom:{openingId:'priest',sourceItem:ADVENTURING_GEAR.priests_pack,gameTime:'0351-01-04T12:55:35Z'}} as Item;
    render(<InventoryList inventory={[kit]} gold={17} character={createMockPlayerCharacter()} onAction={vi.fn()}/>);
    expect(screen.getByText(kit.description!)).toBeVisible();
    expect(screen.getByText('0 additional item(s)')).toBeVisible();
    expect(screen.getByText('Additional load: 0.00 / 20')).toBeVisible();
  });

  it.each(['explorers_pack','priests_pack'])('discloses %s and preserves its raw source index when the tools filter is active', id => {
    const character=createMockPlayerCharacter({id:'pack-owner'});
    const looseTorch={id:'torch',name:'Torch',type:ItemType.Consumable,lightFuelMinutes:4,quantity:1} as Item;
    const pack={...ADVENTURING_GEAR[id],quantity:2} as Item;
    const inventory=[looseTorch,pack],onAction=vi.fn(),dispatch=vi.fn();
    const state={phase:GamePhase.PLAYING,party:[character],inventory,underdark:{activeLightSources:[]},gameTime:new Date('0351-01-01T07:04:03Z')} as unknown as GameState;
    render(<GameProvider state={state} dispatch={dispatch}><InventoryList inventory={inventory} gold={12} character={character} onAction={onAction}/></GameProvider>);
    fireEvent.click(screen.getByRole('button',{name:'Filter by Tools'}));
    fireEvent.click(screen.getByText(`Review ${pack.name} contents`,{exact:true}));
    expect(screen.getByText(/Opens one of 2 bundles/)).toBeVisible();
    expect(screen.getByText(/No drinking water is added/)).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:`Unpack one ${pack.name}`}));
    expect(onAction).toHaveBeenCalledTimes(1);
    const payload=onAction.mock.calls[0][0].payload;
    expect(payload.inventoryIndex).toBe(1);
    expect(payload.unpack.sourceItem).toBe(pack);
    expect(payload.unpack.openingId).toEqual(expect.any(String));
    expect(pack.quantity).toBe(2);
    expect(looseTorch.lightFuelMinutes).toBe(4);
    expect(dispatch).not.toHaveBeenCalled();
  });
});


describe('source-specific backpack organization', () => {
  it('keeps hidden containers available while selecting only the newer filtered ration source', () => {
    const bag={id:'pack-bag',name:'Travel Backpack',type:ItemType.Tool,isContainer:true,capacityWeight:30} as Item;
    const oldFood={id:'rations',name:'Rations (1 day)',type:ItemType.Consumable,quantity:5,weight:2,acquiredAt:100} as Item;
    const newFood={...oldFood,quantity:10,acquiredAt:200};
    const coin={id:'gold_piece',name:'Gold',type:ItemType.Treasure,quantity:1} as Item;
    const inventory=[coin,oldFood,bag,newFood],onAction=vi.fn();
    render(<InventoryList inventory={inventory} gold={11.5} character={createMockPlayerCharacter()} onAction={onAction}/>);
    fireEvent.click(screen.getByRole('button',{name:'Filter by Consumables'}));
    const controls=screen.getAllByRole('combobox',{name:'Move Rations (1 day) to container'});
    fireEvent.change(controls[1],{target:{value:bag.id}});
    const payload=onAction.mock.calls[0][0].payload;
    expect(payload.itemId).toBe('rations');expect(payload.containerId).toBe(bag.id);
    expect(payload.inventoryIndex).toBe(3);expect(payload.sourceItem).toBe(newFood);
    expect(oldFood.containerId).toBeUndefined();
  });

  it('retains the parent of filtered stowed food and shows the complete carried load', () => {
    const bag={id:'pack-bag',name:'Travel Backpack',type:ItemType.Tool,isContainer:true,capacityWeight:30} as Item;
    const food={id:'rations',name:'Rations (1 day)',type:ItemType.Consumable,quantity:10,weight:2,containerId:bag.id} as Item;
    const tool={id:'mess_kit',name:'Mess Kit',type:ItemType.Tool,quantity:1,weight:1,containerId:bag.id} as Item;
    render(<InventoryList inventory={[bag,food,tool]} gold={11.5} character={createMockPlayerCharacter()} onAction={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'Filter by Consumables'}));
    expect(screen.getByRole('button',{name:'Collapse Travel Backpack'})).toBeVisible();
    expect(screen.getByText('Weight: 21.00 / 30')).toBeVisible();
    expect(screen.getByRole('combobox',{name:'Move Rations (1 day) to container'})).toHaveValue(bag.id);
  });
});
