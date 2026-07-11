# Testing Overhaul North Star

Status: active
Last updated: 2026-07-10

## Why This Project Exists

This project keeps test-planning context for a large, growing area of the app in one cold-start surface.
Its goal is to prevent duplicate discovery and preserve unfinished scope while execution ownership is assigned.

## Purpose And Scope

Ensure testing work for UI, interaction, map, gameplay, and utility areas proceeds from a shared, explicit plan.

- In scope: clarify current reality, define bounded slices, preserve execution evidence, and route live test gaps.
- Out of scope for this consolidation pass: broad source refactors or claiming full test-suite completion.

## Current State

- The project is registered in `docs/projects/PROJECT_TRACKER.md`.
- The old phase backlog files were retired on 2026-06-25 after their still-valid work was moved into `GAPS.md`.
- The three project docs in this folder are now the live handoff surface for this task.
- Future execution should choose one stream gap from `GAPS.md`, inspect current tests/source, implement a focused proof, and update the matching row.
- The 2026-07-10 repository sweep now provides a full tracked-suite baseline: 6,492 tests discovered, 6,429 passed, 55 failed, and 8 skipped before the first focused repairs. The run took about 8 minutes 44 seconds with eight workers and about 14 minutes with four workers.
- A post-repair rerun against the still-changing shared checkout completed in about 6 minutes 57 seconds: 6,492 total, 6,421 passed, 58 failed, and 13 pending across 29 failed files. The increase from the earlier baseline came while concurrent decompositions were landing, so both timestamped results are retained rather than presenting the delta as this sweep's regression.
- The latest 2026-07-10 continuation aggregate completed in about 6 minutes 40 seconds: 6,492 total, 6,472 passed, 7 failed assertions, and 13 pending. The raw-button audit is the only stable assertion failure. The other six are rotating `STACK_TRACE_ERROR` cases that pass in a 73/73 controlled cohort; newly surfaced MapPane and ground-chunk cases also pass 26/26 focused. This movement between files keeps the worker/resource-isolation gap visible instead of misclassifying it as six product regressions.
- A completion-grade four-worker aggregate then discovered all 6,492 tests and completed with 6,483 passed, one failed policy assertion, and eight intentionally pending. The sole failure is the deterministic raw-button debt gate (134 current paths versus baseline 95). Three additional probabilistic/order-sensitive tests were repaired along the way: spell-attack event and True Strike success proofs now pin noncritical hit rolls, LeverageSystem pins its time-derived success seed, and GameModals proves the real lazy rest dialogs instead of mock-only test ids.
- The owner approved Option A for button governance and bounded execution. The implemented complete lane now passes all 6,493 discovered tests with zero failed and zero pending across 958 files. Four built-in shards execute the identical file set with zero overlap or omissions: 1,558 / 1,621 / 1,714 / 1,600 tests. The reviewed 134-path button manifest passes and rejects both new debt and stale resolved paths. The eight former pending cases now execute through existing reaction and spell-gate seams; no parallel subsystem was invented.
- Vitest was incorrectly discovering ignored `.agent/scratch` probes and Agora's Node-native `.test.mjs` files. `vitest.config.ts` now excludes both surfaces; Agora remains verified separately with 144/144 passing under `node --test`.
- Safe focused repairs now cover asynchronous command sequencing, current atlas/plane fixtures, multi-target team allocation, zone movement accounting, dialog semantics, error-boundary isolation, spell cantrip wrappers, Lightning Lure save determinism, dock-direction proof, and canonical spell-effect fixture alignment. The split spell-integrity lane now passes 306/306; unsupported granted-action and richer mode-choice semantics remain exact reviewed debt routed below rather than invented silently.

## Active Task

| Field | Value |
|---|---|
| Task | Continue the repository-wide failure inventory through bounded, owner-aware repair slices. |
| Acceptance criteria | Each selected failure cluster gains a focused proof; shared fixture or sharding architecture waits for the Required Review Brief decision below. |
| Allowed boundaries | The selected source/test files plus these testing-overhaul docs; do not edit files held by concurrent decompositions. |
| Stop condition | Do not turn the sweep into a one-shot rewrite or weaken assertions to manufacture a green result. |
| Verification | Focused Vitest/RTL proof per repair, then a tracked-only full-suite rerun; rendered proof if the claim is visual. |
| Owner | testing-overhaul maintainer |
| Next action | Keep the approved bounded lane and button manifest green; obtain G15/G16 decisions before introducing new spell action/choice schemas. |

## Scope Boundaries

In scope:
- Preserve and update testing intent.
- Track implemented versus planned test coverage.
- Record owner-aware, risk-aware next actions.
- Keep cross-project gap routing visible.

Adjacent but not automatically in this slice:
- Full cross-task harmonization of all non-testing roadmap docs.
- Broad quality-gate or CI policy work owned by scripts-quality.

