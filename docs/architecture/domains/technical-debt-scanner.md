# Technical Debt Scanner

Verified: 2026-10-25 for the production debt ratchet and dependency-cycle inventory; scanner inventory last checked 2026-09-23.

## Purpose

The scanner makes unfinished work visible so people and agents can preserve its intent, decide what needs work, and connect that work to durable project records and Agora tasks. A finding is evidence to review. It is not permission to delete a feature, remove a comment, or create a task automatically.

The scanner reads source, Git metadata, project gap registries, PlanMap links, and the Agora API. It does not change source files, write report snapshots, create tasks, or update task states. A separate operator or automation curates its proposals and performs authorized changes.

## Implementation

| File | Responsibility |
| --- | --- |
| [sweep-stubs.mjs](../../../scripts/quality/sweep-stubs.mjs) | File traversal, subsystem checks, Agora reads, report assembly, quality policy, and CLI output |
| [sweep-syntax.mjs](../../../scripts/quality/sweep-syntax.mjs) | Syntax-aware comment and executable-code analysis |
| [sweep-triage.mjs](../../../scripts/quality/sweep-triage.mjs) | Finding identity, durable gap lookup, tracking classification, grouped proposals, and report comparison |
| [gapIndex.mjs](../../../tools/agora/gapIndex.mjs) | Existing parser for living project gap registries |

The main entry point exports `scanCodebase(options)`. Programmatic consumers receive the report without invoking CLI output or task creation. `evaluateQualityGate(report, options)` applies the same policy used by the CLI. The report includes the full inventory so a change in gating policy does not hide findings.

## Scan And Tracking Flow

1. Resolve the repository, requested scope, and selected checks. Reject invalid paths instead of treating them as empty scans.
2. Read the Agora endpoints needed for those checks. Isolated local checks do not need Agora. Endpoint failures and invalid responses remain explicit verification failures.
3. Scan source and run the selected repository checks. Comment markers and executable constructs are analyzed separately.
4. Look up explicit citations in live tasks and durable gap records. Preserve the distinction between work recorded for later and work with an active task.
5. Produce findings, review candidates, and grouped task proposals. Evaluate the selected quality policy independently of the finding inventory.
6. When requested, compare a prior report with the same schema and scope. Report differences without treating disappearance as completion.

Blocked Agora tasks remain registered work. A gap can remain registered in a project's `GAPS.md` or [GLOBAL_GAPS.md](../../projects/GLOBAL_GAPS.md) without an active Agora task. That distinction prevents the scanner from requiring a live board ticket for every future capability.

If a finding remains after its cited task closes, the report asks for a completion review. Possible outcomes include correcting outdated wording, scheduling remaining work, or preserving a documented decision. The scanner cannot infer which outcome is correct from task state alone.

| Tracking state | Interpretation |
| --- | --- |
| `tracked`, `blocked`, `tracked_via_gap` | Active work is registered; a blocker does not remove ownership |
| `recorded_deferred` | An open durable record preserves intent without requiring an active task |
| `unlisted` | Review existing task candidates or investigate the intended behavior |
| `completion_review` | A finding remains after linked work was closed |
| `reference_review`, `task_not_found`, `unmapped_gap` | Reconcile ambiguous, invalid, or missing references |
| `unverified_offline` | Required live task verification is unavailable |

Each finding includes detection evidence, tracking evidence, a suggested next action, and candidate existing tasks where available. A valid citation does not conceal a second reference that needs review.

## Finding Identity And Proposals

Finding identity uses the relative path, rule, enclosing symbol, and full source context. Comment-derived identities exclude supported tracking annotations. Executable string contents remain meaningful. Line movement does not create a new identity. Identical findings in different symbols remain distinguishable; repeated equal findings within one symbol receive occurrence suffixes. Reordering identical occurrences remains ambiguous, so comparison is evidence for review. Imported reports with duplicate IDs are rejected. Task proposals carry the relevant finding IDs for later matching.

Proposals group findings by a known project or nearby source directory for review. This grouping does not prove that every finding belongs in one task. Existing task matches remain visible so an operator can extend appropriate work instead of creating duplicate tickets. A proposal asks the reviewer to establish the observed behavior, the intended capability, what must be preserved, and what evidence would establish completion.

Scaffold output is a set of suggested PowerShell commands. Printing a command does not execute it. The commands use single-quoted arguments with escaped single quotes so source text is not interpreted as PowerShell expressions.

Each command includes Agora's required standalone-work reason. Before running it, review existing task candidates and campaigns; replace the standalone options with `--campaign <id>` when the work belongs to an existing campaign.

## CLI

Run the routine scan with `npm run sweep:stubs` or `node scripts/quality/sweep-stubs.mjs`.

| Option | Effect |
| --- | --- |
| No subsystem flags | Scan routine debt markers and stubs under `src/`, with tracking verification |
| `--all` / `--full` | Select every check; selecting checks does not make every finding a gate failure |
| `--paths`, `--debug-traps`, `--eol` | Select local machine-path, executable debug, or mixed-line-ending checks |
| `--type-debt` / `--as-any` | Select type-suppression and cast inventory |
| `--imports`, `--orphans`, `--leaks` | Select import hygiene, inbound-reference candidates, or visual-proof checks |
| `--agora-state`, `--planmap`, `--health` | Select coordination references, PlanMap links, or architectural inventory |
| `--root <path>` | Set the repository root |
| `--dir <path>` | Restrict source-file checks; repository checks such as imports, orphans, and health retain their repository-wide scope |
| `--json` | Emit the complete machine-readable report |
| `--scaffold` | Print grouped task-creation proposals for review |
| `--compare <prior.json>` | Read a prior compatible report and report changes |
| `--strict` | Exit unsuccessfully when the preservation policy fails or required verification is incomplete |
| `--gate-type-debt` | Select the type-debt check and opt into treating its findings as gate failures |
| `--gate-eol` | Select the line-ending check and opt into treating its findings as gate failures |

