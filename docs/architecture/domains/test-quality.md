# Test quality and mutation evidence

Verified: 2026-10-04 against revision b35ea0ff84591e5f4f1d69c4ecc5d7bf918566fc, tracked test source, executed suite receipts, controlled behavior probes, Stryker reports, and recovered V8 measurements.

The audit proves one empty placeholder and eight incorrect production behaviors accepted by their selected tests. The automated mutation score is 44.08% for eight modules and 175 selected cases. Useful smoke, determinism, and invariant coverage should be preserved while strengthening the missing contracts.

Aralia uses Vitest for application tests, Node's test runner for tooling, Playwright for browser flows, and TSD for declaration contracts. A passing test count measures executed cases. It does not establish whether those cases catch incorrect behavior.

## Audit scope and rules

`scripts/quality/test-value-audit.mjs` reads every tracked test or spec filename from Git and parses JavaScript and TypeScript with TypeScript's parser. It records Python and diagnostic scripts separately. Its first complete inventory covers 1,744 files and 13,550 source registrations at revision b35ea0ff84591e5f4f1d69c4ecc5d7bf918566fc. Parameterized tests expand at runtime, so registration counts are not executed test counts. New audit-tool tests are validated separately from that starting inventory.

The audit distinguishes unconditional constant comparisons and empty tests from review candidates: conditional assertions, loops that may be empty, presence checks, snapshots, caught errors, and duplicate bodies. It follows local assertion helpers and fixture callbacks. Explicit rejection throws, expect.fail, Testing Library findBy queries, and Playwright waits can enforce real behavior without a conventional matcher in the callback.

Repeated calls to a generator are determinism checks, not comparisons of a value to itself. Fixtures with shared callback bodies can still test different inputs. Neither a heuristic flag nor a surviving mutant alone authorizes removing a test. Equivalent changes, diagnostic-only output, and outcomes covered by another suite require separate classification.

The complete scan has no syntax parse errors or focused registrations. It identifies one genuinely empty test, two constant assertions, two nonnegative array-length assertions, and 33 duplicate-body groups for review. The 831 loop-only and 261 presence-only cases are candidates, not 1,092 demonstrated defects. The constant region comparison is an else branch after a live bounds comparison and is not proof that the whole region test is vacuous. Six callbacks have no locally recognized assertion; two use meaningful asynchronous findByText checks, one is the empty banter case, and three are browser flows with incomplete outcome checks.

## Confirmed behavior gaps

Controlled probes apply exact source substitutions in Vite's memory. They run the same selected tests unmodified first, require proof that the substitution loaded, and hash the original source afterward. No production file is edited. A test name filter is stated where it is used.

| Broken behavior | Existing checks | Result |
|---|---|---|
| Game time returns BROKEN CLOCK | Entire timeUtils suite, 17 cases | All pass. |
| Game date returns BROKEN DATE | Entire timeUtils suite, 17 cases | All pass. |
| Missing glossary detection is disabled | Entire raceSyncAuditor suite, seven cases | All pass. |
| Action prompt and instruction lose their context | Prompt inspection case | Passes. |
| World simulation returns no coastlines | WorldSim integration suite, two cases | Both pass. |
| Smithy inventory removes longsword | Merchant stock inventory suite, 11 cases | All pass. |
| Banter location filtering is bypassed | Named location rejection case | Passes; its body is entirely comments. This does not establish that every other banter test misses the defect. |
| Landmark generation always returns null | Named different-seeds case | Passes. Other landmark cases have independent positive checks. |
| Glossary corpus is absent | Three glossary integrity cases | All pass. This is a fixture perturbation, not a production-code mutant. |

The control substitution that breaks game-day calculation is rejected by its existing assertion. Five native Node mutations that weaken mandatory CI gating or file policy are all rejected by the actual tracked Node tests in small private copies.

A real Chromium probe supplies a blank HTML page to an unchanged copy of the frontend terminology check. The check passes without any Hit Points, Armor Class, party, or character-sheet elements. An explicit visibility control rejects that same blank page. Captures and test outputs stay under ignored scratch paths.

