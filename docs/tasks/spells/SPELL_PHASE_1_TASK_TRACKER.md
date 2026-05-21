# Spell Phase 1 Task Tracker

Status: active guiding tracker for early-game spell execution.

This is the single task collection and status tracker for Spell Phase 1. It
does not replace detailed package docs, receipts, Atlas trackers, or PR notes.
It points to them, keeps the package queue coherent, and records adjacent gaps
that should not quietly expand the active slice.

## How To Use This File

1. Add new tasks here when mapping, implementation, review, or verification
   exposes them.
2. Keep each top-level task status current enough that a future foreman can see
   what is active, blocked, done, or out of scope.
3. Split complex work into package-specific or subsystem-specific task files
   when more detail is needed, then link those files from this tracker.
4. Record adjacent gaps here when they are discovered but do not belong in the
   active slice.
5. Do not delete completed task history unless the artifact lifecycle policy
   says the context has been preserved elsewhere.

Statuses:

- `not_started`: known but not active.
- `active`: current work is happening now.
- `blocked`: next action is known but blocked.
- `waiting`: external checks, Jules, PR review, deployment, or operator action.
- `done`: complete with proof linked.
- `superseded`: replaced by another task or policy.
- `out_of_scope`: recorded gap or task is intentionally outside Phase 1.

## Canonical References

- Plan: `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- Lifecycle policy:
  `docs/tasks/spells/SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md`
- Decision report:
  `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`
- Current setup PR: `https://github.com/Gambitnl/Aralia/pull/933`
- Package 2 draft: `draft-1779344522441-vdy0hi`

## Active Package Queue

| ID | Status | Owner | Task | Detail file | Current boundary |
|---|---|---|---|---|---|
| P0 | active | Codex foreman | Symphony finalization baseline: post-ARA-6 contract, stale-status cleanup, branch/worktree discipline, decision reporting, task evidence pathways, artifact lifecycle rules | `EARLY_GAME_SPELL_EXECUTION_PLAN.md`, `SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md` | PR #933 setup/context checks and merge path |
| P1 | done | Codex foreman | Scoped baseline inventory for levels 0-3 | `SPELL_PHASE_1_BASELINE_REPORT.md` | Baseline report exists; use as context for later packages |
| P2 | blocked | Jules implementation, Codex foreman review | Premade level-1 party gear, combat readiness, and caster spellbook legality | `PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK.md`, `PACKAGE_2_PREMADE_PARTY_GEAR_JULES_PROMPT.md`, `PACKAGE_2_DISPATCH_READINESS_CHECKLIST.md` | Blocked until setup context lands or is superseded, local `master` sync/preflight passes, and Jules dispatch is recorded |
| P3 | not_started | Jules preferred after P2 | Character creator spell selection and character sheet spellbook visibility | create `PACKAGE_3_*` docs when P2 review says ready | Waiting on P2 |
| P4 | not_started | Jules preferred after P3 | Combat simulator deterministic spell pilot | create `PACKAGE_4_*` docs after P3 | Waiting on P2/P3 |
| P5 | not_started | Jules preferred after P4 | AI arbitration pilot for open-ended spells | create `PACKAGE_5_*` docs after deterministic pilot | Waiting on P4 |
| P6 | not_started | Jules preferred after pilots | First mechanics bucket closure for levels 0-3 | create bucket-specific docs from current mechanics-discovery evidence | Waiting on pilot evidence |

## Current Setup And PR Tasks

| ID | Status | Task | Evidence | Next action |
|---|---|---|---|---|
| S1 | waiting | Land setup/context docs so Jules can read Package 2 context from the expected base branch | PR #933 | Resolve Build failure, merge/sync or record supersession |
| S2 | active | Repair clean-clone typecheck blocker from tracked markdown-library entry importing ignored DesignPreview local tool | Decision 22 in decision report; `tsconfig.json` excludes `src/md-library-entry.tsx` | Push repair and confirm Build reruns green |
| S3 | waiting | Rerun Symphony task queue/preflight for `draft-1779344522441-vdy0hi` from local `master` after setup context lands | `PACKAGE_2_SYMPHONY_DRAFT_SUBMISSION_RECEIPT.md` | Wait until PR #933 is resolved and local sync proof exists |
| S4 | not_started | Dispatch Package 2 to Jules | `PACKAGE_2_PREMADE_PARTY_GEAR_JULES_PROMPT.md` | Only after S3 passes |

## Adjacent Gap Log

Use this section for discoveries that matter, but are adjacent to the active
slice or outside its write scope. If a gap becomes active, promote it into the
package queue or a linked detailed task file.

| Gap ID | Status | Found during | Gap | Why adjacent/out of scope | Where to continue |
|---|---|---|---|---|---|
| G1 | active | PR #933 setup checks | Clean CI typecheck fails when tracked `src/md-library-entry.tsx` imports ignored `src/components/DesignPreview/` files | It blocks setup PR merge, but is not spell implementation work | Decision 22; `tsconfig.json` repair |
| G2 | out_of_scope | Package 2 planning | Broad clean-clone typecheck health may include other ignored/local tool mismatches | Package 2 scoped Jules work only needs spell validation and combat utility tests; broad typecheck cleanup should stay separate unless it blocks setup PRs | Record future setup/CI task if more failures appear |
| G3 | not_started | Package 2 planning | Higher-level caster fixtures for level 2-3 spell testing need a roster design decision | Useful for Phase 1, but not part of the default level-1 party gear slice | Promote after P2 or during P3/P4 planning |

## Detailed Task File Index

| File | Purpose | Status |
|---|---|---|
| `PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK.md` | Package 2 scope and acceptance criteria | active, blocked before Jules dispatch |
| `PACKAGE_2_PREMADE_PARTY_GEAR_JULES_PROMPT.md` | Exact Jules prompt for Package 2 | prompt-ready, not dispatched |
| `PACKAGE_2_DISPATCH_READINESS_CHECKLIST.md` | Handoff guard for Package 2 | active |
| `PACKAGE_2_ATLAS_GATE_CHECKPOINT_RECEIPT.md` | Package 2 Atlas/gate proof target | pending implementation |
| `PACKAGE_2_FOREMAN_REVIEW_RECEIPT.md` | Package 2 Codex review/failure classification target | pending implementation |
| `PACKAGE_2_TASK_COMMUNICATION_RECEIPT.md` | Package 2 task-scoped communication target | pending implementation |
| `PACKAGE_2_PR_DEPLOYMENT_LOCAL_SYNC_RECEIPT.md` | Package 2 PR/deployment/local-sync target | pending implementation |
| `SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md` | Retain/archive/delete policy for package artifacts | active |

## Update Rules

- Update this tracker before starting a new package.
- Update it after every package-level PR, merge, local sync, Jules dispatch,
  Jules result, foreman review, Atlas/gate checkpoint, or artifact filing
  decision.
- If a detailed package file contradicts this tracker, treat that as a tracking
  bug: reconcile the two instead of assuming either one is silently correct.
- Adjacent gaps should stay visible here until they are either promoted,
  rejected, accepted as future work, or linked to a more specific tracker.
