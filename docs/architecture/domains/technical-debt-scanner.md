# Technical Debt Scanner

Verified: 2026-09-23

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
