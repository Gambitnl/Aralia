import { describe, it, expect } from 'vitest';
import {
  formatTravelTime,
  formatDistance,
  dangerRating,
  formatRouteSummary,
  formatProvisionLine,
  formatMultiModalSummary,
  ferryFare,
  FERRY_BOARDING_FEE_GP,
  FERRY_PER_SEA_MILE_GP,
} from '../travelReadout';
import type { RoutePlan } from '../routePlanning';
import type { MultiModalRoute } from '../multiModalRoute';
import type { ProvisionStatus } from '../provisioning';
import { routeHasFaintPath } from '../navDrift';
import { characterReducer } from '../../../state/reducers/characterReducer';
import type { GameState } from '../../../types/state';
import type { AppAction } from '../../../state/actionTypes';

describe('formatTravelTime', () => {
  it('formats minutes / hours / days', () => {
    expect(formatTravelTime(15)).toBe('15 min');
    expect(formatTravelTime(60)).toBe('1h');
    expect(formatTravelTime(380)).toBe('6h 20m');
    expect(formatTravelTime(24 * 60)).toBe('1d');
    expect(formatTravelTime(52 * 60)).toBe('2d 4h');
    expect(formatTravelTime(-5)).toBe('0 min');
  });
});

describe('formatDistance', () => {
  it('uses one decimal under 10 miles, whole miles above', () => {
    expect(formatDistance(0.4)).toBe('0.4 mi');
    expect(formatDistance(19.3)).toBe('19 mi');
  });
});

