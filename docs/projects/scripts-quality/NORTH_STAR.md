---
schema_version: 1
project: Scripts: Quality
slug: scripts-quality
category: Documentation
main_category: "Tools, Docs & Agents"
subcategory: "Scripts & Automation"
status: active
last_updated: 2026-06-12
iteration: 3
confidence: medium
evidence: docs/projects/scripts-quality; docs/projects/script-tests (merged support surface); docs/projects/DECISION_BLITZ_2026-06-10.md (D21)
gap_signal: "2 open gaps; G3 and G4 remain open after script-tests merge"
protocol: living project doc set
next_step: Run npm run quality:debt at each quality-scope change, keep the routed scripts-git follow-up outside this project unless ownership changes, and pick up the inherited script-tests gaps (ST-GAP-001 first) as the next test slices.
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
required_verification:
  - quality_debt_command
  - docs_consistency
completed_verification:
  - quality_debt_command (2026-06-08)
  - docs_consistency
last_proof: 2026-06-08
workflow_gaps_reviewed: 2026-06-08
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# NORTH_STAR: Scripts: Quality

Status: active
Last updated: 2026-06-12

## Why This Project Exists

`scripts/quality` owns the local debt-report entrypoint for quality debt visibility.
The project exists to keep debt reporting and push-policy expectations discoverable
for future agents without over-committing to cleanup work in unrelated slices.

## Intended Outcome

Create a compact continuation surface that tells a future agent:
- what quality debt tooling is actually implemented,
- how it is wired into push workflow policy,
- what is still unknown or unverified,
- and where to continue next.

## Dashboard Card Schema

Project: Scripts: Quality
Slug: scripts-quality
Category: Documentation
Status: active
Confidence: medium
Evidence: docs/projects/scripts-quality
Gap signal: repeatable checkpoint convention established; 1 adjacent follow-up remains routed to scripts-git; script-tests merged in 2026-06-10 (ST-GAP-001..004 owned here)
Protocol: living project doc set
Next step: Run `npm run quality:debt` at each quality-scope change, keep the routed scripts-git follow-up outside this project unless ownership changes, and pick up the inherited script-tests gaps (ST-GAP-001 first).

## Decision (2026-06-10): Script Tests Merged Into This Project

Recorded from the receiving side of DECISION_BLITZ D21 (Remy, project owner,
batched decision session 2026-06-10; master record
`docs/projects/DECISION_BLITZ_2026-06-10.md`).

- **Scripts: Quality now owns the script-tests surface.**
  `docs/projects/script-tests` becomes a merged-reference support surface of
  this project; its tracker row becomes merged-reference.
- Inherited scope: the `scripts/__tests__` continuity contract (file map and
  integration points documented in `docs/projects/script-tests/NORTH_STAR.md`)
  and the open gaps ST-GAP-001 through ST-GAP-004 in
  `docs/projects/script-tests/GAPS.md` (ST-GAP-001 â€” `spellFieldInventory`
  fixture test â€” remains the safest first slice).
- Local records: `docs/projects/scripts-quality/DECISIONS.md` D2 (receiving
  side) and `docs/projects/script-tests/DECISIONS.md` D2 (merged side).
Required verification: quality_debt_command, docs_consistency
Completed verification: quality_debt_command (2026-06-08), docs_consistency
Last proof: 2026-06-08
Workflow gaps reviewed: 2026-06-08

## File Map

- `scripts/quality/debt-summary.cjs`
  - runs `npm run typecheck` and an ESLint JSON summary,
  - prints grouped counts only in normal mode,
  - supports strict exit in `--strict`.
- `package.json` scripts
  - `quality:debt` -> `node scripts/quality/debt-summary.cjs`
  - `quality:debt:strict` -> strict mode of same command
  - `typecheck`, `lint`, `sync-check`, `intent-gate`
- `docs/DEVELOPMENT_GUIDE.md`
  - documents the ordinary and strict quality flow for pushes.
- `scripts/git/pre-push-aralia.sh`
  - runs `npm run quality:debt:strict` only when `ARALIA_PRE_PUSH_STRICT=1`.

## Implemented State

- Implemented:
  - single debt-report script in `scripts/quality/debt-summary.cjs`,
  - npm script wiring in `package.json`,
  - policy integration in `scripts/git/pre-push-aralia.sh`,
  - dashboard-facing schema section in this North Star file.
  - lint scope for quality debt is intentionally aligned to `src`, `scripts`, and `tests`.
