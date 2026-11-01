/** A building selected by name must outline that physical artifact, even when
 * another plot appears earlier within the old broad matching radius. */
import React from 'react';
import {describe,it,expect} from 'vitest';
import {render} from '@testing-library/react';
import TownPlanView from '../TownPlanView';
import {generateTownPlan} from '../../../systems/worldforge/town/townEngine';
import {rootSeedPath} from '../../../systems/worldforge/seedPath';
import {toArtifactPlan} from '../../../systems/worldforge/town/townPlanAdapter';
import {STYLE_FAMILIES} from '../../../systems/worldforge/town/architectureStyle';
import type {Pt} from '../../../systems/worldforge/submap/submapEngine';

const polygon=(points:Pt[])=>'M'+points.map(p=>`${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')+'Z';
const fixture=()=>{
 const plan=generateTownPlan([[0,0],[120,0],[140,90],[70,140],[0,100]],rootSeedPath(42),{population:4000});
 const artifact=toArtifactPlan(plan,0,STYLE_FAMILIES.temperateFrame).plan;
 return {plan,artifact};
};

describe('town selected building identity',()=>{
 it('outlines the selected artifact rather than the first nearby engine plot',()=>{
  const {plan,artifact}=fixture(),target=artifact.plots[artifact.plots.length-1];
  expect(target).toBeDefined();
  const before=JSON.stringify({plan,artifact});
  const {getByTestId}=render(<TownPlanView plan={plan} artifactPlan={artifact} selectedPlotId={target.id}/>);
  expect(getByTestId('town-selected-highlight').getAttribute('d')).toBe(polygon(target.footprint));
  expect(JSON.stringify({plan,artifact})).toBe(before);
 });
 it('does not substitute another building when the selected source no longer exists',()=>{
  const {plan,artifact}=fixture();
  const {queryByTestId}=render(<TownPlanView plan={plan} artifactPlan={artifact} selectedPlotId={-100}/>);
  expect(queryByTestId('town-selected-highlight')).toBeNull();
 });
});
