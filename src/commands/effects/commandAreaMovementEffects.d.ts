/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 23:03:21
 * Dependents: commands/effects/MovementCommand.ts, commands/effects/UtilityCommand.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { CombatState, Position } from '@/types/combat';
/**
 * Applies area-trigger effects after a command moves a creature through spell zones.
 *
 * Normal voluntary movement runs through useActionExecutor and AreaEffectTracker.
 * Some spell commands update CombatState directly, so this helper gives those
 * command-side moves the same Spike Growth-style damage, healing, and status
 * behavior without inventing a second area-trigger system.
 */
export declare function applyCommandAreaMovementEffects(state: CombatState, characterId: string, previousPosition: Position, newPosition: Position, movementPath: Position[]): CombatState;