- Not yet implemented:
  - automated verification that debt summaries are produced and reviewed on a fixed cadence,
  - persisted debt summaries for trend tracking.
  - mirrored automation for the routed scripts-git cadence follow-up.

## Integrations

`scripts/quality` is not a standalone checker. It is intended to sit inside the
larger push policy chain:

1. `scripts/git/pre-push-aralia.sh` runs `sync-check` and `git:hygiene` as hard gates.
2. `intent-gate` must pass (strict mode by default for pre-push).
3. `quality:debt:strict` runs only in `ARALIA_PRE_PUSH_STRICT=1` mode.
4. The repository guide (`docs/DEVELOPMENT_GUIDE.md`) defines that ordinary pushes
   use non-blocking quality summaries.

## Scope Boundaries

In scope:
- documentation for quality reporting ownership and policy integration,
- tracker and gap alignment for this scripts-quality workstream,
- (since 2026-06-10, D21 merge) the script-tests support surface: `scripts/__tests__` coverage continuity and the inherited ST-GAP-001..004 test slices.

Out of scope:
- rewriting `scripts/quality/debt-summary.cjs`,
- changing pre-push policy itself,
- broad lint/type refactors.

Do not edit outside `docs/projects/scripts-quality/` in this task.

## Gaps and Uncertainties

1. No local checkpoint captures debt-output baselines or trend history.
2. No documented "expected range" for lint/type diagnostic growth exists.
3. The routed cadence/policy follow-up is still owned by scripts-git, not this project.

## Command-Evidence Check (2026-06-08)

- `npm run quality:debt` output snapshot:
  - TypeScript debt: 73 diagnostics (top codes: TS2556 x11, TS6307 x9, TS7006 x7, TS18046 x6, TS18048 x6).
  - ESLint debt: 15 errors, 1706 warnings across `src` / `scripts` / `tests`.
  - File areas in debt output remain: `src`, `scripts`, `tests`.
- Decision: `debt-summary.cjs` is intentionally scoped to the same folder set as `npm run lint` so the debt surface tracks pre-existing policy expectations without widening this local summary surface.
- Decision: the remaining cadence/policy follow-up stays routed to `scripts-git`; scripts-quality keeps the checkpoint convention and debt snapshot cadence only.

## Checkpoint Convention

- Capture a one-line `npm run quality:debt` snapshot only when a quality-scope,
  lint-scope, or push-policy change is made.
- Keep the durable note compact: TypeScript diagnostic count, ESLint error/warning
  count, top file-area groups, date, and reason for the checkpoint.
- Do not turn this workstream into broad lint/type cleanup unless the active task
  explicitly owns that cleanup.
- 2026-06-08 checkpoint for this convention pass: TypeScript remains at 73
  diagnostics; ESLint remains at 15 errors and 1706 warnings; file areas remain
  `src` (1437), `scripts` (282), and `tests` (2).

## Active Task

| Field | Value |
|---|---|
| Task | Keep the quality-debt checkpoint convention current and keep the routed scripts-git follow-up outside this project unless ownership changes |
| Acceptance criteria | NORTH_STAR, TRACKER, and GAPS stay internally consistent; the dashboard card schema still shows one routed adjacent follow-up; no local policy or human-review gate is opened |
| Allowed boundaries | `docs/projects/scripts-quality/*` |
| Stop condition | docs are internally consistent, the routed follow-up is explicit, and the checkpoint convention remains the local owner |
| Next checks | Run `npm run quality:debt` on quality-scope, lint-scope, or push-policy changes and record one compact snapshot here |

## Artifact Boundary

Keep durable intent here and in the tracker/gap file. Keep raw command output,
operator notes, and local run diagnostics outside this project unless a short, durable
excerpt is needed to preserve a real decision or external proof.

## Resume Path

1. Read this file.
2. Read `docs/projects/scripts-quality/TRACKER.md`.
3. Read `docs/projects/scripts-quality/GAPS.md`.
4. Confirm `scripts/quality/debt-summary.cjs`, `package.json`, and
   `scripts/git/pre-push-aralia.sh` still match this map.
5. Keep the `Dashboard Card Schema` section current before the next handoff.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
