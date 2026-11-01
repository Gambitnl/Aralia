/** Matching furniture must remain distinguishable and select the same physical
 * receipt. Pointer and keyboard focus can identify a piece without examining
 * it, and a stale choice must never keep another floor/building highlighted. */
import React from 'react';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {NearbyFurnishingChoices} from '../NearbyFurnishingChoices';
import {focusedFurnishingPart} from '../FurnishingFocusMarker';

afterEach(cleanup);
function fixture() {
  return [
    {id:'wf-plot-188-66/0/5',name:'bench',detail:'nave · west · 2 ft away',activate:vi.fn()},
    {id:'wf-plot-188-66/0/7',name:'bench',detail:'nave · northwest · 3 ft away',activate:vi.fn()},
  ];
}
describe('reached furnishing choices', () => {
  it('distinguishes matching benches and delegates only the selected original action', () => {
    const actions=fixture(),focus=vi.fn();
    render(<NearbyFurnishingChoices actions={actions} onFocusTarget={focus}/>);
    const first=screen.getByRole('button',{name:'Examine bench, nave · west · 2 ft away'});
    fireEvent.mouseEnter(first);
    expect(focus.mock.calls.at(-1)).toEqual([actions[0].id]);
    expect(actions[0].activate).not.toHaveBeenCalled();
    fireEvent.click(first);
    expect(actions[0].activate).toHaveBeenCalledTimes(1);
    expect(actions[1].activate).not.toHaveBeenCalled();
  });
  it('restores the keyboard target when a different pointer target is left', () => {
    const actions=fixture(),focus=vi.fn();
    render(<NearbyFurnishingChoices actions={actions} onFocusTarget={focus}/>);
    const buttons=screen.getAllByRole('button');
    fireEvent.focus(buttons[1]);
    fireEvent.mouseEnter(buttons[0]);
    expect(focus.mock.calls.at(-1)).toEqual([actions[0].id]);
    fireEvent.mouseLeave(buttons[0]);
    expect(focus.mock.calls.at(-1)).toEqual([actions[1].id]);
    fireEvent.blur(buttons[1]);
    expect(focus.mock.calls.at(-1)).toEqual([null]);
    expect(actions.every(a=>a.activate.mock.calls.length===0)).toBe(true);
  });
  it('withdraws focus when movement removes the reached piece, and clears on unmount', () => {
    const actions=fixture(),focus=vi.fn();
    const view=render(<NearbyFurnishingChoices actions={actions} onFocusTarget={focus}/>);
    fireEvent.focus(screen.getAllByRole('button')[0]);
    view.rerender(<NearbyFurnishingChoices actions={[actions[1]]} onFocusTarget={focus}/>);
    expect(focus.mock.calls.at(-1)).toEqual([null]);
    fireEvent.focus(screen.getByRole('button'));
    view.unmount();
    expect(focus.mock.calls.at(-1)).toEqual([null]);
  });
});

describe('physical focus identity', () => {
  const ground={x:1,z:2,w:1.5,d:.4,h:.45,furnishing:{level:0,index:5,roomId:3,kind:'bench'}};
  const upstairs={...ground,baseY:3,furnishing:{...ground.furnishing,level:1}};
  it('matches the exact building/floor/index and keeps the original part', () => {
    expect(focusedFurnishingPart('wf-plot-188-66',[ground,upstairs],'wf-plot-188-66/1/5')).toBe(upstairs);
    expect(focusedFurnishingPart('wf-plot-188-67',[ground],'wf-plot-188-66/0/5')).toBeUndefined();
    expect(focusedFurnishingPart('wf-plot-188-66',[ground],null)).toBeUndefined();
  });
  it('does not outline a removed, malformed or absent physical part', () => {
    expect(focusedFurnishingPart('wf-plot-188-66',undefined,'wf-plot-188-66/0/5')).toBeUndefined();
    expect(focusedFurnishingPart('wf-plot-188-66',[{...ground,w:0}],'wf-plot-188-66/0/5')).toBeUndefined();
  });
});
