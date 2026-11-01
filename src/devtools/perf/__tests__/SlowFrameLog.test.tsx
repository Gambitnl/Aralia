/** The reader can inspect frozen slow-frame evidence while new measurements arrive. */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SlowFrameLog } from '../PerfOverlay';
import type { StallRecord } from '../stallLog';

const frame = (id: number, names = ['Water mesh']): StallRecord => ({
  frame: id, atMs: id * 60, startMs: (id - 1) * 60, frameMs: 60, baselineMs: 20,
  cpuMs: 40, gpuMs: null, drawCalls: 1, baselineDrawCalls: 1, triangles: 2, baselineTriangles: 2,
  contributors: names.map(name => ({ name, valueMs: 30, baselineMs: 5, deltaMs: 25 })), notes: [],
});
afterEach(() => vi.useRealTimers());

describe('slow-frame evidence presentation', () => {
  it('refreshes only every three seconds while accepting new measurements', () => {
    vi.useFakeTimers();
    const view = render(<SlowFrameLog records={[frame(1)]} />);
    view.rerender(<SlowFrameLog records={[frame(2)]} />);
    act(() => vi.advanceTimersByTime(2999));
    expect(screen.getByText('Frame #1')).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText('Frame #2')).toBeTruthy();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('holds copied evidence, including late attribution, and resumes to the newest frames', () => {
    vi.useFakeTimers();
    const original = frame(1);
    const view = render(<SlowFrameLog records={[original]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hold list' }));
    original.contributors[0].name = 'Late GPU result';
    original.notes.push('Late note');
    view.rerender(<SlowFrameLog records={[frame(3), frame(2), original]} />);
    act(() => vi.advanceTimersByTime(9000));
    expect(screen.getByText('Frame #1')).toBeTruthy();
    expect(screen.queryByText('Frame #3')).toBeNull();
    expect(screen.queryByText('Late GPU result')).toBeNull();
    expect(screen.getByText('Held · 2 newer retained')).toBeTruthy();
    const region = screen.getByRole('region', { name: 'Slow frame evidence' });
    region.scrollTop = 150;
    fireEvent.click(screen.getByRole('button', { name: 'Resume list' }));
    expect(screen.getByText('Frame #3')).toBeTruthy();
    expect(region.scrollTop).toBe(0);
  });

  it('keeps evidence still while hovered or keyboard-focused', () => {
    vi.useFakeTimers();
    const view = render(<SlowFrameLog records={[frame(1)]} />);
    const region = screen.getByRole('region', { name: 'Slow frame evidence' });
    fireEvent.mouseEnter(region);
    view.rerender(<SlowFrameLog records={[frame(2)]} />);
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.getByText('Frame #1')).toBeTruthy();
    fireEvent.focus(region);
    fireEvent.mouseLeave(region);
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.getByText('Frame #1')).toBeTruthy();
    fireEvent.blur(region);
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByText('Frame #2')).toBeTruthy();
  });

  it('shows recurring contributors in a predictable order and keeps every retained frame', () => {
    render(<SlowFrameLog records={[frame(3, ['Zebra', 'Alpha']), frame(2, ['Zebra']), frame(1, [])]} />);
    const region = screen.getByRole('region', { name: 'Slow frame evidence' });
    expect(region.textContent?.indexOf('Alpha')).toBeLessThan(region.textContent?.indexOf('Zebra') ?? 0);
    expect(screen.getByText('2/3')).toBeTruthy();
    expect(screen.getByText('1/3')).toBeTruthy();
    expect(screen.getByText('Frame #1')).toBeTruthy();
    expect(screen.getByText('nothing measured explains it')).toBeTruthy();
  });
});
