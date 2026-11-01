import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
import {CarriedTorchIgnition} from '../CarriedTorchIgnition';

describe('carried torch source choice',()=>{
  it('shows both fuel amounts and lights the selected partial source, including after inventory changes',()=>{
    const ignite=vi.fn(),choices=[{inventoryIndex:27,fuelMinutes:60,quantity:2},{inventoryIndex:28,fuelMinutes:4.966666666666667,quantity:1}];
    const view=render(<CarriedTorchIgnition choices={choices} onIgnite={ignite}/>);
    expect(screen.getByRole('group',{name:'Choose a carried torch'})).toHaveTextContent('Uses one carried torch; keeps its remaining fuel. 20 ft bright + 20 ft dim.');
    expect(screen.getByText('Torch 1 · 2 carried · about 60 min fuel')).toBeVisible();
    expect(screen.getByRole('button',{name:'Light torch 1 (60 min fuel)'})).toBeEnabled();
    fireEvent.click(screen.getByRole('button',{name:'Light torch 2 (5 min fuel)'}));
    expect(ignite).toHaveBeenLastCalledWith(28);
    view.rerender(<CarriedTorchIgnition choices={[{...choices[0],inventoryIndex:6},{...choices[1],inventoryIndex:9}]} onIgnite={ignite}/>);
    fireEvent.click(screen.getByRole('button',{name:'Light torch 2 (5 min fuel)'}));
    expect(ignite).toHaveBeenLastCalledWith(9);
    expect(choices[1].fuelMinutes).toBe(4.966666666666667);
  });
  it('discloses the existing eligibility error before commitment and updates when eligibility changes',()=>{
    const ignite=vi.fn(),choice={inventoryIndex:28,fuelMinutes:4.966666666666667,quantity:1,error:'That character cannot handle a torch now.'};
    const view=render(<CarriedTorchIgnition choices={[choice]} onIgnite={ignite}/>);
    const button=screen.getByRole('button',{name:'Light torch 1 (5 min fuel)'});
    expect(button).toBeDisabled();expect(button).toHaveAccessibleDescription(choice.error);
    fireEvent.click(button);expect(ignite).not.toHaveBeenCalled();
    view.rerender(<CarriedTorchIgnition choices={[{...choice,error:null}]} onIgnite={ignite}/>);
    fireEvent.click(screen.getByRole('button',{name:'Light torch 1 (5 min fuel)'}));
    expect(ignite).toHaveBeenCalledWith(28);
  });
  it('keeps all choices unavailable while movement or encounter commitment is paused',()=>{
    const ignite=vi.fn();render(<CarriedTorchIgnition choices={[{inventoryIndex:27,fuelMinutes:60,quantity:1}]} disabled onIgnite={ignite}/>);
    const button=screen.getByRole('button',{name:'Light torch 1 (60 min fuel)'});
    expect(button).toBeDisabled();fireEvent.click(button);expect(ignite).not.toHaveBeenCalled();
  });
});
