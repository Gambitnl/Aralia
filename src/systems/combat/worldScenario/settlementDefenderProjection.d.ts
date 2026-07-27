/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/07/2026, 07:48:58
 * Dependents: systems/combat/worldScenario/worldBattleScenario.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file converts a regiment-scale WorldForge fact into a small gate patrol.
 *
 * A generated regiment can contain thousands of troops, while the combat map
 * needs a handful of individually playable actors. This adapter makes that
 * lossy conversion explicit: state alert sets the token budget, infantry and
 * archers are sampled proportionally, and unsupported mounted or siege roles
 * remain visible as excluded source facts instead of becoming generic guards.
 *
 * Called by: worldBattleScenario when framing a settlement-edge encounter
 * Depends on: Ground settlement-defense facts and BattleMap combat contracts
 */
import type { BattleMapDefendingForce, BattleMapSettlementHostility } from '@/types/combat';
import type { GroundSettlementDefense } from '@/systems/worldforge/bridge/settlementDefense';
export declare function projectSettlementDefendingForce(defense: GroundSettlementDefense, hostility?: BattleMapSettlementHostility): BattleMapDefendingForce | undefined;
