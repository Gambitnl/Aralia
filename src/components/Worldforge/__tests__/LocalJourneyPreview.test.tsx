import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LocalJourneyPreview } from '../LocalJourneyPreview';
import type { LocalJourneyQuote } from '../../../systems/worldforge/travel/localGroundJourney';
afterEach(cleanup);
const quote = { label: 'Old sewer', route: { miles: 2 }, totalSeconds: 5400, encounterChance: 0.02, meta: { provision: { rationsToSpend: 0, waterToSpend: 0 } }, allowed: true } as LocalJourneyQuote;
describe('local journey decision', () => {
  it('explains a qualified street route without promising an event-free trip', () => {
    render(<LocalJourneyPreview quote={{...quote,routeKind:'town-streets'}} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/along mapped town streets/)).toHaveTextContent('travel events and costs still apply');
    expect(screen.queryByText(/through the surrounding country/)).not.toBeInTheDocument();
  });
  it('shows the toll before the player chooses, and cancel spends nothing', () => {
    const confirm = vi.fn(), cancel = vi.fn();
    render(<LocalJourneyPreview quote={quote} onConfirm={confirm} onCancel={cancel} />);
    expect(screen.getByRole('dialog').textContent).toContain('1h 30m');
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Stay here' }));
    expect(cancel).toHaveBeenCalledOnce(); expect(confirm).not.toHaveBeenCalled();
  });
  it('explains the long wetland return as route time plus navigation, while retaining its total', () => {
    const delayed = { ...quote, totalSeconds: 28380, meta: { ...quote.meta, seconds: 6780,
      navDrift: { lost: true, driftDirection: 'W', extraSeconds: 21600, cause: 'wilds' as const } } };
    const confirm = vi.fn(), cancel = vi.fn();
    render(<LocalJourneyPreview quote={delayed} onConfirm={confirm} onCancel={cancel} />);
    expect(screen.getByText('Route time').nextElementSibling).toHaveTextContent('1h 53m');
    expect(screen.getByText('Navigation and delays').nextElementSibling).toHaveTextContent('6h');
    expect(screen.getByText('Total travel time').nextElementSibling).toHaveTextContent('7h 53m');
    expect(screen.queryByText(/drift W/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stay here' }));
    expect(cancel).toHaveBeenCalledOnce(); expect(confirm).not.toHaveBeenCalled();
  });
  it('includes event delays in the same quoted total', () => {
    render(<LocalJourneyPreview quote={{ ...quote, totalSeconds: 7200, meta: { ...quote.meta,
      seconds: 5400, tripEvent: { message: 'A fallen tree blocks the path.', extraSeconds: 1800 } } }} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Navigation and delays').nextElementSibling).toHaveTextContent('30 min');
    expect(screen.getByText('Total travel time').nextElementSibling).toHaveTextContent('2h');
    expect(screen.queryByText(/fallen tree/)).not.toBeInTheDocument();
  });
  it('keeps an undelayed trip simple', () => {
    render(<LocalJourneyPreview quote={{ ...quote, meta: { ...quote.meta, seconds: 5400 } }} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Travel time').nextElementSibling).toHaveTextContent('1h 30m');
    expect(screen.queryByText('Navigation and delays')).not.toBeInTheDocument();
  });
  it('refuses an unaffordable journey and permits an explicit affordable departure', () => {
    const confirm = vi.fn();
    const { rerender } = render(<LocalJourneyPreview quote={{ ...quote, allowed: false, refusal: 'Carry water.' }} onConfirm={confirm} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Set out on foot' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Carry water.');
    rerender(<LocalJourneyPreview quote={quote} onConfirm={confirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Set out on foot' }));
    expect(confirm).toHaveBeenCalledOnce();
  });
});