These findings belong to GG-381 in the [global gap tracker](../../projects/GLOBAL_GAPS.md). Repair means adding a controlled incorrect input or implementation that the relevant test rejects, while preserving useful smoke checks and diagnostic intent.

## Runner and coverage boundaries

The default Playwright list command currently exits with Cannot redefine property: Symbol($$jest-matchers-object), before collecting suites. Its testDir contains Vitest files and its default testMatch includes test as well as spec files. A private config restricted to the browser spec reproduces the blank-page finding successfully. The configured base URL is port 3001, while frontend_verification.spec.ts hard-codes port 3000. Browser checks are not a required application CI lane today.

The normal TSD command names only spells.test-d.ts. A second tracked declaration contract, combat-object-targets.test-d.ts, requires explicit selection. The audit runs the wildcard selection to check both; it does not change the production command during this review.

An in-memory declaration mutation changes targetableObjects from an array of map objects to a number. The configured spells-only command still passes. Selecting both tracked declaration files rejects it at combat-object-targets.test-d.ts:29. Both unmutated selections pass, the read-hook receipt proves the invalid declaration was loaded, and the original declaration's hash stays unchanged.

GG-382 in the global gap tracker records the browser-discovery and declaration-selection gaps. This is a runner-boundary finding, not evidence that every other mandatory CI lane would accept an invalid type.

The normal coverage include measures src/utils only, and CI runs the application suite without coverage. The broad audit uses a disposable config that includes every tracked production JavaScript and TypeScript path across src, scripts, tools, devtools, and misc. Its zero thresholds permit measurement; the tracked configuration's thresholds remain intact. Tooling covered by Node is reported separately and must not be described as untested merely because Vitest's coverage does not execute it.

The tracked tmp/test_palace.py and scripts/test_itemAdapter.ts are diagnostic programs rather than assertion-based runner suites. The Palace diagnostic reads a live local index and was inspected rather than executed as a unit test.

## Execution receipts and timing findings

The full native Node baseline passes 676 cases, with no skips or failures. It includes the seven audit-tool cases present at that point. The completed audit-tool suite subsequently passes all 11 focused cases and its three reusable scripts pass scoped ESLint. Both declaration contracts pass when explicitly selected.

The broad run executes every tracked application test file: 1,660 files and 13,698 cases. Per-file console receipts record 21 failed cases and four skipped after a fixture timeout. It also discovers 64 local files absent from Git, adding 420 cases, ten of which fail. The complete local run therefore records 1,724 files and 14,118 cases, with 31 failures and four skips. Each file appears once.

The original process exhausts its Node heap during coverage aggregation before its JSON reporter completes. These totals come from completed per-file console receipts, not a successful final run or a fabricated JSON report. The same 203 cases in the 19 failed tracked suites pass without coverage with two workers. The four settlement cases pass without coverage with one worker. A retry does not erase the original failures. GG-383 records the coverage-profile reliability problem.

| Tracked test files | Count | Execution boundary |
|---|---:|---|
| Application Vitest | 1,660 | All discovered in the broad execution. Original failures remain recorded. |
| Native Node | 77 | Native baseline passes, including the then-new audit-tool cases. |
| Playwright browser specs | 3 | Default collection fails; a private Chromium control is executed. |
| TSD declaration contracts | 2 | Both pass when explicitly selected; the normal command selects one. |
| Manual diagnostics | 2 | Inspected; not treated as assertion-based suites. |

The shared-checkout runner also executes ignored DesignPreview tests. Their local failures cannot be attributed to the tracked GitHub suite without reconciling file discovery. The tracked static inventory and local runtime inventory are intentionally reported separately.
## Recovered coverage

The audit attempts all 2,570 tracked production JavaScript and TypeScript paths across src, scripts, tools, devtools, and misc. It recovers 2,560 file entries from the original per-suite V8 records. This is observed execution coverage from the load-affected run; it is not proof that all assertions passed.

