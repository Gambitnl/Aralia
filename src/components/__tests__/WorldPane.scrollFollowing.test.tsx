/** Keep actual result history readable without pulling a reader away from older entries. */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import WorldPane from '../WorldPane';
import type { GameMessage } from '../../types';

const message: GameMessage = { id: 1, sender: 'system', timestamp: new Date('0351-01-09T15:08:22Z'), text: 'Constitution save: 17 vs DC 12 — passed.' };
let height: number;
let resized: ResizeObserverCallback;
type Scroll = (options: ScrollToOptions | number, y?: number) => void;
let scroll: ReturnType<typeof vi.fn<Scroll>>;
const disconnected = vi.fn();

beforeAll(() => { Element.prototype.scrollTo ??= () => {}; });

beforeEach(() => {
  height = 1200;
  vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(() => height);
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(300);
  scroll = vi.fn(function (this: HTMLElement, options: ScrollToOptions | number, y?: number) {
    this.scrollTop = Math.min(typeof options === 'number' ? y ?? 0 : options.top ?? 0, height - 300);
  });
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) { resized = callback; }
    observe() {}
    disconnect = disconnected;
  });
  vi.spyOn(Element.prototype, 'scrollTo').mockImplementation(scroll);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); disconnected.mockClear(); });

describe('WorldPane result following', () => {
  it('opens at the tail immediately and follows later layout growth', () => {
    const { unmount } = render(<WorldPane messages={[message]} />);
    expect(scroll).toHaveBeenLastCalledWith({ top: 1200, behavior: 'auto' });
    expect(screen.getByRole('button', { name: 'Latest messages' })).toBeDisabled();
    height = 1800;
    resized([], {} as ResizeObserver);
    expect(scroll).toHaveBeenLastCalledWith({ top: 1800, behavior: 'auto' });
    unmount();
    expect(disconnected).toHaveBeenCalledOnce();
  });

  it('holds a reader in history across new messages and resizing, then returns on request', () => {
    const { rerender } = render(<WorldPane messages={[message]} />);
    const log = screen.getByRole('region', { name: 'Game messages' });
    log.scrollTop = 100;
    fireEvent.scroll(log);
    scroll.mockClear();
    height = 1800;
    rerender(<WorldPane messages={[message, { ...message, id: 2, text: 'The next turn begins.' }]} />);
    resized([], {} as ResizeObserver);
    expect(scroll).not.toHaveBeenCalled();
    expect(log.scrollTop).toBe(100);
    fireEvent.click(screen.getByRole('button', { name: 'Latest messages' }));
    expect(scroll).toHaveBeenLastCalledWith({ top: 1800, behavior: 'auto' });
    expect(log).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Latest messages' })).toBeDisabled();
  });

  it('follows new entries after the reader scrolls back to the tail', () => {
    const { rerender } = render(<WorldPane messages={[message]} />);
    const log = screen.getByRole('region', { name: 'Game messages' });
    log.scrollTop = 100; fireEvent.scroll(log);
    log.scrollTop = 900; fireEvent.scroll(log);
    height = 1600;
    rerender(<WorldPane messages={[message, { ...message, id: 2 }]} />);
    expect(scroll).toHaveBeenLastCalledWith({ top: 1600, behavior: 'auto' });
  });
});
