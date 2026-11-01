/** The actual town view keeps its marker on the existing pan/zoom frame and
 * leaves standalone source plans unchanged when no player is supplied. */
import React from 'react';
import {describe,it,expect} from 'vitest';
import {render,screen} from '@testing-library/react';
import TownPlanView from '../TownPlanView';
import {generateTownPlan} from '../../../systems/worldforge/town/townEngine';
import {rootSeedPath} from '../../../systems/worldforge/seedPath';
const plan=()=>generateTownPlan([[0,0],[120,0],[140,90],[70,140],[0,100]],rootSeedPath(42),{population:4000});
describe('town party marker',()=>{
 it('shows accepted coordinates inside the source plan transform without adding an interaction',()=>{
  const source=plan(),before=JSON.stringify(source);
  render(<TownPlanView plan={source} width={900} height={560} partyPosition={[25,30]}/>);
  const marker=screen.getByRole('img',{name:'Your position'});
  expect(marker.getAttribute('transform')).toBe('translate(25,30)');
  expect(marker.parentElement?.getAttribute('transform')).toContain('scale(');
  expect(marker.getAttribute('pointer-events')).toBe('none');
  expect(JSON.stringify(source)).toBe(before);
 });
 it('keeps previews free of inferred player positions',()=>{
  const {rerender}=render(<TownPlanView plan={plan()} width={900} height={560}/>);
  expect(screen.queryByTestId('town-party-position')).toBeNull();
  rerender(<TownPlanView plan={plan()} partyPosition={[Number.NaN,0]}/>);
  expect(screen.queryByTestId('town-party-position')).toBeNull();
 });
});
