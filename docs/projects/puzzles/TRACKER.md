# Puzzles System Living Tracker

Status: active (PZ-007 decision recorded 2026-06-10; implementation lane open)
Last updated: 2026-06-10

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
| T4 | active | Resolve `getPuzzleHint` runtime caller ownership | Worker A (decision: Remy 2026-06-10) | 2026-06-10 | `docs/projects/puzzles/NORTH_STAR.md`, `docs/projects/puzzles/GAPS.md`, `docs/projects/DECISION_BLITZ_2026-06-10.md` D13 | Decision recorded 2026-06-10: dedicated puzzle-facing runtime surface approved. Build the surface and wire the first gameplay `getPuzzleHint` caller with a focused test. | Source-backed runtime caller proof: a gameplay callsite exercising `getPuzzleHint` plus a focused runtime caller test. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G2 | not_started | support_needed_now | Worker A | `docs/projects/puzzles/GAPS.md` | Types + gameplay scan | Key-based unlock path exists in shape (`Lock.keyId`) but is not used by lock resolution. | `src/systems/puzzles/types.ts`, `src/systems/puzzles/lockSystem.ts`, `src/components/puzzles/LockpickingModal.tsx` | Unlock progression cannot depend on keys without an explicit contract. | Decide lock/key ownership and acceptance rule before continuing gameplay progression tasks. | Evidence of key-resolution contract in tests/docs. |
| G3 | not_started | support_needed_now | Worker A | `docs/projects/puzzles/GAPS.md` | Character contract scan | Multiple puzzle systems still use legacy fallback stats (`character.stats`) while TODOs in `types/character.ts` call for migration. | `src/systems/puzzles/*.ts`, `src/types/character.ts` | Mixed stat shapes increase drift risk as puzzle content expands. | Keep shim intact and define migration target before extending challenge outcomes. | Add migration check in first implementation slice and record completion evidence. |
| G5 | not_started | adjacent_follow_up | Worker A | `docs/projects/puzzles/GAPS.md` | Integration TODO sweep | BattleMap/Submap/Spell interaction for plates, secret doors, mechanisms, and arcane glyphs remains TODO-marked. | `src/systems/puzzles/mechanism.ts`, `secretDoorSystem.ts`, `pressurePlateSystem.ts`, `arcaneGlyphSystem.ts`, `docs/architecture/domains/puzzles-quests-rituals.md` | Without this integration, puzzle state changes are not reliably visualized in world space. | Schedule this as an explicit follow-up slice linked to map/encounter owners. | Keep this gap out of core runtime handoff until map integration path is accepted. |
| G6 | not_started | adjacent_follow_up | Worker A | `docs/projects/puzzles/GAPS.md` | Content pipeline follow-up | No verified puzzle registry or authored puzzle catalog source was discovered in targeted scan. | `rg -n "puzzle" src/data`, `src/systems/puzzles` | Without content registry source, runtime systems lack discoverable production population surface. | Confirm whether a content registry exists in generation/encounter pipeline and document it here before full content work. | Add registry path and owner, or route unresolved gap to global if clearly cross-project. |
| G7 | not_started | in_scope_now | Worker A (decision: Remy 2026-06-10) | `docs/projects/puzzles/GAPS.md` | Runtime caller scan | No gameplay caller yet invokes `getPuzzleHint`; the live helper exists but the project has not picked a runtime owner for `Puzzle` objects. Decided 2026-06-10 (DECISION_BLITZ D13): dedicated puzzle-facing runtime surface approved; Puzzles owns the runtime `Puzzle` instance and hint UI contract. | `src/systems/puzzles/puzzleSystem.ts`, `src/systems/puzzles/__tests__/puzzleSystem.test.ts`, `docs/projects/DECISION_BLITZ_2026-06-10.md` D13 | The domain API can now answer hint checks, but players still need a place in the runtime to ask for one. | Build the approved puzzle-facing runtime surface and wire the first gameplay `getPuzzleHint` caller there. | A source-backed callsite or UI action that exercises `getPuzzleHint` in real play, plus a focused runtime caller test. |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
