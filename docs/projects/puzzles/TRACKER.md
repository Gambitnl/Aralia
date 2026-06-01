# Puzzles System Living Tracker

Status: active
Last updated: 2026-05-31

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|---|
| T1 | done | Replace puzzle scaffold docs with an evidence-based cold-start pack in `docs/projects/puzzles/` (this tracker included). | Worker A | 2026-05-31 | `src/systems/puzzles`, `src/components/puzzles`, `src/state`, `docs/architecture/domains/puzzles-quests-rituals.md` | Run a bounded review on unresolved gaps in this project for implementation restart. | `NORTH_STAR.md` and `GAPS.md` contain concrete map and next checks. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | in_scope_now | Worker A | `docs/projects/puzzles/GAPS.md` | Puzzles implementation scan | No production entry dispatch path from world objects to `OPEN_LOCKPICKING_MODAL` besides dev test path. | `src/App.tsx` (`test_lockpicking`), `src/state/actionTypes.ts`, `src/components/layout/GameModals.tsx` | Lockpicking experience is not reachable from normal gameplay entities yet. | Define and document the first production action source for lock puzzle encounters. | Add one in-scope callsite or explicit blocker note in tracker. |
| G2 | not_started | support_needed_now | Worker A | `docs/projects/puzzles/GAPS.md` | Types + gameplay scan | Key-based unlock path exists in shape (`Lock.keyId`) but is not used by lock resolution. | `src/systems/puzzles/types.ts`, `src/systems/puzzles/lockSystem.ts`, `src/components/puzzles/LockpickingModal.tsx` | Unlock progression cannot depend on keys without an explicit contract. | Decide lock/key ownership and acceptance rule before continuing gameplay progression tasks. | Evidence of key-resolution contract in tests/docs. |
| G3 | not_started | support_needed_now | Worker A | `docs/projects/puzzles/GAPS.md` | Character contract scan | Multiple puzzle systems still use legacy fallback stats (`character.stats`) while TODOs in `types/character.ts` call for migration. | `src/systems/puzzles/*.ts`, `src/types/character.ts` | Mixed stat shapes increase drift risk as puzzle content expands. | Keep shim intact and define migration target before extending challenge outcomes. | Add migration check in first implementation slice and record completion evidence. |
| G4 | not_started | support_needed_now | Worker A | `docs/projects/puzzles/GAPS.md` | Puzzle-system scan | `puzzleSystem` currently has live behavior (`attemptPuzzleInput`) but no runtime hint resolver path (`getPuzzleHint` returns null). | `src/systems/puzzles/puzzleSystem.ts`, tests | Puzzle hints cannot be triggered in gameplay with current API shape. | Decide whether UI or interaction layer owns hint checks and type shape. | Proof is a new integration test that uses a checked-in puzzle with hint outcome. |
| G5 | not_started | adjacent_follow_up | Worker A | `docs/projects/puzzles/GAPS.md` | Integration TODO sweep | BattleMap/Submap/Spell interaction for plates, secret doors, mechanisms, and arcane glyphs remains TODO-marked. | `src/systems/puzzles/mechanism.ts`, `secretDoorSystem.ts`, `pressurePlateSystem.ts`, `arcaneGlyphSystem.ts`, `docs/architecture/domains/puzzles-quests-rituals.md` | Without this integration, puzzle state changes are not reliably visualized in world space. | Schedule this as an explicit follow-up slice linked to map/encounter owners. | Keep this gap out of core runtime handoff until map integration path is accepted. |
| G6 | not_started | adjacent_follow_up | Worker A | `docs/projects/puzzles/GAPS.md` | Content pipeline follow-up | No verified puzzle registry or authored puzzle catalog source was discovered in targeted scan. | `rg -n "puzzle" src/data`, `src/systems/puzzles` | Without content registry source, runtime systems lack discoverable production population surface. | Confirm whether a content registry exists in generation/encounter pipeline and document it here before full content work. | Add registry path and owner, or route unresolved gap to global if clearly cross-project. |