An isolated subsystem flag selects its check without adding the routine marker sweep. Multiple subsystem flags can be combined.

Examples:

```powershell
node scripts/quality/sweep-stubs.mjs --dir src/systems/combat --json
node scripts/quality/sweep-stubs.mjs --all --strict
node scripts/quality/sweep-stubs.mjs --type-debt --gate-type-debt --strict
node scripts/quality/sweep-stubs.mjs --eol --gate-eol --strict
node scripts/quality/sweep-stubs.mjs --scaffold
node scripts/quality/sweep-stubs.mjs --compare .agent/scratch/scanner/prior.json --json
```

## Reports And Quality Policy

Schema version 2 separates what was found from what should block the selected policy. A passed gate does not mean the repository has no unfinished features or technical debt. Advisory findings and registered future work stay in the report.

The main report fields are `scope`, `coverage`, `subsystems`, `findings`, `proposals`, and `gate`. `coverage.complete` describes the selected detection inventory. Failed selected checks prevent comparison; tracking-only network failures are reported separately through subsystem states and gate reasons. CLI comparison adds `comparison` when it succeeds. `registryWarnings` preserves recovered table-format issues and narrative registries without treating them as silently verified ID records. Unreadable registries or lost ID-bearing rows produce errors.

Required verification must succeed before strict mode can pass. Selected import, leak, machine-path, executable-debug, PlanMap, and Agora-reference findings block the gate. Explicit debt markers and executable stubs also block it when they need a tracking or completion decision. Informational comment matches stay advisory unless required verification is unavailable.

Type casts, type suppressions, and mixed line endings remain advisory under `--all`; their gates require explicit opt-ins. File size, test discovery, and orphan candidates stay advisory. This separates discovery from a requirement to change code.

The compatibility arrays and summary counts remain available to existing consumers. `staleTasks` is retained as an alias for findings needing `completionReview`; its presence does not establish that the source comment is wrong.

Comparison requires schema version 2, matching scope, complete source inventories, and unique finding IDs. Its result separates `new`, `changed`, `previouslySeen`, and `noLongerDetected` findings. A finding that is no longer detected may have moved, changed wording, changed classification, or been removed. It is never automatically marked resolved, and comparing a report does not change tasks or gap records.

The caller owns snapshot storage. Keep temporary reports in an ignored location such as `.agent/scratch/scanner/` or outside the repository. Confirm a new scratch path with `git check-ignore` before writing. Comparison accepts UTF-8, UTF-8 with a byte-order mark, and Windows PowerShell UTF-16LE snapshots with a byte-order mark.

## Interpretation Limits

- Syntax analysis detects source constructs. It does not prove that a stub is reachable or that a proposed replacement is correct.
- Task and gap citations establish registration. They do not prove that a task's acceptance criteria cover every cited behavior.
- Test-file discovery measures the presence of tests, not coverage, correctness, or execution.
- Orphan candidates reflect discovered references. Dynamic loading, reflection, generated entry points, and future features can make an unreferenced module intentional. The result is not deletion advice.
- Import checks inspect source dependencies and known resolution patterns. They do not model every runtime dependency or dynamic execution path.
- File size is an advisory review signal. It does not justify splitting or pruning a working system by itself.
- A named proof image is a review candidate. Asset intent and the applicable repository policy still need interpretation.

## Verification

Focused regression tests live beside the scanner modules. They exercise parser boundaries, tracking states, stable identity, proposal grouping, report comparison, and CLI gate behavior using disposable fixtures. Keep those checks independent of production state and do not use a lower finding count as proof that a change is correct.

```powershell
node --test scripts/quality/sweep-syntax.test.mjs scripts/quality/sweep-triage.test.mjs scripts/quality/sweep-stubs.test.mjs
```

## Production debt ratchet

`node scripts/quality/debt-summary.cjs --ratchet` is the fast production guard in the required CI quality lane. It reuses the scanner's syntax-aware comment analysis. The existing `quality:debt` and `quality:debt:strict` commands retain their broad advisory and opt-in strict behavior. The ratchet does not run the application typecheck or broad lint.

The inventory is the exact stage-zero Git index snapshot of JavaScript and TypeScript under `src/`, including declarations and generated source. Both capture and checks read immutable staged blobs in one bulk Git request, so another agent's unstaged source edits cannot enter the baseline. CI checks the same staged snapshot from its checkout. Explicit test, spec, and mock files are excluded. Ignored and untracked local source is outside this clone-compatible inventory. Stage all intended source edits, including new files and deletions, before checking or capturing the baseline. The command deliberately does not evaluate unstaged changes.

The versioned baseline is [debt-baseline.json](../../../scripts/quality/debt-baseline.json). Each file has separate ceilings for all explicit `any` type syntax, assertions directly to `any`, ESLint disable directives, and TypeScript ignore, expect-error, and nocheck directives. Assertions also contribute to the all-any count. Only actual comment directives count as suppressions; strings, examples, regular expressions, and JSX text do not. These syntax counts differ from raw text searches in the review.

A new production file starts with zero allowance. Debt removed from one file cannot pay for debt added to another. A reduction also requires lowering the baseline, so a later change cannot reuse obsolete headroom. Hold the baseline's Agora lock, then run `node scripts/quality/debt-summary.cjs --ratchet-update` and include its smaller baseline with the source change. This command refuses every per-file increase and never overwrites a malformed baseline. Intentional file moves require a reviewed baseline path move; they do not silently grant a new allowance. First capture is explicit. Normal CI checks never write the baseline.

