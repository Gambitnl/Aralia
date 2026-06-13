---
schema_version: 1
project: Scripts: Tooling
slug: scripts-tooling
category: Developer Tooling
main_category: "Tools, Docs & Agents"
subcategory: "Scripts & Automation"
status: active
last_updated: 2026-06-05
iteration: 2
confidence: medium
evidence: docs/projects/scripts-tooling
gap_signal: 3 open gaps
protocol: living project doc set
next_step: Review ST-2 in TRACKER.md and decide whether trackRun() coverage should stay selective or be expanded.
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
  - docs_consistency
completed_verification:
  - docs_consistency
last_proof: 2026-06-05
workflow_gaps_reviewed: 2026-06-05
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# NORTH_STAR: Scripts: Tooling

Status: active
Last updated: 2026-06-05

## Dashboard Card Schema

Project: Scripts: Tooling
Slug: scripts-tooling
Category: Developer Tooling
Status: active
Confidence: medium
Evidence: docs/projects/scripts-tooling
Gap signal: 3 open gaps
Protocol: living project doc set
Next step: Review ST-2 in TRACKER.md and decide whether `trackRun()` coverage should stay selective or be expanded.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## Why this project exists

`scripts/tooling` is the shared developer-maintenance surface for Aralia. This project exists to preserve:

- tooling intent,
- workflow touchpoints,
- run metadata contracts,
- unresolved risks that should not be lost during future slices.

The goal is a cold-start map, not a cleanup summary.

## Purpose and scope

Document the `scripts/tooling` bundle, how it is consumed by dev workflows and tooling UI, and what remains open.

Allowed scope for this documentation pass:

- `scripts/tooling` (evidence files),
- direct runtime/UI integration in `vite.config.ts` and `misc/tooling.html`,
- references in workflow docs that call these scripts.

## File map

| File | Role |
|---|---|
| `scripts/tooling/script-registry.json` | Canonical script registry data with bucket + feature branch metadata |
| `scripts/tooling/.run-log.json` | Shared run history for each script and last-run timestamps |
| `scripts/tooling/script-tracker.ts` | Tracks `@script-meta` in script headers and updates `.run-log.json` |
| `scripts/tooling/audit-dependencies.ts` | Dependency and package-lock drift checks |
| `scripts/tooling/audit-typedoc-reference.ts` | TypeDoc and export doc compliance checks |
| `scripts/tooling/check-bundle-size.ts` | Bundle size regression gating |
| `scripts/tooling/create-session-pr.ts` | Branch, commit, and draft PR workflow helper |
| `scripts/tooling/diagnose-shell.ts` | Shell failure pattern extraction for session ritual |
| `scripts/tooling/mempalace-sync.ts` | MemPalace diagnostics and recovery flow |
| `scripts/tooling/organize-dev-tools.ts` | Tooling script relocation and reference migration helper |
| `scripts/tooling/purge-stale-branches.ts` | Local git branch hygiene utility |
| `scripts/tooling/scan-secrets.ts` | Secret/token scanning for modified and staged paths |
| `scripts/tooling/scan-temp-assets.ts` | Orphan and temporary asset scanner |
| `scripts/tooling/serialize-session-proof.ts` | Session proof output serializer into `.symphony/live-proof` |
| `scripts/tooling/track-turn-cost.ts` | Turn-level token and cost estimation |
| `scripts/tooling/validate-git-remote.ts` | Git remote and CI/PR consistency checks |
| `scripts/tooling/verify-ollama-router.ts` | Local Ollama model routing verification |

## Implemented state

- `scripts/tooling` contains 16 files and one registry/log JSON pair.
- `vite.config.ts` exposes:
  - `GET /api/script-registry` for merged registry + run-log data
  - `POST /api/script-touch` for branch-level freshness resets
- `misc/tooling.html` renders both the branch view and tooling card view from registry data.
- Some scripts declare workflow owners directly in file headers, mainly:
  - `verify.md` for quality checks,
  - `tidy-up.md` for maintenance loops,
  - `session-ritual.md` for ritual checks.

## Active task

| Field | Value |
|---|---|
| Task | ST-2: Decide whether to align script-tracker adoption for more tooling scripts. |
| Acceptance criteria | The docs record whether `trackRun()` adoption should expand or remain intentionally selective, and the gap file reflects that decision. |
| Allowed boundaries | `docs/projects/scripts-tooling/*` only. |
| Stop condition | Do not edit tooling code or add new script behavior. |
| Verification | Re-scan `scripts/tooling`, `script-tracker.ts`, and `.run-log.json` coverage, then record the decision in tracker/gaps. |
| Owner | Worker C |
| Next action | Re-read ST-2 evidence and confirm whether the folder is intentionally selective or under-tracked. |

## Scope boundaries

In scope:
- scripts/tooling intent and current integration contracts
- immediate workflow and UI contracts
- durable gaps for scripts tooling

Adjacent but not in scope:
- redesigning CI pipeline topology
- changing workflow policy language in external guides

Out of scope:
- adding new tooling scripts
- modifying script logic

## What must not be lost

- `script-registry.json`, `.run-log.json`, and the script-tracker update contract.
- `/api/script-registry` and `/api/script-touch` behavior in `vite.config.ts`.
- Tooling UI mapping and execution contract in `misc/tooling.html`.
- A short handoff chain: this file plus `TRACKER.md` and `GAPS.md`.

## Known gaps and follow-ups

- Gaps are registered in `docs/projects/scripts-tooling/GAPS.md` and should be reviewed at the next resume point.
- The shared-path workflow ambiguity is tracked centrally in `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`, not here.

## Evidence and proof

| Evidence | What it proves | Path |
|---|---|---|
| Registry API middleware | Run data and script buckets are served together | `vite.config.ts` |
| Tooling branch UI wiring | Registry is user-visible in dev tooling UI | `misc/tooling.html` |
| Script header ownership notes | Existing workflow intent is embedded in scripts | `scripts/tooling/*.ts` |
| Workflow references | Operational expectations for script invocation | `public/agent-docs/workflows/verify.md`, `public/agent-docs/workflows/tidy-up.md`, `public/agent-docs/workflows/session-ritual.md` |

## Artifact boundary

Keep durable intent, decisions, and gap entries. Keep runtime logs, caches, and raw session proof artifacts external unless summarized in a separate proof artifact.

## Resume path for a cold agent

1. Read this file.
2. Read `TRACKER.md`, then `GAPS.md`.
3. Recheck:
   - `scripts/tooling/`
   - `vite.config.ts`
   - `misc/tooling.html`
   - `public/agent-docs/workflows/{verify,tidy-up,session-ritual}.md`
4. Continue with the active tracker row or the oldest open gap.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
