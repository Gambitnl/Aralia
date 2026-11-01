/** A compass describes camera orientation only. Keep map north, vertical-view
 * honesty, sampling cadence and cleanup independent of movement and saves. */
import React from 'react';
import {act, cleanup, render} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {Vector3} from 'three';
import {bearingFromViewDirection, compassPointForBearing} from '../cameraHeading';

const frame = vi.hoisted(() => ({callback: null as null | ((state: {camera: {getWorldDirection: (target: Vector3) => Vector3}}, delta: number) => void)}));
vi.mock('@react-three/fiber', () => ({useFrame: (callback: typeof frame.callback) => {frame.callback = callback;}}));
import {CameraHeadingReporter} from '../CameraHeadingReporter';
afterEach(() => {cleanup(); frame.callback = null;});

describe('ground camera compass', () => {
  it.each([
    [0,-1,0,'N'], [1,-1,45,'NE'], [1,0,90,'E'], [1,1,135,'SE'],
    [0,1,180,'S'], [-1,1,225,'SW'], [-1,0,270,'W'], [-1,-1,315,'NW'],
  ])('keeps map north for view %s/%s', (x,z,bearing,label) => {
    expect(bearingFromViewDirection({x:Number(x),z:Number(z)})).toBe(bearing);
    expect(compassPointForBearing(Number(bearing))).toBe(label);
  });
  it('wraps a nearly north-facing view to zero and rejects unavailable directions', () => {
    expect(bearingFromViewDirection({x:-0.001,z:-1})).toBe(0);
    for (const direction of [{x:0,z:0},{x:NaN,z:1},{x:1,z:Infinity},{x:1e-8,z:0}]) {
      expect(bearingFromViewDirection(direction)).toBeNull();
    }
  });
  it('samples changed headings at most four times per second without moving the camera', () => {
    const onChange=vi.fn(),position=new Vector3(7,12,30),direction=new Vector3(0,0,-1);
    const camera={position,getWorldDirection:(target:Vector3)=>target.copy(direction)};
    render(<CameraHeadingReporter onChange={onChange} />);
    act(()=>frame.callback!({camera},0.01));
    expect(onChange.mock.calls).toEqual([[0]]);
    direction.set(1,0,0);
    act(()=>frame.callback!({camera},0.1));
    expect(onChange).toHaveBeenCalledTimes(1);
    act(()=>frame.callback!({camera},0.15));
    expect(onChange.mock.calls).toEqual([[0],[90]]);
    act(()=>frame.callback!({camera},1));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(position.toArray()).toEqual([7,12,30]);
  });
  it('clears a vertical view and an unmounted scene rather than retaining a stale bearing', () => {
    const onChange=vi.fn(),direction=new Vector3(0,0,-1),camera={getWorldDirection:(target:Vector3)=>target.copy(direction)};
    const view=render(<CameraHeadingReporter onChange={onChange} />);
    act(()=>frame.callback!({camera},0.01));
    direction.set(0,-1,0);
    act(()=>frame.callback!({camera},0.25));
    expect(onChange).toHaveBeenLastCalledWith(null);
    view.unmount();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
