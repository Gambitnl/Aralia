/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 01:25:32
 * Dependents: hooks/actions/handleEncounter.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file turns a lightweight encounter monster into a combat-ready enemy.
 *
 * The generated bestiary is large, so this adapter lives outside combatUtils.ts.
 * Most systems only need dice, distance, or damage helpers; they should not load
 * the whole monster registry unless a battle is actually being started.
 *
 * Called by: encounter start handlers and crime systems that need live enemies.
 * Depends on: runtimeMonsterRegistry for bestiary lookup, class data for fallback shape.
 */
import { CombatCharacter } from '../../types/combat';
import { Monster } from '../../types';
export declare function createEnemyFromMonster(monster: Monster, index: number): CombatCharacter;
