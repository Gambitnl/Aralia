/** World selection must remain a reversible plan. Exercise the real atlas
 * route and metadata; only the drawing surface is replaced with a named pick. */
import React from 'react';
import {fireEvent,render,screen} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import MapPane from '../MapPane';
import type {TravelMeta} from '../../types/travelMeta';

vi.mock('../Worldforge/AtlasSvgView',()=>({default:({onPickCell}:{onPickCell:(cell:{i:number})=>void})=>
  <button onClick={()=>onPickCell({i:2015})}>Pick Oroten</button>}));

const seed=1793176397587;
describe('world journey review',()=>{
  it('cancels without travel and explicitly commits the same reviewed route once',async()=>{
    const travel=vi.fn();
    render(<MapPane worldSeed={seed} playerAtlasCellId={2016} onTileClick={travel} onClose={vi.fn()} allowTravel/>);
    fireEvent.click(await screen.findByRole('button',{name:'Pick Oroten'}));
    const review=await screen.findByTestId('world-journey-review');
    expect(review).toHaveTextContent('Journey to Oroten');
    expect(review).toHaveTextContent('Total travel time');
    const firstText=review.textContent ?? '';
    expect(travel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Stay here'}));
    expect(screen.queryByTestId('world-journey-review')).toBeNull();
    expect(travel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Pick Oroten'}));
    expect((await screen.findByTestId('world-journey-review')).textContent).toBe(firstText);
    fireEvent.click(screen.getByRole('button',{name:'Set out'}));
    expect(travel).toHaveBeenCalledTimes(1);
    const meta=travel.mock.calls[0][3] as TravelMeta;
    expect(meta.destinationCell).toMatchObject({cellId:2015,name:'Oroten'});
    expect(meta.routeLineage?.fromCellId).toBe(2016);
    expect(meta.routeLineage?.intendedCellId).toBe(2015);
    expect(meta.seconds).toBeGreaterThan(0);
    expect(screen.queryByTestId('world-journey-review')).toBeNull();
  },60000);

  it('invalidates a quote when route preference or accepted origin changes',async()=>{
    const travel=vi.fn(),close=vi.fn();
    const view=render(<MapPane worldSeed={seed} playerAtlasCellId={2016} onTileClick={travel} onClose={close} allowTravel/>);
    fireEvent.click(await screen.findByRole('button',{name:'Pick Oroten'}));
    expect(await screen.findByTestId('world-journey-review')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Route preference'),{target:{value:'cautious'}});
    expect(screen.queryByTestId('world-journey-review')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Pick Oroten'}));
    expect(await screen.findByTestId('world-journey-review')).toHaveTextContent('Favor safer ground');
    view.rerender(<MapPane worldSeed={seed} playerAtlasCellId={2011} onTileClick={travel} onClose={close} allowTravel/>);
    expect(screen.queryByTestId('world-journey-review')).toBeNull();
    expect(travel).not.toHaveBeenCalled();
  },60000);

  it('retains the existing underprovisioned choice instead of offering a funded departure',async()=>{
    localStorage.removeItem('aralia.travel.provisionRiskInfo.v1');
    const travel=vi.fn();
    render(<MapPane worldSeed={seed} playerAtlasCellId={2016} partySize={1}
      travelMinutesRemainder={1400} onTileClick={travel} onClose={vi.fn()} allowTravel/>);
    fireEvent.click(await screen.findByRole('button',{name:'Pick Oroten'}));
    expect(await screen.findByTestId('travel-provision-risk-info')).toBeVisible();
    expect(screen.queryByTestId('world-journey-review')).toBeNull();
    expect(travel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('prov-risk-info-ack'));
    fireEvent.click(await screen.findByTestId('prov-turn-back'));
    expect(screen.queryByTestId('travel-provision-choice')).toBeNull();
    expect(travel).not.toHaveBeenCalled();
  },60000);
});
