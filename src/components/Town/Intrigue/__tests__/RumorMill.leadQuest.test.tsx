/**
 * @file RumorMill.leadQuest.test.tsx
 * Proof for agora-6820.4: buying a 'lead' rumor accepts the quest it points at,
 * so the quest lands in the log through the real ACCEPT_QUEST seam.
 *
 * The map-marker half of the old TODO is intentionally absent: MapMarker has no
 * reducer and no renderer, so there is nothing to dispatch a marker to.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { rumorsForBurg } from '../../../../systems/worldforge/dungeon/world/rumors';
import { TavernGossipSystem } from '../../../../systems/intrigue/TavernGossipSystem';
import type { PurchaseableRumor } from '../../../../systems/intrigue/TavernGossipSystem';
import { INITIAL_QUESTS } from '../../../../data/quests';
import { questReducer } from '../../../../state/reducers/questReducer';
import { characterReducer } from '../../../../state/reducers/characterReducer';
import { handleMerchantAction } from '../../../../hooks/actions/handleMerchantInteraction';
import { createMockGameState } from '../../../../utils/core';
import { ItemType, type Action } from '../../../../types';

const game = vi.hoisted(() => ({state: {} as Record<string, unknown>}));
vi.mock('../../../../state/GameContext', () => ({useGameState: () => ({state: game.state})}));
vi.mock('../../../../systems/worldforge/dungeon/world/rumors', () => ({rumorsForBurg: vi.fn(() => [])}));
vi.mock('../../../../systems/worldforge/townsim/chronicleForLocation', () => ({burgIdForLocation: () => 2}));

import { RumorMill } from '../RumorMill';

const LEAD: PurchaseableRumor = {
  id: 'lead_7',
  type: 'lead',
  cost: 10,
  title: 'Ask about work or trouble',
  content: "I heard there's an old ruin to the north that's been glowing at night.",
  questId: 'explore_ruins',
};

const PLAIN_RUMOR: PurchaseableRumor = {
  id: 'gossip_1',
  type: 'rumor',
  cost: 2,
  title: 'Hear the latest gossip',
  content: 'The mill burned down.',
};

const renderMill = (rumors: PurchaseableRumor[], onAction: (action: Action) => void) => {
  vi.spyOn(TavernGossipSystem, 'getAvailableRumors').mockReturnValue(rumors);
  render(
    <RumorMill
      merchantName="Barkeep"
      playerGold={100}
      playerInventory={[]}
      onAction={onAction}
    />
  );
};

describe('RumorMill lead rumors (agora-6820.4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    game.state = {};
    vi.mocked(rumorsForBurg).mockReturnValue([]);
  });

  it('accepts the lead quest on purchase and lands it in the quest log', () => {
    const actions: Action[] = [];
    renderMill([LEAD], action => actions.push(action));

    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(actions.map(a => a.type)).toEqual(['BUY_ITEM', 'ACCEPT_QUEST']);

    const accept = actions[1] as Extract<Action, { type: 'ACCEPT_QUEST' }>;
    expect(accept.payload).toBe(INITIAL_QUESTS['explore_ruins']);

    // Drive the real reducer so the proof is "the quest is in the log", not "an action was sent".
    const state = createMockGameState({ questLog: [] });
    const next = questReducer(state, accept as never);
    expect(next.questLog?.map(q => q.id)).toContain('explore_ruins');
  });

  it('actually pays for the rumor and retains its readable receipt through the real handler', async () => {
    const actions: Action[] = [];
    renderMill([PLAIN_RUMOR], action => actions.push(action));
    fireEvent.click(screen.getAllByRole('button')[0]);
    const state = createMockGameState({gold: 12, inventory: []});
    const dispatch = vi.fn();
    await handleMerchantAction({action: actions[0], gameState: state,
      dispatch, addMessage: vi.fn()} as never);
    const purchase = dispatch.mock.calls.find(([action]) => action.type === 'BUY_ITEM')?.[0];
    expect(purchase).toBeDefined();
    const next = characterReducer(state, purchase);
    expect(next.gold).toBe(10);
    expect(next.inventory).toEqual([expect.objectContaining({
      sourceId: PLAIN_RUMOR.id,
      description: expect.stringContaining(PLAIN_RUMOR.content!),
      quantity: 1,
    })]);
    expect(actions[0].payload).toMatchObject({priceMultiplier: 1});
  });

  it('shows a saved receipt even after bought gossip leaves the offer pool', () => {
    vi.spyOn(TavernGossipSystem, 'getAvailableRumors').mockReturnValue([]);
    const onAction = vi.fn();
    render(<RumorMill merchantName="Barkeep" playerGold={10} onAction={onAction}
      playerInventory={[{id: 'rumor_gossip_1', sourceId: 'gossip_1', name: 'Rumor',
        type: ItemType.Service, weight: 0, description: 'The mill burned down.'}]} />);
    expect(screen.getByRole('region', {name: 'Purchased information'})).toHaveTextContent('The mill burned down.');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('annotates an already-paid legacy source without changing its receipt or charging again', () => {
    game.state = {worldSeed:7, playerCell:{cellId:1567}, currentLocationId:'cell_1567'};
    vi.mocked(rumorsForBurg).mockReturnValue([{sitePath:'wf:7/burg:2/dungeon:sewer',
      dungeonName:'The Kober Channels',text:'The undercity flooded.',eventRef:0,speakerBias:'scholar'}]);
    vi.spyOn(TavernGossipSystem,'getAvailableRumors').mockReturnValue([]);
    const receipt={id:'rumor_old',sourceId:'gossip_dungeon-cell_1567-wf:7/burg:2/dungeon:sewer-0',
      name:'Rumor',type:ItemType.Service,weight:0,description:'Original paid words about the undercity.'};
    const onAction=vi.fn();
    render(<RumorMill merchantName="Barkeep" playerGold={8.06} playerInventory={[receipt]} onAction={onAction}/>);
    expect(screen.getByRole('region',{name:'Purchased information'})).toHaveTextContent('Source site: The Kober Channels');
    expect(screen.getByText(/This account gives no confirmed travel route/)).toBeVisible();
    expect(receipt.description).toBe('Original paid words about the undercity.');
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not start a quest for a rumor that is not a lead', () => {
    const actions: Action[] = [];
    renderMill([PLAIN_RUMOR], action => actions.push(action));

    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(actions.map(a => a.type)).toEqual(['BUY_ITEM']);
  });
});

it('shows an offer age before payment and freezes its purchase-time context in the note',()=>{
 const offer={...PLAIN_RUMOR,title:'Family news · 249 days ago',context:{subject:'Family news',ageLabel:'249 days ago'}};
 const actions:Action[]=[];renderMill([offer],a=>actions.push(a));
 expect(screen.getByText('Family news · 249 days ago')).toBeInTheDocument();expect(screen.queryByText('The mill burned down.')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'2 GP'}));
 const buy=actions[0] as Extract<Action,{type:'BUY_ITEM'}>;
 expect(buy.payload.transaction!.buy!.item.description).toContain('Account age when purchased: 249 days ago');
});

it('annotates a legacy paid note from its exact local event without rewriting it',()=>{
 const text='Ivo married Ysolde.';
 const rumor={id:'chronicle-cell_1506-113',text,type:'misc',timestamp:-248,expiration:31,locationId:'cell_1506'};
 game.state={worldSeed:77,currentLocationId:'cell_1506',playerCell:{cellId:1506},gameTime:new Date('0351-01-01T15:10:41Z'),activeRumors:[rumor],townSim:{2:{burgId:2,villagers:{},chronicle:{events:[{id:113,day:-248,kind:'marriage',summary:text,subjectId:1,relatedIds:[2]}]}}}};
 vi.spyOn(TavernGossipSystem,'getAvailableRumors').mockReturnValue([]);
 const note={id:'rumor_paid',sourceId:'gossip_'+rumor.id,name:'Rumor',type:ItemType.Service,weight:0,description:'Purchased from Bryn: "'+text+'"'};
 const before=JSON.stringify(note),onAction=vi.fn();
 render(<RumorMill merchantName="Bryn" playerGold={10.5} playerInventory={[note]} onAction={onAction}/>);
 expect(screen.getByRole('region',{name:'Purchased information'})).toHaveTextContent('Town chronicle · Family news · 249 days ago');
 expect(JSON.stringify(note)).toBe(before);expect(onAction).not.toHaveBeenCalled();
});
