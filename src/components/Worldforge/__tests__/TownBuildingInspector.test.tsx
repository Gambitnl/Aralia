/** Exercises furnishing inspection and normal keeper actions without WebGL. */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TownBuildingInspector from '../TownBuildingInspector';
import { townBuildingChoices, townBuildingVisit } from '../townBuildingVisit';

const seed = 1793146029630;
// GG-552 (2026-11-01): the town-look rules re-lay out every NEW town (Remy's
// ruling q2, layout revision 2). These played towns keep the layout their save
// was made with, so their fixtures read layout revision 1.
const SAVED = 1 as const;
const SAVED_LIFE = {layoutRevision: SAVED, villagers: {}};

describe('saved building source changes',()=>{
 it('withdraws an old furnishing index and floor until the player makes a fresh choice',()=>{
  const props={worldSeed:1793432134128,burgId:188,plotId:19,hour:17,onClose:vi.fn()};
  const {rerender}=render(<TownBuildingInspector {...props} life={{layoutRevision:1,villagers:{}}}/>);
  fireEvent.click(screen.getAllByRole('button',{name:'Examine desk'})[0]);
  expect(screen.getByText('desk in the study.')).toBeInTheDocument();
  rerender(<TownBuildingInspector {...props} life={{layoutRevision:2,villagers:{}}}/>);
  expect(screen.getByRole('heading',{name:'townhouse'})).toBeInTheDocument();
  expect(screen.queryByText('bed in the hall.')).not.toBeInTheDocument();
  expect(screen.queryByText('desk in the study.')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'1'}});
  expect(screen.getByRole('combobox')).toHaveValue('1');
  rerender(<TownBuildingInspector {...props} life={{layoutRevision:1,villagers:{}}}/>);
  expect(screen.getByRole('combobox')).toHaveValue('0');
  expect(screen.queryByText('desk in the study.')).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button',{name:'Examine desk'})[0]);
  expect(screen.getByText('desk in the study.')).toBeInTheDocument();
 },60000);
});