| Measurement scope | Lines | Statements | Functions | Branches |
|---|---:|---:|---:|---:|
| Tracked Vitest suites, all measured source areas | 54.24% | 53.11% | 57.11% | 48.7% |
| Tracked Vitest suites, src only | 67.03% | 65.92% | 69.17% | 61.51% |
| All local Vitest suites, including ignored files | 54.81% | 53.69% | 57.7% | 49.17% |

Within src, utility coverage is 85.50% of lines and 72.42% of branches; systems coverage is 77.11% and 76.73%; component coverage is 48.93% and 47.37%. App.tsx and the application entry points are not executed by this Vitest measurement. A browser lane is needed to assess the booted application. Tooling exercised by the separate native Node lane is outside these Vitest percentages.

The single-map recovery also exhausts an 8 GB heap. The successful recovery partitions source into 18 groups, retains only each group’s scripts before merging V8 records, uses the installed provider to remap in the original project and client/SSR environment, and merges disjoint Istanbul maps. It executes no test cases. A CPU profile also identifies repeated compilation of 2,570 include patterns and heavy garbage collection.

A concurrent agent changes six river source files after the recorded test execution. Their two source groups are regenerated with an in-memory Vite loader returning the measured Git revision. Load receipts verify all six substitutions. The other agent’s working files are preserved. Coverage figures are anchored to the measured revision, not the later river work.

Nine tooling sources are excluded by the V8 remapper: scripts/auditAtlasBuckets.mjs, scripts/auditEdgeCaseSpells.mjs, scripts/audits/check-base-trait-coverage.ts, scripts/audits/check-base-trait-key-coverage.ts, scripts/audits/racialSpellParserAudit.ts, scripts/compressGlossaryLinks.js, scripts/dev-crash-logger.cjs, scripts/quality/sweep-stubs.mjs, and tools/agora/sync-surfaces.mjs. The six JavaScript files pass Node syntax checks; the three TypeScript files have no parser syntax diagnostics. Their coverage is unmeasured here.

The tenth omitted source, devtools/roadmap/src/spell-branch/types.ts, has an actual syntax defect: a JSDoc path contains a comment terminator. TypeScript reports 18 syntax diagnostics. GG-385 records the repair and consumer verification. The zero-diagnostic test-source scan covers a different file scope.
## Reproducing mutations

The reusable runner is `scripts/quality/run-test-mutations.mjs`. Install its isolated toolchain with npm install --prefix .agent/scratch/test-value-audit/toolchain --ignore-scripts --no-audit --no-fund --cache .agent/scratch/test-value-audit/npm-cache @stryker-mutator/core@10.0.0 @stryker-mutator/vitest-runner@10.0.0 vitest@4.1.10, then run the script from the repository root. Both dependency manifests in the root remain intact.

