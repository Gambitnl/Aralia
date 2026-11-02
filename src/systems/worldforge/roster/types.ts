// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 02/11/2026, 21:55:43
 * Dependents: components/World3D/GroundAgents.tsx, components/World3D/InteriorOccupants.tsx, components/World3D/streetOwnedAgents.ts, components/Worldforge/TownAgentSnapshotView.tsx, components/Worldforge/VillagerRegistry.tsx, hooks/actions/handleWorldEvents.ts, systems/worldforge/body/generateBody.ts, systems/worldforge/bridge/groundAgentMotion.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/bridge/institutionOccupancy.ts, systems/worldforge/bridge/residentDoorRoutes.ts, systems/worldforge/bridge/shopKeeperOccupancy.ts, systems/worldforge/roster/agentDeepening.ts, systems/worldforge/roster/agentLife.ts, systems/worldforge/roster/agentSim.ts, systems/worldforge/roster/employment.ts, systems/worldforge/roster/errands.ts, systems/worldforge/roster/family.ts, systems/worldforge/roster/generateTownRoster.ts, systems/worldforge/roster/institutionWorkplaces.ts, systems/worldforge/roster/occupantSchedule.ts, systems/worldforge/roster/relationshipWeb.ts, systems/worldforge/roster/ruralHouseholds.ts, systems/worldforge/roster/townSnapshot.ts, systems/worldforge/town/historicalTownLayout.ts, systems/worldforge/town/household.ts, systems/worldforge/town/prepareHistoricalTownLoad.ts, systems/worldforge/townsim/keyNpcs.ts, systems/worldforge/townsim/shopLife.ts, systems/worldforge/townsim/townSim.ts, systems/worldforge/townsim/townSimRegistration.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { TownPlan } from "../artifacts";
import type {HouseholdMember} from '../town/household';
import type { PublicHouseWorkRole } from './workHours';

/**
 * This file defines the public data contract for Worldforge town rosters.
 *
 * A town plan says where buildings are; this roster says which deterministic
 * people live in those buildings and which adult residents work in markets or
 * workshops. Qualified civic duties keep a separate destination and do not
 * turn their holder into a shopkeeper. Later faction and economy passes can extend these
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

export type AgeBand = "child" | "adult" | "elder";

export type Occupation = "resident" | "shopkeeper" | "artisan";

export interface Occupant {
  id: number;
  name: string;
  /**
   * Stable named-household identity when this roster person comes from the
   * lazy household pipeline. Servants use it today; later family unification
   * can adopt the same key without changing existing numeric roster ids.
   */
  householdMemberId?: string;
  /** Explicit admitted farm source. Original member facts are not a new
   * ownership grant or a physically qualified field-work destination. */
  ruralHousehold?: {
    farmId: string;
    farmParcelIndex: number;
    member: Pick<HouseholdMember,'age'|'race'|'role'|'occupation'>;
  };
  ageBand: AgeBand;
  homePlotId: number;
  workPlotId?: number;
  /** Qualified proprietor job, joined through the workplace's actual owner
   * home. Its hours do not change family identity, home or business ownership. */
  publicHouseWorkRole?: PublicHouseWorkRole;
  /** Source-backed institutional duty, separate from a merchant/business identity.
   * The physical bridge admits this only with the current holder and a clear
   * source station; it never changes home, trade, family or NPC memory keys. */
  civicWorkplace?: {role: 'priest' | 'librarian'; plotId: number};
  /** NPC lives (GG-600): the workplace this person earns a living at, read
   * from the town engine's home-to-work links (`roster/employment.ts`). A
   * staff member, a family helper or a day labourer. It is NOT `workPlotId`:
   * that field still marks only the business keeper, whom merchant ids,
   * stock and shop succession join on. It never changes home or identity. */
  employment?: {plotId: number; role: 'proprietor' | 'staff' | 'labourer'};
  /** A retired proprietor retains the business identity without a daily shift. */
  retired?: boolean;
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

export type TownPlot = TownPlan["plots"][number];
