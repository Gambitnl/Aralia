import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  type ModalEntry,
  resolveTopmostOpenModal,
  shouldLockBackgroundScroll,
  backgroundLockKey,
  useModalOrchestration,
} from '../useModalOrchestration';

/** Convenience builder so tests only specify the fields they exercise. */
const entry = (over: Partial<ModalEntry> & { id: string }): ModalEntry => ({
  isOpen: false,
  locksBackgroundScroll: false,
  ...over,
});

describe('resolveTopmostOpenModal', () => {
  it('returns the first open entry with a close action (array order = Escape priority)', () => {
    const entries = [
      entry({ id: 'a', isOpen: true, close: vi.fn() }),
      entry({ id: 'b', isOpen: true, close: vi.fn() }),
    ];
    expect(resolveTopmostOpenModal(entries)?.id).toBe('a');
  });

  it('skips open entries without a close action (they bind their own Escape)', () => {
    const entries = [
      entry({ id: 'a', isOpen: true }),
      entry({ id: 'b', isOpen: true, close: vi.fn() }),
    ];
    expect(resolveTopmostOpenModal(entries)?.id).toBe('b');
  });

  it('returns undefined when nothing is open', () => {
    expect(resolveTopmostOpenModal([entry({ id: 'a' })])).toBeUndefined();
  });
});

describe('shouldLockBackgroundScroll', () => {
  it('is true when any open entry locks background scroll', () => {
    const entries = [
      entry({ id: 'a' }),
      entry({ id: 'b', isOpen: true, locksBackgroundScroll: true }),
    ];
    expect(shouldLockBackgroundScroll(entries)).toBe(true);
  });

  it('is false when no open entry locks background scroll', () => {
    const entries = [entry({ id: 'a', isOpen: true, locksBackgroundScroll: false })];
    expect(shouldLockBackgroundScroll(entries)).toBe(false);
  });
});

describe('backgroundLockKey', () => {
  it('is a stable key over the set of open lock-scrolling modals in array order', () => {
    const entries = [
      entry({ id: 'a', isOpen: true, locksBackgroundScroll: true }),
      entry({ id: 'b', isOpen: false, locksBackgroundScroll: true }),
      entry({ id: 'c', isOpen: true, locksBackgroundScroll: true }),
    ];
    expect(backgroundLockKey(entries)).toBe('a|c');
  });

  it('is empty when nothing locks', () => {
    expect(backgroundLockKey([entry({ id: 'a' })])).toBe('');
  });
});

describe('useModalOrchestration', () => {
  afterEach(() => {
    document.body.style.overflow = '';
    document.documentElement.style.overscrollBehavior = '';
  });

  it('dismisses the topmost open modal on Escape', () => {
    const close = vi.fn();
    const { unmount } = renderHook(() =>
      useModalOrchestration([
        entry({ id: 'a', isOpen: true, close, locksBackgroundScroll: false }),
      ]),
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(close).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('does not dismiss when a child already handled Escape (defaultPrevented)', () => {
    const close = vi.fn();
    const { unmount } = renderHook(() =>
      useModalOrchestration([
        entry({ id: 'a', isOpen: true, close, locksBackgroundScroll: false }),
      ]),
    );
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    event.preventDefault();
    act(() => {
      document.dispatchEvent(event);
    });
    expect(close).not.toHaveBeenCalled();
    unmount();
  });

  it('locks body scroll while a scroll-locking modal is open and restores it on close', () => {
    const { rerender, unmount } = renderHook(
      ({ isOpen }: { isOpen: boolean }) =>
        useModalOrchestration([entry({ id: 'a', isOpen, locksBackgroundScroll: true })]),
      { initialProps: { isOpen: true } },
    );
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overscrollBehavior).toBe('contain');

    rerender({ isOpen: false });
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overscrollBehavior).toBe('');
    unmount();
  });
});
