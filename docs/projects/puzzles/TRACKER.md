# Puzzles System Living Tracker

Status: active (PZ-007 runtime surface complete; PZ-003 key path next)
Last updated: 2026-06-27

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `review-required`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|---|
| T4 | done | Resolve `getPuzzleHint` runtime caller ownership | Worker A (decision: Remy 2026-06-10) | 2026-06-27 | `src/systems/puzzles/puzzleRuntime.ts`, `src/components/puzzles/PuzzleRuntimeModal.tsx`, `src/components/ActionPane/useActionGeneration.ts`, `src/data/world/locations.ts`, `src/components/puzzles/PuzzleRuntimeModal.test.tsx`, `src/systems/puzzles/__tests__/puzzleRuntime.test.ts`, `src/components/ActionPane/__tests__/ActionPane.test.tsx`, `.agent/scratch/proof/puzzles/runtime-surface/after/puzzle-runtime-modal-after.png` | Closed: puzzle-owned runtime surface exists, a real `puzzle` location feature opens it, and the rendered hint action calls the runtime hint surface. | Focused runtime and caller tests passed 2026-06-27. |
| T5 | active | Resolve key-based lock progression path (PZ-003) | Worker A | 2026-06-27 | `src/systems/puzzles/types.ts`, `src/systems/puzzles/lockSystem.ts`, `src/components/puzzles/LockpickingModal.tsx`, `docs/projects/puzzles/GAPS.md` PZ-003 | Decide whether key matching is puzzle-system owned or inventory-system owned, then make the unlock path deterministic. | One production-oriented acceptance test covering both pick and key paths. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G2 | not_started | support_needed_now | Worker A | `docs/projects/puzzles/GAPS.md` | Types + gameplay scan | Key-based unlock path exists in shape (`Lock.keyId`) but is not used by lock resolution. | `src/systems/puzzles/types.ts`, `src/systems/puzzles/lockSystem.ts`, `src/components/puzzles/LockpickingModal.tsx` | Unlock progression cannot depend on keys without an explicit contract. | Decide lock/key ownership and acceptance rule before continuing gameplay progression tasks. | Evidence of key-resolution contract in tests/docs. |
| G3 | not_started | support_needed_now | Worker A | `docs/projects/puzzles/GAPS.md` | Character contract scan | Multiple puzzle systems still use legacy fallback stats (`character.stats`) while TODOs in `types/character.ts` call for migration. | `src/systems/puzzles/*.ts`, `src/types/character.ts` | Mixed stat shapes increase drift risk as puzzle content expands. | Keep shim intact and define migration target before extending challenge outcomes. | Add migration check in first implementation slice and record completion evidence. |
| G5 | not_started | adjacent_follow_up | Worker A | `docs/projects/puzzles/GAPS.md` | Integration TODO sweep | BattleMap/Submap/Spell interaction for plates, secret doors, mechanisms, and arcane glyphs remains TODO-marked. | `src/systems/puzzles/mechanism.ts`, `secretDoorSystem.ts`, `pressurePlateSystem.ts`, `arcaneGlyphSystem.ts`, `docs/architecture/domains/puzzles-quests-rituals.md` | Without this integration, puzzle state changes are not reliably visualized in world space. | Schedule this as an explicit follow-up slice linked to map/encounter owners. | Keep this gap out of core runtime handoff until map integration path is accepted. |
| G6 | not_started | adjacent_follow_up | Worker A | `docs/projects/puzzles/GAPS.md` | Content pipeline follow-up | No verified puzzle registry or authored puzzle catalog source was discovered in targeted scan. | `rg -n "puzzle" src/data`, `src/systems/puzzles` | Without content registry source, runtime systems lack discoverable production population surface. | Confirm whether a content registry exists in generation/encounter pipeline and document it here before full content work. | Add registry path and owner, or route unresolved gap to global if clearly cross-project. |
| G7 | done | in_scope_now | Worker A (decision: Remy 2026-06-10) | `docs/projects/puzzles/GAPS.md` | Runtime caller scan | Dedicated puzzle-facing runtime surface is implemented. A real `puzzle` interactable feature now routes through `OPEN_PUZZLE_RUNTIME`, and `PuzzleRuntimeModal` calls `requestPuzzleHint` from the rendered hint action. | `src/systems/puzzles/puzzleRuntime.ts`, `src/components/puzzles/PuzzleRuntimeModal.tsx`, `src/components/ActionPane/useActionGeneration.ts`, `src/data/world/locations.ts`, focused tests, after screenshot in `.agent/scratch/proof/puzzles/runtime-surface/after/` | The domain API now has a player-facing gameplay caller for hints. | Closed 2026-06-27. | Focused tests passed and after screenshot captured. |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