Out of scope:
- Restoring retired phase checklist files.
- Declaring the whole test surface complete from one focused proof.

## File Map

| File | Role |
|---|---|
| `NORTH_STAR.md` | Cold-start entry point and scope memory. |
| `TRACKER.md` | Active queue, stream matrix, owner, status, evidence, and next checks. |
| `GAPS.md` | Durable unresolved findings with next proof. |

## Implemented / Planned

Implemented:
- Project registration in the repo-level tracker remains visible.
- Core three-file handoff surface is present.
- Old phase backlog files were consolidated and retired.

Planned:
- Execute stream gaps G4-G8 one focused slice at a time.
- Update proof rows after each slice.
- Route quality-gate or script-test policy work to `docs/projects/scripts-quality`.
- Continue focused stream coverage only from new evidence; the repository failure inventory and runner-policy slice are complete.
- Keep shared fixture helpers strict and incremental when future schema drift demonstrates a repeated need; do not add permissive catch-all builders speculatively.

## Integrations

- `docs/projects/PROJECT_TRACKER.md`: owns project registry and required progress signal.
- `docs/projects/GLOBAL_GAPS.md`: cross-project or external gap routing.
- `docs/projects/scripts-quality`: adjacent owner for quality-gate and script-test infrastructure.
- `docs/ARCHITECTURE.md`: system ownership context for components named in this testing scope.

## Required Review Brief

Title: Shared test-state and full-suite execution architecture
Decision: Option A approved by the human owner on 2026-07-10. The complete lane is capped at four workers in `vitest.config.ts`, CI calls `npm run test:bounded`, and four optional built-in shard scripts retain the exact 958-file inventory without overlap. Existing focused factories remain the strict fixture layer; broader builders will be added incrementally only when repeated schema drift provides a concrete contract.
Question: Should Aralia add shared canonical combat-state fixtures plus explicit Vitest lanes/shards, or keep local fixtures and one monolithic application-suite command?
Issue: The tracked suite currently takes about 8:44 with eight workers and exposed 55 failing assertions across 27 product files. Many command failures repeat the same incomplete `CombatState` fixture symptoms (`characters` or `turnState` absent), while the monolithic runner previously mixed product tests with ignored scratch probes and Node-native Agora tests.
Current behavior: Scratch and Agora discovery are now separated, and focused repairs can proceed. Test files still construct many local partial combat states, and the application suite has no durable lane/shard contract beyond one broad Vitest invocation.
Why blocked: Introducing shared fixture builders or CI shards changes testing ownership and can hide drift if the builders become overly permissive. Continuing with ad hoc local fixtures repeats the same schema repair across many files and keeps the full check slow.
Option A: Add canonical strict fixture builders for combat/game state and define explicit Vitest lanes or shards that together retain full coverage. Migrate failing clusters incrementally with focused proof. This is the preserving recommendation.
Option B: Keep local fixtures and the monolithic suite; repair each failing file independently and accept the longer full-run budget.
Option C: Defer infrastructure changes; continue only isolated failures that do not need shared state or runner changes.
Evidence: `vitest.config.ts`; `package.json`; `.github/workflows/ci.yml`; ignored bounded/shard JSON reports with 6,493 total, 6,493 passed, zero pending, zero failed, 958 unique files, zero duplicate/missing/extra shard files; `node --test "tools/agora/*.test.mjs"` (144/144 passing).
Decision owner: Human/project owner with Testing Overhaul and Scripts: Quality maintainers.
Proof after decision: Option A requires focused fixture-builder tests, unchanged behavior assertions for at least one damage/status/attack command cluster, explicit shard manifests, and a full aggregate count matching tracked discovery. Option B requires focused repairs plus a full monolithic rerun within the documented time budget.

### Button Audit Governance

Decision: Option A approved by the human owner on 2026-07-10. `buttonAuditDebt.json` records the 134 reviewed paths; the guard fails on new paths and on resolved paths that were not removed from the manifest.
Question: Should the raw-button regression gate use a reviewed file allowlist with an incremental migration, or remain a count-only threshold?
Issue: The scanner's global-RegExp state leak is repaired, and three unchanged-tree runs now return the same 134 `needs_work` files against baseline 95. The remaining count-only policy still cannot distinguish a newly nonconforming path from simultaneous improvement elsewhere.
Option A: Replace the numeric baseline with a reviewed path-based debt manifest. New paths fail immediately; existing paths migrate incrementally. This is the preserving recommendation.
Option B: Migrate all 134 current files in one broad UI campaign and remove the baseline afterward.
Option C: Keep the now-deterministic numeric threshold and accept that it cannot identify which files are newly nonconforming.
Proof after decision: Repeat-order scans return the same set, a deliberately added raw-button fixture fails by path, and exemptions retain written semantic reasons.

### App Integration-Test Isolation

