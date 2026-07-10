import { describe, it, expect } from 'vitest';
import type { RoutePlan } from '../routePlanning';
import { segmentRoute, type CellKind } from '../multiModalRoute';
import {
  dockSizeForPort,
  dockClassFitsPort,
  dockClassForVehicle,
  dockClassForShipSize,
  DOCK_MEDIUM_MIN_POP,
  DOCK_LARGE_MIN_POP,
} from '../dockTiers';
import { STANDARD_VEHICLES } from '../../../types/travel';

/**
 * Travel G14: ports have a dock size derived from what the burg already carries,
 * water vehicles have a dock class, and a ship too large for the destination dock
 * adds a short tender leg (row ashore) instead of berthing directly.
 */

describe('dockSizeForPort', () => {
  it('reads a tiny fishing village as a small dock', () => {
    expect(dockSizeForPort({ population: 0.05 })).toBe('small');
    expect(dockSizeForPort(undefined)).toBe('small');
  });

  it('promotes a capital to at least a medium dock even when small', () => {
    expect(dockSizeForPort({ population: 0.4, capital: 1 })).toBe('medium');
  });

  it('reads a market town at the medium threshold as a medium dock', () => {
    expect(dockSizeForPort({ population: DOCK_MEDIUM_MIN_POP })).toBe('medium');
    expect(dockSizeForPort({ population: DOCK_MEDIUM_MIN_POP - 0.01 })).toBe('small');
  });

  it('reads a city at the large threshold as a large dock', () => {
    expect(dockSizeForPort({ population: DOCK_LARGE_MIN_POP })).toBe('large');
    expect(dockSizeForPort({ population: DOCK_LARGE_MIN_POP + 5 })).toBe('large');
  });
});

describe('dock class lookups', () => {
  it('classes the standard water vehicles', () => {
    expect(dockClassForVehicle(STANDARD_VEHICLES.rowboat)).toBe('small');
    expect(dockClassForVehicle(STANDARD_VEHICLES.keelboat)).toBe('small');
    expect(dockClassForVehicle(STANDARD_VEHICLES.galley)).toBe('large');
    expect(dockClassForVehicle(STANDARD_VEHICLES.warship)).toBe('large');
    expect(dockClassForVehicle(undefined)).toBe('small');
  });

  it('maps owned-ship sizes onto the dock scale', () => {
    expect(dockClassForShipSize('Tiny')).toBe('small');
    expect(dockClassForShipSize('Large')).toBe('large');
    expect(dockClassForShipSize('Gargantuan')).toBe('large');
  });
});

describe('dockClassFitsPort', () => {
  it('lets a large ship berth at a large dock but not a small one', () => {
    expect(dockClassFitsPort('large', 'large')).toBe(true);
    expect(dockClassFitsPort('large', 'medium')).toBe(false);
    expect(dockClassFitsPort('large', 'small')).toBe(false);
  });

  it('lets a small craft berth anywhere', () => {
    expect(dockClassFitsPort('small', 'small')).toBe(true);
    expect(dockClassFitsPort('small', 'large')).toBe(true);
  });
});

// A route that walks over land, crosses water, and lands at a port cell (id 4).
const seaArrival: RoutePlan = {
  cells: [0, 1, 2, 3, 4],
  points: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  miles: 4,
  minutes: 200,
  danger: 0.2,
};
// cells 0,1 land · 2,3 sea · 4 destination port (land).
const kindOf = (cell: number): CellKind => (cell === 2 || cell === 3 ? 'sea' : 'land');

describe('segmentRoute tender legs', () => {
  it('inserts a tender leg when a large ship lands at a small dock', () => {
    const result = segmentRoute(seaArrival, kindOf, 1, {
      tender: { vehicleDockClass: 'large', dockSizeOf: () => 'small' },
    });

    expect(result.segments.map((s) => s.kind)).toEqual(['land', 'sea', 'tender']);
    expect(result.tenderMiles).toBeCloseTo(1, 5);
    expect(result.landMiles).toBeCloseTo(1, 5); // the arrival edge moved to tender
    expect(result.seaMiles).toBeCloseTo(2, 5);
  });

  it('berths directly (no tender) when the destination dock is large enough', () => {
    const result = segmentRoute(seaArrival, kindOf, 1, {
      tender: { vehicleDockClass: 'large', dockSizeOf: () => 'large' },
    });

    expect(result.segments.map((s) => s.kind)).toEqual(['land', 'sea', 'land']);
    expect(result.tenderMiles).toBe(0);
    expect(result.landMiles).toBeCloseTo(2, 5);
  });

  it('never adds a tender for a small craft, even at a small dock', () => {
    const result = segmentRoute(seaArrival, kindOf, 1, {
      tender: { vehicleDockClass: 'small', dockSizeOf: () => 'small' },
    });

    expect(result.segments.some((s) => s.kind === 'tender')).toBe(false);
    expect(result.tenderMiles).toBe(0);
  });

  it('leaves routes unchanged when no tender options are supplied', () => {
    const result = segmentRoute(seaArrival, kindOf, 1);
    expect(result.segments.map((s) => s.kind)).toEqual(['land', 'sea', 'land']);
    expect(result.tenderMiles).toBe(0);
  });

  it('is deterministic', () => {
    const opts = { tender: { vehicleDockClass: 'large' as const, dockSizeOf: () => 'small' as const } };
    const a = segmentRoute(seaArrival, kindOf, 1, opts);
    const b = segmentRoute(seaArrival, kindOf, 1, opts);
    expect(a).toEqual(b);
  });
});
