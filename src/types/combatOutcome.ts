// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 18:54:14
 * Dependents: components/Combat/CombatView.tsx, services/combatDefeatService.ts, utils/combat/battleEndActions.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { CombatLogEntry } from './combat';
import type { DungeonIdentity } from '../systems/worldforge/dungeon/world/deriveIdentity';

/** Public facts captured at acceptance, before the transient tactical roster is removed. */
export interface CombatOutcomeReview {
  result: 'victory' | 'defeat' | 'flee';
  party: Array<{
    id: string;
    name: string;
    currentHP: number;
    maxHP: number;
    deathSaves?: { successes: number; failures: number };
  }>;
  enemies: Array<{ id: string; name: string; currentHP: number; maxHP: number }>;
  /** The same bounded final events shown in the result review, not a reconstructed roll. */
  events: Array<Pick<CombatLogEntry, 'id' | 'timestamp' | 'type' | 'message'>>;
}

/** Saves retain the outcome's source alongside the complete post-combat GameState. */
export interface PersistedCombatOutcome extends CombatOutcomeReview {
  worldSeed: number;
  currentLocationId: string;
  gameTime: string;
  dungeon?: { identity: DungeonIdentity; encounterId: string; depth: number };
  /** Present only in a dedicated saved defeat; ordinary recovery saves remain independent. */
  chronicleSlotId?: string;
}