describe('TownBuildingInspector', () => {
  it('updates a legacy keeper plan to saved death without a live marker, contact or invented successor', () => {
    const action=vi.fn();
    // Re-pinned 2026-10-31 after the GG-541 road fix (Remy chose to re-lay out every world).
    const props={worldSeed:seed,burgId:675,plotId:149,hour:17,gameTime:new Date('0351-01-03T17:01:12.000Z'),onClose:vi.fn(),onKeeperAction:action};
    const {rerender}=render(<TownBuildingInspector {...props} life={SAVED_LIFE} />);
    expect(screen.getByRole('button',{name:'Talk to keeper'})).toBeEnabled();
    expect(screen.getByLabelText('Furnished floor plan')).toHaveTextContent('Roban');
    const life={layoutRevision:SAVED,villagers:{397:{occupantId:397,name:'Roban Westsmith',homePlotId:151,bornDay:-10000,diedDay:-253},
      488:{occupantId:488,name:'Edith Ashbourne',homePlotId:151,bornDay:-10000,diedDay:-382}}};
    const before=JSON.stringify(life);
    rerender(<TownBuildingInspector {...props} life={life} />);
    expect(screen.getByRole('button',{name:'Talk to keeper'})).toBeDisabled();
    expect(screen.getByRole('button',{name:'Browse goods'})).toBeDisabled();
    expect(screen.getByLabelText('Furnished floor plan')).not.toHaveTextContent('Roban');
    expect(screen.getByText(/The proprietor has died/)).toHaveTextContent('No successor');
    expect(screen.getByRole('region',{name:'Household'}).textContent).toMatch(/Roban Westsmith.*deceased/);
    expect(screen.getByRole('region',{name:'Household'}).textContent).toMatch(/Edith Ashbourne.*deceased/);
    fireEvent.click(screen.getByRole('button',{name:'Browse goods'}));
    expect(action).not.toHaveBeenCalled();
    expect(JSON.stringify(life)).toBe(before);
  },60000);
  it('shows the canonical family and lets the player examine actual container contents', () => {
    const plot = townBuildingChoices(seed, 10).find((choice) => choice.role === 'house' && townBuildingVisit(seed, 10, choice.id).manifests.length > 0)!;
    const close = vi.fn();
    render(<TownBuildingInspector worldSeed={seed} burgId={10} plotId={plot.id} hour={7} onClose={close} />);
    expect(screen.getByRole('region', { name: 'Household' })).toBeInTheDocument();
    expect(screen.getByLabelText('Furnished floor plan').querySelector('svg')).toBeTruthy();
    const visit = townBuildingVisit(seed, 10, plot.id);
    fireEvent.change(screen.getByLabelText('Building floor'), { target: { value: String(visit.manifests[0].level) } });
    expect(screen.getByLabelText('Furnished floor plan').textContent).not.toMatch(/child:\d|servant:\d/);
    const container = screen.getAllByRole('button', { name: /Examine (chest|shelf|barrel|crate|strongbox)/ })[0];
    fireEvent.click(container);
    expect(screen.getByRole('status')).toHaveTextContent('Belongings of this household');
    fireEvent.click(screen.getByRole('button', { name: 'Back to town' }));
    expect(close).toHaveBeenCalledOnce();
  }, 60000);

  it('routes shop and talk buttons to the existing keeper actions', () => {
    // Re-pinned 2026-10-31 after the GG-541 road fix (Remy chose to re-lay out every world).
    const plot = townBuildingChoices(seed, 10, SAVED).find((choice) => choice.id === 48)!;
    const action = vi.fn();
    render(<TownBuildingInspector worldSeed={seed} burgId={10} plotId={plot.id} hour={12} life={SAVED_LIFE} onClose={vi.fn()} onKeeperAction={action} />);
    fireEvent.click(screen.getByRole('button', { name: 'Browse goods' }));
    fireEvent.click(screen.getByRole('button', { name: 'Talk to keeper' }));
    expect(action.mock.calls).toEqual([['shop'], ['talk']]);
  }, 60000);

  it('does not summon an absent or retired keeper, and enables the active owner on shift', () => {
    const action = vi.fn();
    // Re-pinned 2026-10-31 after the GG-541 road fix (Remy chose to re-lay out every world).
    const {rerender} = render(<TownBuildingInspector worldSeed={seed} burgId={10} plotId={48} hour={7} life={SAVED_LIFE} onClose={vi.fn()} onKeeperAction={action} />);
    expect(screen.getByRole('button', {name:'Talk to keeper'})).toBeDisabled();
    expect(screen.getByText(/The keeper is off duty/)).toHaveTextContent('Trading hours:');
    expect(screen.queryByText(/The proprietor is retired from this trade/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'Browse goods'}));
    expect(action).not.toHaveBeenCalled();
    rerender(<TownBuildingInspector worldSeed={seed} burgId={10} plotId={48} hour={10} life={SAVED_LIFE} onClose={vi.fn()} onKeeperAction={action} />);
    expect(screen.getByRole('button', {name:'Talk to keeper'})).toBeEnabled();
    rerender(<TownBuildingInspector worldSeed={seed} burgId={10} plotId={18} hour={10} life={SAVED_LIFE} onClose={vi.fn()} onKeeperAction={action} />);
    expect(screen.getByRole('button', {name:'Talk to keeper'})).toBeDisabled();
    expect(screen.getByText(/The proprietor is retired from this trade/)).toHaveTextContent('No keeper is scheduled to serve here.');
    expect(screen.getByText(/Lys Greenford/)).toBeInTheDocument();
  }, 60000);
});


describe('source-specific keeper availability',()=>{
 it('explains the played Exchange proprietor retirement without assigning her family to serve',()=>{
  // Re-pinned 2026-10-31 after the GG-541 road fix (Remy chose to re-lay out every world).
  const worldSeed=1793176470555,burgId=2,plotId=122;
  const visit=townBuildingVisit(worldSeed,burgId,plotId,undefined,undefined,SAVED),before=JSON.stringify(visit.household),action=vi.fn();
  expect(visit.household?.members[0].name).toBe('Edmund Ashwright');
  render(<TownBuildingInspector worldSeed={worldSeed} burgId={burgId} plotId={plotId} hour={10} gameTime={new Date('0351-01-04T10:00:00Z')} life={SAVED_LIFE} onClose={vi.fn()} onKeeperAction={action} />);
  expect(screen.getByRole('button',{name:'Talk to keeper'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'Browse goods'})).toBeDisabled();
  expect(screen.getByText(/The proprietor is retired from this trade/)).toHaveTextContent('No keeper is scheduled to serve here.');
  fireEvent.click(screen.getByRole('button',{name:'Browse goods'}));
  fireEvent.click(screen.getByRole('button',{name:'Talk to keeper'}));
  expect(action).not.toHaveBeenCalled();
  expect(JSON.stringify(visit.household)).toBe(before);
 },60000);
});

