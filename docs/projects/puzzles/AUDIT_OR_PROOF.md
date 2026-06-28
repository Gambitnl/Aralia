# Puzzles System Audit and Proof

Status: active
Last updated: 2026-06-27

## Iteration 3: First Production Lockpicking Dispatch (T2/PZ-001)

### Method

Direct file inspection and assertion-based test verification:

- `docs/projects/puzzles/TRACKER.md`
- `docs/projects/puzzles/GAPS.md`
- `src/data/world/locations.ts`
- `src/types/world.ts`
- `src/components/ActionPane/useActionGeneration.ts`
- `src/hooks/actions/actionHandlers.ts`
- `src/components/ActionPane/__tests__/ActionPane.test.tsx`

### Results

| Item | Result | Evidence |
|---|---|---|
| Dispatch source exists outside dev-only flow | [Done] | `Location` data now includes `interactableFeatures` on `cave_entrance` with lock payload |
| Action generation includes lock feature path | [Done] | `OPEN_LOCKPICKING_MODAL` action emitted in `useActionGeneration` |
| Action handler updates UI state | [Done] | `actionHandlers.ts` forwards `OPEN_LOCKPICKING_MODAL` to `OPEN_LOCKPICKING_MODAL` app action |
| Type contracts updated for lock action and feature payload | [Done] | `src/types/actions.ts`, `src/types/actions.d.ts`, `src/types/world.ts`, `src/types/world.d.ts` |
| Test proves real UI route + payload | [Done] | `ActionPane.test.tsx` validates clicking lock action dispatches expected payload |

### Conclusion

`PZ-001` is complete as a bounded in-scope implementation. Remaining open gaps are
`PZ-002`, `PZ-003`, `PZ-004`, `PZ-005`, and `PZ-006`.

## Iteration 4: Live Puzzle Hint Helper and Caller Gap Split

### Method

Scoped source review and deterministic unit test verification:

- `docs/projects/puzzles/NORTH_STAR.md`
- `docs/projects/puzzles/TRACKER.md`
- `docs/projects/puzzles/GAPS.md`
- `src/systems/puzzles/puzzleSystem.ts`
- `src/systems/puzzles/__tests__/puzzleSystem.test.ts`

### Results

| Item | Result | Evidence |
|---|---|---|
| `getPuzzleHint` no longer returns `null` when a hint exists | [Done] | The helper now rolls a live Intelligence check using `CharacterStats.intelligence` and delegates to `checkPuzzleHint` |
| Deterministic test proves at least one puzzle can return a hint | [Done] | `puzzleSystem.test.ts` stubs `Math.random`, feeds a valid `CharacterStats`, and expects the riddle hint to return |
| Remaining caller gap is recorded separately | [Done] | `GAPS.md` and `TRACKER.md` now point to the missing runtime caller as the next follow-up instead of treating the helper as dead |

### Conclusion

`PZ-002` is resolved at the helper layer. `PZ-007` now carries the remaining runtime caller follow-up so the next agent does not mistake the helper fix for full gameplay integration.

## Iteration 5: Puzzle Hint Caller Ownership Review

### Method

Targeted source scan and dashboard/doc review only:

- `docs/projects/puzzles/NORTH_STAR.md`
- `docs/projects/puzzles/TRACKER.md`
- `docs/projects/puzzles/GAPS.md`
- `docs/projects/puzzles/COLD_START_AGENT_PROMPT.md`
- `src/components/puzzles/LockpickingModal.tsx`
- `src/components/layout/GameModals.tsx`
- `src/hooks/actions/actionHandlers.ts`
- `src/systems/puzzles/puzzleSystem.ts`
- `src/systems/puzzles/__tests__/puzzleSystem.test.ts`

### Results

