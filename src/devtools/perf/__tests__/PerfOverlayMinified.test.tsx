/**
 * @file PerfOverlayMinified.test.tsx
 * Holds the minified panel state (Remy, 2026-10-30). Minified is a fourth
 * state beside the pill, the default panel and the maximized view. It keeps
 * the live headline numbers, drops the diagnosis, and survives a reload.
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PerfOverlayView } from '../PerfOverlay';
import { acquirePerfSession, clearPerfSessions } from '../perfRegistry';

const PANEL_SIZE_KEY = 'aralia.perfPanelSize';

beforeEach(() => {
  localStorage.setItem('aralia.perfHud', 'panel');
  acquirePerfSession('minified-test', 'Test Surface');
});

afterEach(() => {
  cleanup();
  clearPerfSessions();
  localStorage.clear();
});

const panel = () => screen.getByTestId('perf-panel');
const miniButton = () => screen.getByRole('button', { name: /minify performance monitor|show the full performance monitor/i });

describe('performance monitor minified state', () => {
  it('opens in the default size, with the diagnosis tabs in view', () => {
    render(<PerfOverlayView />);
    expect(panel().dataset.minified).toBe('false');
    expect(miniButton().getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'passes' })).toBeTruthy();
  });

  it('keeps the headline numbers and hides the diagnosis when minified', () => {
    render(<PerfOverlayView />);
    fireEvent.click(miniButton());
    expect(panel().dataset.minified).toBe('true');
    expect(miniButton().getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Test Surface')).toBeTruthy();
    expect(screen.getByText('mean ms')).toBeTruthy();
    expect(screen.getByText('p95 ms')).toBeTruthy();
    expect(screen.getByText('worst ms')).toBeTruthy();
    expect(screen.getByText('gpu')).toBeTruthy();
    expect(screen.getByText('CPU callback')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'passes' })).toBeNull();
    expect(screen.queryByText('Scene and memory details')).toBeNull();
    expect(screen.queryByText('budget')).toBeNull();
    expect(localStorage.getItem(PANEL_SIZE_KEY)).toBe('minified');
  });

  it('returns to the default size on a second press', () => {
    render(<PerfOverlayView />);
    fireEvent.click(miniButton());
    fireEvent.click(miniButton());
    expect(panel().dataset.minified).toBe('false');
    expect(screen.getByRole('button', { name: 'passes' })).toBeTruthy();
    expect(localStorage.getItem(PANEL_SIZE_KEY)).toBe('default');
  });

  it('opens minified after a reload when minified was the last choice', () => {
    localStorage.setItem(PANEL_SIZE_KEY, 'minified');
    render(<PerfOverlayView />);
    expect(panel().dataset.minified).toBe('true');
  });

  it('lets maximize win, and restore return to the minified size', () => {
    render(<PerfOverlayView />);
    fireEvent.click(miniButton());
    fireEvent.click(screen.getByRole('button', { name: 'Maximize performance monitor' }));
    expect(panel().dataset.maximized).toBe('true');
    expect(panel().dataset.minified).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Restore performance monitor' }));
    expect(panel().dataset.minified).toBe('true');
  });

  it('restores and minifies in one press from the maximized view', () => {
    render(<PerfOverlayView />);
    fireEvent.click(screen.getByRole('button', { name: 'Maximize performance monitor' }));
    fireEvent.click(miniButton());
    expect(panel().dataset.maximized).toBe('false');
    expect(panel().dataset.minified).toBe('true');
  });

  it('keeps the collapse button working from the minified size', () => {
    render(<PerfOverlayView />);
    fireEvent.click(miniButton());
    fireEvent.click(screen.getByTitle('Collapse (Alt+P)'));
    expect(screen.queryByTestId('perf-panel')).toBeNull();
    expect(screen.getByTitle('Performance (Alt+P)')).toBeTruthy();
  });
});
