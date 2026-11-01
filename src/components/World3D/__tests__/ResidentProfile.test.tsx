/** The physical meeting card must agree with speech without inventing people. */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ResidentProfile from '../ResidentProfile';
import type { Household } from '../../../systems/worldforge/town/household';

const household: Household = {
  homeId: 'b34', surname: 'Hartham', dwelling: 'cottage', ancestry: 'human', occupation: 'shopkeeper',
  summary: 'The founding household has four children.',
  members: [
    {name:'Fenna Hartham',role:'head',age:56,ageBand:'adult',race:'human',occupation:'shopkeeper'},
    {name:'Ysolde Hartham',role:'spouse',age:51,ageBand:'adult',race:'human',occupation:'keeps the household'},
    {name:'Lark Hartham',role:'child',age:9,ageBand:'child',race:'human',occupation:''},
    {name:'Lark Hartham',role:'child',age:8,ageBand:'child',race:'human',occupation:''},
    {name:'Petra Dunford',role:'servant',age:25,ageBand:'adult',race:'human',occupation:'household servant'},
  ],
};
const life = {villagers:{
  81:{occupantId:81,householdMemberId:'b34:head',name:'Fenna Hartham',homePlotId:34,bornDay:-18613,spouseId:82,childIds:[84]},
  82:{occupantId:82,householdMemberId:'b34:spouse',name:'Ysolde Hartham',homePlotId:34,bornDay:-12043,spouseId:81,childIds:[84]},
  84:{occupantId:84,name:'Lark Hartham',homePlotId:14,bornDay:-6568,parentIds:[81,82],spouseId:13},
  13:{occupantId:13,name:'Robin Marshdown',homePlotId:14,bornDay:-6203,spouseId:84},
}};
const clock = new Date('0351-01-05T12:00:00Z');

describe('physical resident profile', () => {
  it('shows the admitted current age, reciprocal family and untracked people without mutation', () => {
    const before = JSON.stringify({household,life});
    const {rerender} = render(<ResidentProfile household={household} memberIndex={0} life={life} gameTime={clock} />);
    expect(screen.getByText('shopkeeper · Age 51')).toBeInTheDocument();
    const relatives = screen.getByTestId('resident-current-family');
    expect(relatives).toHaveTextContent('Ysolde Hartham — spouse · 33 years · keeps the household');
    expect(relatives).toHaveTextContent('Lark Hartham — child · 18 years · married to Robin Marshdown · home elsewhere in town');
    expect(screen.queryByText(household.summary)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Lark Hartham/)).toHaveLength(3);
    expect(screen.getByText(/Petra Dunford/)).toHaveTextContent('household servant');
    expect(JSON.stringify({household,life})).toBe(before);
    const changed={villagers:{...life.villagers,84:{...life.villagers[84],spouseId:undefined}}};
    rerender(<ResidentProfile household={household} memberIndex={0} life={changed} gameTime={clock} />);
    expect(screen.getByTestId('resident-current-family')).not.toHaveTextContent('married to Robin');
  });

  it('retains the founding view without a valid clock or admitted person', () => {
    const {rerender}=render(<ResidentProfile household={household} memberIndex={0} life={life} />);
    expect(screen.getByText('shopkeeper · Age 56')).toBeInTheDocument();
    expect(screen.getByText(household.summary)).toBeInTheDocument();
    rerender(<ResidentProfile household={household} memberIndex={0} life={life} gameTime={new Date('invalid')} />);
    expect(screen.getByText('shopkeeper · Age 56')).toBeInTheDocument();
    const stranger={villagers:{99:{occupantId:99,name:'Another person',homePlotId:34,bornDay:-10000}}};
    rerender(<ResidentProfile household={household} memberIndex={0} life={stranger} gameTime={clock} />);
    expect(screen.getByText('shopkeeper · Age 56')).toBeInTheDocument();
    expect(screen.queryByTestId('resident-current-family')).not.toBeInTheDocument();
  });

  it('does not merge duplicate names, replace staff, or invent reciprocal relatives', () => {
    const partial={villagers:{81:{...life.villagers[81],spouseId:undefined,childIds:[]},82:life.villagers[82]}};
    const {rerender}=render(<ResidentProfile household={household} memberIndex={0} life={partial} gameTime={clock} />);
    expect(screen.getByText('No confirmed family details are available.')).toBeInTheDocument();
    expect(screen.getAllByText(/Lark Hartham/)).toHaveLength(2);
    expect(screen.getByText(/Ysolde Hartham/)).toBeInTheDocument();
    rerender(<ResidentProfile household={household} memberIndex={4} life={life} gameTime={clock} />);
    expect(screen.getByText('household servant · Age 25')).toBeInTheDocument();
    expect(screen.getByText(household.summary)).toBeInTheDocument();
    expect(screen.queryByTestId('resident-current-family')).not.toBeInTheDocument();
  });
});


describe('current institutional role in a physical profile',()=>{
 it('shows the same admitted priest as a relative and primary person, without changing their household work',()=>{
  const source={villagers:{...life.villagers,82:{...life.villagers[82],role:'priest'}}}; const before=JSON.stringify(source);
  const {rerender}=render(<ResidentProfile household={household} memberIndex={0} life={source} gameTime={clock} />);
  expect(screen.getByTestId('resident-current-family')).toHaveTextContent('Town role: priest');
  rerender(<ResidentProfile household={household} memberIndex={1} life={source} gameTime={clock} />);
  expect(screen.getByText('Town role: priest')).toBeInTheDocument(); expect(screen.getByText('keeps the household · Age 33')).toBeInTheDocument();
  expect(JSON.stringify(source)).toBe(before);
  rerender(<ResidentProfile household={household} memberIndex={0} life={{villagers:{...source.villagers,82:{...source.villagers[82],diedDay:5}}}} gameTime={clock} />);
  expect(screen.getByTestId('resident-current-family')).toHaveTextContent('deceased'); expect(screen.queryByText(/Town role: priest/)).not.toBeInTheDocument();
 });
});