The 2026-10-24 tracked-production capture contains 326 explicit any type nodes, including 53 direct any assertions, 150 ESLint disable directives, and 43 ts-ignore directives. Expect-error and nocheck counts are zero. These are accepted existing debt, not a claim that the code is type-safe. Preserve feature intent when repairing it.

Focused CLI fixtures verify that a deliberately added production assertion makes the exact CI command exit 1, that updates refuse baseline inflation, and that removed debt cannot return after a reduction. The baseline and regression test are new files in the shared working tree. Include both in the same reviewed commit as the required CI step; a clone without the baseline fails closed. Local checks validate the source and workflow wiring; no new GitHub run, commit, or publication is implied.

## Dependency-cycle inventory

`node scripts/quality/import-graph.cjs --cycles` extends the existing import graph with a fresh syntax-based cycle report. The orphan-report API retains its prior behavior. This command reads current filesystem production source under `src/`, including ignored and untracked local modules; it is deliberately broader than the staged-only CI debt baseline. It reads code without changing source or generated dependency headers.

The scan uses the installed TypeScript parser and repository tsconfig resolution, including aliases, directory indexes, and emitted `.js` import spellings. Explicit type imports and dynamic imports are separate edge kinds. Cycles are reported as maximal groups of mutually reachable modules, rather than every possible path around each group. For eager candidates, an isolated TypeScript emit from the same captured bytes checks whether unmarked imports of types disappear. This does not execute a module, reproduce Vite tree shaking, or prove an initialization failure. Worker URL graphs and nonliteral dynamic imports are outside this module-import inventory.

The 2026-10-24 C15 receipt measured **3007 files, 10257 resolved internal edges, 27 source cycle groups, 8 eager source candidates, and 5 groups surviving isolated emission**. Input signature: `76755713fe486f6c8b2f8649034b1ae914f2d90a9d9327eafe2af9e52b2cbc04`. The older generated dependency JSON dates from 2026-06-22 and was not used as current evidence.

The initial C15 declaration-inclusive scan was partial because the stale `src/devtools/buildingIdentityLab/PreviewBuilding3D.d.ts` twin contained three unresolved relative imports. C7 verified source ownership, matching export names, actual TypeScript resolution and no direct twin consumer before removing that tracked duplicate. The current C7 graph has **3005 files, 10258 edges, 25 source groups, 5 eager candidates and 2 isolated-emitted groups**, with `complete: true`, `eagerCoverageComplete: true` and zero unresolved imports within the supported scope. The CLI now exits 0. The two remaining emitted groups still belong to C11 and contact-flow task `.17`; complete import resolution is not cycle-free or runtime acceptance. Historical C15 counts below remain the baseline inventory.

### Compiler settings and source provenance

Claude independently accepted the initial five graph tests in Agora 8174 and 8179. Review refinements add two regressions: inline type-only import/export forms retain eager side effects when `verbatimModuleSyntax` is enabled, and cycle members carry Git provenance. Seven focused graph tests pass. The report records TypeScript 5.9.3, `isolatedModules: true`, `verbatimModuleSyntax: false`, and isolated transpile mode for this checked configuration. Classification reads the resolved setting; it does not assume type elision for a future verbatim configuration.

Each member below is labeled `tracked`, `untracked`, or `ignored` using `git ls-files` and `git check-ignore`. The pre-C18 refinement captured 2,590 tracked, 162 untracked and 255 ignored production modules. Local-only members are not assumed to exist in a clone and must retain that provenance when work is routed. These labels describe the observed Git state, not intended publication or owner acceptance.

### Prioritized emitted candidates

[GG-434](../../projects/GLOBAL_GAPS.md) retains the remaining repairs from this baseline. First repair the six-module river layering cycle under existing `agora-9ed9.11`, preserving accepted geometry and water proof boundaries. The movement/combat barrel task `agora-9ed9.16` is now repaired as described below. Remaining bounded cycle work is `.17` (waterfall contact flow), alongside C11 river layering; `.18` (ground worker/loader) and `.19` (region generator/field) are repaired below. Each requires behavior parity and a fresh graph showing its targeted cycle absent. The table below preserves the five initial emitted candidates. The separately verified movement, ground-worker and region repairs are closed; task creation and inventory alone do not establish a fix.

