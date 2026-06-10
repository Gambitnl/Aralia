# Puzzles System Living Tracker

Status: review-required
Last updated: 2026-06-09

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
| T1 | done | Replace puzzle scaffold docs with an evidence-based cold-start pack in `docs/projects/puzzles/` (this tracker included). | Worker A | 2026-06-05 | `docs/projects/puzzles/NORTH_STAR.md`, `docs/projects/puzzles/TRACKER.md`, `docs/projects/puzzles/GAPS.md` | Keep the dashboard schema current and hand the next implementation slice to T2. | `NORTH_STAR.md` contains a current Dashboard Card Schema and `GAPS.md` stays aligned with the open project gaps. |
| T2 | done | Implement the first production lockpicking dispatch path from a real world encounter. | Worker A | 2026-06-09 | `src/data/world/locations.ts`, `src/components/ActionPane/useActionGeneration.ts`, `src/hooks/actions/actionHandlers.ts`, `src/components/ActionPane/__tests__/ActionPane.test.tsx` | Route lock puzzle interactions from `Location.interactableFeatures` via `OPEN_LOCKPICKING_MODAL` and confirm with non-dev dispatch test. | `src/components/ActionPane/__tests__/ActionPane.test.tsx` asserts lock action + payload dispatch on a real cave location. |
| T3 | done | Implement source-backed puzzle hint resolution in `puzzleSystem`. | Worker A | 2026-06-09 | `src/systems/puzzles/puzzleSystem.ts`, `src/systems/puzzles/__tests__/puzzleSystem.test.ts`, `docs/projects/puzzles/AUDIT_OR_PROOF.md` | Keep the live hint helper callable and route the first gameplay caller when ownership is clear. | `getPuzzleHint` now rolls an Intelligence check and returns the hint on pass; no runtime caller is wired yet. |
| T4 | review-required | Resolve `getPuzzleHint` runtime caller ownership | human/product owner | 2026-06-09 | `docs/projects/puzzles/NORTH_STAR.md`, `docs/projects/puzzles/GAPS.md` | Decide the gameplay owner for the first real caller, then route or wire the chosen surface. | Required Review Brief is recorded in `NORTH_STAR.md`; source-backed runtime caller proof comes after the decision. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | in_scope_now | Worker A | `docs/projects/puzzles/GAPS.md` | T2 implementation | Real production callsite added: `src/components/ActionPane/useActionGeneration.ts` now emits `OPEN_LOCKPICKING_MODAL` from `Location.interactableFeatures`, and `cave_entrance` has a lock feature in `src/data/world/locations.ts`. | `src/data/world/locations.ts`, `src/components/ActionPane/useActionGeneration.ts`, `src/hooks/actions/actionHandlers.ts`, `src/components/ActionPane/__tests__/ActionPane.test.tsx` | Without this path, lockpicking remains dev-only; now the modal can be reached from a world encounter payload contract. | Keep the path contract stable (`OPEN_LOCKPICKING_MODAL` carries `Lock`) and route map integration follow-ups via `G2+` gaps. | Passes if dispatch test remains in scope and payload fields (`id`, `dc`, `isLocked`) assert cleanly. |
| G2 | not_started | support_needed_now | Worker A | `docs/projects/puzzles/GAPS.md` | Types + gameplay scan | Key-based unlock path exists in shape (`Lock.keyId`) but is not used by lock resolution. | `src/systems/puzzles/types.ts`, `src/systems/puzzles/lockSystem.ts`, `src/components/puzzles/LockpickingModal.tsx` | Unlock progression cannot depend on keys without an explicit contract. | Decide lock/key ownership and acceptance rule before continuing gameplay progression tasks. | Evidence of key-resolution contract in tests/docs. |
| G3 | not_started | support_needed_now | Worker A | `docs/projects/puzzles/GAPS.md` | Character contract scan | Multiple puzzle systems still use legacy fallback stats (`character.stats`) while TODOs in `types/character.ts` call for migration. | `src/systems/puzzles/*.ts`, `src/types/character.ts` | Mixed stat shapes increase drift risk as puzzle content expands. | Keep shim intact and define migration target before extending challenge outcomes. | Add migration check in first implementation slice and record completion evidence. |
| G4 | done | support_needed_now | Worker A | `docs/projects/puzzles/GAPS.md` | Puzzle-system scan | `puzzleSystem` now has live hint behavior (`getPuzzleHint` rolls an Intelligence check and returns the hint on pass). | `src/systems/puzzles/puzzleSystem.ts`, `src/systems/puzzles/__tests__/puzzleSystem.test.ts` | The helper can now answer a hint check without inventing new API shape. | Keep the helper in the puzzle domain and route the first gameplay caller separately. | The new test plus `docs/projects/puzzles/GAPS.md` confirm the split between helper and caller gap. |
| G5 | not_started | adjacent_follow_up | Worker A | `docs/projects/puzzles/GAPS.md` | Integration TODO sweep | BattleMap/Submap/Spell interaction for plates, secret doors, mechanisms, and arcane glyphs remains TODO-marked. | `src/systems/puzzles/mechanism.ts`, `secretDoorSystem.ts`, `pressurePlateSystem.ts`, `arcaneGlyphSystem.ts`, `docs/architecture/domains/puzzles-quests-rituals.md` | Without this integration, puzzle state changes are not reliably visualized in world space. | Schedule this as an explicit follow-up slice linked to map/encounter owners. | Keep this gap out of core runtime handoff until map integration path is accepted. |
| G6 | not_started | adjacent_follow_up | Worker A | `docs/projects/puzzles/GAPS.md` | Content pipeline follow-up | No verified puzzle registry or authored puzzle catalog source was discovered in targeted scan. | `rg -n "puzzle" src/data`, `src/systems/puzzles` | Without content registry source, runtime systems lack discoverable production population surface. | Confirm whether a content registry exists in generation/encounter pipeline and document it here before full content work. | Add registry path and owner, or route unresolved gap to global if clearly cross-project. |
| G7 | review-required | blocked_human_decision | human/product owner | `docs/projects/puzzles/GAPS.md` | Runtime caller scan | No gameplay caller yet invokes `getPuzzleHint`; the live helper exists but the project has not picked a runtime owner for `Puzzle` objects. | `src/systems/puzzles/puzzleSystem.ts`, `src/systems/puzzles/__tests__/puzzleSystem.test.ts` | The domain API can now answer hint checks, but players still need a place in the runtime to ask for one. | Decide the gameplay owner for `getPuzzleHint`, then wire that surface or route the caller to another project. | A source-backed callsite or UI action that exercises `getPuzzleHint` in real play. |
