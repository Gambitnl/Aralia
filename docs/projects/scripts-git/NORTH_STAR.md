---
schema_version: 1
project: Scripts: Git
slug: scripts-git
category: Tools, Automation, and Infrastructure
main_category: "Tools, Docs & Agents"
subcategory: "Scripts & Automation"
status: partial
last_updated: 2026-06-12
iteration: 2
confidence: medium
evidence: docs/projects/scripts-git
gap_signal: 2 open gaps, 1 in-scope and 1 follow-up
protocol: living project doc set
next_step: Pick G1 and define the smallest believable verification path for hook-policy behavior.
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
# NORTHSTAR: Scripts: Git

Status: active
Last updated: 2026-06-12

## Why This Project Exists

`scripts/git` owns local repository safety policy for Git pushes. It combines:

- Git safety checks (`sync-check`, `git:hygiene`, `intent-gate`)
- Local hook installation
- The tracked pre-push policy file used by local contributors

The project keeps a durable handoff map so future agents can continue policy-aware workflow work without losing intent.

## Intended Outcome

Provide a cold-start, implementation-ready map of `scripts/git` scope, file map, integration points, and next checks for local policy and CI-aligned push behavior.

## Dashboard Card Schema

Project: Scripts: Git
Slug: scripts-git
Category: Tools, Automation, and Infrastructure
Status: partial
Confidence: medium
Evidence: docs/projects/scripts-git
Gap signal: 2 open gaps, 1 in-scope and 1 follow-up
Protocol: living project doc set
Next step: Pick G1 and define the smallest believable verification path for hook-policy behavior.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## File Map

- `scripts/git/pre-push-aralia.sh` - tracked push policy script
- `scripts/git/sync-check.cjs` - fast sync blocker checks for ordinary push
- `scripts/git/git-hygiene-check.cjs` - local branch/worktree shape checks
- `scripts/git/intent-gate-check.cjs` - local intent approval gate
- `scripts/git/install-pre-push-hook.cjs` - installs `.git/hooks/pre-push` delegator
- `package.json` scripts:
  - `sync-check`
  - `git:hygiene`
  - `intent-gate`
  - `hooks:install`
  - `quality:debt`
  - `quality:debt:strict`

## Current State

Status remains partial with policy evidence in place and the docs refreshed for a
clean cold-start handoff:

- Registry row is present: `docs/projects/PROJECT_TRACKER.md` under Tools, Automation, and Infrastructure.
- Source evidence is present at `scripts/git` with all policy scripts and hook installer.
- Local policy path is documented and aligned with agent guidance (`docs/DEVELOPMENT_GUIDE.md`).
- This pass added the dashboard schema, compacted the tracker and gap notes, and kept the implementation surface unchanged.
- The next meaningful slice is G1: define the smallest believable verification path for the hook-policy scripts.

## Active Task

| Field | Value |
|---|---|
| Task | Define the narrow verification path for `scripts/git` hook-policy behavior |
| Acceptance criteria | G1 is reduced to a concrete verification checklist or test plan and the docs point at the next proof source |
| Allowed boundaries | `docs/projects/scripts-git/*` only |
| Stop condition | A future agent can resume the verification work without guessing which check comes next |
| Verification | `git diff --check` plus the verification source named by the chosen follow-up |
| Owner | Worker C |
| Next action | Decide whether the next slice is a doc-only runbook or a small script test |

## Scope Boundaries

In scope:
- Purpose, policy flow, and verification checkpoints for scripts/git.
- Integration notes for package scripts, hook installation, and local CI expectations.
- Gap capture for docs/reliability uncertainties tied to this project.

Adjacent but not in scope:
- Changing scripts behavior in `scripts/git`.
- Editing `.github/workflows/*` from this pass.

Out of scope:
- Updating project registry rows or adding cross-project infrastructure not already present.

## What Must Not Be Lost

- Gate order in `scripts/git/pre-push-aralia.sh`.
- The local/explicit-intent split: `sync-check` + `git:hygiene` + `intent-gate` are blocking by default.
- Optional strict mode (`ARALIA_PRE_PUSH_STRICT=1`) intentionally does not replace everyday local policy.
- Hook installation must remain a delegator, with logic kept in tracked files.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next action |
|---|---|---|---|---|
| No local automated tests for hook-policy scripts | adjacent_follow_up | Worker C | `scripts/git/*.cjs`, `scripts/git/*.sh` | add a narrow test plan and route if this project is expanded into implementation |
| CI policy currently documented but not fully mirrored in scripts-git docs to a runbook format | out_of_scope | Worker C | `docs/DEVELOPMENT_GUIDE.md`, `.github/workflows/ci.yml` | keep as docs follow-up when policy ownership changes |

## Global Gap Imports

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| none | no | none | no global gap mapped to scripts-git in this refresh |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| Policy script set | Push gates and installer are implemented | `scripts/git/pre-push-aralia.sh`, `scripts/git/git-hygiene-check.cjs`, `scripts/git/sync-check.cjs`, `scripts/git/intent-gate-check.cjs`, `scripts/git/install-pre-push-hook.cjs` |
| Script wiring | Policy entry points are discoverable | `package.json` scripts section |
| Local hook policy docs | Local policy behavior is externally documented | `docs/DEVELOPMENT_GUIDE.md` |
| CI policy evidence | Local policy is local-only and does not replace PR gating | `.github/workflows/ci.yml` |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Registry anchor and scope ownership | active |
| `docs/projects/GLOBAL_GAPS.md` | Cross-project gap routing | active |
| `docs/projects/scripts-git/TRACKER.md` | Operational status and next action | active |
| `docs/projects/scripts-git/GAPS.md` | Durable gaps and follow-ups | active |

## Artifact Boundary

Track durable intent, scope, and next checks in this folder. Keep local bypass
incident notes, hook-run logs, local CI output, and temporary environment
diagnostics outside durable docs.

## Open Questions

| Question | Why it matters | Owner | Needed by |
|---|---|---|---|
| Is an explicit runbook file needed for scripts/git policy execution, or is the current tracker plus handoff enough? | Operators currently rely on multiple docs and inline notes | Worker C | Next workflow update request |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/scripts-git/TRACKER.md`.
3. Read `docs/projects/scripts-git/GAPS.md`.
4. Choose G1 first unless the owner explicitly wants the runbook follow-up instead.
5. Continue from: "define the narrow verification path for `scripts/git` hook-policy behavior."


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count

## Required Review Brief

Title: Scripts: Git partial due to hook-policy verification gap
Question: What is the smallest believable verification path for git hook policy behavior?
Issue: The project has an in-scope gap for end-to-end hook script behavior and a follow-up runbook gap.
Current behavior: GAPS.md marks G1 not_started/in_scope_now and G2 as an adjacent runbook follow-up.
Why blocked: Without a reproducible proof path, hook policy can drift while still appearing documented.
Option A: Add a narrow verification checklist or test for hook behavior.
Option B: Create the runbook first if operator execution is currently the failure point.
Evidence: NORTH_STAR.md next_step; GAPS.md G1 and G2.
Decision owner: Scripts/Git tooling owner
Proof after decision: A documented sample run covers sync-check, git:hygiene, and intent-gate expectations.
