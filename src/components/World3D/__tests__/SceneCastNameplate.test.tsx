import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {SceneCastNameplate} from '../SceneCastNameplate';

describe('present cast talk affordance',()=>{
  it('accepts pointer and browser keyboard click activation through the same action',()=>{
    const talk=vi.fn();
    render(<SceneCastNameplate id="kaelen" name="Kaelen" onTalk={talk}/>);
    const button=screen.getByRole('button',{name:'Talk to Kaelen'});
    fireEvent.click(button,{button:0,detail:1});
    button.focus();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('type','button');
    // Browsers send a primary click with detail 0 for native keyboard activation.
    // Actual Enter/Space default behavior is verified in the gameplay browser.
    fireEvent.click(button,{button:0,detail:0});
    expect(talk).toHaveBeenCalledTimes(2);
  });
  it('does not turn secondary gestures into speech or bubble speech into world controls',()=>{
    const talk=vi.fn(),world=vi.fn();
    render(<div onClick={world} onPointerDown={world}><SceneCastNameplate id="elara" name="Elara" onTalk={talk}/></div>);
    const button=screen.getByRole('button',{name:'Talk to Elara'});
    fireEvent.contextMenu(button);fireEvent.click(button,{button:2});
    expect(talk).not.toHaveBeenCalled();
    world.mockClear();
    fireEvent(button,new MouseEvent('pointerdown',{button:0,bubbles:true}));fireEvent.click(button,{button:0});
    expect(talk).toHaveBeenCalledTimes(1);expect(world).not.toHaveBeenCalled();
  });
  it('keeps the player and a cast without a talk handler inert',()=>{
    const talk=vi.fn();
    render(<><SceneCastNameplate id="mara" name="Mara" isPlayer onTalk={talk}/><SceneCastNameplate id="diorama" name="Diorama"/></>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Mara'));fireEvent.click(screen.getByLabelText('Diorama'));
    expect(talk).not.toHaveBeenCalled();
  });
});
