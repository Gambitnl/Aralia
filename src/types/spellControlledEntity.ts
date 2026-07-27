// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/07/2026, 15:30:59
 * Dependents: types/spells.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file describes controllable utility entities created by spells.
 *
 * It exists because spells such as Mage Hand create a persistent helper that can
 * be controlled later, move around, manipulate objects, and has explicit limits.
 * Those rules are not ordinary target choice and they are not combat summons, so
 * they need a small runtime shape of their own.
 *
 * Called by: `spells.ts` for the public spell contract.
 * Depends on: no other type modules.
 */

//==============================================================================
// Controlled Utility Entity Metadata
//==============================================================================
// These types describe a spell-created utility helper and what the caster can do
// with it while the spell remains active.
//==============================================================================

/** Describes a persistent spell-created utility helper such as Mage Hand, Unseen Servant, or Spiritual Weapon. */
export interface ControlledEntity {
  /** Source-backed entity label; runtime adapters narrow known executable kinds. */
  entityType?: string;
  count?: number;
  appearsAt?: string;
  durationScope?: string;
  controlActionType?: string;
  initialUseOnCast?: boolean;
  laterControlTiming?: string;
  movementDistance?: number;
  movementUnit?: string;
  maxDistanceFromCaster?: number;
  canAttack?: boolean;
  canActivateMagicItems?: boolean;
  carryCapacityPounds?: number | "not_applicable";
  allowedInteractions?: string[];
  endingTriggers?: string[];
  persistent?: boolean;
  duration?: string;
  position?: string;
  reachFeet?: number;
  moveAction?: string;
  moveDistanceFeet?: number;
  repeatAttack?: string;
  damage?: string;
  combatEntity?: boolean;
  actionModes?: string[];
  durability?: string;
  origin?: string;
  elementChoice?: string[];
  mechanicalRole?: string;
  control?: string;
  notes?: string;
  /** Preserve additional source-backed fields until their runtime lane owns them. */
  [key: string]: unknown;
}