describe('dangerRating', () => {
  it('buckets 0..1 into labelled levels (clamped)', () => {
    expect(dangerRating(0).level).toBe('Safe');
    expect(dangerRating(0.2).level).toBe('Low');
    expect(dangerRating(0.4).level).toBe('Moderate');
    expect(dangerRating(0.6).level).toBe('High');
    expect(dangerRating(0.9).level).toBe('Perilous');
    expect(dangerRating(5).level).toBe('Perilous'); // clamped
    expect(dangerRating(0.4).color).toMatch(/^#/);
  });
});

describe('formatRouteSummary', () => {
  it('builds the one-line travel readout', () => {
    const route: RoutePlan = { cells: [0, 1, 2], points: [[0, 0]], miles: 19.3, minutes: 380, danger: 0.4 };
    expect(formatRouteSummary(route, 'on foot')).toBe('≈ 6h 20m · ~19 mi · Danger: Moderate · on foot');
    expect(formatRouteSummary(route, 'by horse')).toContain('by horse');
  });
});

// ── Faint-path warning (roads task 10) ──────────────────────────────────────
// The readout warns BEFORE the player commits to a route that follows a faint
// forest path (the trail can fade → a get-lost roll on the committed trip).
describe('formatRouteSummary (faint-path warning)', () => {
  it('warns when a route follows a faint forest path', () => {
    const route: RoutePlan = { cells: [1], points: [[0, 0]], miles: 5, minutes: 100, danger: 0.2 };
    expect(formatRouteSummary(route, 'on foot', { faintPath: true }))
      .toContain('follows a faint forest path');
    expect(formatRouteSummary(route)).not.toContain('faint');
  });

  it('routeHasFaintPath detects any faint-path cell', () => {
    const info = (c: number) => (c === 2
      ? { dc: 8, cause: 'faint-path' as const }
      : { dc: 0, cause: 'road' as const });
    expect(routeHasFaintPath(info, [1, 2, 3])).toBe(true);
    expect(routeHasFaintPath(info, [1, 3])).toBe(false);
  });
});

// ── Named-forest naming (forests task 7) ────────────────────────────────────
// When the route crosses a named forest, the summary names the wood so the
// player reads "through the <Name>" before committing to the trip.
describe('formatRouteSummary (named forest)', () => {
  const route: RoutePlan = { cells: [0, 1, 2], points: [[0, 0]], miles: 19.3, minutes: 380, danger: 0.4 };

  it('appends the forest segment when forestName is set', () => {
    expect(formatRouteSummary(route, 'on foot', { forestName: 'Angshire Wraithwood' }))
      .toBe('≈ 6h 20m · ~19 mi · Danger: Moderate · on foot · through the Angshire Wraithwood');
  });

  it('orders the faint-path warning first, then the forest segment, when both opts are set', () => {
    expect(formatRouteSummary(route, 'on foot', { faintPath: true, forestName: 'Bigwood' }))
      .toBe('≈ 6h 20m · ~19 mi · Danger: Moderate · on foot · follows a faint forest path · through the Bigwood');
  });

  it('leaves the summary byte-identical when opts are absent, empty, or unset', () => {
    const plain = '≈ 6h 20m · ~19 mi · Danger: Moderate · on foot';
    expect(formatRouteSummary(route, 'on foot')).toBe(plain);
    expect(formatRouteSummary(route, 'on foot', {})).toBe(plain);
    expect(formatRouteSummary(route, 'on foot', { forestName: undefined })).toBe(plain);
  });
});

// ── Named-pass naming (mountains task 4) ────────────────────────────────────
// When the route crests a named mountain pass, the summary says "via <Name>".
// One flavor clause max: a pass outranks a named forest, whose clause drops.
describe('formatRouteSummary (named pass)', () => {
  const route: RoutePlan = { cells: [0, 1, 2], points: [[0, 0]], miles: 19.3, minutes: 380, danger: 0.4 };

  it('appends "via <Name>" when passName is set', () => {
    expect(formatRouteSummary(route, 'on foot', { passName: 'Ironteeth Pass' }))
      .toBe('≈ 6h 20m · ~19 mi · Danger: Moderate · on foot · via Ironteeth Pass');
  });

  it('pass WINS over forest — the forest clause is dropped (one flavor clause max)', () => {
    const both = formatRouteSummary(route, 'on foot', { passName: 'Ironteeth Pass', forestName: 'Bigwood' });
    expect(both).toBe('≈ 6h 20m · ~19 mi · Danger: Moderate · on foot · via Ironteeth Pass');
    expect(both).not.toContain('through the');
  });

  it('orders the faint-path warning first, then the pass clause', () => {
    expect(formatRouteSummary(route, 'on foot', { faintPath: true, passName: 'Ironteeth Pass', forestName: 'Bigwood' }))
      .toBe('≈ 6h 20m · ~19 mi · Danger: Moderate · on foot · follows a faint forest path · via Ironteeth Pass');
  });

  it('stays byte-identical when passName is absent — the forest clause survives', () => {
    expect(formatRouteSummary(route, 'on foot', { passName: undefined, forestName: 'Bigwood' }))
      .toBe('≈ 6h 20m · ~19 mi · Danger: Moderate · on foot · through the Bigwood');
    expect(formatRouteSummary(route, 'on foot', { passName: undefined }))
      .toBe('≈ 6h 20m · ~19 mi · Danger: Moderate · on foot');
  });
});

// ── Ferry fares (travel G15) ────────────────────────────────────────────────
const mmRoute = (over: Partial<MultiModalRoute>): MultiModalRoute => ({
  cells: [0, 1, 2],
  points: [[0, 0], [1, 0], [2, 0]],
  segments: [],
  miles: 40,
  landMiles: 10,
  seaMiles: 30,
  minutes: 600,
  danger: 0.3,
  ...over,
});

describe('ferryFare', () => {
  it('charges nothing for an all-land route (zero sea miles)', () => {
    expect(ferryFare(mmRoute({ seaMiles: 0 }))).toBe(0);
    expect(ferryFare({ seaMiles: 0 })).toBe(0);
  });

  it('scales up with sea miles: more open water → higher fare', () => {
    const shortHop = ferryFare(mmRoute({ seaMiles: 10 }));
    const longCrossing = ferryFare(mmRoute({ seaMiles: 30 }));
    expect(longCrossing).toBeGreaterThan(shortHop);
    // boarding fee + per-mile rate, rounded up to whole gp
    expect(shortHop).toBe(Math.ceil(FERRY_BOARDING_FEE_GP + 10 * FERRY_PER_SEA_MILE_GP));
    expect(longCrossing).toBe(Math.ceil(FERRY_BOARDING_FEE_GP + 30 * FERRY_PER_SEA_MILE_GP));
  });

  it('is a positive whole number for any sea crossing (deterministic + pure)', () => {
    const fare = ferryFare(mmRoute({ seaMiles: 31 }));
    expect(Number.isInteger(fare)).toBe(true);
    expect(fare).toBeGreaterThan(0);
    // pure: same input → same output
    expect(ferryFare(mmRoute({ seaMiles: 31 }))).toBe(fare);
  });
});

describe('formatMultiModalSummary (fare)', () => {
  it('appends the fare only when a positive fare is supplied', () => {
    const route = mmRoute({ seaMiles: 30 });
    const withFare = formatMultiModalSummary(route, { fareGp: ferryFare(route) });
    expect(withFare).toContain(`Fare: ${ferryFare(route)} gp`);
    expect(withFare).toContain('land');
    expect(withFare).toContain('sea');
  });

  it('omits the fare for an owned ship / all-land trip (no fare supplied or zero)', () => {
    const route = mmRoute({ seaMiles: 30 });
    expect(formatMultiModalSummary(route)).not.toContain('Fare');
    expect(formatMultiModalSummary(route, { fareGp: 0 })).not.toContain('Fare');
    expect(formatMultiModalSummary(route, { fareGp: null })).not.toContain('Fare');
  });
});

describe('formatMultiModalSummary (tender leg)', () => {
  it('appends the tender distance only when tenderMiles > 0', () => {
    const route = mmRoute({ landMiles: 10, seaMiles: 30, tenderMiles: 0.3 });
    const summary = formatMultiModalSummary(route);
    expect(summary).toContain('10 mi land');
    expect(summary).toContain('30 mi sea');
    expect(summary).toContain('0.3 mi tender');
    // ordering: tender sits between the sea distance and the danger label
    expect(summary).toMatch(/sea \+ 0\.3 mi tender · Danger:/);
  });

  it('omits the tender piece when tenderMiles is 0 or undefined', () => {
    expect(formatMultiModalSummary(mmRoute({ tenderMiles: 0 }))).not.toContain('tender');
    expect(formatMultiModalSummary(mmRoute({ tenderMiles: undefined }))).not.toContain('tender');
    // default fixture has no tenderMiles at all
    expect(formatMultiModalSummary(mmRoute({}))).not.toContain('tender');
  });

  it('keeps the fare label alongside a tender leg', () => {
    const route = mmRoute({ seaMiles: 30, tenderMiles: 0.4 });
    const summary = formatMultiModalSummary(route, { fareGp: ferryFare(route) });
    expect(summary).toContain('0.4 mi tender');
    expect(summary).toContain(`Fare: ${ferryFare(route)} gp`);
  });
});

describe('ferry fare — affordability + deduction on departure', () => {
  it('an empty purse cannot afford a sea crossing (unaffordable gate condition)', () => {
    const fare = ferryFare(mmRoute({ seaMiles: 30 }));
    const purse = 3; // less than the crossing fare
    expect(purse < fare).toBe(true); // MapPane rejects the pick in this state
  });

  it('deducts the fare from party gold on departure (MODIFY_GOLD path)', () => {
    const fare = ferryFare(mmRoute({ seaMiles: 30 }));
    // App.handleTileClick dispatches MODIFY_GOLD with -ferryFareGp on a committed
    // ferry trip; prove the primitive reduces the purse by exactly the fare.
    const state = { gold: 100 } as unknown as GameState;
    const action = { type: 'MODIFY_GOLD', payload: { amount: -fare } } as AppAction;
    const next = characterReducer(state, action);
    expect(next.gold).toBe(100 - fare);
  });

  it('never drives gold negative when the fare exceeds the purse (clamp)', () => {
    const fare = ferryFare(mmRoute({ seaMiles: 30 }));
    const state = { gold: 1 } as unknown as GameState;
    const action = { type: 'MODIFY_GOLD', payload: { amount: -fare } } as AppAction;
    expect(characterReducer(state, action).gold).toBe(0);
  });
});

describe('formatProvisionLine', () => {
  const status = (over: Partial<ProvisionStatus>): ProvisionStatus => ({
    inRange: true,
    shortfallDays: 0,
    severity: 'none',
    foodRangeDays: 0,
    tripDays: 0,
    ...over,
  });

  it('reads OK and shows the food range when in range', () => {
    const line = formatProvisionLine(status({ inRange: true, foodRangeDays: 6, tripDays: 4 }));
    expect(line.text).toContain('Food: 6 days');
    expect(line.ok).toBe(true);
    expect(line.color).toBe('#22c55e');
  });

  it('reads the shortfall and an amber color when minor-short', () => {
    const line = formatProvisionLine(
      status({ inRange: false, shortfallDays: 2, severity: 'minor', foodRangeDays: 3, tripDays: 5 }),
    );
    expect(line.text).toContain('short 2 days');
    expect(line.ok).toBe(false);
    expect(line.color).toBe('#eab308');
  });

  it('uses a red color when major-short', () => {
    const line = formatProvisionLine(
      status({ inRange: false, shortfallDays: 5, severity: 'major', foodRangeDays: 1, tripDays: 6 }),
    );
    expect(line.color).toBe('#ef4444');
  });

  it('singularizes a one-day range and a one-day shortfall', () => {
    const line = formatProvisionLine(
      status({ inRange: false, shortfallDays: 1, severity: 'minor', foodRangeDays: 1, tripDays: 2 }),
    );
    expect(line.text).toBe('Food: 1 day · short 1 day');
  });

  it('labels the binding resource when water runs out first (E1)', () => {
    const line = formatProvisionLine({
      inRange: false,
      shortfallDays: 2,
      severity: 'major',
      foodRangeDays: 2,
      tripDays: 4,
      binding: 'water',
    });
    expect(line.text).toContain('Water: 2 days');
    expect(line.text).toContain('short 2 days');
  });
});
