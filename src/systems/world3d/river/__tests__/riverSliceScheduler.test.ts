/** Exercises pause/resume races without running a hydraulic solver or creating real workers. */
import { afterEach, expect, it, vi } from 'vitest';
import { RiverSliceScheduler } from '../riverSliceScheduler';
afterEach(() => vi.useRealTimers());

it('replaces a paused timer with one immediate resume and leaves no second chain', () => {
  vi.useFakeTimers(); const post = vi.fn(); const schedule = new RiverSliceScheduler(post);
  schedule.idle(); schedule.soon(); schedule.soon();
  expect(post).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(8);
  expect(post).toHaveBeenCalledTimes(1);
  schedule.beginSlice(); schedule.idle();
  vi.advanceTimersByTime(8);
  expect(post).toHaveBeenCalledTimes(2);
});

it('keeps repeated paused edits and idle requests from multiplying the queue', () => {
  vi.useFakeTimers(); const post = vi.fn(); const schedule = new RiverSliceScheduler(post);
  for (let i = 0; i < 20; i++) {
    schedule.idle(); schedule.soon(); schedule.soon();
    schedule.beginSlice(); schedule.idle(); schedule.idle();
  }
  expect(post).toHaveBeenCalledTimes(20);
  vi.advanceTimersByTime(8);
  expect(post).toHaveBeenCalledTimes(21);
});

it('lets fast settling schedule its next slice immediately', () => {
  vi.useFakeTimers(); const post = vi.fn(); const schedule = new RiverSliceScheduler(post);
  schedule.soon(); schedule.beginSlice(); schedule.soon();
  expect(post).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});
