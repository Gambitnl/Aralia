/** Native balances and deed ownership must survive the screen-to-reducer hop. */
import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {GameProvider} from '../../../state/GameContext';
import {economyReducer} from '../../../state/reducers/economyReducer';
import {createMockGameState} from '../../../utils/core/factories';
import type {WorldBusiness} from '../../../types/business';
import type {AppAction} from '../../../state/actionTypes';
import {canPurchaseBusiness} from '../../../systems/economy/BusinessAcquisition';
import {RealEstateModal} from '../RealEstateModal';
import {BankModal} from '../BankModal';
const business: WorldBusiness = {
  id:'shop',name:'Village Forge',locationId:'village-center',ownerId:'smith',ownerType:'npc',businessType:'smithy',
  daysSinceManaged:0,managerEfficiency:50,metrics:{customerSatisfaction:75,reputation:60,competitorPressure:20,supplyChainHealth:80,staffEfficiency:70},
  supplyContracts:[],dailyCustomers:10,priceMultiplier:1,competitorIds:[],
  lastDailyReport:{day:1,revenue:50,costs:30,profit:20,customersSatisfied:10,customersLost:0,supplyIssues:[],competitorActions:[],staffIssues:[]},
  npcOwnerProfile:{businessSkill:50,willingnessToSell:60,financialPressure:0,attachmentToShop:20,askingPriceMultiplier:1,daysUnprofitable:0},
};
describe('economy screen native contracts',()=>{
  it('acquires a deed and deducts the quoted price exactly once',()=>{
    const state=createMockGameState({gold:100000,worldBusinesses:{shop:business}});
    const price=canPurchaseBusiness(business,state.gold,state.economy).askingPrice;
    const dispatch=vi.fn();
    render(<GameProvider state={state} dispatch={dispatch}><RealEstateModal/></GameProvider>);
    fireEvent.click(screen.getByRole('button',{name:/property market/i}));
    fireEvent.click(screen.getByRole('button',{name:/acquire deed/i}));
    expect(dispatch).toHaveBeenCalledTimes(1);
    const action=dispatch.mock.calls[0][0] as AppAction;
    expect(action).toEqual({type:'PURCHASE_BUSINESS',payload:{businessId:'shop',negotiatedPrice:price}});
    const updated=economyReducer(state,action);
    expect(updated.gold).toBe(state.gold-price);
    expect(updated.worldBusinesses?.shop).toMatchObject({ownerType:'player',ownerId:'player',metrics:business.metrics});
    expect(economyReducer({...state,...updated},action)).toEqual({});
  });
  it('repays only the remaining debt after a partial payment',()=>{
    const state=createMockGameState({gold:50,playerInvestments:[{id:'loan',type:'loan_taken',principalGold:100,currentValue:45,startDay:1,durationDays:30,riskLevel:0,status:'active',interestRate:0,lastUpdateDay:1}]});
    const dispatch=vi.fn();
    render(<GameProvider state={state} dispatch={dispatch}><BankModal/></GameProvider>);
    fireEvent.click(screen.getByRole('button',{name:/active debts/i}));
    fireEvent.click(screen.getByRole('button',{name:'Repay 45 GP'}));
    expect(dispatch).toHaveBeenCalledTimes(1);
    const action=dispatch.mock.calls[0][0] as AppAction;
    expect(action).toEqual({type:'REPAY_LOAN',payload:{investmentId:'loan',amount:45}});
    const updated=economyReducer(state,action);
    expect(updated.gold).toBe(5);
    expect(updated.playerInvestments?.[0]).toMatchObject({status:'completed',currentValue:0});
  });
});