| Group | Modules | Internal emitted edges | Complete member list |
| --- | ---: | ---: | --- |
| E1 | 6 | 13 | [src/components/World3D/water/riverCliffFrame.ts](../../../src/components/World3D/water/riverCliffFrame.ts) (untracked)<br>[src/components/World3D/water/riverSistersCliffSurface.ts](../../../src/components/World3D/water/riverSistersCliffSurface.ts) (untracked)<br>[src/components/World3D/water/riverWaterfallCliff.ts](../../../src/components/World3D/water/riverWaterfallCliff.ts) (untracked)<br>[src/systems/world3d/river/riverHeadwaters.ts](../../../src/systems/world3d/river/riverHeadwaters.ts) (untracked)<br>[src/systems/world3d/river/riverRapidsReconstruction.ts](../../../src/systems/world3d/river/riverRapidsReconstruction.ts) (untracked)<br>[src/systems/world3d/river/riverReach.ts](../../../src/systems/world3d/river/riverReach.ts) (tracked) |
| E2 | 3 | 3 | [src/commands/effects/MovementCommand.ts](../../../src/commands/effects/MovementCommand.ts) (tracked)<br>[src/utils/combat/index.ts](../../../src/utils/combat/index.ts) (tracked)<br>[src/utils/combat/shoveUtils.ts](../../../src/utils/combat/shoveUtils.ts) (tracked) |
| E3 | 3 | 4 | [src/systems/world3d/river/waterfallContactFlow.ts](../../../src/systems/world3d/river/waterfallContactFlow.ts) (untracked)<br>[src/systems/world3d/river/waterfallImpactLocus.ts](../../../src/systems/world3d/river/waterfallImpactLocus.ts) (untracked)<br>[src/systems/world3d/river/waterfallSourceSupport.ts](../../../src/systems/world3d/river/waterfallSourceSupport.ts) (untracked) |
| E4 | 2 | 2 | [src/systems/worldforge/bridge/groundChunkLoader.ts](../../../src/systems/worldforge/bridge/groundChunkLoader.ts) (tracked)<br>[src/systems/worldforge/bridge/groundChunkWorkerCore.ts](../../../src/systems/worldforge/bridge/groundChunkWorkerCore.ts) (tracked) |
| E5 | 2 | 2 | [src/systems/worldforge/region/generateRegion.ts](../../../src/systems/worldforge/region/generateRegion.ts) (tracked)<br>[src/systems/worldforge/region/regionTerrainField.ts](../../../src/systems/worldforge/region/regionTerrainField.ts) (tracked) |

### Complete observed source group list

These groups include explicit type edges and deferred imports. An observed group can disappear from emitted code; its presence alone is not a runtime defect. The three declaration-resolution issues above may hide additional type relationships. Temporary full edges and raw receipts remain in ignored `.agent/scratch/agora-review-c15/`; the durable member lists are below.

