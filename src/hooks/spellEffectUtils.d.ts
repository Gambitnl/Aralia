/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 23/07/2026, 19:08:22
 * Dependents: commands/effects/DamageCommand.ts, hooks/useAbilitySystem.ts, systems/spells/effects/triggerHandler.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { SpellEffect, TerrainEffect, MovementEffect, Spell } from '../types/spells';
import type { RecurringMechanic } from '../types/spellEffectTypes';
/**
 * Normalize the source-compatible singleton form once at the runtime boundary.
 * Source data may keep one compact recurring record, while area and command
 * consumers need a stable collection. Unknown timing labels remain in the
 * returned records so a later event adapter can still inspect them.
 */
export declare const getRecurringMechanics: (effect: Pick<SpellEffect, "recurringMechanics">) => RecurringMechanic[];
export declare const getRuntimeRecurringMechanics: (effect: Pick<SpellEffect, "recurringMechanics">) => RecurringMechanic[];
/** Returns true when a composite area effect should wait for a later zone event. */
export declare const isDeferredAreaZoneTrigger: (effect: SpellEffect) => boolean;
export declare const hasPersistentAreaTrigger: (effect: SpellEffect) => boolean;
export declare const isTerrainEffect: (effect: SpellEffect) => effect is TerrainEffect;
export declare const hasScheduledEffectTrigger: (effect: SpellEffect) => boolean;
export declare const hasTargetMovementTrigger: (effect: SpellEffect) => boolean;
export declare const isMovementEffect: (effect: SpellEffect) => effect is MovementEffect;
export declare const getDurationRounds: (spell: Spell) => number | undefined;
