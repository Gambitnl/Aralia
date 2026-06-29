import { render, screen } from '@testing-library/react';
import LivingWorldPreview from '../LivingWorldPreview';

describe('LivingWorldPreview', () => {
  it('mounts and renders a Town Chronicle with institution-holders', () => {
    render(<LivingWorldPreview />);
    expect(screen.getByText('Living-World Town Sim — Preview')).toBeTruthy();

    // The default 40-year run on a ~2000-pop town produces chronicle lines.
    const chronicle = screen.getByTestId('chronicle');
    expect(chronicle.textContent && chronicle.textContent.length).toBeGreaterThan(0);
    expect(chronicle.querySelectorAll('div').length).toBeGreaterThan(0);

    // The headless hook is wired and reports coherent stats.
    const hook = (window as unknown as Record<string, any>).__livingWorldPreview;
    expect(hook).toBeDefined();
    const cur = hook.current();
    expect(cur.started).toBeGreaterThan(0);
    expect(cur.totalEver).toBe(cur.living + cur.dead);
    expect(cur.events).toBeGreaterThan(0);
    expect(cur.holders).toBeGreaterThanOrEqual(1); // at least a priest/marketmaster
  });
});