| Group | Modules | Internal source edges | Complete member list |
| --- | ---: | ---: | --- |
| S1 | 21 | 87 | [src/systems/worldforge/fmg/biomes.ts](../../../src/systems/worldforge/fmg/biomes.ts) (tracked)<br>[src/systems/worldforge/fmg/burgs-generator.ts](../../../src/systems/worldforge/fmg/burgs-generator.ts) (tracked)<br>[src/systems/worldforge/fmg/coa-generator.ts](../../../src/systems/worldforge/fmg/coa-generator.ts) (tracked)<br>[src/systems/worldforge/fmg/cultures-generator.ts](../../../src/systems/worldforge/fmg/cultures-generator.ts) (tracked)<br>[src/systems/worldforge/fmg/features.ts](../../../src/systems/worldforge/fmg/features.ts) (tracked)<br>[src/systems/worldforge/fmg/ice.ts](../../../src/systems/worldforge/fmg/ice.ts) (tracked)<br>[src/systems/worldforge/fmg/lakes.ts](../../../src/systems/worldforge/fmg/lakes.ts) (tracked)<br>[src/systems/worldforge/fmg/markers-generator.ts](../../../src/systems/worldforge/fmg/markers-generator.ts) (tracked)<br>[src/systems/worldforge/fmg/military-generator.ts](../../../src/systems/worldforge/fmg/military-generator.ts) (tracked)<br>[src/systems/worldforge/fmg/names-generator.ts](../../../src/systems/worldforge/fmg/names-generator.ts) (tracked)<br>[src/systems/worldforge/fmg/provinces-generator.ts](../../../src/systems/worldforge/fmg/provinces-generator.ts) (tracked)<br>[src/systems/worldforge/fmg/religions-generator.ts](../../../src/systems/worldforge/fmg/religions-generator.ts) (tracked)<br>[src/systems/worldforge/fmg/river-generator.ts](../../../src/systems/worldforge/fmg/river-generator.ts) (tracked)<br>[src/systems/worldforge/fmg/routes-generator.ts](../../../src/systems/worldforge/fmg/routes-generator.ts) (tracked)<br>[src/systems/worldforge/fmg/states-generator.ts](../../../src/systems/worldforge/fmg/states-generator.ts) (tracked)<br>[src/systems/worldforge/fmg/utils/graphUtils.ts](../../../src/systems/worldforge/fmg/utils/graphUtils.ts) (tracked)<br>[src/systems/worldforge/fmg/utils/index.ts](../../../src/systems/worldforge/fmg/utils/index.ts) (tracked)<br>[src/systems/worldforge/fmg/utils/unitUtils.ts](../../../src/systems/worldforge/fmg/utils/unitUtils.ts) (tracked)<br>[src/systems/worldforge/fmg/zones-generator.ts](../../../src/systems/worldforge/fmg/zones-generator.ts) (tracked)<br>[src/systems/worldforge/forests/forestsPass.ts](../../../src/systems/worldforge/forests/forestsPass.ts) (tracked)<br>[src/systems/worldforge/mountains/mountainsPass.ts](../../../src/systems/worldforge/mountains/mountainsPass.ts) (tracked) |
| S2 | 18 | 45 | [src/systems/intrigue/RumorMillSystem.ts](../../../src/systems/intrigue/RumorMillSystem.ts) (tracked)<br>[src/systems/npc/backgroundBrief.ts](../../../src/systems/npc/backgroundBrief.ts) (tracked)<br>[src/systems/social/npcEmotionalMemory.ts](../../../src/systems/social/npcEmotionalMemory.ts) (tracked)<br>[src/systems/social/npcWitnessMemory.ts](../../../src/systems/social/npcWitnessMemory.ts) (tracked)<br>[src/types/character.ts](../../../src/types/character.ts) (tracked)<br>[src/types/combat.ts](../../../src/types/combat.ts) (tracked)<br>[src/types/effects.ts](../../../src/types/effects.ts) (tracked)<br>[src/types/items.ts](../../../src/types/items.ts) (tracked)<br>[src/types/memory.ts](../../../src/types/memory.ts) (tracked)<br>[src/types/planes.ts](../../../src/types/planes.ts) (tracked)<br>[src/types/provenance.ts](../../../src/types/provenance.ts) (tracked)<br>[src/types/rituals.ts](../../../src/types/rituals.ts) (tracked)<br>[src/types/spellAttackMetadata.ts](../../../src/types/spellAttackMetadata.ts) (tracked)<br>[src/types/spellEffectTypes.ts](../../../src/types/spellEffectTypes.ts) (tracked)<br>[src/types/spellTargeting.ts](../../../src/types/spellTargeting.ts) (tracked)<br>[src/types/spells.ts](../../../src/types/spells.ts) (tracked)<br>[src/types/visuals.ts](../../../src/types/visuals.ts) (tracked)<br>[src/types/world.ts](../../../src/types/world.ts) (tracked) |
| S3 | 16 | 28 | [src/data/deities/index.ts](../../../src/data/deities/index.ts) (tracked)<br>[src/data/villagePersonalityProfiles.ts](../../../src/data/villagePersonalityProfiles.ts) (tracked)<br>[src/state/actionTypes.ts](../../../src/state/actionTypes.ts) (tracked)<br>[src/systems/worldforge/bridge/legacySubmapBridge.ts](../../../src/systems/worldforge/bridge/legacySubmapBridge.ts) (tracked)<br>[src/systems/worldforge/chronicle/worldChronicle.ts](../../../src/systems/worldforge/chronicle/worldChronicle.ts) (tracked)<br>[src/systems/worldforge/dungeon/world/chronicle.ts](../../../src/systems/worldforge/dungeon/world/chronicle.ts) (tracked)<br>[src/systems/worldforge/dungeon/world/deriveIdentity.ts](../../../src/systems/worldforge/dungeon/world/deriveIdentity.ts) (tracked)<br>[src/systems/worldforge/dungeon/world/dungeonSites.ts](../../../src/systems/worldforge/dungeon/world/dungeonSites.ts) (tracked)<br>[src/systems/worldforge/town/canonicalTown.ts](../../../src/systems/worldforge/town/canonicalTown.ts) (tracked)<br>[src/systems/worldforge/townsim/buildingHistoryCompaction.ts](../../../src/systems/worldforge/townsim/buildingHistoryCompaction.ts) (tracked)<br>[src/systems/worldforge/townsim/festivals.ts](../../../src/systems/worldforge/townsim/festivals.ts) (tracked)<br>[src/systems/worldforge/townsim/townSim.ts](../../../src/systems/worldforge/townsim/townSim.ts) (tracked)<br>[src/systems/worldforge/townsim/townSimRegistry.ts](../../../src/systems/worldforge/townsim/townSimRegistry.ts) (tracked)<br>[src/types/actions.ts](../../../src/types/actions.ts) (tracked)<br>[src/types/index.ts](../../../src/types/index.ts) (tracked)<br>[src/types/state.ts](../../../src/types/state.ts) (tracked) |
| S4 | 9 | 19 | [src/systems/world3d/ocean/oceanBeach.ts](../../../src/systems/world3d/ocean/oceanBeach.ts) (tracked)<br>[src/systems/world3d/ocean/oceanBuoyancyProbe.ts](../../../src/systems/world3d/ocean/oceanBuoyancyProbe.ts) (tracked)<br>[src/systems/world3d/ocean/oceanField.ts](../../../src/systems/world3d/ocean/oceanField.ts) (tracked)<br>[src/systems/world3d/ocean/oceanFoam.ts](../../../src/systems/world3d/ocean/oceanFoam.ts) (tracked)<br>[src/systems/world3d/ocean/oceanMouth.ts](../../../src/systems/world3d/ocean/oceanMouth.ts) (untracked)<br>[src/systems/world3d/ocean/oceanRocks.ts](../../../src/systems/world3d/ocean/oceanRocks.ts) (tracked)<br>[src/systems/world3d/ocean/oceanSeabed.ts](../../../src/systems/world3d/ocean/oceanSeabed.ts) (tracked)<br>[src/systems/world3d/ocean/oceanSurface.ts](../../../src/systems/world3d/ocean/oceanSurface.ts) (tracked)<br>[src/systems/world3d/ocean/oceanWake.ts](../../../src/systems/world3d/ocean/oceanWake.ts) (tracked) |
| S5 | 9 | 26 | [src/systems/world3d/river/waterfallBackpressureObserver.ts](../../../src/systems/world3d/river/waterfallBackpressureObserver.ts) (untracked)<br>[src/systems/world3d/river/waterfallContactFilm.ts](../../../src/systems/world3d/river/waterfallContactFilm.ts) (untracked)<br>[src/systems/world3d/river/waterfallContactFlow.ts](../../../src/systems/world3d/river/waterfallContactFlow.ts) (untracked)<br>[src/systems/world3d/river/waterfallContactGeometry.ts](../../../src/systems/world3d/river/waterfallContactGeometry.ts) (untracked)<br>[src/systems/world3d/river/waterfallFilmFront.ts](../../../src/systems/world3d/river/waterfallFilmFront.ts) (untracked)<br>[src/systems/world3d/river/waterfallImpactLocus.ts](../../../src/systems/world3d/river/waterfallImpactLocus.ts) (untracked)<br>[src/systems/world3d/river/waterfallLayeredFilm.ts](../../../src/systems/world3d/river/waterfallLayeredFilm.ts) (untracked)<br>[src/systems/world3d/river/waterfallLayeredFilmEnergyObserver.ts](../../../src/systems/world3d/river/waterfallLayeredFilmEnergyObserver.ts) (untracked)<br>[src/systems/world3d/river/waterfallSourceSupport.ts](../../../src/systems/world3d/river/waterfallSourceSupport.ts) (untracked) |
| S6 | 8 | 14 | [src/components/DesignPreview/steps/PreviewBiome.tsx](../../../src/components/DesignPreview/steps/PreviewBiome.tsx) (ignored)<br>[src/components/ThreeDModal/Experimental/BiomeHeightFog.tsx](../../../src/components/ThreeDModal/Experimental/BiomeHeightFog.tsx) (ignored)<br>[src/components/ThreeDModal/Experimental/BiomeWater.tsx](../../../src/components/ThreeDModal/Experimental/BiomeWater.tsx) (ignored)<br>[src/components/ThreeDModal/Experimental/BiomeWeather.tsx](../../../src/components/ThreeDModal/Experimental/BiomeWeather.tsx) (ignored)<br>[src/components/ThreeDModal/Experimental/VoxelAmbience.tsx](../../../src/components/ThreeDModal/Experimental/VoxelAmbience.tsx) (ignored)<br>[src/components/ThreeDModal/Experimental/VoxelScatter.tsx](../../../src/components/ThreeDModal/Experimental/VoxelScatter.tsx) (ignored)<br>[src/components/ThreeDModal/Experimental/VoxelScene.tsx](../../../src/components/ThreeDModal/Experimental/VoxelScene.tsx) (ignored)<br>[src/components/ThreeDModal/Experimental/VoxelTerrain.tsx](../../../src/components/ThreeDModal/Experimental/VoxelTerrain.tsx) (ignored) |
| S7 | 6 | 6 | [src/components/ui/LoadingSpinner.tsx](../../../src/components/ui/LoadingSpinner.tsx) (tracked)<br>[src/context/SpellContext.tsx](../../../src/context/SpellContext.tsx) (tracked)<br>[src/utils/character/index.ts](../../../src/utils/character/index.ts) (tracked)<br>[src/utils/character/spellFilterUtils.ts](../../../src/utils/character/spellFilterUtils.ts) (tracked)<br>[src/utils/core/factories.ts](../../../src/utils/core/factories.ts) (tracked)<br>[src/utils/core/index.ts](../../../src/utils/core/index.ts) (tracked) |
| S8 | 6 | 14 | [src/components/World3D/water/riverCliffFrame.ts](../../../src/components/World3D/water/riverCliffFrame.ts) (untracked)<br>[src/components/World3D/water/riverSistersCliffSurface.ts](../../../src/components/World3D/water/riverSistersCliffSurface.ts) (untracked)<br>[src/components/World3D/water/riverWaterfallCliff.ts](../../../src/components/World3D/water/riverWaterfallCliff.ts) (untracked)<br>[src/systems/world3d/river/riverHeadwaters.ts](../../../src/systems/world3d/river/riverHeadwaters.ts) (untracked)<br>[src/systems/world3d/river/riverRapidsReconstruction.ts](../../../src/systems/world3d/river/riverRapidsReconstruction.ts) (untracked)<br>[src/systems/world3d/river/riverReach.ts](../../../src/systems/world3d/river/riverReach.ts) (tracked) |
| S9 | 6 | 11 | [src/systems/worldforge/bridge/dungeonEntrances.ts](../../../src/systems/worldforge/bridge/dungeonEntrances.ts) (tracked)<br>[src/systems/worldforge/bridge/groundChunkLoader.ts](../../../src/systems/worldforge/bridge/groundChunkLoader.ts) (tracked)<br>[src/systems/worldforge/bridge/groundChunkWorkerCore.ts](../../../src/systems/worldforge/bridge/groundChunkWorkerCore.ts) (tracked)<br>[src/systems/worldforge/bridge/groundHostiles.ts](../../../src/systems/worldforge/bridge/groundHostiles.ts) (tracked)<br>[src/systems/worldforge/bridge/groundProps.ts](../../../src/systems/worldforge/bridge/groundProps.ts) (tracked)<br>[src/systems/worldforge/bridge/townVegetation.ts](../../../src/systems/worldforge/bridge/townVegetation.ts) (tracked) |
| S10 | 5 | 10 | [src/systems/worldforge/town/architectureDistricts.ts](../../../src/systems/worldforge/town/architectureDistricts.ts) (tracked)<br>[src/systems/worldforge/town/buildingEnsembles.ts](../../../src/systems/worldforge/town/buildingEnsembles.ts) (tracked)<br>[src/systems/worldforge/town/courtyardSpaces.ts](../../../src/systems/worldforge/town/courtyardSpaces.ts) (tracked)<br>[src/systems/worldforge/town/population.ts](../../../src/systems/worldforge/town/population.ts) (tracked)<br>[src/systems/worldforge/town/townEngine.ts](../../../src/systems/worldforge/town/townEngine.ts) (tracked) |
| S11 | 4 | 5 | [src/systems/world3d/buildingModels.ts](../../../src/systems/world3d/buildingModels.ts) (tracked)<br>[src/systems/world3d/types.ts](../../../src/systems/world3d/types.ts) (tracked)<br>[src/systems/worldforge/bridge/buildingHistoryParts.ts](../../../src/systems/worldforge/bridge/buildingHistoryParts.ts) (tracked)<br>[src/systems/worldforge/bridge/interiorParts.ts](../../../src/systems/worldforge/bridge/interiorParts.ts) (tracked) |
| S12 | 4 | 6 | [src/systems/worldforge/mountains/mountainClusters.ts](../../../src/systems/worldforge/mountains/mountainClusters.ts) (tracked)<br>[src/systems/worldforge/mountains/mountainTunables.ts](../../../src/systems/worldforge/mountains/mountainTunables.ts) (tracked)<br>[src/systems/worldforge/travel/roadTunables.ts](../../../src/systems/worldforge/travel/roadTunables.ts) (tracked)<br>[src/systems/worldforge/travel/routeTerrain.ts](../../../src/systems/worldforge/travel/routeTerrain.ts) (tracked) |
| S13 | 3 | 3 | [src/commands/effects/MovementCommand.ts](../../../src/commands/effects/MovementCommand.ts) (tracked)<br>[src/utils/combat/index.ts](../../../src/utils/combat/index.ts) (tracked)<br>[src/utils/combat/shoveUtils.ts](../../../src/utils/combat/shoveUtils.ts) (tracked) |
| S14 | 3 | 4 | [src/components/World3D/water/riverExperimentStations.ts](../../../src/components/World3D/water/riverExperimentStations.ts) (untracked)<br>[src/components/World3D/water/riverReachScene.ts](../../../src/components/World3D/water/riverReachScene.ts) (tracked)<br>[src/components/World3D/water/waterfallTerrainComparisonView.ts](../../../src/components/World3D/water/waterfallTerrainComparisonView.ts) (untracked) |
| S15 | 3 | 4 | [src/systems/world3d/river/cascadeRuntimeV1FinitePatch.ts](../../../src/systems/world3d/river/cascadeRuntimeV1FinitePatch.ts) (untracked)<br>[src/systems/world3d/river/cascadeRuntimeV1Projection.ts](../../../src/systems/world3d/river/cascadeRuntimeV1Projection.ts) (untracked)<br>[src/systems/world3d/river/cascadeRuntimeV1SharedRemap.ts](../../../src/systems/world3d/river/cascadeRuntimeV1SharedRemap.ts) (untracked) |
| S16 | 3 | 5 | [src/systems/world3d/river/riverRectGrid.ts](../../../src/systems/world3d/river/riverRectGrid.ts) (untracked)<br>[src/systems/world3d/river/riverSolver.ts](../../../src/systems/world3d/river/riverSolver.ts) (tracked)<br>[src/systems/world3d/river/riverSpillTransfer.ts](../../../src/systems/world3d/river/riverSpillTransfer.ts) (untracked) |
| S17 | 3 | 4 | [src/systems/worldforge/town/architectureStyle.ts](../../../src/systems/worldforge/town/architectureStyle.ts) (tracked)<br>[src/systems/worldforge/town/buildingMotifs.ts](../../../src/systems/worldforge/town/buildingMotifs.ts) (tracked)<br>[src/systems/worldforge/town/buildingWeathering.ts](../../../src/systems/worldforge/town/buildingWeathering.ts) (tracked) |
| S18 | 2 | 2 | [src/components/World3D/water/riverSpillInstances.ts](../../../src/components/World3D/water/riverSpillInstances.ts) (untracked)<br>[src/components/World3D/water/riverSpillView.ts](../../../src/components/World3D/water/riverSpillView.ts) (untracked) |
| S19 | 2 | 2 | [src/components/World3D/WebGPUProbe.tsx](../../../src/components/World3D/WebGPUProbe.tsx) (tracked)<br>[src/components/World3D/WebGPUProbeScene.tsx](../../../src/components/World3D/WebGPUProbeScene.tsx) (tracked) |
| S20 | 2 | 2 | [src/services/ollama/client.ts](../../../src/services/ollama/client.ts) (tracked)<br>[src/services/ollama/router.ts](../../../src/services/ollama/router.ts) (tracked) |
| S21 | 2 | 2 | [src/systems/world/NobleIntrigueManager.ts](../../../src/systems/world/NobleIntrigueManager.ts) (tracked)<br>[src/systems/world/WorldEventManager.ts](../../../src/systems/world/WorldEventManager.ts) (tracked) |
| S22 | 2 | 2 | [src/systems/world3d/river/riverFloodSurge.ts](../../../src/systems/world3d/river/riverFloodSurge.ts) (untracked)<br>[src/systems/world3d/river/riverSourceHistory.ts](../../../src/systems/world3d/river/riverSourceHistory.ts) (untracked) |
| S23 | 2 | 2 | [src/systems/worldforge/forests/forestClusters.ts](../../../src/systems/worldforge/forests/forestClusters.ts) (tracked)<br>[src/systems/worldforge/forests/forestTunables.ts](../../../src/systems/worldforge/forests/forestTunables.ts) (tracked) |
| S24 | 2 | 2 | [src/systems/worldforge/interior/blueprintTypes.ts](../../../src/systems/worldforge/interior/blueprintTypes.ts) (tracked)<br>[src/systems/worldforge/interior/footprint.ts](../../../src/systems/worldforge/interior/footprint.ts) (tracked) |
| S25 | 2 | 2 | [src/systems/worldforge/interior/briefProgram.ts](../../../src/systems/worldforge/interior/briefProgram.ts) (tracked)<br>[src/systems/worldforge/interior/program.ts](../../../src/systems/worldforge/interior/program.ts) (tracked) |
| S26 | 2 | 2 | [src/systems/worldforge/region/generateRegion.ts](../../../src/systems/worldforge/region/generateRegion.ts) (tracked)<br>[src/systems/worldforge/region/regionTerrainField.ts](../../../src/systems/worldforge/region/regionTerrainField.ts) (tracked) |
| S27 | 2 | 2 | [src/systems/worldforge/terrain/flipCompute.ts](../../../src/systems/worldforge/terrain/flipCompute.ts) (tracked)<br>[src/systems/worldforge/terrain/flipConvexContact.ts](../../../src/systems/worldforge/terrain/flipConvexContact.ts) (untracked) |

