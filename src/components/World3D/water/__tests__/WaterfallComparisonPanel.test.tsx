/** Frequent water readings must update their panel without rerendering the river editor. */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createComparisonReadings, WaterfallComparisonPanel } from '@/components/DesignPreview/steps/water/WaterfallComparisonPanel';
import type { ComparisonState } from '../waterfallTerrainComparisonView';

function state(time = 0): ComparisonState {
  return { display: 'liquid', selected: 'seven-sisters', displayError: null, liquid: null,
    reading: { physicalTime: time, sourceOn: true, running: true, failure: null,
      lastStepMilliseconds: 12, cases: [], arrivals: [] },
    wallSeconds: time, pace: 1, markers: {}, loading: false, error: null };
}
const controls = () => ({ onDisplay: vi.fn(), onCloseUp: vi.fn(), onFocus: vi.fn(), onSource: vi.fn(),
  onPause: vi.fn(), onReset: vi.fn(), onClose: vi.fn() });
afterEach(cleanup);

describe('comparison readout ownership', () => {
  it('shows every latest reading without rendering its parent again', () => {
    const readings = createComparisonReadings(state());
    let parentRenders = 0;
    function Editor() { parentRenders++; return <WaterfallComparisonPanel readings={readings} {...controls()} />; }
    render(<React.StrictMode><Editor /></React.StrictMode>);
    const before = parentRenders;
    for (let time = 1; time <= 20; time++) act(() => readings.publish(state(time)));
    expect(screen.getByText(/Selected physical clock/)).toHaveTextContent('20.000 s');
    expect(parentRenders).toBe(before);
  });

  it('retains closed-panel updates, unsubscribes, and reopens on the latest state', () => {
    const readings = createComparisonReadings(state());
    const notify = vi.fn(), unsubscribe = readings.subscribe(notify);
    const first = state(1); readings.publish(first); readings.publish(first);
    expect(notify).toHaveBeenCalledTimes(1);
    unsubscribe(); readings.publish(state(2)); expect(notify).toHaveBeenCalledTimes(1);
    const mounted = render(<WaterfallComparisonPanel readings={readings} {...controls()} />);
    expect(screen.getByText(/Selected physical clock/)).toHaveTextContent('2.000 s');
    mounted.unmount(); readings.publish(state(3));
    render(<WaterfallComparisonPanel readings={readings} {...controls()} />);
    expect(screen.getByText(/Selected physical clock/)).toHaveTextContent('3.000 s');
  });

  it('keeps minimized controls and uses the newest source, pause and failure states', () => {
    const readings = createComparisonReadings(state()), actions = controls();
    render(<WaterfallComparisonPanel readings={readings} {...actions} />);
    fireEvent.click(screen.getByRole('button', { name: 'Minimize controls' }));
    const next = state(7); next.reading = { ...next.reading!, sourceOn: false, running: false, failure: 'retained diagnostic failure' };
    act(() => readings.publish(next));
    expect(screen.getByRole('button', { name: /Show waterfall controls/ })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Show waterfall controls/ }));
    fireEvent.click(screen.getByText('Existing water controls and terrain details'));
    fireEvent.click(screen.getByRole('button', { name: 'Start source' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run existing water' }));
    expect(actions.onSource).toHaveBeenCalledWith(true);
    expect(actions.onPause).toHaveBeenCalledWith(false);
    expect(screen.getByRole('alert')).toHaveTextContent('retained diagnostic failure');
    expect(screen.getByText(/Selected physical clock/)).toHaveTextContent('7.000 s');
  });
});
