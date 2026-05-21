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
- Setup PR: `https://github.com/Gambitnl/Aralia/pull/933` (merged
  2026-05-21)
- Package 2 clean-base draft: `draft-1779400428597-mind7o`
- Package 2 Linear issue:
  `https://linear.app/aralia/issue/ARA-7/spell-phase-1-package-2-premade-party-and-gear`
- Package 2 Jules session:
  `https://jules.google.com/session/15527431301408060204`

## Active Package Queue

| ID | Status | Owner | Task | Detail file | Current boundary |
|---|---|---|---|---|---|
| P0 | active | Codex foreman | Symphony finalization baseline: post-ARA-6 contract, stale-status cleanup, branch/worktree discipline, decision reporting, task evidence pathways, artifact lifecycle rules | `EARLY_GAME_SPELL_EXECUTION_PLAN.md`, `SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md` | Setup PR #933 landed; continue evidence updates during Package 2 |
| P1 | done | Codex foreman | Scoped baseline inventory for levels 0-3 | `SPELL_PHASE_1_BASELINE_REPORT.md` | Baseline report exists; use as context for later packages |
| P2 | waiting | Jules implementation, Codex foreman review | Premade level-1 party gear, combat readiness, and caster spellbook legality | `PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK.md`, `PACKAGE_2_PREMADE_PARTY_GEAR_JULES_PROMPT.md`, `PACKAGE_2_DISPATCH_READINESS_CHECKLIST.md`, `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md` | Jules session `15527431301408060204` had its visible plan approved through the dashboard-linked Jules page; dashboard refresh now reports `IN_PROGRESS` and no PR URL yet |
| P2D | active | Codex foreman | Dashboard-first hardening for Package 2 handoff monitoring | `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md`; Decisions 26-30 | Fix dashboard boundary selection, compact top chrome, keep visible action controls stable, surface completed-without-PR Jules sessions as inspectable blockers, and record the visible plan-approval recovery path |
| P3 | not_started | Jules preferred after P2 | Character creator spell selection and character sheet spellbook visibility | create `PACKAGE_3_*` docs when P2 review says ready | Waiting on P2 |
| P4 | not_started | Jules preferred after P3 | Combat simulator deterministic spell pilot | create `PACKAGE_4_*` docs after P3 | Waiting on P2/P3 |
| P5 | not_started | Jules preferred after P4 | AI arbitration pilot for open-ended spells | create `PACKAGE_5_*` docs after deterministic pilot | Waiting on P4 |
| P6 | not_started | Jules preferred after pilots | First mechanics bucket closure for levels 0-3 | create bucket-specific docs from current mechanics-discovery evidence | Waiting on pilot evidence |

## Current Setup And PR Tasks

| ID | Status | Task | Evidence | Next action |
|---|---|---|---|---|
| S1 | done | Land setup/context docs so Jules can read Package 2 context from the expected base branch | PR #933 merged as `40678de8` | Done |
| S2 | done | Repair clean-clone typecheck blocker from tracked markdown-library entry importing ignored DesignPreview local tool | Decision 22 in decision report; PR #933 Build green after `tsconfig.json` exclusion | Done |
| S3 | done | Rerun Symphony task queue/preflight from local `master` after setup context lands | `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md` | Clean preflight: local and remote `master` both `40678de8` |
| S4 | done | Dispatch Package 2 to Jules | `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md` | Jules session `15527431301408060204` launched and queued |
| S5 | done | Inspect completed Jules session result through dashboard-safe workflow | `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md` | Visible Jules session showed a plan-approval gate, not a usable completion result; plan was approved through the dashboard-linked Jules page |
| S6 | waiting | Monitor approved Package 2 Jules run through dashboard-safe workflow | `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md` | Current state `IN_PROGRESS`; use dashboard `Refresh Jules Status` until Jules returns a PR, blocker, or follow-up request |

## Adjacent Gap Log

Use this section for discoveries that matter, but are adjacent to the active
slice or outside its write scope. If a gap becomes active, promote it into the
package queue or a linked detailed task file.

| Gap ID | Status | Found during | Gap | Why adjacent/out of scope | Where to continue |
|---|---|---|---|---|---|
| G1 | done | PR #933 setup checks | Clean CI typecheck failed when tracked `src/md-library-entry.tsx` imported ignored `src/components/DesignPreview/` files | It blocked setup PR merge, but was not spell implementation work | Decision 22; PR #933 Build green |
| G2 | out_of_scope | Package 2 planning | Broad clean-clone typecheck health may include other ignored/local tool mismatches | Package 2 scoped Jules work only needs spell validation and combat utility tests; broad typecheck cleanup should stay separate unless it blocks setup PRs | Record future setup/CI task if more failures appear |
| G3 | not_started | Package 2 planning | Higher-level caster fixtures for level 2-3 spell testing need a roster design decision | Useful for Phase 1, but not part of the default level-1 party gear slice | Promote after P2 or during P3/P4 planning |
| G4 | done | Dashboard-first Package 2 monitoring | After Jules launch, receipt-doc edits made the dashboard worktree non-`master` and dirty, causing the global foreman boundary to show Git sync instead of the active Jules refresh boundary | This is a Symphony dashboard/workflow limitation exposed by the test flow, not spell implementation work | Decision 26; `conductor/symphony/src/server.ts` middleman path repair |
| G5 | done | Dashboard-first Package 2 monitoring | The dashboard first viewport spent too much space on run totals/control API links and showed raw ISO update timestamps with milliseconds | This is a dashboard usability issue exposed by human-style browser navigation, not spell implementation work | Decision 27; `conductor/symphony/public/dashboard.js`; `conductor/symphony/public/dashboard.css` |
| G6 | done | Dashboard-first Package 2 monitoring | A live dashboard refresh could replace the `Refresh Jules Status` button while the operator was trying to click it | This is a dashboard interaction stability issue exposed by human-style browser navigation, not spell implementation work | Decision 28; `conductor/symphony/public/dashboard.js`; `conductor/symphony/scripts/verify-dashboard-interaction-stability.mjs` |
| G7 | done | Dashboard-first Package 2 monitoring | Jules can report `COMPLETED` without a captured PR URL, while the in-app browser may still be blocked on Google sign-in before the result can be inspected | This is a Symphony/Jules visibility and filing blocker, not spell implementation work | Decision 29; `conductor/symphony/src/server.ts`; `conductor/symphony/scripts/verify-completed-jules-no-pr-boundary.mjs` |
| G8 | active | Dashboard-first Package 2 monitoring | The dashboard-linked Jules page can reveal a visible plan-approval gate even when Symphony's prior stored status said `COMPLETED` with no PR URL | This is a Symphony/Jules state reconciliation gap, not spell implementation work | Decision 30; keep refreshing through dashboard controls after any visible Jules action |

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
| `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md` | Clean-base Package 2 draft, Linear issue, handoff, manifest, and Jules launch receipt | active, Jules plan approved and run in progress |

## Update Rules

- Update this tracker before starting a new package.
- Update it after every package-level PR, merge, local sync, Jules dispatch,
  Jules result, foreman review, Atlas/gate checkpoint, or artifact filing
  decision.
- If a detailed package file contradicts this tracker, treat that as a tracking
  bug: reconcile the two instead of assuming either one is silently correct.
- Adjacent gaps should stay visible here until they are either promoted,
  rejected, accepted as future work, or linked to a more specific tracker.
