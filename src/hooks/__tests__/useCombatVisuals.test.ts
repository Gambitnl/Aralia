import { renderHook, act } from '@testing-library/react';
import { useCombatVisuals } from '../combat/useCombatVisuals';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('useCombatVisuals', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should add damage number and remove it after duration', async () => {
    const { result } = renderHook(() => useCombatVisuals());

    act(() => {
      result.current.addDamageNumber(10, { x: 0, y: 0 }, 'damage');
    });

    expect(result.current.damageNumbers).toHaveLength(1);
    expect(result.current.damageNumbers[0].value).toBe(10);

    // Advance timer to trigger removal
    // duration defaults to 1000 in createDamageNumber usually, but we should rely on the object
    const duration = result.current.damageNumbers[0].duration;

    await act(async () => {
        vi.advanceTimersByTime(duration + 10);
    });

    expect(result.current.damageNumbers).toHaveLength(0);
  });

  it('should queue animation and remove it after duration', async () => {
    const { result } = renderHook(() => useCombatVisuals());

    const animation = {
      id: 'anim1',
      type: 'move' as const,
      duration: 500,
      startTime: Date.now()
    };

    act(() => {
      result.current.queueAnimation(animation);
    });

    expect(result.current.animations).toHaveLength(1);
    expect(result.current.animations[0].id).toBe('anim1');

    await act(async () => {
        vi.advanceTimersByTime(510);
    });

    expect(result.current.animations).toHaveLength(0);
  });
});
