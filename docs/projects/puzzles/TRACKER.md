# Puzzles System Living Tracker

Status: active (PZ-004 character stat bridge complete; map/content follow-ups remain)
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
| T5 | done | Resolve key-based lock progression path (PZ-003) | Worker A | 2026-06-27 | `src/systems/puzzles/types.ts`, `src/systems/puzzles/types.d.ts`, `src/systems/puzzles/lockSystem.ts`, `src/systems/puzzles/__tests__/lockSystem.test.ts`, `docs/projects/puzzles/GAPS.md` PZ-003 | Closed: puzzle lock runtime owns deterministic key matching against caller-supplied key ids. Inventory/economy sourcing stays outside this slice. | Focused lock system test passed 2026-06-27. |
| T6 | done | Resolve legacy character fallback migration target (PZ-004) | Worker A | 2026-06-27 | `src/systems/puzzles/characterAbilityBridge.ts`, `src/systems/puzzles/lockSystem.ts`, `src/systems/puzzles/pressurePlateSystem.ts`, `src/systems/puzzles/secretDoorSystem.ts`, `src/systems/puzzles/arcaneGlyphSystem.ts`, `src/systems/puzzles/__tests__/lockSystem.test.ts`, `docs/projects/puzzles/GAPS.md` PZ-004 | Closed: puzzle runtime checks prefer modern `finalAbilityScores`, then `abilityScores`, with legacy `character.stats` retained only as compatibility fallback. | Focused runtime tests passed 2026-06-27. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G2 | done | support_needed_now | Worker A | `docs/projects/puzzles/GAPS.md` | Types + gameplay scan | Key-based unlock path now has a puzzle-owned runtime contract: callers provide available key ids, and `attemptKeyUnlock` compares them against `Lock.keyId`. | `src/systems/puzzles/types.ts`, `src/systems/puzzles/types.d.ts`, `src/systems/puzzles/lockSystem.ts`, `src/systems/puzzles/__tests__/lockSystem.test.ts` | Unlock progression can now depend on a deterministic key match without forcing the puzzle package to own inventory or economy registries. | Closed 2026-06-27. Route visible key-use UI or inventory key sourcing as a separate bounded slice. | Focused lock system test covers both pick and key paths. |
| G3 | done | support_needed_now | Worker A | `docs/projects/puzzles/GAPS.md` | Character contract scan | Puzzle runtime checks now share `getPuzzleCharacterStats`: modern `finalAbilityScores` first, modern `abilityScores` second, legacy `character.stats` last. | `src/systems/puzzles/characterAbilityBridge.ts`, changed puzzle runtime callers, `src/systems/puzzles/__tests__/lockSystem.test.ts` | Mixed stat shapes are now centralized and documented, reducing drift as puzzle content expands. | Closed 2026-06-27. Keep future puzzle callers aligned with the same modern-first bridge. | Focused tests cover the modern-preferred and legacy-fallback lock path. |
| G5 | not_started | adjacent_follow_up | Worker A | `docs/projects/puzzles/GAPS.md` | Integration TODO sweep | BattleMap/Submap/Spell interaction for plates, secret doors, mechanisms, and arcane glyphs remains TODO-marked. | `src/systems/puzzles/mechanism.ts`, `secretDoorSystem.ts`, `pressurePlateSystem.ts`, `arcaneGlyphSystem.ts`, `docs/architecture/domains/puzzles-quests-rituals.md` | Without this integration, puzzle state changes are not reliably visualized in world space. | Schedule this as an explicit follow-up slice linked to map/encounter owners. | Keep this gap out of core runtime handoff until map integration path is accepted. |
| G6 | not_started | adjacent_follow_up | Worker A | `docs/projects/puzzles/GAPS.md` | Content pipeline follow-up | No verified puzzle registry or authored puzzle catalog source was discovered in targeted scan. | `rg -n "puzzle" src/data`, `src/systems/puzzles` | Without content registry source, runtime systems lack discoverable production population surface. | Confirm whether a content registry exists in generation/encounter pipeline and document it here before full content work. | Add registry path and owner, or route unresolved gap to global if clearly cross-project. |
| G7 | done | in_scope_now | Worker A (decision: Remy 2026-06-10) | `docs/projects/puzzles/GAPS.md` | Runtime caller scan | Dedicated puzzle-facing runtime surface is implemented. A real `puzzle` interactable feature now routes through `OPEN_PUZZLE_RUNTIME`, and `PuzzleRuntimeModal` calls `requestPuzzleHint` from the rendered hint action. | `src/systems/puzzles/puzzleRuntime.ts`, `src/components/puzzles/PuzzleRuntimeModal.tsx`, `src/components/ActionPane/useActionGeneration.ts`, `src/data/world/locations.ts`, focused tests, after screenshot in `.agent/scratch/proof/puzzles/runtime-surface/after/` | The domain API now has a player-facing gameplay caller for hints. | Closed 2026-06-27. | Focused tests passed and after screenshot captured. |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