describe('current family in the building inspector',()=>{
 it('shows the admitted current family and ages without replacing the household source',()=>{
  const gameTime=new Date('0351-01-05T12:00:00Z');
  // Re-pinned 2026-10-31 after the GG-541 road fix (Remy chose to re-lay out every world).
  const life={layoutRevision:SAVED,villagers:{
   95:{occupantId:95,name:'Fenna Hartham',homePlotId:34,bornDay:-18613,spouseId:96,parentIds:[],childIds:[98]},
   96:{occupantId:96,name:'Ysolde Hartham',homePlotId:34,bornDay:-12043,spouseId:95,parentIds:[],childIds:[98]},
   98:{occupantId:98,name:'Lark Hartham',homePlotId:3,bornDay:-6568,spouseId:13,parentIds:[95,96],childIds:[]},
   13:{occupantId:13,name:'Robin Marshdown',homePlotId:3,bornDay:-6203,spouseId:98,parentIds:[],childIds:[]},
  }};
  const source=townBuildingVisit(seed,675,34,undefined,undefined,SAVED),before=JSON.stringify({life,household:source.household});
  const {rerender}=render(<TownBuildingInspector worldSeed={seed} burgId={675} plotId={34} hour={12} gameTime={gameTime} life={life} onClose={vi.fn()} />);
  const family=screen.getByRole('region',{name:'Household'});
  expect(family).toHaveTextContent('Fenna Hartham · 51 years');
  expect(family).toHaveTextContent('Lark Hartham · child · 18 years');
  expect(family).toHaveTextContent('married to Robin Marshdown');
  expect(family).toHaveTextContent('home elsewhere in town');
  expect(family).not.toHaveTextContent('5 children');
  expect(within(family).getByTestId('current-household-family')).not.toHaveTextContent('9 years');
  expect(family).toHaveTextContent('Dob Hartham');
  expect(within(family).getAllByText('Lark Hartham')).toHaveLength(3);
  expect(family).toHaveTextContent('Petra Dunford');
  expect(family).toHaveTextContent('Loran Blackfield');
  expect(family).toHaveTextContent('household servant');
  expect(family).toHaveTextContent('keeps the household');
  expect(JSON.stringify({life,household:source.household})).toBe(before);
  const changed={layoutRevision:SAVED,villagers:{...life.villagers,98:{...life.villagers[98],spouseId:undefined},13:{...life.villagers[13],spouseId:undefined}}};
  rerender(<TownBuildingInspector worldSeed={seed} burgId={675} plotId={34} hour={12} gameTime={gameTime} life={changed} onClose={vi.fn()} />);
  expect(family).not.toHaveTextContent('married to Robin');
  rerender(<TownBuildingInspector worldSeed={seed} burgId={675} plotId={34} hour={12} life={life} onClose={vi.fn()} />);
  expect(family).toHaveTextContent('5 children'); // Re-pinned 2026-10-31 (GG-541): the household now has 5 children.
 },60000);
 it('does not replace a conflicting founding household using an address alone',()=>{
  const life={layoutRevision:SAVED,villagers:{285:{occupantId:285,name:'Oswin Oakcroft',homePlotId:64,bornDay:-18613,spouseId:484}}};
  render(<TownBuildingInspector worldSeed={seed} burgId={675} plotId={64} hour={12} gameTime={new Date('0351-01-05T12:00:00Z')} life={life} onClose={vi.fn()} />);
  expect(screen.getByRole('region',{name:'Household'})).toHaveTextContent('Mara Marshwick');
  expect(screen.getByRole('region',{name:'Household'})).not.toHaveTextContent('Oswin Oakcroft');
 },60000);
});


describe('institutional roles in the current household view',()=>{
 it('retains a real saved priest role beside family and work without offering remote services',()=>{
  // Re-pinned 2026-10-31 after the GG-541 road fix (Remy chose to re-lay out every world).
  const life={layoutRevision:SAVED,villagers:{95:{occupantId:95,name:'Fenna Hartham',homePlotId:34,bornDay:-18613,spouseId:96,role:'marketmaster' as const},96:{occupantId:96,name:'Ysolde Hartham',homePlotId:34,bornDay:-12043,spouseId:95,role:'priest' as const}}};
  const before=JSON.stringify(life); const action=vi.fn();
  render(<TownBuildingInspector worldSeed={seed} burgId={675} plotId={34} hour={12} gameTime={new Date('0351-01-05T12:00:00Z')} life={life} onClose={vi.fn()} onKeeperAction={action} />);
  const family=screen.getByRole('region',{name:'Household'}); expect(family).toHaveTextContent('Town role: marketmaster'); expect(family).toHaveTextContent('Town role: priest');
  expect(family).toHaveTextContent('innkeeper'); expect(family).toHaveTextContent('keeps the household'); // Re-pinned 2026-10-31 (GG-541): Fenna now keeps an inn. expect(action).not.toHaveBeenCalled(); expect(JSON.stringify(life)).toBe(before);
 },60000);
});