The [Stryker Vitest runner](https://stryker-mutator.io/docs/stryker-js/vitest-runner/) attributes executable mutants to covering tests. The audit's eight named production modules cover clock formatting, security, race matching, seeded randomness, AI prompts, landmarks, world simulation, and banter. Its successful baseline runs 175 cases selected from their existing suites. Other repository suites are outside this mutation score; a survivor can still be caught elsewhere. The selection is written into mutation-scope.json and the generated Vitest config. Explicit command arguments may narrow these eight modules; additional modules require a reviewed test scope. This is a scoped mutation campaign, not every production-code mutation in Aralia. Static initializers are explicitly Ignored, and the race auditor's literal Vite glob loaders are outside its selected mutation range because instrumenting their arguments prevents compilation.

The mutation-only Vitest config permits 60 seconds per test to accommodate instrumentation overhead. No assertion is changed, and the tracked fast/slow CI limits remain intact. Earlier broad dry runs failed on a chronicle timeout, a missing copied fixture, Vite glob instrumentation, and an ignored combat-preview assertion. No mutants were active. These are preserved baseline or infrastructure receipts, not caught mutants. The completed 175-case module baseline passes before mutation execution.

All raw reports, sandboxes, fixture copies, and captures live under .agent/scratch/test-value-audit. Preserve original source hashes and separate Survived, NoCoverage, Ignored, CompileError, RuntimeError, and Timeout outcomes. Only the selected campaign has a mutation score; the whole repository does not have a measured mutation score from this run.

## Automated mutation results

Stryker 10.0.0 completes the eight-module campaign in 18 minutes 49 seconds. It generates 1,242 mutants: 451 Killed, three Timeout, 346 Survived, 230 NoCoverage, and 212 Ignored. There are no CompileError or RuntimeError outcomes in the completed campaign.

The total score is (451 + 3) / (451 + 3 + 346 + 230) = 44.08%. The covered-only score is 56.75%. Ignored static initializers are outside both scores. The three Timeout mutations change incrementing loops to decrementing loops and hit Stryker execution limits; they are separated from assertion kills.

| Module | Total score | Killed | Timeout | Survived | NoCoverage | Ignored |
|---|---:|---:|---:|---:|---:|---:|
| geminiService.ts wrapper | 7.14% | 3 | 0 | 4 | 35 | 0 |
| raceSyncAuditor.ts selected range | 7.59% | 12 | 0 | 80 | 66 | 0 |
| worldSim/index.ts | 26.32% | 5 | 0 | 4 | 10 | 3 |
| landmarkService.ts | 32.59% | 87 | 1 | 154 | 28 | 201 |
| BanterManager.ts | 53.52% | 38 | 0 | 15 | 18 | 6 |
| core/securityUtils.ts | 56.14% | 96 | 0 | 47 | 28 | 0 |
| core/timeUtils.ts | 69.29% | 167 | 0 | 29 | 45 | 2 |
| seededRandom.ts | 77.59% | 43 | 2 | 13 | 0 | 0 |

Representative survivors include empty action-prompt content, world density scaling using cols divided by rows, and disabled banter relationship filtering. They point to missing expectations or fixtures in the selected scopes. Boundary changes, diagnostic labels, and alternate deterministic RNG formulas need contract review before being called defects.

The dedicated geminiRedaction suite is outside the 175-case scored selection. Its seven unmutated cases pass; an in-memory redaction bypass makes five fail. This positive control demonstrates why the scoped survivor count cannot be turned into 346 repository defects or 346 pointless tests. Every probe proves it loaded and leaves the original source hash unchanged.

## Recommended order

1. Strengthen the confirmed prompt, clock/date, race-gap, coastlines, merchant-stock, and browser-prerequisite checks with controlled inputs and expected outcomes. Implement the empty banter fixture while preserving its unfinished intent.
2. Repair browser discovery and type-contract selection in GG-382; require a completed user-flow outcome where a browser check currently accepts absent UI.
3. Establish a bounded coverage profile in GG-383 that records test results independently of coverage aggregation, preserves tracked-versus-local inventories, and reports remapping exclusions.
4. Extend mutation selection to dedicated related suites before setting CI thresholds. Add fixtures for important NoCoverage branches. Review static initializers explicitly.
5. Review the 33 duplicate-body groups against their setup and inputs before consolidating them. Duration, snapshots, presence checks, loops, and equal bodies alone do not justify removal.
6. Repair the excluded roadmap profile syntax in GG-385 and verify its consumers.

## Local evidence

All receipts are under ignored .agent/scratch/test-value-audit: source-audit.json, execution-summary.json, baseline-vitest.log, baseline-node.log, baseline-retry.json, hook-retry.json, mutation.json, mutation.html, mutation-scope.json, probes/results.json, node-mutations/results.json, type-probes/results.json, browser-probes/results.json, redaction-control/results.json, tracked-coverage/coverage-summary.json, recovered-coverage/coverage-summary.json, and the two coverage recovery receipts. Raw V8 records remain under coverage/.tmp. Test results, source scope, and coverage recovery are separate evidence.

The audit adds reusable inventory and mutation runners, their 11 regression checks, this living domain report, and gap notes. Application code and existing application tests are not changed by this audit. No tests are deleted. The concurrent river changes belong to another agent.
