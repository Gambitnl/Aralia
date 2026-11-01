import React from 'react';
import {fireEvent,render,screen} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createMockGameState} from '@/utils/core/factories';
const mocks=vi.hoisted(()=>({current:vi.fn(),discovery:vi.fn()}));
vi.mock('@/systems/worldforge/interior/libraryCollection',()=>({currentLibraryCollection:mocks.current,libraryAccountDiscovery:mocks.discovery}));
import {GameProvider} from '@/state/GameContext';
import LibraryCollectionReader from '../LibraryCollectionReader';
const record={key:'works:502',title:'Menina: municipal waterworks',text:'Ask locally in Menina.',kind:'municipal-works'};
beforeEach(()=>{vi.clearAllMocks();mocks.current.mockReturnValue({regionName:'Hafrostia',townName:'Grangengen',records:[record]});mocks.discovery.mockReturnValue({id:'account',content:record.text});});
describe('explicit library reading',()=>{
 it('does not reveal a new worlds text through a previously selected record key',()=>{const dispatch=vi.fn(),state=createMockGameState();mocks.current.mockReturnValue({worldSeed:1,burgId:40,plotId:56,regionName:'Hafrostia',townName:'Grangengen',records:[record]});const view=render(<GameProvider state={state} dispatch={dispatch}><LibraryCollectionReader/></GameProvider>);fireEvent.click(screen.getByRole('button',{name:'Read Menina: municipal waterworks'}));mocks.current.mockReturnValue({worldSeed:2,burgId:40,plotId:56,regionName:'Other realm',townName:'Other town',records:[{...record,text:'Unopened new-world account.'}]});view.rerender(<GameProvider state={{...state,worldSeed:2}} dispatch={dispatch}><LibraryCollectionReader/></GameProvider>);expect(screen.queryByText('Unopened new-world account.')).toBeNull();expect(screen.getByText('Choose a volume from the collection.')).toBeInTheDocument();expect(dispatch).toHaveBeenCalledTimes(1);});
 it('teaches nothing from the index, then records the selected account',()=>{const dispatch=vi.fn();render(<GameProvider state={createMockGameState()} dispatch={dispatch}><LibraryCollectionReader/></GameProvider>);expect(dispatch).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Read Menina: municipal waterworks'}));expect(dispatch).toHaveBeenCalledWith({type:'ADD_DISCOVERY_ENTRY',payload:{id:'account',content:record.text}});expect(screen.getByText('Ask locally in Menina.')).toBeInTheDocument();});
 it('rechecks admission when an indexed account is activated',()=>{const dispatch=vi.fn();render(<GameProvider state={createMockGameState()} dispatch={dispatch}><LibraryCollectionReader/></GameProvider>);mocks.current.mockReturnValue(null);fireEvent.click(screen.getByRole('button',{name:'Read Menina: municipal waterworks'}));expect(dispatch).not.toHaveBeenCalled();});
});
