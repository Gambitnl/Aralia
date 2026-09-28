import { describe, expect, it } from 'vitest';
import { CRAFTING_BENCH_ACTION_TYPES } from '../craftingActionContract';
import type { CraftingBenchAction } from '../actionTypes';
import { generateCraftingActions } from '../../systems/crafting/craftingEngine';
import { generateBatchCraftActions } from '../../systems/crafting/batchCrafting';

/**
 * Compile-time pin for the crafting generator signatures (agora-5789).
 *
 * WHY THIS EXISTS: `generateCraftingActions` and `generateBatchCraftActions` used to
 * declare `{ type: string; payload: unknown }[]`. That return type accepted a drifted
 * payload (rename `count` to `quantity` and the build stayed green while the reducer
 * dropped the item), which is why the runtime guard in `craftingActionContract.ts`
 * had to exist at all. Both now declare `CraftingBenchAction[]`, so the drift is a
 * compile error at the source.
 *
 * HOW IT FAILS: the assertions below are types, not values — widening either return
 * type back makes `assertExactly` fail to instantiate, so `npm run typecheck:files`
 * reports an error in this file. The runtime body pins the companion invariant: the
 * side-effect action types the generators emit must stay inside the contract table.
 */

/** True only when `A` and `B` are the same type, not merely mutually assignable. */
type IsExactly<A, B> =
    (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

/** Instantiating this with `false` is a compile error; that is the whole assertion. */
const assertExactly = <_Pinned extends true>(): void => {};

describe('crafting generator return types are narrowed to the declared union', () => {
    it('generateCraftingActions declares CraftingBenchAction[]', () => {
        assertExactly<IsExactly<ReturnType<typeof generateCraftingActions>, CraftingBenchAction[]>>();
        expect(typeof generateCraftingActions).toBe('function');
    });

    it('generateBatchCraftActions declares CraftingBenchAction[]', () => {
        assertExactly<IsExactly<ReturnType<typeof generateBatchCraftActions>, CraftingBenchAction[]>>();
        expect(typeof generateBatchCraftActions).toBe('function');
    });

    it('keeps every side-effect action the generators emit inside the contract table', () => {
        // Dropping one of these from the union would silently re-open the hole the
        // narrowing closes: the generator would stop compiling against a shape that
        // no longer describes what the reducer handles.
        expect(CRAFTING_BENCH_ACTION_TYPES).toEqual(
            expect.arrayContaining(['REMOVE_ITEM', 'MODIFY_GOLD', 'ADVANCE_TIME', 'ADD_ITEM'])
        );
    });
});
