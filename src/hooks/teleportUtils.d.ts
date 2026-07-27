/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/06/2026, 11:57:48
 * Dependents: hooks/useAbilitySystem.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { Ability, Position } from '../types/combat';
import { Spell } from '../types/spells';
export declare const hasTeleportMovementEffect: (ability: Ability) => boolean;
export declare const addTeleportDestinationToSpell: (spell: Spell, destination: Position) => Spell;
export declare const addTeleportDestinationsToSpell: (spell: Spell, destinationsByTargetId: Record<string, Position>) => Spell;
export declare const requiresUnassignedTeleportDestination: (ability: Ability) => boolean;