Decision: The approved bounded complete lane plus the real-child GameModals repair satisfies the current isolation proof. A separate App-only configuration is deferred unless a future failure reproduces under the bounded lane.
Question: Should Aralia add an isolated App-integration Vitest lane, or keep root-level tests focused on components that are safe in the shared module environment?
Issue: App-level tests require many global mocks. With the current shared module cache, those mocks can replace lazy modal/layout modules in sibling files; resetting modules inside one test also invalidates modules while siblings are running.
Option A: Add a small isolated App-integration lane/config and keep component tests in the fast shared lane. This is the preserving recommendation.
Option B: Keep only focused component-boundary tests and accept that App wiring is verified by broader browser smoke tests.
Option C: Enable isolation for the entire suite and accept the runtime/memory cost after benchmarking.
Current preserving repair: GameModals now loads the real Long/Short Rest lazy children and asserts their accessible dialogs. The file passes 28/28, a module-reset cohort passes 63/63, and the final four-worker aggregate retains the proof.
Proof after decision: The App boundary test and `GameModals.test.tsx` pass together and in reversed order without module resets or leaked mocks, and the selected lane retains full 6,493-test discovery.

### Spell Granted-Action Schema

Question: Should spell `grantedActions` be migrated to one normalized action-economy schema, or should the validator recognize several domain-specific action kinds?
Issue: The spell-integrity split exposes 15 spells with missing/unknown action types, labels, or frequencies (`free_command`, `question`, `magic_action`, and legacy unlabeled actions). The independent blank Animate Dead description defect has been repaired. Choosing action values mechanically would still invent runtime semantics for commands, questions, sustained effects, and object interactions.
Option A: Define one canonical granted-action contract and migrate the 15 spells with runtime bridge tests. This is the preserving recommendation.
Option B: Expand the validator/type union to retain domain-specific action kinds, documenting how each maps to combat action economy.
Option C: Classify the 15 records as explicit temporary migration debt while exact-description fixtures are aligned to the current canonical corpus.
Proof after decision: Validator, factory/runtime bridge, and representative UI action tests agree on type, label, frequency, and resource cost for each migrated family.

### Spell Mode-Choice Cardinality And Scope

Question: Should the spell choice schema support selecting several global options and making one choice per target, or should those mechanics remain spell-specific metadata?
Issue: The current `ModeChoice` contract models exactly one global choice. Commune with Nature requires choosing three of five benefits, while Conjure Celestial requires a separate form choice for each target. Rewriting either record as `choose_one` would lose canonical behavior; widening the schema without runtime/UI consumers would only make unsupported data look valid.
Option A: Extend the shared contract with explicit selection cardinality and scope, including a bounded multi-select form and a per-target choice form, then add runtime and UI allocation tests. This is the preserving recommendation.
Option B: Keep `ModeChoice` global and single-select, and add spell-specific structured metadata plus dedicated consumers for these two mechanics.
Option C: Retain the exact two-spell reviewed-debt gate and defer representation until a consumer needs these mechanics.
Proof after decision: Validator tests reject out-of-range selections, runtime tests preserve all selected benefits or target-specific forms, and UI tests prove selection limits and target allocation.

## Decision Visualizations

| Decision | Status | Visual page | Summary | Owner |
|---|---|---|---|---|
| Shared fixtures and Vitest lane/shard policy | approved / implemented | Living-project dashboard -> Testing Overhaul | Four-worker complete lane plus four exact built-in shards; strict fixtures remain incremental. | Human/project owner |
| Raw-button audit baseline and migration policy | approved / implemented | Living-project dashboard -> Testing Overhaul | Reviewed 134-path manifest rejects new and stale-resolved debt. | Human/project owner |
| App integration-test isolation | resolved by approved lane | Living-project dashboard -> Testing Overhaul | Real lazy-child wiring plus bounded full lane is green; reopen only from reproduced evidence. | Human/project owner |
| Spell granted-action schema | needs decision | Living-project dashboard -> Testing Overhaul | Choose one canonical action contract, domain-specific kinds, or explicit temporary migration debt. | Human/project owner |
| Spell mode-choice cardinality and scope | needs decision | Living-project dashboard -> Testing Overhaul | Choose a shared multi-select/per-target contract, spell-specific metadata, or exact reviewed debt. | Human/project owner / Spell Phase maintainer |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `TRACKER.md`.
3. Read `GAPS.md`.
4. Check G15-G16 in the Required Review Brief before choosing work that invents new spell schemas.
5. Choose exactly one owner-safe failure or coverage stream gap.
6. Inspect current source/tests for that stream.
7. Add one focused proof and update the matching gap row.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/testing-overhaul/NORTH_STAR.md","sha256WithoutMarker":"30ffbbabde780350c7ffcbf7d626df54eabc32c2216562cfe639d4099100b1a8","markedAtUtc":"2026-06-25T22:29:38.630Z"} -->
