import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPerfMeasurementEnabled, setPerfMeasurementEnabled, subscribePerfMeasurement } from '../perfControl';

afterEach(() => setPerfMeasurementEnabled(true));

describe('reversible diagnostic measurement control', () => {
  it('notifies only real transitions and lets owners unsubscribe', () => {
    const listener = vi.fn(), stop = subscribePerfMeasurement(listener);
    setPerfMeasurementEnabled(true); expect(listener).not.toHaveBeenCalled();
    setPerfMeasurementEnabled(false); expect(isPerfMeasurementEnabled()).toBe(false);
    expect(listener).toHaveBeenCalledOnce();
    setPerfMeasurementEnabled(false); expect(listener).toHaveBeenCalledOnce();
    stop(); setPerfMeasurementEnabled(true);
    expect(isPerfMeasurementEnabled()).toBe(true); expect(listener).toHaveBeenCalledOnce();
  });
});
