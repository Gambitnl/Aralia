# NORTH_STAR: Scripts: Git

Status: active
Last updated: 2026-05-31

## Why This Project Exists

`scripts/git` owns local repository safety policy for Git pushes. It combines:

- Git safety checks (`sync-check`, `git:hygiene`, `intent-gate`)
- Local hook installation
- The tracked pre-push policy file used by local contributors

The project keeps a durable handoff map so future agents can continue policy-aware workflow work without losing intent.

## Intended Outcome

Provide a cold-start, implementation-ready map of `scripts/git` scope, file map, integration points, and next checks for local policy and CI-aligned push behavior.

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

Status remains partial with policy evidence in place and docs now brought to a usable
hand-off state:

- Registry row is present: `docs/projects/PROJECT_TRACKER.md` under Tools, Automation, and Infrastructure.
- Source evidence is present at `scripts/git` with all policy scripts and hook installer.
- Local policy path is documented and aligned with agent guidance (`docs/DEVELOPMENT_GUIDE.md`).
- This update clarifies boundaries and checks; no script behavior was changed.

## Active Task

| Field | Value |
|---|---|
| Task | Refresh docs for Scripts: Git to capture policy purpose, integrations, and next checks |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, `GAPS.md` describe file map, local hook flow, CI-local policy split, and unresolved follow-ups |
| Allowed boundaries | `docs/projects/scripts-git/*` only |
| Stop condition | Documentation reflects current behavior with no claim of code/CI changes |
| Verification | Confirm `scripts/git` file set exists and matches policy references in docs |
| Owner | Worker C |
| Next action | close tracker with docs-consistent status and keep gaps explicit |

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
| Is an explicit runbook file needed for scripts/git policy execution? | Operators currently rely on multiple docs and inline notes | Worker C | Next workflow update request |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/scripts-git/TRACKER.md`.
3. Read `docs/projects/scripts-git/GAPS.md`.
4. Confirm current policy files in `scripts/git` and matching package scripts in `package.json`.
5. Continue from: "update docs to include explicit runbook only if requested."
