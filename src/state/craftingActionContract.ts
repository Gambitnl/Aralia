/**
 * @file src/state/craftingActionContract.ts
 * Runtime guard for the crafting bench action contract (ui-features:G3).
 *
 * WHAT: a descriptor table that mirrors, field for field, the `CraftingBenchAction`
 * union declared in `./actionTypes.ts`, plus `isCraftingBenchAction` which checks a
 * candidate action against it.
 *
 * WHY: `generateCraftingActions` (systems/crafting/craftingEngine.ts) and
 * `generateBatchCraftActions` (systems/crafting/batchCrafting.ts) both used to return
 * `{ type: string; payload: unknown }[]`. `AlchemyBenchPanel` forwarded each element
 * to `dispatch` behind a cast, which meant the compiler could not see a drifted
 * payload: rename `count` to `quantity` in either generator and the code still builds,
 * while `inventoryReducer` quietly drops the item. The declared union cannot be checked
 * at runtime on its own (types are erased), so the shape lives here as data and the
 * `SHAPES` table is pinned to the union by the `satisfies` clause below — adding a
 * crafting action to `CraftingBenchAction` without describing it here is a type error.
 *
 * PRESERVED: this module only *reports*. It never rewrites or filters an action; the
 * panel keeps dispatching exactly what the engines produce so behavior is unchanged.
 *
 * RESOLVED (agora-5789): both generators now declare `CraftingBenchAction[]`, so a
 * drifted payload is a compile error at the source rather than a runtime report. This
 * guard is kept as the second line of defense — it still catches an action that reaches
 * the panel through an untyped path (a cast, stored JSON, a future generator) and names
 * the offending field instead of failing anonymously.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 13:27:01
 * Dependents: components/Crafting/AlchemyBenchPanel.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { CraftingBenchAction } from './actionTypes';
import type { CraftingQuality } from '../types/crafting';

/** Payload field checker. Returns true when the value satisfies the declared type. */
type FieldCheck = (value: unknown) => boolean;

interface ActionShape {
    /** Payload keys that must be present and valid. */
    required: Record<string, FieldCheck>;
    /** Payload keys that may be absent, but must be valid when present. */
    optional?: Record<string, FieldCheck>;
}

const isString: FieldCheck = (v) => typeof v === 'string';
const isBoolean: FieldCheck = (v) => typeof v === 'boolean';
/** Rejects NaN/Infinity too: a non-finite amount corrupts gold and XP silently. */
const isFiniteNumber: FieldCheck = (v) => typeof v === 'number' && Number.isFinite(v);
const isStringArray: FieldCheck = (v) => Array.isArray(v) && v.every(isString);

/** Mirrors `CraftingQuality` in types/crafting.ts. */
const CRAFTING_QUALITIES: readonly CraftingQuality[] = [
    'ruined',
    'flawed',
    'standard',
    'masterwork',
    'legendary'
];

/** Mirrors `CraftingCategory` in state/actionTypes.ts. */
const CRAFTING_CATEGORIES = ['potion', 'oil', 'poison', 'bomb', 'utility', 'ink'];

const isQuality: FieldCheck = (v) =>
    typeof v === 'string' && (CRAFTING_QUALITIES as readonly string[]).includes(v);
const isCategory: FieldCheck = (v) => typeof v === 'string' && CRAFTING_CATEGORIES.includes(v);

/**
 * One entry per member of `CraftingBenchAction`. The `satisfies` clause keys this
 * table to the union, so a new crafting action type cannot be added to the union
 * without also being described here.
 */
const SHAPES = {
    INIT_CRAFTING_STATE: { required: { toolProficiencies: isStringArray } },
    LEARN_RECIPE: { required: { recipeId: isString } },
    ADD_CRAFTING_XP: { required: { amount: isFiniteNumber } },
    UPDATE_CRAFTING_STATS: {
        required: { quality: isQuality, category: isCategory, isNat20: isBoolean }
    },
    UNLOCK_ACHIEVEMENT: { required: { achievementId: isString } },
    SET_CRAFTING_LOCATION: { required: { locationId: isString } },
    ADD_ITEM: { required: { itemId: isString }, optional: { count: isFiniteNumber } },
    REMOVE_ITEM: { required: { itemId: isString }, optional: { count: isFiniteNumber } },
    MODIFY_GOLD: { required: { amount: isFiniteNumber } },
    ADVANCE_TIME: { required: { seconds: isFiniteNumber } }
} satisfies Record<CraftingBenchAction['type'], ActionShape>;

/** Every action type the alchemy bench is allowed to dispatch. */
export const CRAFTING_BENCH_ACTION_TYPES = Object.keys(SHAPES) as CraftingBenchAction['type'][];

/**
 * Explains why a candidate action is not a valid `CraftingBenchAction`.
 * Returns `null` when the action matches its declared shape.
 *
 * Used by the contract test and by the panel's dev-mode warning, so the message
 * names the offending field rather than just failing.
 */
export function describeCraftingBenchActionMismatch(value: unknown): string | null {
    if (typeof value !== 'object' || value === null) {
        return `expected an action object, got ${value === null ? 'null' : typeof value}`;
    }

    const candidate = value as { type?: unknown; payload?: unknown };
    if (typeof candidate.type !== 'string') {
        return 'action has no string "type"';
    }

    const shape = (SHAPES as Record<string, ActionShape | undefined>)[candidate.type];
    if (!shape) {
        return `"${candidate.type}" is not part of the crafting bench action contract`;
    }

    if (typeof candidate.payload !== 'object' || candidate.payload === null) {
        return `${candidate.type}: payload must be an object`;
    }
    const payload = candidate.payload as Record<string, unknown>;

    for (const [key, check] of Object.entries(shape.required)) {
        if (!(key in payload)) return `${candidate.type}: payload is missing "${key}"`;
        if (!check(payload[key])) return `${candidate.type}: payload."${key}" has the wrong type`;
    }

    const optional = shape.optional ?? {};
    for (const [key, check] of Object.entries(optional)) {
        if (key in payload && payload[key] !== undefined && !check(payload[key])) {
            return `${candidate.type}: payload."${key}" has the wrong type`;
        }
    }

    // An unexpected key is the drift signature we care about most: a renamed field
    // leaves the old key absent (caught above only when required) and a new key here.
    for (const key of Object.keys(payload)) {
        if (!(key in shape.required) && !(key in optional)) {
            return `${candidate.type}: payload has unexpected key "${key}"`;
        }
    }

    return null;
}

/** Type guard form of {@link describeCraftingBenchActionMismatch}. */
export function isCraftingBenchAction(value: unknown): value is CraftingBenchAction {
    return describeCraftingBenchActionMismatch(value) === null;
}
