import type { TownPlan } from '../artifacts';

/**
 * This file defines the public data contract for Worldforge town rosters.
 *
 * A town plan says where buildings are; this roster says which deterministic
 * people live in those buildings and which adult residents work in markets or
 * workshops. Later schedule, faction, and economy passes can extend these
 * records without asking interior generation to invent people on its own.
 *
 * Called by: generateTownRoster and future ground/interior agent placement.
 * Depends on: TownPlan only for the plot role type alias below.
 */

// ============================================================================
// Occupant Contract
// ============================================================================
// This section describes one person in a generated town. The current slice
// keeps identity, name, age band, home, work, and broad occupation only because
// SPEC section 6 population details like schedules and factions are later passes.
// ============================================================================

export type AgeBand = 'child' | 'adult' | 'elder';

export type Occupation = 'resident' | 'shopkeeper' | 'artisan';

export interface Occupant {
  id: number;
  name: string;
  ageBand: AgeBand;
  homePlotId: number;
  workPlotId?: number;
  occupation: Occupation;
}

// ============================================================================
// Town-Level Contract
// ============================================================================
// The roster echoes the burg id from TownPlan so consumers can cache and compare
// it as the population artifact for one settlement.
// ============================================================================

export interface TownRoster {
  burgId: number;
  occupants: Occupant[];
}

// ============================================================================
// Local Aliases
// ============================================================================
// These aliases keep implementation files readable while preserving the source
// of truth in artifacts.ts.
// ============================================================================

export type TownPlot = TownPlan['plots'][number];
