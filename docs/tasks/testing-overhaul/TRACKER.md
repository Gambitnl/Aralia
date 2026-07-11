# Testing Overhaul Living Tracker

Status: active
Last updated: 2026-07-10

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
| T6 | done | Separate product Vitest discovery from ignored scratch probes and Node-native Agora tests. | Codex | 2026-07-10 | `vitest.config.ts`; full JSON inventory; Agora Node test run | Keep `.agent/**` and `tools/agora/**/*.test.mjs` out of Vitest; continue running Agora with Node's runner. | `node --test "tools/agora/*.test.mjs"` passed 144/144; focused product discovery contains no scratch/Agora files. |
| T7 | done | Repair the tracked application-suite failures in bounded owner-safe clusters. | Codex / owning subsystem maintainers | 2026-07-10 | Four exact shards: 6,493 total / 6,493 passed / 0 failed / 0 pending across 958 unique files; `GAPS.md` G10 | Continue from fresh failures only. | Complete bounded lane stays green. |
| T8 | done | Implement approved full-suite lane/shard architecture. | Human/project owner / Codex | 2026-07-10 | `vitest.config.ts`; `package.json`; `.github/workflows/ci.yml`; four green shard reports | Keep four-worker complete lane as CI authority; use shards for independent parallel jobs when needed. | Bounded and shard union remain identical: 958 files / 6,493 tests. |
| T9 | done | Implement approved deterministic raw-button audit governance. | Human/project owner / Codex | 2026-07-10 | `buttonAuditDebt.json`; focused guard proof; bounded aggregate | Remove reviewed paths as migration lands; reject new paths unless explicitly reviewed. | Exact current/manifest path equality. |
| T10 | done | Resolve App integration-test isolation strategy. | Human/project owner / Codex | 2026-07-10 | Real-child GameModals proof; module-reset cohort 63/63; full bounded/sharded aggregate | Reopen only from a bounded-lane reproduction. | No App integration failure in complete lane. |
| T11 | waiting | Decide canonical spell granted-action semantics. | Human/project owner / Spell Phase maintainer | 2026-07-10 | `NORTH_STAR.md` Spell Granted-Action Schema; `GAPS.md` G15 | Choose normalized contract, domain-specific action kinds, or explicit migration debt. | Validator/runtime/UI agreement for all migrated action families. |
| T12 | waiting | Decide spell mode-choice cardinality and scope. | Human/project owner / Spell Phase maintainer | 2026-07-10 | `NORTH_STAR.md` Spell Mode-Choice Cardinality And Scope; `GAPS.md` G16 | Choose shared multi-select/per-target semantics, spell-specific metadata, or exact reviewed debt. | Validator/runtime/UI agreement for bounded selections and per-target allocation. |

## Testing Stream Matrix

| Stream | Owning gap | Current target surface | Test shape | First proof boundary |
|---|---|---|---|---|
| Core UI | G4 | action buttons, character sheet entry, modal behavior | RTL interaction tests plus focused utility tests when needed | One current core UI test proves render state and user interaction. |
| Character Creator | G5 | race/class choices, ability score flow, finalization state | RTL flow tests with state persistence assertions | One current creator slice proves step transition and retained selections. |
| Gameplay | G6 | combat view, inventory, spellbook/action context | RTL/unit mix around command-facing behavior | One current gameplay flow proves visible state and dispatched action contract. |
| Map | G7 | Submap, Battle Map, Worldforge map surfaces | logic tests first; rendered proof when UI/visual behavior is claimed | One map slice proves current interaction or generated data behavior. |
| Hooks/Utils | G8 | shared hooks and exported helpers | focused unit tests with deterministic fixtures | First proof added: generated item SVG paths resolve through `resolveItemVisual`; continue with the next missing high-value helper/hook regression. |
| Test infrastructure | G9-G11 | discovery boundaries, strict state fixtures, aggregate execution | bounded complete lane plus exact built-in shards and focused fixture tests | Product Vitest excludes scratch/Agora; 144 Agora Node tests pass; bounded/shard union matches 958 files and 6,493 tests. |

## Gap Log

See `GAPS.md` for the durable gap registry. This tracker keeps the execution queue and stream matrix only.

## Update Rules

- Update this tracker before new work starts in a slice.
- Active, waiting, blocked, and in-progress rows should include owner, evidence, and next proof/check.
- Cross-project or out-of-scope findings should be routed to `docs/projects/GLOBAL_GAPS.md`.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/testing-overhaul/TRACKER.md","sha256WithoutMarker":"9a1c90b1a9c0db9fbc6436b806e6bdeb117de19f673bfc8022c3801945678375","markedAtUtc":"2026-06-25T22:29:38.631Z"} -->