| Item | Result | Evidence |
|---|---|---|
| Live helper still works | [Done] | `getPuzzleHint` remains covered by the deterministic unit test from the previous iteration |
| No runtime gameplay caller exists yet | [Done] | Search found no source-backed caller that passes a real `Puzzle` object into `getPuzzleHint` |
| Gap is now review-required instead of half-assigned | [Done] | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` now carry the human decision brief and the blocked gap row |

### Conclusion

The helper is still preserved, but the next safe step is a human ownership decision on the first runtime hint caller before any key or map follow-up work.

## Iteration 6: Puzzle Runtime Surface and First Hint Caller

### Method

Focused implementation, rendered proof, and assertion-based verification:

- `src/systems/puzzles/puzzleRuntime.ts`
- `src/components/puzzles/PuzzleRuntimeModal.tsx`
- `src/components/ActionPane/useActionGeneration.ts`
- `src/hooks/actions/actionHandlers.ts`
- `src/state/actionTypes.ts`
- `src/state/reducers/uiReducer.ts`
- `src/data/world/locations.ts`
- `src/systems/puzzles/__tests__/puzzleRuntime.test.ts`
- `src/components/puzzles/PuzzleRuntimeModal.test.tsx`
- `src/components/ActionPane/__tests__/ActionPane.test.tsx`

### Results

| Item | Result | Evidence |
|---|---|---|
| Puzzle-owned runtime surface exists | [Done] | `requestPuzzleHint` wraps the existing `getPuzzleHint` helper in a gameplay result envelope |
| First source-backed gameplay caller exists | [Done] | `cave_chamber.interactableFeatures[].type === 'puzzle'` emits `OPEN_PUZZLE_RUNTIME` through `useActionGeneration` |
| Rendered UI caller asks the runtime for a hint | [Done] | `PuzzleRuntimeModal` calls `requestPuzzleHint` from the `Ask for Hint` button |
| Focused tests prove route and behavior | [Done] | `npm exec vitest run src/systems/puzzles/__tests__/puzzleRuntime.test.ts src/components/puzzles/PuzzleRuntimeModal.test.tsx src/components/ActionPane/__tests__/ActionPane.test.tsx` passed 2026-06-27 |
| Visual proof captured | [Done] | Before: `.agent/scratch/proof/puzzles/runtime-surface/before/pre-runtime-surface-app.png`; after: `.agent/scratch/proof/puzzles/runtime-surface/after/puzzle-runtime-modal-after.png` |

### Conclusion

`PZ-007` was completed as a bounded slice. At that time, the next documented
step was `PZ-003`: decide and implement deterministic key-based lock progression
without widening into full map integration or puzzle solving UI.

## Iteration 7: Deterministic Key-Based Lock Runtime Contract

### Method

Focused runtime implementation, red-green unit proof, and project-doc alignment:

- `src/systems/puzzles/types.ts`
- `src/systems/puzzles/types.d.ts`
- `src/systems/puzzles/lockSystem.ts`
- `src/systems/puzzles/__tests__/lockSystem.test.ts`
- `docs/projects/puzzles/NORTH_STAR.md`
- `docs/projects/puzzles/TRACKER.md`
- `docs/projects/puzzles/GAPS.md`

### Results

| Item | Result | Evidence |
|---|---|---|
| Ownership rule is explicit | [Done] | Puzzle runtime owns deterministic comparison of caller-supplied key ids against `Lock.keyId`; inventory/economy sourcing remains outside this slice |
| Key path exists in runtime | [Done] | `attemptKeyUnlock` returns a `KeyUnlockResult` for already-open, no-key, missing-key, and matching-key cases |
| Existing pick path still works | [Done] | `lockSystem.test.ts` proves `attemptLockpick` still succeeds for the existing thieves'-tools route |
| Key path unlocks only with the matching key id | [Done] | `lockSystem.test.ts` proves a missing key fails and a matching key succeeds deterministically |

### Conclusion

`PZ-003` is complete for the puzzle-runtime contract. The project remains active;
visible modal key use, inventory key sourcing, and any item/economy registry work
remain future bounded slices.

## Iteration 8: Modern-First Character Ability Bridge (PZ-004)

### Method

Focused red-green runtime implementation, dependency-header sync, and project-doc alignment:

- `src/systems/puzzles/characterAbilityBridge.ts`
- `src/systems/puzzles/lockSystem.ts`
- `src/systems/puzzles/pressurePlateSystem.ts`
- `src/systems/puzzles/secretDoorSystem.ts`
- `src/systems/puzzles/arcaneGlyphSystem.ts`
- `src/systems/puzzles/__tests__/lockSystem.test.ts`
- `docs/projects/puzzles/NORTH_STAR.md`
- `docs/projects/puzzles/TRACKER.md`
- `docs/projects/puzzles/GAPS.md`

### Results

| Item | Result | Evidence |
|---|---|---|
| Migration target is explicit | [Done] | `getPuzzleCharacterStats` prefers `finalAbilityScores`, then `abilityScores`, and uses legacy `character.stats` only as compatibility fallback |
| Duplicated runtime shims are removed | [Done] | Lock, pressure plate, secret door, and arcane glyph checks now use the shared bridge instead of local `getLegacyStats` helpers |
| Modern-preferred path is proven | [Done] | `lockSystem.test.ts` fails under legacy-first behavior and passes when `finalAbilityScores.Dexterity` drives lockpicking |
| Legacy fallback remains compatible | [Done] | `lockSystem.test.ts` keeps a modern-missing fixture working through legacy `stats` |

### Conclusion

`PZ-004` is complete for puzzle runtime checks. The remaining project gaps are
integration/content follow-ups; caller-side stat adapters should be kept aligned
with this bridge when those UI or runtime surfaces are next touched.