### Verified movement cycle repair

C16 changes MovementCommand to import the existing `getDistance` implementation directly from `utils/combat/combatUtils`, avoiding the combat barrel that also exports shove commands. All barrel exports remain available. No helper implementation, effect data, movement rule, or shove rule changed. The previously mixed line endings in this owned file were normalized to its dominant CRLF style. The named-file advisory sync reported the header already current and wrote no dependent files.

Both existing MovementCommand suites and the shove suite pass: **34 tests across three files**. Scoped typecheck reports **zero errors and zero suppressed imported-file diagnostics**. A fresh graph has **26 source groups, seven eager syntax candidates and four groups surviving isolated emission**, with no group containing MovementCommand or shoveUtils. The same three stale declaration imports keep full graph coverage partial. New input signature: `3b30aee7e4e8a7707e9ba7bdce719ada7efe6c7e7f5c553de217f50d1c205c2d`. This proves the targeted static dependency repair and focused behavior coverage; it does not establish whole-game runtime or cycle-free acceptance.

### Verified ground loader and worker cycle repair

C18 moves the existing ground-mesh assembly body unchanged into a shared pure leaf with injected existing samplers. The worker-compatible API and inline loader both use it. The [streaming domain](streamed-3d-world.md#shared-ground-mesh-assembly) describes current ownership and retained public contracts.

All 55 existing tests pass across four affected suites, including actual worker/inline bundle parity at five chunks and three LODs, staged-world equivalence, ground fixtures and fake-worker protocol/lifecycle. Scoped typecheck has zero errors and zero suppressed imported-file diagnostics. The three-file advisory wave wrote only its owned paths. No sampler, message protocol, cache, termination or fallback implementation changed. Fixture placement diagnostics remain separately registered in GG-435.

The refined fresh graph contains 3,008 source files, 26 source groups, six eager syntax candidates and **three groups surviving isolated emission**, with no loader/core/mesh group. The three unresolved declaration imports remain explicit. Input signature: `7271a795a4bd29273f8b6b237e180911c1fa04de29f0a3e396dd10393ed53365`. River cliff/headwaters (C11), waterfall contact flow (.17), and region generator/field (.19) remain open in GG-434. All group members carry Git provenance; the remaining river groups include untracked local source and must not be represented as clone-wide findings. No actual browser-worker, whole-game or cycle-free acceptance is implied.

### Verified region generator and field cycle repair

C19 moves the existing IDW radius and ridge helpers unchanged into the existing point-sampler module. Generator exports remain available through re-exports. The [region terrain domain](region-terrain.md#shared-point-sampler-math) records current ownership and exact preservation boundaries.

All 40 existing generation, field and river-course tests pass, including frozen goldens, byte-equal determinism and shared-point seam checks. Scoped two-file typecheck has zero errors and zero suppressed imported diagnostics; one header wave wrote only those two files. The fresh graph has **25 source groups, five eager syntax candidates and two groups surviving isolated emission**, with the generator/field group absent. The same three stale declaration imports keep full graph coverage partial. Input signature: `c68be8404683b3ad8e73f823002bc8a8b3c568de7944439db502c6e049d60f8b`.

GG-434 now retains only the river cliff/headwaters group (C11) and waterfall contact-flow group (.17). Their per-member provenance includes untracked local source; they are not clone-wide cycle findings. No numeric terrain change, new golden, browser rendering, live-water or whole-game acceptance is claimed.

### Waterfall contact-flow cycle repair

C17 moves the existing `waterfallDownwardRoot` declaration unchanged into dependency-free `waterfallFlightRoots.ts`. Contact flow, source support and impact-locus code now import the same leaf. The original public export through `waterfallContactFlow.ts` remains available. All three original source files were untracked local application source before this task; the new leaf is also untracked. This repair preserves that unfinished work and does not establish clone-wide coverage.

The exact inverse transformation reconstructs all three frozen pre-edit files byte-for-byte, excluding generated advisory headers. The function declaration is byte-identical. A separate-VM comparison passes 10,096 cases with `Object.is`, including signed zero, and exact error names and messages. Four-file scoped typechecking reports zero errors and zero suppressed imported diagnostics; scoped ESLint passes. One header wave touched only the four owned files.

The fresh graph contains 3,077 source modules, 27 source groups, 4 eager syntax candidates and **one group surviving isolated emission**, with complete supported coverage and zero unresolved imports. The contact-flow emitted group is absent; type-only source relationships remain. The six-module river cliff/headwaters group remains open under C11 and GG-438. Input signature: `79520100c66ba889675529d7a4a1a74fb820765b35bfbf1240332a5c82131b36`.

The unchanged seven-suite baseline has 82 passing tests and one existing 60-second timeout in the native 40.233333-second source/drain/restart fixture. The first identical post-edit run had 80 passing tests and three timeouts. Its two new timing failures both pass in a scoped diagnostic under the same 60-second limit (48.858 and 57.472 seconds). One justified full retry returns to 82 passing tests and the same inherited timeout; the existing baseline comparator reports zero new failures, zero missing tests and zero unverified identities. All reports are retained separately. The suite remains red because the inherited timeout remains unresolved; this is not a green water acceptance. Argon independently accepted the static cycle repair in Agora message 8522; task `agora-9ed9.17` is complete for that bounded scope. No test limit, fixture, solver arithmetic, source geometry or golden was changed. No rendered, physical-flow, performance or live-epoch acceptance follows from this static repair.
