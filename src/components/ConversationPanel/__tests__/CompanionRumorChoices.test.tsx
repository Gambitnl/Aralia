import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMockGameState } from '@/utils/core';
import { COMPANIONS } from '@/data/companions';
import { ItemType } from '@/types/items';
import { CompanionRumorChoices } from '../CompanionRumorChoices';

const state=()=>createMockGameState({worldSeed:77,companions:{elara_vance:COMPANIONS.elara_vance},metNpcIds:['elara_vance'],currentLocationActiveDynamicNpcIds:['elara_vance'],
  inventory:[{id:'rumor_1',sourceId:'source_1',name:'Rumor',type:ItemType.Service,description:'Purchased from Tomas: "The Iolodidau Channels: Flooding was reported."',weight:0}],
  activeConversation:{id:'talk',participants:['elara_vance'],messages:[],startedAt:1,isPlayerTurn:true,pendingResponse:false}});
describe('companion account discussion controls',()=>{
  it('quotes only a retained receipt to the selected current companion',()=>{
    const current=state(),dispatch=vi.fn();render(<CompanionRumorChoices state={current} dispatch={dispatch} disabled={false}/>);
    fireEvent.click(screen.getByRole('button',{name:'Discuss The Iolodidau Channels'}));
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({type:'DISCUSS_COMPANION_RUMOR',payload:{companionId:'elara_vance',inventoryIndex:0,itemId:'rumor_1',sourceId:'source_1',description:current.inventory[0].description}});
  });
  it('honors the existing input lock and offers nothing for an absent person',()=>{
    const {rerender}=render(<CompanionRumorChoices state={state()} dispatch={vi.fn()} disabled/>);
    expect(screen.getByRole('button')).toBeDisabled();
    rerender(<CompanionRumorChoices state={{...state(),currentLocationActiveDynamicNpcIds:[]}} dispatch={vi.fn()} disabled={false}/>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
