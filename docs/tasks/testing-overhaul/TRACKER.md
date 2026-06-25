# Testing Overhaul Living Tracker

Status: active
Last updated: 2026-06-25

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
|---|---|---|---|---|---|---|---|
| T1 | done | Confirmed project registration and docs surface for testing-overhaul exists. | Worker D | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md`; `docs/projects/GLOBAL_GAPS.md` | Keep `NORTH_STAR.md`, `GAPS.md`, and `TRACKER.md` aligned before next execution slice. | `docs/tasks/testing-overhaul` file map integrity |
| T2 | done | Define explicit owner map and test matrix across core UI, complex interactions, map/gameplay, and utilities/docs targets. | Codex | 2026-06-25 | Retired phase files; `GAPS.md` G1-G8; stream matrix below | Use stream rows G4-G8 for future execution instead of restoring phase checklists. | Matrix present with target systems and proof boundaries. |
| T3 | done | Merge duplicate phase naming/overlap into a single test execution path note. | Codex | 2026-06-25 | Retired duplicate `02` and `03` phase files; `GAPS.md` G3 | Route all future work through gap rows and the stream matrix. | No phase backlog files remain. |
| T4 | done | Execute the first focused testing slice from the stream matrix. | Codex | 2026-06-25 | `src/utils/visuals/__tests__/visualUtils.test.ts`; item icon SVG generation pass | Added a generated-item-SVG path regression for `resolveItemVisual`. | `npx vitest run src/utils/visuals/__tests__/visualUtils.test.ts` passed: 10 tests. |
| T5 | active | Execute the next focused testing slice from the remaining stream gaps. | testing-overhaul maintainer | 2026-06-25 | `GAPS.md` G4-G8; current source/test tree | Choose one remaining high-risk stream, inspect current tests, add one focused regression proof, then update the matching gap row. | Focused Vitest/RTL proof for the selected slice; rendered proof if the claim is visual. |

## Testing Stream Matrix

| Stream | Owning gap | Current target surface | Test shape | First proof boundary |
|---|---|---|---|---|
| Core UI | G4 | action buttons, character sheet entry, modal behavior | RTL interaction tests plus focused utility tests when needed | One current core UI test proves render state and user interaction. |
| Character Creator | G5 | race/class choices, ability score flow, finalization state | RTL flow tests with state persistence assertions | One current creator slice proves step transition and retained selections. |
| Gameplay | G6 | combat view, inventory, spellbook/action context | RTL/unit mix around command-facing behavior | One current gameplay flow proves visible state and dispatched action contract. |
| Map | G7 | Submap, Battle Map, Worldforge map surfaces | logic tests first; rendered proof when UI/visual behavior is claimed | One map slice proves current interaction or generated data behavior. |
| Hooks/Utils | G8 | shared hooks and exported helpers | focused unit tests with deterministic fixtures | First proof added: generated item SVG paths resolve through `resolveItemVisual`; continue with the next missing high-value helper/hook regression. |

## Gap Log

See `GAPS.md` for the durable gap registry. This tracker keeps the execution queue and stream matrix only.

## Update Rules

- Update this tracker before new work starts in a slice.
- Active, waiting, blocked, and in-progress rows should include owner, evidence, and next proof/check.
- Cross-project or out-of-scope findings should be routed to `docs/projects/GLOBAL_GAPS.md`.
