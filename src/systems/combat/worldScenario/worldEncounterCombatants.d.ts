/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/07/2026, 07:49:33
 * Dependents: components/DesignPreview/steps/PreviewBattleMapScenarioLab.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file turns an inspectable WorldForge defending-force receipt into the
 * normal CombatCharacter records used by the playable battle map.
 *
 * The projection policy has already chosen roles and counts. This adapter only
 * loads matching bestiary mechanics and stamps stable source provenance onto
 * each actor, so the visual harness exercises real attacks, HP, initiative, and
 * movement without returning to the generic combat-demo enemy roster.
 *
 * Called by: PreviewBattleMapScenarioLab before mounting BattleMapDemo
 * Depends on: the runtime monster registry and the standard enemy converter
 */
import type { BattleMapDefendingForce, CombatCharacter } from '@/types/combat';
export declare function createWorldDefenderCombatants(force: BattleMapDefendingForce | undefined): Promise<CombatCharacter[]>;
