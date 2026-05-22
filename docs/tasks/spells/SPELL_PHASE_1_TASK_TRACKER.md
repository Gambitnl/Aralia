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
- Package 2 PR:
  `https://github.com/Gambitnl/Aralia/pull/935`

## Active Package Queue

| ID | Status | Owner | Task | Detail file | Current boundary |
|---|---|---|---|---|---|
| P0 | active | Codex foreman | Symphony finalization baseline: post-ARA-6 contract, stale-status cleanup, branch/worktree discipline, decision reporting, task evidence pathways, artifact lifecycle rules | `EARLY_GAME_SPELL_EXECUTION_PLAN.md`, `SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md` | Setup PR #933 landed; continue evidence updates during Package 2 |
| P1 | done | Codex foreman | Scoped baseline inventory for levels 0-3 | `SPELL_PHASE_1_BASELINE_REPORT.md` | Baseline report exists; use as context for later packages |
| P2 | active | Jules implementation, Codex foreman review | Premade level-1 party gear, combat readiness, and caster spellbook legality | `PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK.md`, `PACKAGE_2_PREMADE_PARTY_GEAR_JULES_PROMPT.md`, `PACKAGE_2_DISPATCH_READINESS_CHECKLIST.md`, `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md` | PR #935 is visible and mergeable; Scout/Core now reports no out-of-scope files after the expected-file glob repair; scoped local verification passed; broad GitHub test job is failing in unrelated `handleMovement` seasonal test and needs Scout/Core disposition before merge |
| P2D | active | Codex foreman | Dashboard-first hardening for Package 2 handoff monitoring | `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md`; Decisions 26-35 | Task detail now has a visible safe PR-refresh button, Scout/Core honors Package 2 write-scope globs, operator decisions have a visible no-typing receipt button, the selected setup-repair lane can create a local draft visibly, and the global dashboard boundary now points at PR review after a PR exists; task-note entry still fails from the in-app browser clipboard/input surface, so keep recording durable evidence here until the dashboard has a robust note path |
| P2R | active | Codex foreman, Jules preferred after filing | Workflow-config repair lane for PR #935 failed `review / review` automation | local draft `draft-1779410025252-nnowpt` (`Setup repair for ARA-7`) | Created through the visible Package 2 task page after the recorded `create_setup_repair_task` answer; currently `blocked_by_git_sync` until these Symphony dashboard fixes are filed and the draft can pass normal dashboard gates |
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
| S6 | done | Monitor approved Package 2 Jules run through dashboard-safe workflow | `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md` | Dashboard captured PR #935 and current boundary moved to `Bridge Through Scout/Core` |
| S7 | active | Review Package 2 PR #935 before Scout/Core merge path | `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md`, `PACKAGE_2_FOREMAN_REVIEW_RECEIPT.md` | Scoped local verification passed; task-page safe refresh loaded current checks; Scout/Core file risk is now `medium` because of large diff only, with `outOfScopeFiles: []`; GitHub build/lint/security checks pass; broad test job fails in unrelated movement test; Gemini review job fails from missing `gemini-1.5-flash`; classify and decide whether to request Jules follow-up, fix ambient CI separately, or proceed through documented guarded PR path |

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
| G8 | done | Dashboard-first Package 2 monitoring | The dashboard-linked Jules page can reveal a visible plan-approval gate even when Symphony's prior stored status said `COMPLETED` with no PR URL | This was a Symphony/Jules state reconciliation gap, not spell implementation work | Decision 30; dashboard refresh after approval eventually captured PR #935 |
| G9 | active | Visible Jules Package 2 monitoring | The Jules working tree showed helper/scratch files and generated/audit surfaces outside declared write scope while work was in progress; PR #935 file list does not include those helper files, but three premade JSON files still carry large formatting churn | Helper files were transient at PR-file-list level; formatting churn remains a review concern because it makes human review harder even when semantic JSON changes are narrow | PR #935 semantic diff: gear additions, a few armor-class changes, and two prepared-spell trims; decide during Scout/Core review whether to accept formatting churn or request a narrower JSON rewrite |
| G10 | active | PR #935 CI review | GitHub broad test job fails in `src/hooks/actions/__tests__/handleMovement.test.ts`, expecting winter travel time `2700` but receiving `8100`; focused movement test passes locally on both PR #935 checkout and the foreman checkout | The failing file is outside Package 2's write scope and not touched by PR #935, so this looks like ambient full-suite order/environment behavior rather than a Jules implementation defect | Classify before merge: either document as ambient CI blocker, repair separately, or rerun after any known test-isolation fix |
| G11 | active | Dashboard task-page note attempt | The visible task message form could not be filled from Codex because the in-app browser reported that its virtual clipboard is not installed | This is a dashboard/workflow evidence-path limitation, not spell implementation work; using a hidden task-message endpoint would bypass the dashboard-first test | Keep durable notes in this tracker/receipt; add a robust visible note-entry fallback or dashboard-side action later |
| G12 | done | Package 2 task-page Scout/Core bridge | The task page listed a safe `POST /refresh-pr` endpoint as raw text under guarded actions, but did not provide a visible control to run that non-mutating refresh | This was a Symphony dashboard affordance gap exposed by dashboard-first PR review, not Package 2 spell implementation work | Decision 31; `conductor/symphony/src/server.ts`; `conductor/symphony/scripts/verify-task-detail-page.mjs`; live task page now has `Run Safe Symphony Refresh` |
| G13 | done | Package 2 Scout/Core scope review | Scout/Core treated Package 2 expected-file globs as literal paths and falsely reported the premade JSON and combat test files as out of scope | This was a Symphony evidence-classification bug; the PR file list itself remained inside the declared write scope | Decision 32; `conductor/symphony/src/task-intake.ts`; `conductor/symphony/scripts/verify-pr-scope-risk.mjs`; live evidence now reports `outOfScopeFiles: []` |
| G14 | done | Package 2 operator-answer path | The visible operator-answer form required typed text, but the in-app browser cannot reliably fill that text box because its virtual clipboard path is unavailable | This is a Symphony dashboard workflow limitation; using the hidden operator-answer endpoint would bypass the dashboard-first test | Decision 33; `conductor/symphony/src/server.ts`; `conductor/symphony/scripts/verify-task-detail-page.mjs`; live task page recorded `create_setup_repair_task` through `Record Selected Decision` |
| G15 | done | Package 2 selected repair-lane routing | After `create_setup_repair_task` was recorded, the task page still showed PR refresh/Jules feedback instead of the executable local setup-repair draft lane | This was a Symphony workflow-routing gap; the selected decision was recorded but not surfaced as the next visible dashboard action | Decision 34; `conductor/symphony/src/server.ts`; live task page created `draft-1779410025252-nnowpt` through `Create Local Repair Draft` |
| G16 | done | Main dashboard boundary after PR capture | The global `Current Foreman Boundary` still showed `Jules session` / `Refresh Jules Status` after Package 2 had captured PR #935 and recorded the setup-repair lane | This was a dashboard routing bug; completed Jules session receipts should not mask the PR/check boundary once a PR exists | Decision 35; `conductor/symphony/src/server.ts`; `conductor/symphony/public/dashboard.js`; live dashboard now shows `GitHub PR` and `Needs input: 0` |

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
| `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md` | Clean-base Package 2 draft, Linear issue, handoff, manifest, Jules launch, PR #935, and scoped verification receipt | active, PR review in progress |

## Update Rules

- Update this tracker before starting a new package.
- Update it after every package-level PR, merge, local sync, Jules dispatch,
  Jules result, foreman review, Atlas/gate checkpoint, or artifact filing
  decision.
- If a detailed package file contradicts this tracker, treat that as a tracking
  bug: reconcile the two instead of assuming either one is silently correct.
- Adjacent gaps should stay visible here until they are either promoted,
  rejected, accepted as future work, or linked to a more specific tracker.
